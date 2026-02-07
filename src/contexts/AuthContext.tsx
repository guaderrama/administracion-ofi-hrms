// AuthContext - Contexto de autenticación Firebase con roles
// Provee estado de autenticación y rol del usuario a toda la app

import React, { createContext, useContext, useState, useEffect, useRef, useCallback, ReactNode } from 'react';
import {
  User,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  UserCredential
} from 'firebase/auth';
import { doc, getDoc, setDoc, collection, getDocs } from 'firebase/firestore';
import { auth, db } from '../firebaseConfig';

// Tipos de roles
export type UserRole = 'admin' | 'employee';

// Datos del usuario en Firestore
export interface UserData {
  uid: string;
  email: string;
  role: UserRole;
  displayName?: string;
  createdAt: Date;
}

// Tipos para el contexto
interface AuthContextType {
  user: User | null;
  userData: UserData | null;
  loading: boolean;
  error: string | null;
  isAdmin: boolean;
  login: (email: string, password: string) => Promise<UserCredential>;
  register: (email: string, password: string) => Promise<UserCredential>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
}

// Valor inicial del contexto
const AuthContext = createContext<AuthContextType>({
  user: null,
  userData: null,
  loading: true,
  error: null,
  isAdmin: false,
  login: async () => { throw new Error('AuthProvider not initialized'); },
  register: async () => { throw new Error('AuthProvider not initialized'); },
  logout: async () => { throw new Error('AuthProvider not initialized'); },
  resetPassword: async () => { throw new Error('AuthProvider not initialized'); },
});

// Hook para usar el contexto de autenticación
export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

// Props del provider
interface AuthProviderProps {
  children: ReactNode;
}

// Provider de autenticación
export function AuthProvider({ children }: AuthProviderProps): React.ReactElement {
  const [user, setUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Función para obtener datos del usuario de Firestore
  const fetchUserData = async (uid: string): Promise<UserData | null> => {
    try {
      const userDoc = await getDoc(doc(db, 'users', uid));
      if (userDoc.exists()) {
        return userDoc.data() as UserData;
      }
      return null;
    } catch (err) {
      console.error('Error fetching user data:', err);
      return null;
    }
  };

  // Función para crear usuario en Firestore
  const createUserData = async (user: User, role: UserRole): Promise<UserData> => {
    const newUserData: UserData = {
      uid: user.uid,
      email: user.email || '',
      role: role,
      displayName: user.displayName || user.email?.split('@')[0] || '',
      createdAt: new Date(),
    };

    await setDoc(doc(db, 'users', user.uid), newUserData);
    return newUserData;
  };

  // Verificar si es el primer usuario (será admin)
  const checkIfFirstUser = async (): Promise<boolean> => {
    try {
      const usersSnapshot = await getDocs(collection(db, 'users'));
      return usersSnapshot.empty;
    } catch (err) {
      console.error('Error checking first user:', err);
      return false;
    }
  };

  // Escuchar cambios en el estado de autenticación
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);

      if (currentUser) {
        // Obtener datos del usuario de Firestore
        const data = await fetchUserData(currentUser.uid);
        setUserData(data);
      } else {
        setUserData(null);
      }

      setLoading(false);
    }, (err) => {
      console.error('Auth state change error:', err);
      setError(err.message);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Auto-logout por inactividad (10 minutos)
  const INACTIVITY_TIMEOUT = 10 * 60 * 1000; // 10 minutos en ms
  const inactivityTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resetInactivityTimer = useCallback(() => {
    if (inactivityTimer.current) {
      clearTimeout(inactivityTimer.current);
    }
    // Solo iniciar timer si hay usuario autenticado
    if (user) {
      inactivityTimer.current = setTimeout(() => {
        console.log('Sesión cerrada por inactividad (10 minutos)');
        signOut(auth);
      }, INACTIVITY_TIMEOUT);
    }
  }, [user]);

  useEffect(() => {
    if (!user) {
      if (inactivityTimer.current) {
        clearTimeout(inactivityTimer.current);
      }
      return;
    }

    const events = ['mousedown', 'keydown', 'scroll', 'touchstart'];
    events.forEach(event => window.addEventListener(event, resetInactivityTimer));

    // Iniciar timer al montar
    resetInactivityTimer();

    return () => {
      events.forEach(event => window.removeEventListener(event, resetInactivityTimer));
      if (inactivityTimer.current) {
        clearTimeout(inactivityTimer.current);
      }
    };
  }, [user, resetInactivityTimer]);

  // Función de login
  const login = async (email: string, password: string): Promise<UserCredential> => {
    setError(null);
    try {
      const result = await signInWithEmailAndPassword(auth, email, password);
      // Obtener datos del usuario después del login
      let data = await fetchUserData(result.user.uid);

      // Si el usuario existe en Auth pero no en Firestore, crear documento
      if (!data) {
        const isFirst = await checkIfFirstUser();
        const role: UserRole = isFirst ? 'admin' : 'employee';
        data = await createUserData(result.user, role);
      }

      setUserData(data);
      return result;
    } catch (err: any) {
      setError(err.message);
      throw err;
    }
  };

  // Función de registro
  const register = async (email: string, password: string): Promise<UserCredential> => {
    setError(null);
    try {
      const result = await createUserWithEmailAndPassword(auth, email, password);

      // Verificar si es el primer usuario
      const isFirst = await checkIfFirstUser();
      const role: UserRole = isFirst ? 'admin' : 'employee';

      // Crear datos del usuario en Firestore
      const newUserData = await createUserData(result.user, role);
      setUserData(newUserData);

      return result;
    } catch (err: any) {
      setError(err.message);
      throw err;
    }
  };

  // Función de restablecimiento de contraseña
  const resetPassword = async (email: string): Promise<void> => {
    setError(null);
    try {
      await sendPasswordResetEmail(auth, email);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error al enviar email';
      setError(message);
      throw err;
    }
  };

  // Función de logout
  const logout = async (): Promise<void> => {
    setError(null);
    try {
      await signOut(auth);
      setUserData(null);
    } catch (err: any) {
      setError(err.message);
      throw err;
    }
  };

  // Valor del contexto
  const value: AuthContextType = {
    user,
    userData,
    loading,
    error,
    isAdmin: userData?.role === 'admin',
    login,
    register,
    logout,
    resetPassword,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}
