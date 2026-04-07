import React, { useState, useEffect, useMemo } from 'react';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, sendPasswordResetEmail } from 'firebase/auth';
import { secondaryAuth } from '../src/firebaseConfig';
import { usersService, employeesService, type SystemUser } from '../src/services/firestoreService';
import type { DetailedEmployee } from '../types';
import { useAuth } from '../src/contexts/AuthContext';
import { useToast } from './ui/Toast';
import { ConfirmDialog } from './ui/ConfirmDialog';
import { AccessDenied } from './ui/AccessDenied';

interface UserManagementPageProps {
  setView: (view: string) => void;
}

export const UserManagementPage: React.FC<UserManagementPageProps> = ({ setView }) => {
  const { isAdmin, user } = useAuth();
  const toast = useToast();

  const [users, setUsers] = useState<SystemUser[]>([]);
  const [employees, setEmployees] = useState<DetailedEmployee[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    displayName: '',
    role: 'employee' as 'admin' | 'supervisor' | 'employee',
  });
  const [creating, setCreating] = useState(false);
  const [recoveryEmail, setRecoveryEmail] = useState<string | null>(null);

  // Confirm dialog state
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    variant: 'danger' | 'warning' | 'info';
    onConfirm: () => void;
  }>({ isOpen: false, title: '', message: '', variant: 'warning', onConfirm: () => {} });

  // Subscribe to users and employees
  useEffect(() => {
    const unsubUsers = usersService.subscribe((data) => {
      setUsers(data);
      setLoading(false);
    });
    const unsubEmployees = employeesService.subscribe((data) => {
      setEmployees(data);
    });
    return () => { unsubUsers(); unsubEmployees(); };
  }, []);

  // Find associated employee for a user
  const findEmployee = (userEmail: string): DetailedEmployee | undefined => {
    return employees.find(emp => emp.email === userEmail);
  };

  // Filtered users
  const filteredUsers = useMemo(() => {
    if (!searchTerm) return users;
    const term = searchTerm.toLowerCase();
    return users.filter(u =>
      u.email.toLowerCase().includes(term) ||
      (u.displayName || '').toLowerCase().includes(term) ||
      u.role.toLowerCase().includes(term)
    );
  }, [users, searchTerm]);

  // Create new user
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.email || !formData.password) {
      toast.warning('Email y contrasena son obligatorios.');
      return;
    }
    if (formData.password.length < 6) {
      toast.warning('La contrasena debe tener al menos 6 caracteres.');
      return;
    }

    setCreating(true);
    try {
      // Crear usuario con la instancia secundaria (no deslogea al admin)
      const userCredential = await createUserWithEmailAndPassword(
        secondaryAuth,
        formData.email,
        formData.password
      );

      // Cerrar sesion en la app secundaria inmediatamente
      await signOut(secondaryAuth);

      // Crear documento en Firestore
      await usersService.create(userCredential.user.uid, {
        email: formData.email,
        role: formData.role,
        displayName: formData.displayName || formData.email.split('@')[0],
        createdAt: new Date(),
      });

      // Si hay un empleado con ese email, vincular firebaseUid
      const matchingEmployee = employees.find(emp => emp.email === formData.email);
      if (matchingEmployee) {
        await employeesService.update(matchingEmployee.id, {
          firebaseUid: userCredential.user.uid,
        });
        toast.success(`Usuario creado y vinculado con ${matchingEmployee.nombres} ${matchingEmployee.paterno}.`);
      } else {
        toast.success(`Usuario "${formData.email}" creado como ${formData.role === 'admin' ? 'Administrador' : 'Colaborador'}.`);
      }

      // Reset form
      setFormData({ email: '', password: '', displayName: '', role: 'employee' });
      setShowForm(false);
    } catch (error: any) {
      if (error.code === 'auth/email-already-in-use') {
        // El email existe en Firebase Auth pero puede no estar en Firestore
        // Intentar recuperar el UID iniciando sesion con las credenciales proporcionadas
        try {
          const recovered = await signInWithEmailAndPassword(
            secondaryAuth,
            formData.email,
            formData.password
          );
          await signOut(secondaryAuth);

          // Verificar si ya existe en Firestore
          const existingUser = users.find(u => u.uid === recovered.user.uid);
          if (existingUser) {
            toast.error('Este usuario ya existe en el sistema.');
          } else {
            // Crear documento en Firestore con el UID recuperado
            await usersService.create(recovered.user.uid, {
              email: formData.email,
              role: formData.role,
              displayName: formData.displayName || formData.email.split('@')[0],
              createdAt: new Date(),
            });

            const matchingEmployee = employees.find(emp => emp.email === formData.email);
            if (matchingEmployee) {
              await employeesService.update(matchingEmployee.id, {
                firebaseUid: recovered.user.uid,
              });
              toast.success(`Usuario recuperado y vinculado con ${matchingEmployee.nombres} ${matchingEmployee.paterno}.`);
            } else {
              toast.success(`Usuario "${formData.email}" recuperado y registrado como ${roleNames[formData.role]}.`);
            }
            setFormData({ email: '', password: '', displayName: '', role: 'employee' });
            setShowForm(false);
            setRecoveryEmail(null);
          }
        } catch (recoverError: any) {
          if (recoverError.code === 'auth/wrong-password' || recoverError.code === 'auth/invalid-credential') {
            // Contrasena no coincide - ofrecer resetear contrasena
            setRecoveryEmail(formData.email);
            toast.warning('La contrasena no coincide. Puedes enviar un correo para restablecer la contrasena.');
          } else {
            toast.error('Este email ya esta registrado en el sistema.');
          }
        }
      } else if (error.code === 'auth/invalid-email') {
        toast.error('El formato del email no es valido.');
      } else if (error.code === 'auth/weak-password') {
        toast.error('La contrasena es muy debil. Usa minimo 6 caracteres.');
      } else {
        toast.error(`Error al crear usuario: ${error.message}`);
      }
    } finally {
      setCreating(false);
    }
  };

  // Role display names
  const roleNames: Record<string, string> = {
    admin: 'Administrador (acceso total)',
    supervisor: 'Supervisor (solo lectura)',
    employee: 'Colaborador (acceso limitado)',
  };

  // Change user role
  const handleRoleChange = (targetUser: SystemUser, newRole: 'admin' | 'supervisor' | 'employee') => {
    if (targetUser.uid === user?.uid) {
      toast.warning('No puedes cambiar tu propio rol.');
      return;
    }

    setConfirmDialog({
      isOpen: true,
      title: 'Cambiar Rol de Usuario',
      message: `Cambiar el rol de "${targetUser.displayName || targetUser.email}" a ${roleNames[newRole]}?`,
      variant: newRole === 'admin' ? 'warning' : 'info',
      onConfirm: async () => {
        try {
          await usersService.updateRole(targetUser.uid, newRole);
          toast.success(`Rol actualizado a ${roleNames[newRole]}.`);
        } catch {
          toast.error('Error al actualizar el rol.');
        }
        setConfirmDialog(prev => ({ ...prev, isOpen: false }));
      },
    });
  };

  // Delete user (Firestore only - Firebase Auth deletion requires Admin SDK)
  const handleDeleteUser = (targetUser: SystemUser) => {
    if (targetUser.uid === user?.uid) {
      toast.warning('No puedes eliminar tu propia cuenta.');
      return;
    }

    setConfirmDialog({
      isOpen: true,
      title: 'Eliminar Usuario',
      message: `Eliminar a "${targetUser.displayName || targetUser.email}" del sistema? El usuario perdera acceso al portal.`,
      variant: 'danger',
      onConfirm: async () => {
        try {
          await usersService.delete(targetUser.uid);
          toast.success('Usuario eliminado del sistema.');
        } catch {
          toast.error('Error al eliminar usuario.');
        }
        setConfirmDialog(prev => ({ ...prev, isOpen: false }));
      },
    });
  };

  if (!isAdmin) {
    return <AccessDenied message="No tienes permisos para acceder a esta seccion." onBack={() => setView('dashboard')} />;
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Gestion de Usuarios</h1>
          <p className="text-sm text-slate-500 mt-1">
            Administra el acceso al portal y asigna roles a los usuarios.
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white font-medium rounded-lg shadow-sm transition-all active:scale-[0.98]"
        >
          {showForm ? (
            <>
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
              Cancelar
            </>
          ) : (
            <>
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Nuevo Usuario
            </>
          )}
        </button>
      </div>

      {/* Create User Form */}
      {showForm && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 mb-6 animate-fade-in-down">
          <h2 className="text-lg font-semibold text-slate-800 mb-4">Crear Nuevo Usuario</h2>
          <form onSubmit={handleCreateUser} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Email *</label>
              <input
                type="email"
                required
                value={formData.email}
                onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none transition-shadow"
                placeholder="usuario@empresa.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Contrasena *</label>
              <input
                type="text"
                required
                minLength={6}
                value={formData.password}
                onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none transition-shadow"
                placeholder="Min. 6 caracteres"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Nombre (opcional)</label>
              <input
                type="text"
                value={formData.displayName}
                onChange={(e) => setFormData(prev => ({ ...prev, displayName: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none transition-shadow"
                placeholder="Nombre del usuario"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Rol de Acceso *</label>
              <select
                value={formData.role}
                onChange={(e) => setFormData(prev => ({ ...prev, role: e.target.value as 'admin' | 'supervisor' | 'employee' }))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none transition-shadow bg-white"
              >
                <option value="employee">Colaborador (acceso limitado)</option>
                <option value="supervisor">Supervisor (solo lectura, ve todo)</option>
                <option value="admin">Administrador (acceso total)</option>
              </select>
            </div>
            <div className="sm:col-span-2 lg:col-span-4 flex items-center gap-3">
              <button
                type="submit"
                disabled={creating}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 text-white font-medium rounded-lg shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]"
              >
                {creating ? (
                  <>
                    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Creando...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    Crear Usuario
                  </>
                )}
              </button>
              <div className="text-xs text-slate-500">
                <strong>Admin:</strong> Acceso total.
                <strong className="ml-2">Supervisor:</strong> Ve todo, no edita.
                <strong className="ml-2">Colaborador:</strong> Solo dashboard, checador y RH.
              </div>
            </div>
          </form>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-2xl font-bold text-slate-800">{users.length}</p>
          <p className="text-xs text-slate-500">Total Usuarios</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-2xl font-bold text-amber-600">{users.filter(u => u.role === 'admin').length}</p>
          <p className="text-xs text-slate-500">Administradores</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-2xl font-bold text-purple-600">{users.filter(u => u.role === 'supervisor').length}</p>
          <p className="text-xs text-slate-500">Supervisores</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-2xl font-bold text-blue-600">{users.filter(u => u.role === 'employee').length}</p>
          <p className="text-xs text-slate-500">Colaboradores</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-2xl font-bold text-green-600">{employees.length}</p>
          <p className="text-xs text-slate-500">Empleados Registrados</p>
        </div>
      </div>

      {/* Search */}
      <div className="mb-4">
        <div className="relative max-w-md">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por email, nombre o rol..."
            className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none transition-shadow"
          />
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Usuario</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Rol</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden md:table-cell">Colaborador Asociado</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden lg:table-cell">Departamento</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-slate-400">
                    <svg className="animate-spin w-6 h-6 mx-auto mb-2 text-amber-500" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Cargando usuarios...
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-slate-400">
                    {searchTerm ? 'No se encontraron usuarios con ese criterio.' : 'No hay usuarios registrados.'}
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => {
                  const emp = findEmployee(u.email);
                  const isCurrentUser = u.uid === user?.uid;

                  return (
                    <tr key={u.uid} className={`hover:bg-slate-50/50 transition-colors ${isCurrentUser ? 'bg-amber-50/30' : ''}`}>
                      {/* User Info */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0 ${
                            u.role === 'admin' ? 'bg-gradient-to-br from-amber-500 to-orange-600'
                              : u.role === 'supervisor' ? 'bg-gradient-to-br from-purple-500 to-violet-600'
                              : 'bg-gradient-to-br from-blue-500 to-indigo-600'
                          }`}>
                            {(u.displayName || u.email)[0].toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-slate-800 truncate">
                              {u.displayName || u.email.split('@')[0]}
                              {isCurrentUser && (
                                <span className="ml-1.5 text-[10px] font-semibold text-amber-600 bg-amber-100 px-1.5 py-0.5 rounded-full">TU</span>
                              )}
                            </p>
                            <p className="text-xs text-slate-400 truncate">{u.email}</p>
                          </div>
                        </div>
                      </td>

                      {/* Role Badge */}
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${
                          u.role === 'admin'
                            ? 'bg-amber-100 text-amber-800 border border-amber-200'
                            : u.role === 'supervisor'
                              ? 'bg-purple-100 text-purple-800 border border-purple-200'
                              : 'bg-blue-100 text-blue-800 border border-blue-200'
                        }`}>
                          {u.role === 'admin' ? (
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.286z" />
                            </svg>
                          ) : u.role === 'supervisor' ? (
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                          ) : (
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0" />
                            </svg>
                          )}
                          {u.role === 'admin' ? 'Administrador' : u.role === 'supervisor' ? 'Supervisor' : 'Colaborador'}
                        </span>
                      </td>

                      {/* Associated Employee */}
                      <td className="px-4 py-3 hidden md:table-cell">
                        {emp ? (
                          <div>
                            <p className="text-sm text-slate-700">{emp.nombres} {emp.paterno} {emp.materno}</p>
                            <p className="text-xs text-slate-400">{emp.puesto}</p>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400 italic">Sin vincular</span>
                        )}
                      </td>

                      {/* Department */}
                      <td className="px-4 py-3 hidden lg:table-cell">
                        {emp ? (
                          <span className="text-xs text-slate-600 bg-slate-100 px-2 py-1 rounded">{emp.departamento}</span>
                        ) : (
                          <span className="text-xs text-slate-300">-</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          {/* Role Select */}
                          {!isCurrentUser && (
                            <select
                              value={u.role}
                              onChange={(e) => handleRoleChange(u, e.target.value as 'admin' | 'supervisor' | 'employee')}
                              className={`text-xs font-medium px-2 py-1.5 rounded-lg transition-all border cursor-pointer outline-none ${
                                u.role === 'admin'
                                  ? 'bg-amber-50 text-amber-700 border-amber-200'
                                  : u.role === 'supervisor'
                                    ? 'bg-purple-50 text-purple-700 border-purple-200'
                                    : 'bg-blue-50 text-blue-700 border-blue-200'
                              }`}
                            >
                              <option value="employee">Colaborador</option>
                              <option value="supervisor">Supervisor</option>
                              <option value="admin">Administrador</option>
                            </select>
                          )}

                          {/* Delete */}
                          {!isCurrentUser && (
                            <button
                              onClick={() => handleDeleteUser(u)}
                              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title="Eliminar usuario"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                              </svg>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer info */}
        <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 text-xs text-slate-500">
          {filteredUsers.length} usuario{filteredUsers.length !== 1 ? 's' : ''} registrado{filteredUsers.length !== 1 ? 's' : ''}
          {searchTerm && ` (filtrado de ${users.length} total)`}
        </div>
      </div>

      {/* Role Legend */}
      <div className="mt-6 bg-slate-50 rounded-xl border border-slate-200 p-4">
        <h3 className="text-sm font-semibold text-slate-700 mb-3">Permisos por Rol</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="flex items-start gap-3">
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200 flex-shrink-0">
              Administrador
            </span>
            <p className="text-xs text-slate-600">Acceso total: puede ver, crear, editar y eliminar en todas las secciones.</p>
          </div>
          <div className="flex items-start gap-3">
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold bg-purple-100 text-purple-800 border border-purple-200 flex-shrink-0">
              Supervisor
            </span>
            <p className="text-xs text-slate-600">Solo lectura: puede visualizar todas las secciones pero no puede editar, agregar ni eliminar informacion.</p>
          </div>
          <div className="flex items-start gap-3">
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-200 flex-shrink-0">
              Colaborador
            </span>
            <p className="text-xs text-slate-600">Acceso limitado: Dashboard, Checador, y opciones de RH habilitadas por el administrador.</p>
          </div>
        </div>
      </div>

      {/* Confirm Dialog */}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={confirmDialog.message}
        variant={confirmDialog.variant}
        onConfirm={confirmDialog.onConfirm}
        onCancel={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}
        confirmText="Confirmar"
        cancelText="Cancelar"
      />
    </div>
  );
};
