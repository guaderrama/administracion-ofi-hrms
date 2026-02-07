import React, { useState, useEffect, useMemo, useCallback } from 'react';
import type { LogEntry, DetailedEmployee, PermissionRequest } from '../../types';
import { LogType, PermissionType, Compensation } from '../../types';
import { EMPLOYEES } from '../../checadorConstants';
import { AdminLogTable } from './AdminLogTable';
import { IncidentsReport } from './IncidentsReport';
import { WorkedHoursSummary } from './WorkedHoursSummary';
import { DownloadIcon } from './icons/DownloadIcon';
import { createUserWithEmailAndPassword, sendPasswordResetEmail, fetchSignInMethodsForEmail } from 'firebase/auth';
import { doc, setDoc, getDoc, getDocs, collection, query, where } from 'firebase/firestore';
import { auth, db } from '../../src/firebaseConfig';
import { employeesService, logsService, permissionsService, schedulesService, migrateAllDataToFirestore, cleanDuplicateLogs } from '../../src/services/firestoreService';
import { useToast } from '../ui/Toast';

interface AdminViewProps {
  onExit: () => void;
}

interface ScheduleConfig {
  type: 'indeterminado' | 'determinado';
  time: string;
  startDate?: string;
  endDate?: string;
}

const calculateTenure = (startDateString: string): string => {
  if (!startDateString) return 'N/A';
  
  const startDate = new Date(startDateString + 'T12:00:00');
  const today = new Date();
  today.setHours(12, 0, 0, 0);

  if (isNaN(startDate.getTime()) || startDate > today) {
    return 'Fecha inválida';
  }

  let years = today.getFullYear() - startDate.getFullYear();
  let months = today.getMonth() - startDate.getMonth();
  let days = today.getDate() - startDate.getDate();

  if (days < 0) {
    months--;
    const prevMonth = new Date(today.getFullYear(), today.getMonth(), 0);
    days += prevMonth.getDate();
  }

  if (months < 0) {
    years--;
    months += 12;
  }
  
  const parts = [];
  if (years > 0) parts.push(`${years} año${years > 1 ? 's' : ''}`);
  if (months > 0) parts.push(`${months} mes${months > 1 ? 'es' : ''}`);
  if (days > 0) parts.push(`${days} día${days > 1 ? 's' : ''}`);
  
  return parts.length > 0 ? parts.join(', ') : "Menos de un día";
};

// --- Helper functions for permission time calculation ---
const timeToMinutes = (timeStr?: string): number => {
    if (!timeStr) return 0;
    const [hours, minutes] = timeStr.split(':').map(Number);
    if (isNaN(hours) || isNaN(minutes)) return 0;
    return hours * 60 + minutes;
};

const formatMinutes = (minutes: number): string => {
    if (minutes <= 0) return '0m';
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    const parts = [];
    if (h > 0) parts.push(`${h}h`);
    if (m > 0) parts.push(`${m}m`);
    return parts.join(' ');
};

const calculateMinutesToCompensate = (req: PermissionRequest): number => {
    const { permissionType, arrivalTime, departureTime, absenceStartTime, absenceEndTime, daysCount } = req;
    
    const WORKDAY_START_MINUTES = 9 * 60; // 09:00
    const WORKDAY_END_MINUTES = 18 * 60;   // 18:00
    const WORKDAY_DURATION_MINUTES = 8 * 60; // 8 hours

    switch (permissionType) {
        case PermissionType.FULL_DAYS:
            return (daysCount || 0) * WORKDAY_DURATION_MINUTES;
        case PermissionType.LATE_ARRIVAL:
            const arrival = timeToMinutes(arrivalTime);
            return arrival > WORKDAY_START_MINUTES ? arrival - WORKDAY_START_MINUTES : 0;
        case PermissionType.EARLY_DEPARTURE:
            const departure = timeToMinutes(departureTime);
            return departure < WORKDAY_END_MINUTES ? WORKDAY_END_MINUTES - departure : 0;
        case PermissionType.PARTIAL_ABSENCE:
            const start = timeToMinutes(absenceStartTime);
            const end = timeToMinutes(absenceEndTime);
            return end > start ? end - start : 0;
        default:
            return 0;
    }
};
// --------------------------------------------------------

const generateTimeOptions = (): string[] => {
    const options = [];
    for (let h = 7; h < 21; h++) {
        for (let m = 0; m < 60; m += 30) {
            const hour = h.toString().padStart(2, '0');
            const minute = m.toString().padStart(2, '0');
            options.push(`${hour}:${minute}`);
        }
    }
    return options;
};


export const AdminView: React.FC<AdminViewProps> = ({ onExit }) => {
  const [allLogs, setAllLogs] = useState<LogEntry[]>([]);
  const toast = useToast();
  const [schedules, setSchedules] = useState<{ [key: string]: ScheduleConfig }>({});
  const [detailedEmployees, setDetailedEmployees] = useState<DetailedEmployee[]>([]);
  const [permissionRequests, setPermissionRequests] = useState<PermissionRequest[]>([]);
  const timeOptions = useMemo(() => generateTimeOptions(), []);
  
  const initialFormState: Omit<DetailedEmployee, 'id' | 'codigo' | 'horarioLunesMiercolesViernes' | 'horarioJueves' | 'horarioSabado' | 'firebaseUid'> = {
    email: '',
    paterno: '',
    materno: '',
    nombres: '',
    fechaIngreso: new Date().toISOString().slice(0, 10),
    fechaNacimiento: '',
    curp: '',
    rfc: '',
    nss: '',
    departamento: '',
    puesto: '',
    bonoPuntualidad: 0,
    bonoObjetivos: 0,
    apoyoGasolina: 0,
  };
  const [newEmployee, setNewEmployee] = useState(initialFormState);
  const [isEmployeeSectionVisible, setIsEmployeeSectionVisible] = useState(false);

  // Estado para edición de colaboradores
  const [editingEmployee, setEditingEmployee] = useState<DetailedEmployee | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Estado para crear cuenta de acceso
  const [creatingAccountForId, setCreatingAccountForId] = useState<string | null>(null);

  // Estado para restablecer contraseña
  const [resettingPasswordForId, setResettingPasswordForId] = useState<string | null>(null);

  // Estado para edición de logs de asistencia
  const [editingLog, setEditingLog] = useState<LogEntry | null>(null);
  const [isLogEditModalOpen, setIsLogEditModalOpen] = useState(false);
  const [isSavingLog, setIsSavingLog] = useState(false);
  const [editLogDate, setEditLogDate] = useState('');
  const [editLogTime, setEditLogTime] = useState('');
  
  const initialScheduleState = {
    lunesMiercolesViernesEntrada: '09:00',
    lunesMiercolesViernesSalida: '18:00',
    juevesTrabaja: 'si',
    juevesEntrada: '09:00',
    juevesSalida: '18:00',
    sabadoTrabaja: 'si',
    sabEntrada: '09:00',
    sabSalida: '14:00',
  };
  const [scheduleForm, setScheduleForm] = useState(initialScheduleState);


  const today = new Date().toISOString().slice(0, 10);
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [isCleaningDuplicates, setIsCleaningDuplicates] = useState(false);

  useEffect(() => {
    // Migrar datos existentes de localStorage a Firestore (solo la primera vez)
    migrateAllDataToFirestore();

    // Suscribirse a cambios en tiempo real desde Firestore
    const unsubscribeLogs = logsService.subscribe((logs) => {
      setAllLogs(logs);
    });

    const unsubscribeEmployees = employeesService.subscribe((employees) => {
      setDetailedEmployees(employees);
    });

    const unsubscribePermissions = permissionsService.subscribe((requests) => {
      setPermissionRequests(requests);
    });

    const unsubscribeSchedules = schedulesService.subscribe((loadedSchedules) => {
      const migratedSchedules: { [key: string]: ScheduleConfig } = {};
      for (const empName in loadedSchedules) {
        const value = loadedSchedules[empName];
        if (typeof value === 'string') {
          migratedSchedules[empName] = { type: 'indeterminado', time: value };
        } else if (typeof value === 'object' && value.time) {
          migratedSchedules[empName] = value;
        }
      }
      if (Object.keys(migratedSchedules).length > 0) {
        setSchedules(migratedSchedules);
      } else {
        // Default schedules si no hay datos
        const defaultSchedules = EMPLOYEES.reduce((acc, emp) => {
          acc[emp.name] = { type: 'indeterminado', time: emp.scheduleStartTime };
          return acc;
        }, {} as {[key: string]: ScheduleConfig});
        setSchedules(defaultSchedules);
      }
    });

    // Cleanup: desuscribirse cuando el componente se desmonte
    return () => {
      unsubscribeLogs();
      unsubscribeEmployees();
      unsubscribePermissions();
      unsubscribeSchedules();
    };
  }, []);

  const calculatedOwedHours = useMemo(() => {
    const owedByEmployee: { [key: string]: number } = {};

    permissionRequests.forEach(req => {
        if (req.compensation === Compensation.EXTRA_TIME) {
            // Construct the name key in the same format as EMPLOYEES list (PATERNO MATERNO NOMBRES)
            const employeeFullName = `${req.lastName} ${req.motherLastName} ${req.firstName}`.toUpperCase().replace(/\s+/g, ' ').trim();
            const minutesToCompensate = calculateMinutesToCompensate(req);
            
            if (!owedByEmployee[employeeFullName]) {
                owedByEmployee[employeeFullName] = 0;
            }
            owedByEmployee[employeeFullName] += minutesToCompensate;
        }
    });
    
    // Convert minutes to hours for display
    for (const empName in owedByEmployee) {
        owedByEmployee[empName] = owedByEmployee[empName] / 60;
    }

    return owedByEmployee;
  }, [permissionRequests]);

  const filteredLogs = useMemo(() => {
    const start = new Date(startDate).setHours(0, 0, 0, 0);
    const end = new Date(endDate).setHours(23, 59, 59, 999);
    return allLogs.filter(log => log.timestamp >= start && log.timestamp <= end);
  }, [allLogs, startDate, endDate]);

  const getEffectiveScheduleTime = useCallback((employeeName: string, timestamp: number): string => {
    const scheduleConfig = schedules[employeeName];
    const defaultSchedule = EMPLOYEES.find(e => e.name === employeeName)?.scheduleStartTime || '09:00';

    if (!scheduleConfig) {
      return defaultSchedule;
    }

    if (scheduleConfig.type === 'determinado' && scheduleConfig.startDate && scheduleConfig.endDate) {
      const logDate = new Date(timestamp);
      const logDateOnly = new Date(logDate.getFullYear(), logDate.getMonth(), logDate.getDate());

      const startDate = new Date(scheduleConfig.startDate + 'T00:00:00');
      const endDate = new Date(scheduleConfig.endDate + 'T00:00:00');

      if (logDateOnly >= startDate && logDateOnly <= endDate) {
        return scheduleConfig.time;
      } else {
        return defaultSchedule;
      }
    }

    return scheduleConfig.time || defaultSchedule;
  }, [schedules]);

  const handleDownloadLogs = () => {
    const sortedLogs = [...filteredLogs].sort((a, b) => a.timestamp - b.timestamp);
    const headers = ['Colaborador', 'Tipo', 'Fecha', 'Hora', 'Incidencia', 'Coordenadas'];

    const formatDate = (ts: number) => new Date(ts).toLocaleDateString('es-MX', { year: 'numeric', month: '2-digit', day: '2-digit' });
    const formatTime = (ts: number) => new Date(ts).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    
    const getIncident = (log: LogEntry): string => {
      if (log.type !== LogType.ENTRADA) return '';
      const scheduleTime = getEffectiveScheduleTime(log.employeeName, log.timestamp);
      if (!scheduleTime) return '';

      const logDate = new Date(log.timestamp);
      const [hours, minutes] = scheduleTime.split(':').map(Number);
      
      const scheduleDate = new Date(logDate);
      scheduleDate.setHours(hours, minutes, 0, 0);

      const toleranceDeadline = new Date(scheduleDate.getTime() + 10 * 60 * 1000);
      return logDate > toleranceDeadline ? 'Retardo' : '';
    };

    const csvRows = [headers.join(',')];
    sortedLogs.forEach(log => {
      const incident = getIncident(log);
      const coordinates = log.location ? `${log.location.lat.toFixed(4)}, ${log.location.lon.toFixed(4)}` : 'No disponible';
      
      const row = [
        `"${log.employeeName.replace(/"/g, '""')}"`,
        `"${log.type}"`,
        `"${formatDate(log.timestamp)}"`,
        `"${formatTime(log.timestamp)}"`,
        `"${incident}"`,
        `"${coordinates}"`
      ].join(',');
      csvRows.push(row);
    });

    const csvString = csvRows.join('\n');
    const blob = new Blob(['\uFEFF' + csvString], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `registros_asistencia_${startDate}_a_${endDate}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleNewEmployeeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type } = e.target;
    setNewEmployee(prev => ({
      ...prev,
      [name]: type === 'number' ? parseFloat(value) || 0 : value,
    }));
  };
  
  const handleScheduleFormChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const { name, value } = e.target;
    setScheduleForm(prev => ({ ...prev, [name]: value }));
  };

  const handleScheduleChange = (employeeName: string, field: keyof ScheduleConfig, value: string) => {
    setSchedules(prev => {
        const currentSchedule = prev[employeeName] || {
            type: 'indeterminado',
            time: EMPLOYEES.find(e => e.name === employeeName)?.scheduleStartTime || '09:00',
            startDate: '',
            endDate: '',
        };

        const newSchedule = { ...currentSchedule, [field]: value };

        if (field === 'type' && value === 'indeterminado') {
            newSchedule.startDate = '';
            newSchedule.endDate = '';
        }

        return { ...prev, [employeeName]: newSchedule };
    });
  };

  const saveSchedules = async () => {
    try {
      await schedulesService.save(schedules);
      toast.success('Horarios guardados.');
    } catch (error) {
      console.error('Error al guardar horarios:', error);
      toast.error('Error al guardar horarios. Intenta de nuevo.');
    }
  };

  const handleCleanDuplicates = async () => {
    const confirm = window.confirm(
      '¿Estás seguro de que deseas limpiar los registros duplicados?\n\n' +
      'Esta acción eliminará los registros de asistencia duplicados en la base de datos.'
    );
    if (!confirm) return;

    setIsCleaningDuplicates(true);
    try {
      const result = await cleanDuplicateLogs();
      if (result.deleted > 0) {
        toast.success(`Limpieza completada. ${result.deleted} registros duplicados eliminados.`);
      } else {
        toast.info('No se encontraron registros duplicados.');
      }
    } catch (error) {
      console.error('Error al limpiar duplicados:', error);
      toast.error('Error al limpiar duplicados. Revisa la consola para más detalles.');
    } finally {
      setIsCleaningDuplicates(false);
    }
  };

  const [isRegistering, setIsRegistering] = useState(false);

  const handleRegisterEmployee = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!newEmployee.nombres || !newEmployee.paterno || !newEmployee.fechaNacimiento || !newEmployee.email) {
      toast.warning('Nombre(s), Apellido Paterno, Fecha de Cumpleaños y Email son obligatorios.');
      return;
    }

    // Validar formato de email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newEmployee.email)) {
      toast.warning('Por favor ingresa un email válido.');
      return;
    }

    setIsRegistering(true);

    try {
      // Obtener empleados existentes desde Firestore
      const existingEmployees = await employeesService.getAll();

      // Verificar si el email ya existe en detailed_employees
      if (existingEmployees.some(emp => emp.email === newEmployee.email)) {
        toast.error('Ya existe un colaborador con este email en el panel.');
        setIsRegistering(false);
        return;
      }

      const [year, month, day] = newEmployee.fechaNacimiento.split('-');
      const baseCode = `${day}${month}${year.slice(-2)}`;

      let employeeCode = baseCode;
      let counter = 1;
      while (existingEmployees.some(emp => emp.codigo === employeeCode)) {
          employeeCode = `${baseCode}-${counter}`;
          counter++;
      }

      // Verificar si el email ya existe en Firebase Auth
      const signInMethods = await fetchSignInMethodsForEmail(auth, newEmployee.email);

      let firebaseUid: string | undefined = undefined;
      let accountLinked = false;

      if (signInMethods.length > 0) {
        // El email ya existe en Firebase Auth - preguntar si vincular
        const confirmLink = window.confirm(
          `El email ${newEmployee.email} ya existe en el sistema de autenticación.\n\n` +
          `¿Deseas vincular este colaborador con la cuenta existente?\n\n` +
          `Si eliges "Aceptar", el colaborador se registrará y se vinculará a su cuenta.\n` +
          `Puedes enviarle un email de restablecimiento de contraseña después.`
        );

        if (!confirmLink) {
          setIsRegistering(false);
          return;
        }

        // Buscar el UID existente en Firestore
        const usersQuery = query(collection(db, 'users'), where('email', '==', newEmployee.email));
        const querySnapshot = await getDocs(usersQuery);

        if (!querySnapshot.empty) {
          firebaseUid = querySnapshot.docs[0].id;
          accountLinked = true;
        } else {
          // No hay documento en Firestore, el usuario existe en Auth pero sin perfil
          // El colaborador se registrará sin firebaseUid y podrá vincularse después
          accountLinked = false;
        }
      } else {
        // El email no existe - crear cuenta nueva
        const userCredential = await createUserWithEmailAndPassword(
          auth,
          newEmployee.email,
          employeeCode // El código de 6 dígitos es la contraseña
        );

        // Crear documento en Firestore con rol 'employee'
        await setDoc(doc(db, 'users', userCredential.user.uid), {
          uid: userCredential.user.uid,
          email: newEmployee.email,
          role: 'employee',
          displayName: `${newEmployee.nombres} ${newEmployee.paterno}`,
          createdAt: new Date(),
        });

        firebaseUid = userCredential.user.uid;
      }

      const finalHorarioLMV = `${scheduleForm.lunesMiercolesViernesEntrada} - ${scheduleForm.lunesMiercolesViernesSalida}`;
      const finalHorarioJueves = scheduleForm.juevesTrabaja === 'si'
          ? `${scheduleForm.juevesEntrada} - ${scheduleForm.juevesSalida}`
          : 'No labora';
      const finalHorarioSab = scheduleForm.sabadoTrabaja === 'si'
          ? `${scheduleForm.sabEntrada} - ${scheduleForm.sabSalida}`
          : 'No labora';

      const newEmployeeData = {
        codigo: employeeCode,
        email: newEmployee.email,
        firebaseUid: firebaseUid,
        paterno: newEmployee.paterno,
        materno: newEmployee.materno,
        nombres: newEmployee.nombres,
        fechaIngreso: newEmployee.fechaIngreso,
        fechaNacimiento: newEmployee.fechaNacimiento,
        curp: newEmployee.curp,
        rfc: newEmployee.rfc,
        nss: newEmployee.nss,
        departamento: newEmployee.departamento,
        puesto: newEmployee.puesto,
        horarioLunesMiercolesViernes: finalHorarioLMV,
        horarioJueves: finalHorarioJueves,
        horarioSabado: finalHorarioSab,
        bonoPuntualidad: Number(newEmployee.bonoPuntualidad),
        bonoObjetivos: Number(newEmployee.bonoObjetivos),
        apoyoGasolina: Number(newEmployee.apoyoGasolina),
      };

      // Guardar en Firestore (el servicio también actualiza localStorage)
      await employeesService.create(newEmployeeData);
      // La suscripción actualizará automáticamente detailedEmployees

      // Mostrar mensaje según el caso
      if (accountLinked) {
        toast.success(`Colaborador ${newEmployee.nombres} ${newEmployee.paterno} registrado y vinculado exitosamente. Código: ${employeeCode}`);
      } else if (firebaseUid) {
        toast.success(`Colaborador ${newEmployee.nombres} ${newEmployee.paterno} registrado exitosamente. Contraseña: ${employeeCode}`);
      } else {
        toast.info(`Colaborador ${newEmployee.nombres} ${newEmployee.paterno} registrado. El email existe en Auth pero sin perfil vinculado. Use "Crear cuenta" después.`);
      }

      setNewEmployee(initialFormState);
      setScheduleForm(initialScheduleState);
    } catch (error: any) {
      console.error('Error al registrar colaborador:', error);
      if (error.code === 'auth/email-already-in-use') {
        // El email ya existe en Firebase Auth - ofrecer vincular
        const confirmLink = window.confirm(
          `El email ${newEmployee.email} ya existe en el sistema de autenticación.\n\n` +
          `¿Deseas registrar este colaborador y vincularlo con la cuenta existente?\n\n` +
          `Si eliges "Aceptar", el colaborador se registrará sin crear cuenta nueva.\n` +
          `Puedes enviarle un email de restablecimiento de contraseña después.`
        );

        if (confirmLink) {
          try {
            // Obtener empleados existentes desde Firestore
            const existingEmployees = await employeesService.getAll();

            // Generar código
            const [year, month, day] = newEmployee.fechaNacimiento.split('-');
            const baseCode = `${day}${month}${year.slice(-2)}`;
            let employeeCode = baseCode;
            let counter = 1;
            while (existingEmployees.some(emp => emp.codigo === employeeCode)) {
              employeeCode = `${baseCode}-${counter}`;
              counter++;
            }

            // Buscar el UID existente en Firestore
            let firebaseUid: string | undefined = undefined;
            const usersQuery = query(collection(db, 'users'), where('email', '==', newEmployee.email));
            const querySnapshot = await getDocs(usersQuery);

            if (!querySnapshot.empty) {
              firebaseUid = querySnapshot.docs[0].id;
            }

            // Preparar horarios
            const finalHorarioLMV = `${scheduleForm.lunesMiercolesViernesEntrada} - ${scheduleForm.lunesMiercolesViernesSalida}`;
            const finalHorarioJueves = scheduleForm.juevesTrabaja === 'si'
              ? `${scheduleForm.juevesEntrada} - ${scheduleForm.juevesSalida}`
              : 'No labora';
            const finalHorarioSab = scheduleForm.sabadoTrabaja === 'si'
              ? `${scheduleForm.sabEntrada} - ${scheduleForm.sabSalida}`
              : 'No labora';

            // Crear registro del empleado SIN crear cuenta en Firebase Auth
            const newEmployeeData = {
              codigo: employeeCode,
              email: newEmployee.email,
              firebaseUid: firebaseUid,
              paterno: newEmployee.paterno,
              materno: newEmployee.materno,
              nombres: newEmployee.nombres,
              fechaIngreso: newEmployee.fechaIngreso,
              fechaNacimiento: newEmployee.fechaNacimiento,
              curp: newEmployee.curp,
              rfc: newEmployee.rfc,
              nss: newEmployee.nss,
              departamento: newEmployee.departamento,
              puesto: newEmployee.puesto,
              horarioLunesMiercolesViernes: finalHorarioLMV,
              horarioJueves: finalHorarioJueves,
              horarioSabado: finalHorarioSab,
              bonoPuntualidad: Number(newEmployee.bonoPuntualidad),
              bonoObjetivos: Number(newEmployee.bonoObjetivos),
              apoyoGasolina: Number(newEmployee.apoyoGasolina),
            };

            // Guardar en Firestore
            await employeesService.create(newEmployeeData);

            toast.success(`Colaborador ${newEmployee.nombres} ${newEmployee.paterno} registrado y vinculado exitosamente. Código: ${employeeCode}`);

            setNewEmployee(initialFormState);
            setScheduleForm(initialScheduleState);
          } catch (linkError: any) {
            console.error('Error al vincular cuenta existente:', linkError);
            toast.error(`Error al vincular: ${linkError.message}`);
          }
        }
      } else if (error.code === 'auth/weak-password') {
        toast.warning('El código generado es muy débil. Contacta al administrador del sistema.');
      } else {
        toast.error(`Error al registrar: ${error.message}`);
      }
    } finally {
      setIsRegistering(false);
    }
  };

  // Función para abrir modal de edición
  const handleEditEmployee = (employee: DetailedEmployee) => {
    setEditingEmployee({ ...employee });
    setIsEditModalOpen(true);
  };

  // Función para guardar cambios de edición
  const handleSaveEdit = async () => {
    if (!editingEmployee) return;

    setIsSavingEdit(true);
    try {
      // Actualizar en Firestore
      await employeesService.update(editingEmployee.id, editingEmployee);

      // Si el colaborador tiene cuenta Firebase, actualizar en Firestore users
      if (editingEmployee.firebaseUid) {
        await setDoc(doc(db, 'users', editingEmployee.firebaseUid), {
          displayName: `${editingEmployee.nombres} ${editingEmployee.paterno}`,
          email: editingEmployee.email,
        }, { merge: true });
      }

      toast.success('Colaborador actualizado exitosamente.');
      setIsEditModalOpen(false);
      setEditingEmployee(null);
    } catch (error: any) {
      console.error('Error al actualizar colaborador:', error);
      toast.error(`Error al actualizar: ${error.message}`);
    } finally {
      setIsSavingEdit(false);
    }
  };

  // Función para eliminar colaborador
  const handleDeleteEmployee = async (employee: DetailedEmployee) => {
    const confirmDelete = window.confirm(
      `¿Estás seguro de que deseas dar de baja a ${employee.nombres} ${employee.paterno}?\n\n` +
      `Esta acción eliminará al colaborador del sistema.`
    );

    if (!confirmDelete) return;

    try {
      // Eliminar de Firestore
      await employeesService.delete(employee.id);

      // Nota: No eliminamos la cuenta de Firebase Auth por seguridad
      // El admin puede desactivarla desde la consola de Firebase si es necesario

      toast.success(`Colaborador ${employee.nombres} ${employee.paterno} dado de baja exitosamente.`);
    } catch (error: any) {
      console.error('Error al eliminar colaborador:', error);
      toast.error(`Error al eliminar: ${error.message}`);
    }
  };

  // Función para vincular empleado con cuenta Firebase existente
  const handleLinkExistingAccount = async (employee: DetailedEmployee) => {
    if (!employee.email) return;

    setCreatingAccountForId(employee.id);

    try {
      // Buscar el usuario en Firestore por email
      const usersQuery = query(collection(db, 'users'), where('email', '==', employee.email));
      const querySnapshot = await getDocs(usersQuery);

      if (!querySnapshot.empty) {
        // Usuario encontrado en Firestore - vincular con ese UID
        const existingUser = querySnapshot.docs[0];
        const uid = existingUser.id;

        // Actualizar el registro del empleado con el firebaseUid en Firestore
        await employeesService.update(employee.id, { firebaseUid: uid });

        toast.success(`Cuenta vinculada exitosamente. ${employee.nombres} ${employee.paterno} ha sido vinculado a su cuenta existente.`);
      } else {
        // No hay documento en Firestore pero sí en Auth
        // Crear documento en Firestore (se creará cuando el usuario inicie sesión)
        toast.info('El email existe en Firebase Auth pero no tiene perfil en Firestore. El colaborador debe iniciar sesión para completar su perfil.');
      }
    } catch (error: any) {
      console.error('Error al vincular cuenta:', error);
      toast.error(`Error al vincular cuenta: ${error.message}`);
    } finally {
      setCreatingAccountForId(null);
    }
  };

  // Función para crear cuenta de acceso para empleados existentes
  const handleCreateAccount = async (employee: DetailedEmployee) => {
    // Validar que tenga email
    if (!employee.email) {
      toast.error('Este colaborador no tiene email registrado. Por favor, edita el registro y agrega un email primero.');
      return;
    }

    // Validar que no tenga cuenta ya
    if (employee.firebaseUid) {
      toast.info('Este colaborador ya tiene una cuenta de acceso activa.');
      return;
    }

    setCreatingAccountForId(employee.id);

    try {
      // Primero verificar si el email ya existe en Firebase Auth
      const signInMethods = await fetchSignInMethodsForEmail(auth, employee.email);

      if (signInMethods.length > 0) {
        // El email ya existe - preguntar si quiere vincular
        setCreatingAccountForId(null);

        const confirmLink = window.confirm(
          `El email ${employee.email} ya existe en el sistema de autenticación.\n\n` +
          `¿Deseas vincular este colaborador con la cuenta existente?\n\n` +
          `Si eliges "Aceptar", el colaborador podrá usar su cuenta actual.\n` +
          `Puedes enviarle un email de restablecimiento de contraseña después.`
        );

        if (confirmLink) {
          await handleLinkExistingAccount(employee);
        }
        return;
      }

      // El email no existe - proceder a crear cuenta nueva
      const confirmCreate = window.confirm(
        `¿Crear cuenta de acceso para ${employee.nombres} ${employee.paterno}?\n\n` +
        `Email: ${employee.email}\n` +
        `Contraseña: ${employee.codigo} (código de 6 dígitos)\n\n` +
        `El colaborador podrá iniciar sesión con estas credenciales.`
      );

      if (!confirmCreate) {
        setCreatingAccountForId(null);
        return;
      }

      // Crear cuenta en Firebase Auth con el código como contraseña
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        employee.email,
        employee.codigo // El código de 6 dígitos es la contraseña
      );

      // Crear documento en Firestore con rol 'employee'
      await setDoc(doc(db, 'users', userCredential.user.uid), {
        uid: userCredential.user.uid,
        email: employee.email,
        role: 'employee',
        displayName: `${employee.nombres} ${employee.paterno}`,
        createdAt: new Date(),
      });

      // Actualizar el registro del empleado con el firebaseUid en Firestore
      await employeesService.update(employee.id, { firebaseUid: userCredential.user.uid });

      toast.success(`Cuenta creada exitosamente para ${employee.nombres} ${employee.paterno}. Contraseña: ${employee.codigo}`);
    } catch (error: any) {
      console.error('Error al crear cuenta:', error);
      if (error.code === 'auth/email-already-in-use') {
        // Esto no debería pasar ahora, pero por si acaso
        const confirmLink = window.confirm(
          `El email ya está registrado.\n\n` +
          `¿Deseas vincular este colaborador con la cuenta existente?`
        );
        if (confirmLink) {
          await handleLinkExistingAccount(employee);
        }
      } else if (error.code === 'auth/weak-password') {
        toast.warning('El código es muy corto para ser una contraseña segura. Firebase requiere mínimo 6 caracteres.');
      } else if (error.code === 'auth/invalid-email') {
        toast.error('El email no es válido. Por favor, verifica el formato.');
      } else {
        toast.error(`Error al crear cuenta: ${error.message}`);
      }
    } finally {
      setCreatingAccountForId(null);
    }
  };

  // Función para restablecer contraseña de un empleado
  const handleResetPassword = async (employee: DetailedEmployee) => {
    if (!employee.email) {
      toast.error('Este colaborador no tiene email registrado.');
      return;
    }

    const confirmReset = window.confirm(
      `¿Enviar email de restablecimiento de contraseña a ${employee.nombres} ${employee.paterno}?\n\n` +
      `Se enviará un correo a: ${employee.email}\n\n` +
      `El colaborador recibirá un enlace para crear una nueva contraseña.`
    );

    if (!confirmReset) return;

    setResettingPasswordForId(employee.id);

    try {
      await sendPasswordResetEmail(auth, employee.email);

      // Registrar la fecha del restablecimiento en el empleado
      const resetDate = new Date().toISOString();
      await employeesService.update(employee.id, { lastPasswordReset: resetDate });

      // Actualizar estado local
      setDetailedEmployees(prev =>
        prev.map(emp => emp.id === employee.id ? { ...emp, lastPasswordReset: resetDate } : emp)
      );

      toast.success(`Email enviado exitosamente a ${employee.email}. El colaborador debe revisar su bandeja de entrada.`);
    } catch (error: unknown) {
      console.error('Error al enviar email de restablecimiento:', error);
      const firebaseError = error as { code?: string; message?: string };
      if (firebaseError.code === 'auth/user-not-found') {
        toast.error('No existe una cuenta con este email. Primero debes crear la cuenta de acceso.');
      } else if (firebaseError.code === 'auth/invalid-email') {
        toast.error('El email no es válido.');
      } else {
        toast.error(`Error al enviar email: ${firebaseError.message || 'Error desconocido'}`);
      }
    } finally {
      setResettingPasswordForId(null);
    }
  };

  // Función para manejar cambios en el formulario de edición
  const handleEditFormChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!editingEmployee) return;
    const { name, value, type } = e.target;
    setEditingEmployee({
      ...editingEmployee,
      [name]: type === 'number' ? parseFloat(value) || 0 : value,
    });
  };

  // Funciones para edición de logs de asistencia
  const handleEditLog = (log: LogEntry) => {
    setEditingLog({ ...log });
    // Convertir timestamp a fecha y hora
    const date = new Date(log.timestamp);
    setEditLogDate(date.toISOString().slice(0, 10));
    setEditLogTime(date.toTimeString().slice(0, 5));
    setIsLogEditModalOpen(true);
  };

  const handleDeleteLog = async (log: LogEntry) => {
    if (!log.id) {
      toast.error('Este registro no tiene ID y no puede ser eliminado.');
      return;
    }

    const confirmDelete = window.confirm(
      `¿Estás seguro de que deseas eliminar este registro?\n\n` +
      `Colaborador: ${log.employeeName}\n` +
      `Tipo: ${log.type}\n` +
      `Fecha: ${new Date(log.timestamp).toLocaleString('es-MX')}\n\n` +
      `Esta acción no se puede deshacer.`
    );

    if (!confirmDelete) return;

    try {
      await logsService.delete(log.id);
      toast.success('Registro eliminado exitosamente.');
    } catch (error: any) {
      console.error('Error al eliminar registro:', error);
      toast.error(`Error al eliminar: ${error.message}`);
    }
  };

  const handleSaveLogEdit = async () => {
    if (!editingLog || !editingLog.id) {
      toast.error('No se puede guardar: el registro no tiene ID.');
      return;
    }

    setIsSavingLog(true);
    try {
      // Construir el nuevo timestamp desde fecha y hora
      const [year, month, day] = editLogDate.split('-').map(Number);
      const [hours, minutes] = editLogTime.split(':').map(Number);
      const newTimestamp = new Date(year, month - 1, day, hours, minutes, 0, 0).getTime();

      await logsService.update(editingLog.id, {
        employeeName: editingLog.employeeName,
        type: editingLog.type,
        timestamp: newTimestamp,
        location: editingLog.location,
      });

      toast.success('Registro actualizado exitosamente.');
      setIsLogEditModalOpen(false);
      setEditingLog(null);
    } catch (error: any) {
      console.error('Error al actualizar registro:', error);
      toast.error(`Error al actualizar: ${error.message}`);
    } finally {
      setIsSavingLog(false);
    }
  };

  const handleDownloadEmployeesCSV = () => {
    if (detailedEmployees.length === 0) {
        toast.info('No hay colaboradores registrados para descargar.');
        return;
    }

    const headers = [
        'ID', 'Código', 'Apellido Paterno', 'Apellido Materno', 'Nombre(s)', 
        'Fecha de Ingreso', 'Fecha de Cumpleaños', 'Antigüedad', 'CURP', 'RFC', 'NSS', 'Departamento', 'Puesto',
        'Horario L,M,M,V', 'Horario Jueves Caminata De Arte', 'Horario Sábado',
        'Bono Puntualidad', 'Bono Objetivos', 'Apoyo Gasolina'
    ];

    const csvRows = [headers.join(',')];

    detailedEmployees.forEach(emp => {
        const tenure = calculateTenure(emp.fechaIngreso);
        const row = [
            `"${emp.id}"`, `"${emp.codigo}"`, `"${emp.paterno}"`, `"${emp.materno}"`, `"${emp.nombres}"`,
            `"${emp.fechaIngreso}"`, `"${emp.fechaNacimiento}"`, `"${tenure}"`, `"${emp.curp}"`, `"${emp.rfc}"`, `"${emp.nss}"`,
            `"${emp.departamento}"`, `"${emp.puesto}"`,
            `"${emp.horarioLunesMiercolesViernes}"`, `"${emp.horarioJueves}"`, `"${emp.horarioSabado}"`,
            emp.bonoPuntualidad,
            emp.bonoObjetivos, emp.apoyoGasolina
        ].join(',');
        csvRows.push(row);
    });

    const csvString = csvRows.join('\n');
    const blob = new Blob(['\uFEFF' + csvString], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `lista_colaboradores.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };
  
  const getPermissionDetailsText = (req: PermissionRequest) => {
    switch (req.permissionType) {
        case PermissionType.FULL_DAYS:
            return req.dates?.map(d => new Date(d + 'T12:00:00').toLocaleDateString('es-MX')).join(', ') || 'Fechas no especificadas';
        case PermissionType.LATE_ARRIVAL:
            return `Llegada a las ${req.arrivalTime}`;
        case PermissionType.EARLY_DEPARTURE:
            return `Salida a las ${req.departureTime}`;
        case PermissionType.PARTIAL_ABSENCE:
            return `De ${req.absenceStartTime} a ${req.absenceEndTime}`;
        default:
            return 'N/A';
    }
  };

  const ChevronDownIcon: React.FC<{className?: string}> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={`h-6 w-6 text-slate-700 ${className}`} viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
    </svg>
  );


  return (
    <div className="container mx-auto p-4 sm:p-6 lg:p-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="font-serif text-3xl font-bold text-slate-900">Panel de Administración</h1>
        <button onClick={onExit} className="text-sm font-medium text-amber-600 hover:underline">Salir de Administración</button>
      </div>

      <div className="space-y-8">
        {/* Filtros y Logs */}
        <div className="p-6 bg-white/30 backdrop-blur-lg rounded-xl shadow-lg border border-white/20">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-slate-800">Registros de Asistencia</h2>
            <div className="flex space-x-2">
              <button
                onClick={handleCleanDuplicates}
                disabled={isCleaningDuplicates}
                className="inline-flex items-center px-3 py-1 border border-red-300 text-sm font-medium rounded-md shadow-sm text-red-700 bg-red-50 hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:bg-slate-100/50 disabled:cursor-not-allowed disabled:text-slate-400"
              >
                {isCleaningDuplicates ? 'Limpiando...' : 'Limpiar Duplicados'}
              </button>
              <button
                onClick={handleDownloadLogs}
                disabled={filteredLogs.length === 0}
                className="inline-flex items-center px-3 py-1 border border-slate-300 text-sm font-medium rounded-md shadow-sm text-slate-700 bg-white/60 hover:bg-white/80 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-500 disabled:bg-slate-100/50 disabled:cursor-not-allowed disabled:text-slate-400"
              >
                <DownloadIcon />
                <span className="ml-2">Descargar CSV</span>
              </button>
            </div>
          </div>
          <div className="flex items-center space-x-4 mb-4">
            <div>
              <label htmlFor="startDate" className="block text-sm font-medium text-slate-700">Desde</label>
              <input type="date" id="startDate" value={startDate} onChange={e => setStartDate(e.target.value)} className="mt-1 block w-full px-3 py-2 bg-white/40 border border-slate-300 rounded-md shadow-sm"/>
            </div>
            <div>
              <label htmlFor="endDate" className="block text-sm font-medium text-slate-700">Hasta</label>
              <input type="date" id="endDate" value={endDate} onChange={e => setEndDate(e.target.value)} className="mt-1 block w-full px-3 py-2 bg-white/40 border border-slate-300 rounded-md shadow-sm"/>
            </div>
          </div>
          <AdminLogTable
            logs={filteredLogs}
            getEffectiveScheduleTime={getEffectiveScheduleTime}
            onEditLog={handleEditLog}
            onDeleteLog={handleDeleteLog}
          />
        </div>

        {/* Reportes */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="p-6 bg-white/30 backdrop-blur-lg rounded-xl shadow-lg border border-white/20">
            <h2 className="text-xl font-bold text-slate-800 mb-4">Resumen de Horas Trabajadas</h2>
            <WorkedHoursSummary logs={filteredLogs} />
          </div>
          <div className="p-6 bg-white/30 backdrop-blur-lg rounded-xl shadow-lg border border-white/20">
            <h2 className="text-xl font-bold text-slate-800 mb-4">Reporte de Incidencias</h2>
            <IncidentsReport logs={filteredLogs} getEffectiveScheduleTime={getEffectiveScheduleTime} />
          </div>
        </div>

        {/* Solicitudes de Permiso */}
        <div className="p-6 bg-white/30 backdrop-blur-lg rounded-xl shadow-lg border border-white/20">
          <h2 className="text-xl font-bold text-slate-800 mb-4">Solicitudes de Permiso</h2>
            <div className="overflow-x-auto max-h-96">
                <table className="min-w-full bg-white/60 rounded-lg shadow">
                    <thead className="bg-white/80 sticky top-0">
                        <tr>
                            <th className="py-3 px-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Colaborador</th>
                            <th className="py-3 px-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Fecha Solicitud</th>
                            <th className="py-3 px-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Tipo</th>
                            <th className="py-3 px-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Detalles</th>
                            <th className="py-3 px-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Horas a Reponer</th>
                            <th className="py-3 px-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Motivo</th>
                            <th className="py-3 px-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Estado</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                        {permissionRequests.length > 0 ? [...permissionRequests].reverse().map(req => (
                            <tr key={req.id} className="hover:bg-slate-100/50">
                                <td className="py-3 px-4 whitespace-nowrap text-sm text-slate-800">{`${req.firstName} ${req.lastName} ${req.motherLastName}`}</td>
                                <td className="py-3 px-4 whitespace-nowrap text-sm text-slate-700 font-mono">{new Date(req.requestDate + 'T12:00:00').toLocaleDateString('es-MX')}</td>
                                <td className="py-3 px-4 whitespace-nowrap text-sm text-slate-700">{req.permissionType}</td>
                                <td className="py-3 px-4 text-sm text-slate-700">{getPermissionDetailsText(req)}</td>
                                <td className="py-3 px-4 whitespace-nowrap text-sm text-center">
                                    {req.compensation === Compensation.EXTRA_TIME ? (
                                        <span className="font-mono font-semibold text-amber-800 bg-amber-100/60 px-2 py-1 rounded">
                                            {formatMinutes(calculateMinutesToCompensate(req))}
                                        </span>
                                    ) : (
                                        <span className="text-slate-400">-</span>
                                    )}
                                </td>
                                <td className="py-3 px-4 whitespace-nowrap text-sm text-slate-700">{req.reason}</td>
                                <td className="py-3 px-4 whitespace-nowrap text-sm">
                                    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                                        req.status === 'Pendiente' ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-800'
                                    }`}>
                                        {req.status}
                                    </span>
                                </td>
                            </tr>
                        )) : (
                            <tr>
                                <td colSpan={7} className="text-center py-4 text-sm text-slate-500">No hay solicitudes de permiso registradas.</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>

        {/* Gestión */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
           <div className="p-6 bg-white/30 backdrop-blur-lg rounded-xl shadow-lg border border-white/20">
                <h2 className="text-xl font-bold text-slate-800 mb-4">Gestión de Horarios</h2>
                <div className="space-y-2 max-h-96 overflow-y-auto pr-2">
                    {EMPLOYEES.map(emp => {
                      const currentSchedule = schedules[emp.name] || { type: 'indeterminado', time: emp.scheduleStartTime };
                      return (
                        <div key={emp.name} className="p-3 bg-slate-50/50 rounded-md border border-slate-200 space-y-2">
                            <label className="text-sm text-slate-800 font-medium block">{emp.name}</label>
                            <div className="grid grid-cols-2 gap-2">
                              <select
                                  value={currentSchedule.type}
                                  onChange={e => handleScheduleChange(emp.name, 'type', e.target.value)}
                                  className="w-full px-2 py-1 bg-white/40 border border-slate-300 rounded-md shadow-sm text-sm"
                              >
                                  <option value="indeterminado">Indeterminado</option>
                                  <option value="determinado">Determinado</option>
                              </select>
                              <input
                                  type="time"
                                  value={currentSchedule.time}
                                  onChange={e => handleScheduleChange(emp.name, 'time', e.target.value)}
                                  className="w-full px-2 py-1 bg-white/40 border border-slate-300 rounded-md shadow-sm text-sm"
                              />
                            </div>
                            {currentSchedule.type === 'determinado' && (
                              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200 mt-2">
                                  <div>
                                      <label className="text-xs text-slate-600 block mb-1">Desde</label>
                                      <input
                                          type="date"
                                          value={currentSchedule.startDate || ''}
                                          onChange={e => handleScheduleChange(emp.name, 'startDate', e.target.value)}
                                          className="w-full px-2 py-1 bg-white/40 border border-slate-300 rounded-md shadow-sm text-sm"
                                      />
                                  </div>
                                  <div>
                                      <label className="text-xs text-slate-600 block mb-1">Hasta</label>
                                      <input
                                          type="date"
                                          value={currentSchedule.endDate || ''}
                                          onChange={e => handleScheduleChange(emp.name, 'endDate', e.target.value)}
                                          className="w-full px-2 py-1 bg-white/40 border border-slate-300 rounded-md shadow-sm text-sm"
                                      />
                                  </div>
                              </div>
                            )}
                        </div>
                      )
                    })}
                </div>
                <button onClick={saveSchedules} className="mt-4 w-full inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700">Guardar Horarios</button>
            </div>
            <div className="p-6 bg-white/30 backdrop-blur-lg rounded-xl shadow-lg border border-white/20">
                <h2 className="text-xl font-bold text-slate-800 mb-4">Resumen de Horas Pendientes por Reponer</h2>
                <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
                    {EMPLOYEES.map(emp => {
                      const employeeNameKey = emp.name.toUpperCase().replace(/\s+/g, ' ').trim();
                      const hours = calculatedOwedHours[employeeNameKey] || 0;
                      return (
                        <div key={emp.name} className="flex items-center justify-between p-2 bg-slate-50/50 rounded-md border border-slate-200">
                            <p className="text-sm text-slate-800">{emp.name}</p>
                            <div className="text-right">
                              <p className="w-24 text-center px-2 py-1 bg-amber-100/60 rounded-md font-mono font-bold text-amber-900 text-base">
                                  {hours.toFixed(2)}
                              </p>
                              <p className="text-xs text-slate-500">horas</p>
                            </div>
                        </div>
                      )
                    })}
                </div>
                <p className="mt-4 text-xs text-slate-500 text-center">
                    Este es un cálculo automático basado en las solicitudes de permiso con "Reposición con tiempo de trabajo adicional".
                </p>
            </div>
        </div>

        {/* Alta de Nuevo Colaborador */}
        <div className="p-6 bg-white/30 backdrop-blur-lg rounded-xl shadow-lg border border-white/20">
          <button 
            onClick={() => setIsEmployeeSectionVisible(!isEmployeeSectionVisible)} 
            className="w-full flex justify-between items-center text-left"
          >
            <h2 className="text-xl font-bold text-slate-800">Alta y Gestión de Colaboradores</h2>
            <ChevronDownIcon className={`transition-transform duration-300 ${isEmployeeSectionVisible ? 'rotate-180' : ''}`} />
          </button>
          
          {isEmployeeSectionVisible && (
            <div className="mt-6 border-t pt-6 border-slate-300/50">
              <h3 className="text-lg font-semibold text-slate-800 mb-4">Alta de Nuevo Colaborador</h3>
              <form onSubmit={handleRegisterEmployee} className="space-y-4">
                {/* Email para acceso al sistema */}
                <div className="p-4 bg-blue-50/50 border border-blue-200 rounded-lg">
                  <label htmlFor="email" className="block text-sm font-medium text-blue-800">Email (para acceso al sistema)</label>
                  <input type="email" name="email" id="email" value={newEmployee.email} onChange={handleNewEmployeeChange} required placeholder="colaborador@empresa.com" className="mt-1 block w-full px-3 py-2 bg-white border border-blue-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"/>
                  <p className="mt-1 text-xs text-blue-600">La contraseña será el código de 6 dígitos generado automáticamente (fecha de nacimiento: DDMMAA)</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label htmlFor="nombres" className="block text-sm font-medium text-slate-700">Nombre(s)</label>
                    <input type="text" name="nombres" id="nombres" value={newEmployee.nombres} onChange={handleNewEmployeeChange} required className="mt-1 block w-full px-3 py-2 bg-white/40 border border-slate-300 rounded-md shadow-sm"/>
                  </div>
                  <div>
                    <label htmlFor="paterno" className="block text-sm font-medium text-slate-700">Apellido Paterno</label>
                    <input type="text" name="paterno" id="paterno" value={newEmployee.paterno} onChange={handleNewEmployeeChange} required className="mt-1 block w-full px-3 py-2 bg-white/40 border border-slate-300 rounded-md shadow-sm"/>
                  </div>
                  <div>
                    <label htmlFor="materno" className="block text-sm font-medium text-slate-700">Apellido Materno</label>
                    <input type="text" name="materno" id="materno" value={newEmployee.materno} onChange={handleNewEmployeeChange} className="mt-1 block w-full px-3 py-2 bg-white/40 border border-slate-300 rounded-md shadow-sm"/>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label htmlFor="fechaIngreso" className="block text-sm font-medium text-slate-700">Fecha de Ingreso</label>
                        <input type="date" name="fechaIngreso" id="fechaIngreso" value={newEmployee.fechaIngreso} onChange={handleNewEmployeeChange} required className="mt-1 block w-full px-3 py-2 bg-white/40 border border-slate-300 rounded-md shadow-sm"/>
                    </div>
                    <div>
                        <label htmlFor="fechaNacimiento" className="block text-sm font-medium text-slate-700">Fecha de Cumpleaños</label>
                        <input type="date" name="fechaNacimiento" id="fechaNacimiento" value={newEmployee.fechaNacimiento} onChange={handleNewEmployeeChange} required className="mt-1 block w-full px-3 py-2 bg-white/40 border border-slate-300 rounded-md shadow-sm"/>
                    </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label htmlFor="curp" className="block text-sm font-medium text-slate-700">CURP</label>
                    <input type="text" name="curp" id="curp" value={newEmployee.curp} onChange={handleNewEmployeeChange} className="mt-1 block w-full px-3 py-2 bg-white/40 border border-slate-300 rounded-md shadow-sm"/>
                  </div>
                  <div>
                    <label htmlFor="rfc" className="block text-sm font-medium text-slate-700">RFC</label>
                    <input type="text" name="rfc" id="rfc" value={newEmployee.rfc} onChange={handleNewEmployeeChange} className="mt-1 block w-full px-3 py-2 bg-white/40 border border-slate-300 rounded-md shadow-sm"/>
                  </div>
                  <div>
                    <label htmlFor="nss" className="block text-sm font-medium text-slate-700">NSS</label>
                    <input type="text" name="nss" id="nss" value={newEmployee.nss} onChange={handleNewEmployeeChange} className="mt-1 block w-full px-3 py-2 bg-white/40 border border-slate-300 rounded-md shadow-sm"/>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="departamento" className="block text-sm font-medium text-slate-700">Departamento</label>
                    <input type="text" name="departamento" id="departamento" value={newEmployee.departamento} onChange={handleNewEmployeeChange} className="mt-1 block w-full px-3 py-2 bg-white/40 border border-slate-300 rounded-md shadow-sm"/>
                  </div>
                  <div>
                    <label htmlFor="puesto" className="block text-sm font-medium text-slate-700">Puesto</label>
                    <input type="text" name="puesto" id="puesto" value={newEmployee.puesto} onChange={handleNewEmployeeChange} className="mt-1 block w-full px-3 py-2 bg-white/40 border border-slate-300 rounded-md shadow-sm"/>
                  </div>
                </div>
                
                {/* --- Horarios Start --- */}
                <div className="p-4 bg-black/5 border border-slate-300/50 rounded-lg space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700">Horario Lunes, Martes, Miércoles y Viernes</label>
                    <div className="mt-1 grid grid-cols-2 gap-4">
                        <select name="lunesMiercolesViernesEntrada" value={scheduleForm.lunesMiercolesViernesEntrada} onChange={handleScheduleFormChange} className="block w-full px-3 py-2 bg-white/40 border border-slate-300 rounded-md shadow-sm">
                            {timeOptions.map(t => <option key={`lmv-in-${t}`} value={t}>{t}</option>)}
                        </select>
                        <select name="lunesMiercolesViernesSalida" value={scheduleForm.lunesMiercolesViernesSalida} onChange={handleScheduleFormChange} className="block w-full px-3 py-2 bg-white/40 border border-slate-300 rounded-md shadow-sm">
                            {timeOptions.map(t => <option key={`lmv-out-${t}`} value={t}>{t}</option>)}
                        </select>
                    </div>
                  </div>
                   <div>
                    <label className="block text-sm font-medium text-slate-700">Horario Jueves Caminata De Arte</label>
                    <div className="mt-1 grid grid-cols-3 gap-4">
                        <select name="juevesTrabaja" value={scheduleForm.juevesTrabaja} onChange={handleScheduleFormChange} className="col-span-1 block w-full px-3 py-2 bg-white/40 border border-slate-300 rounded-md shadow-sm">
                            <option value="si">Trabaja</option>
                            <option value="no">Descansa</option>
                        </select>
                        {scheduleForm.juevesTrabaja === 'si' && (
                            <>
                               <select name="juevesEntrada" value={scheduleForm.juevesEntrada} onChange={handleScheduleFormChange} className="block w-full px-3 py-2 bg-white/40 border border-slate-300 rounded-md shadow-sm">
                                    {timeOptions.map(t => <option key={`jue-in-${t}`} value={t}>{t}</option>)}
                                </select>
                                <select name="juevesSalida" value={scheduleForm.juevesSalida} onChange={handleScheduleFormChange} className="block w-full px-3 py-2 bg-white/40 border border-slate-300 rounded-md shadow-sm">
                                    {timeOptions.map(t => <option key={`jue-out-${t}`} value={t}>{t}</option>)}
                                </select>
                            </>
                        )}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700">Horario Sábado</label>
                    <div className="mt-1 grid grid-cols-3 gap-4">
                        <select name="sabadoTrabaja" value={scheduleForm.sabadoTrabaja} onChange={handleScheduleFormChange} className="col-span-1 block w-full px-3 py-2 bg-white/40 border border-slate-300 rounded-md shadow-sm">
                            <option value="si">Trabaja</option>
                            <option value="no">Descansa</option>
                        </select>
                        {scheduleForm.sabadoTrabaja === 'si' && (
                            <>
                               <select name="sabEntrada" value={scheduleForm.sabEntrada} onChange={handleScheduleFormChange} className="block w-full px-3 py-2 bg-white/40 border border-slate-300 rounded-md shadow-sm">
                                    {timeOptions.map(t => <option key={`sab-in-${t}`} value={t}>{t}</option>)}
                                </select>
                                <select name="sabSalida" value={scheduleForm.sabSalida} onChange={handleScheduleFormChange} className="block w-full px-3 py-2 bg-white/40 border border-slate-300 rounded-md shadow-sm">
                                    {timeOptions.map(t => <option key={`sab-out-${t}`} value={t}>{t}</option>)}
                                </select>
                            </>
                        )}
                    </div>
                  </div>
                </div>
                {/* --- Horarios End --- */}

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label htmlFor="bonoPuntualidad" className="block text-sm font-medium text-slate-700">Bono Puntualidad ($)</label>
                    <input type="number" step="0.01" min="0" name="bonoPuntualidad" id="bonoPuntualidad" value={newEmployee.bonoPuntualidad} onChange={handleNewEmployeeChange} className="mt-1 block w-full px-3 py-2 bg-white/40 border border-slate-300 rounded-md shadow-sm"/>
                  </div>
                  <div>
                    <label htmlFor="bonoObjetivos" className="block text-sm font-medium text-slate-700">Bono Objetivos ($)</label>
                    <input type="number" step="0.01" min="0" name="bonoObjetivos" id="bonoObjetivos" value={newEmployee.bonoObjetivos} onChange={handleNewEmployeeChange} className="mt-1 block w-full px-3 py-2 bg-white/40 border border-slate-300 rounded-md shadow-sm"/>
                  </div>
                  <div>
                    <label htmlFor="apoyoGasolina" className="block text-sm font-medium text-slate-700">Apoyo Gasolina ($)</label>
                    <input type="number" step="0.01" min="0" name="apoyoGasolina" id="apoyoGasolina" value={newEmployee.apoyoGasolina} onChange={handleNewEmployeeChange} className="mt-1 block w-full px-3 py-2 bg-white/40 border border-slate-300 rounded-md shadow-sm"/>
                  </div>
                </div>
                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={isRegistering}
                    className="mt-2 inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isRegistering ? (
                      <>
                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Registrando...
                      </>
                    ) : (
                      'Registrar Colaborador'
                    )}
                  </button>
                </div>
              </form>

              <div className="mt-8">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-bold text-slate-800">Colaboradores Registrados</h3>
                    <button
                    onClick={handleDownloadEmployeesCSV}
                    disabled={detailedEmployees.length === 0}
                    className="inline-flex items-center px-3 py-1 border border-slate-300 text-sm font-medium rounded-md shadow-sm text-slate-700 bg-white/60 hover:bg-white/80 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-500 disabled:bg-slate-100/50 disabled:cursor-not-allowed disabled:text-slate-400"
                    >
                    <DownloadIcon />
                    <span className="ml-2">Descargar Excel</span>
                    </button>
                </div>
                <div className="overflow-x-auto">
                    <table className="min-w-full bg-white/60 rounded-lg shadow">
                        <thead className="bg-white/80">
                            <tr>
                                <th className="py-3 px-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Acciones</th>
                                <th className="py-3 px-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Código</th>
                                <th className="py-3 px-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Email</th>
                                <th className="py-3 px-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Nombre Completo</th>
                                <th className="py-3 px-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Puesto</th>
                                <th className="py-3 px-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Departamento</th>
                                <th className="py-3 px-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Horario L,M,M,V</th>
                                <th className="py-3 px-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Horario Jueves</th>
                                <th className="py-3 px-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Horario Sáb</th>
                                <th className="py-3 px-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Fecha Ingreso</th>
                                <th className="py-3 px-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Antigüedad</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                            {detailedEmployees.length > 0 ? detailedEmployees.map(emp => (
                                <tr key={emp.id} className="hover:bg-slate-100/50">
                                    <td className="py-3 px-4 whitespace-nowrap text-sm">
                                        <div className="flex space-x-2">
                                            <button
                                                onClick={() => handleEditEmployee(emp)}
                                                className="text-blue-600 hover:text-blue-800 font-medium"
                                                title="Editar"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                                </svg>
                                            </button>
                                            <button
                                                onClick={() => handleDeleteEmployee(emp)}
                                                className="text-red-600 hover:text-red-800 font-medium"
                                                title="Dar de baja"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                </svg>
                                            </button>
                                            {/* Botón crear cuenta - solo si no tiene firebaseUid */}
                                            {!emp.firebaseUid && (
                                                <button
                                                    onClick={() => handleCreateAccount(emp)}
                                                    disabled={creatingAccountForId === emp.id}
                                                    className={`font-medium ${
                                                        emp.email
                                                            ? 'text-green-600 hover:text-green-800'
                                                            : 'text-slate-400 cursor-not-allowed'
                                                    }`}
                                                    title={emp.email ? 'Crear cuenta de acceso' : 'Agrega un email primero'}
                                                >
                                                    {creatingAccountForId === emp.id ? (
                                                        <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                        </svg>
                                                    ) : (
                                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                                                        </svg>
                                                    )}
                                                </button>
                                            )}
                                            {/* Indicador de cuenta activa y botón restablecer contraseña */}
                                            {emp.firebaseUid && (
                                                <>
                                                    <span className="text-green-500" title="Cuenta activa">
                                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                                                        </svg>
                                                    </span>
                                                    <button
                                                        onClick={() => handleResetPassword(emp)}
                                                        disabled={resettingPasswordForId === emp.id}
                                                        className="text-amber-600 hover:text-amber-800 font-medium"
                                                        title="Restablecer contraseña"
                                                    >
                                                        {resettingPasswordForId === emp.id ? (
                                                            <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                            </svg>
                                                        ) : (
                                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                                                            </svg>
                                                        )}
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    </td>
                                    <td className="py-3 px-4 whitespace-nowrap text-sm text-slate-700 font-mono">{emp.codigo}</td>
                                    <td className="py-3 px-4 whitespace-nowrap text-sm text-slate-700">
                                        {emp.email ? (
                                            <span className="text-blue-600">{emp.email}</span>
                                        ) : (
                                            <span className="text-slate-400 italic">Sin email</span>
                                        )}
                                    </td>
                                    <td className="py-3 px-4 whitespace-nowrap text-sm text-slate-800">{`${emp.nombres} ${emp.paterno} ${emp.materno}`}</td>
                                    <td className="py-3 px-4 whitespace-nowrap text-sm text-slate-700">{emp.puesto}</td>
                                    <td className="py-3 px-4 whitespace-nowrap text-sm text-slate-700">{emp.departamento}</td>
                                    <td className="py-3 px-4 whitespace-nowrap text-sm text-slate-700">{emp.horarioLunesMiercolesViernes}</td>
                                    <td className="py-3 px-4 whitespace-nowrap text-sm text-slate-700">{emp.horarioJueves}</td>
                                    <td className="py-3 px-4 whitespace-nowrap text-sm text-slate-700">{emp.horarioSabado}</td>
                                    <td className="py-3 px-4 whitespace-nowrap text-sm text-slate-700 font-mono">{emp.fechaIngreso}</td>
                                    <td className="py-3 px-4 whitespace-nowrap text-sm text-slate-700">{calculateTenure(emp.fechaIngreso)}</td>
                                </tr>
                            )) : (
                                <tr>
                                    <td colSpan={11} className="text-center py-4 text-sm text-slate-500">No hay colaboradores registrados.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal de Edición */}
      {isEditModalOpen && editingEmployee && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-200">
              <div className="flex justify-between items-center">
                <h3 className="text-xl font-bold text-slate-800">Editar Colaborador</h3>
                <button
                  onClick={() => { setIsEditModalOpen(false); setEditingEmployee(null); }}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              {/* Email */}
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <label className="block text-sm font-medium text-blue-800 mb-1">Email (para acceso al sistema)</label>
                <input
                  type="email"
                  name="email"
                  value={editingEmployee.email || ''}
                  onChange={handleEditFormChange}
                  placeholder="colaborador@empresa.com"
                  className="w-full px-3 py-2 bg-white border border-blue-300 rounded-md shadow-sm"
                />
                {!editingEmployee.firebaseUid && editingEmployee.email && (
                  <p className="mt-1 text-xs text-amber-600">
                    Nota: Este colaborador no tiene cuenta de acceso. Para crearla, deberás registrarlo nuevamente.
                  </p>
                )}
              </div>

              {/* Datos personales */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700">Nombre(s)</label>
                  <input type="text" name="nombres" value={editingEmployee.nombres} onChange={handleEditFormChange} className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-md"/>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">Apellido Paterno</label>
                  <input type="text" name="paterno" value={editingEmployee.paterno} onChange={handleEditFormChange} className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-md"/>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">Apellido Materno</label>
                  <input type="text" name="materno" value={editingEmployee.materno} onChange={handleEditFormChange} className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-md"/>
                </div>
              </div>

              {/* Fechas */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700">Fecha de Ingreso</label>
                  <input type="date" name="fechaIngreso" value={editingEmployee.fechaIngreso} onChange={handleEditFormChange} className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-md"/>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">Fecha de Cumpleaños</label>
                  <input type="date" name="fechaNacimiento" value={editingEmployee.fechaNacimiento} onChange={handleEditFormChange} className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-md"/>
                </div>
              </div>

              {/* Documentos */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700">CURP</label>
                  <input type="text" name="curp" value={editingEmployee.curp} onChange={handleEditFormChange} className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-md"/>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">RFC</label>
                  <input type="text" name="rfc" value={editingEmployee.rfc} onChange={handleEditFormChange} className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-md"/>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">NSS</label>
                  <input type="text" name="nss" value={editingEmployee.nss} onChange={handleEditFormChange} className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-md"/>
                </div>
              </div>

              {/* Puesto y Departamento */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700">Departamento</label>
                  <input type="text" name="departamento" value={editingEmployee.departamento} onChange={handleEditFormChange} className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-md"/>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">Puesto</label>
                  <input type="text" name="puesto" value={editingEmployee.puesto} onChange={handleEditFormChange} className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-md"/>
                </div>
              </div>

              {/* Bonos */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700">Bono Puntualidad ($)</label>
                  <input type="number" step="0.01" min="0" name="bonoPuntualidad" value={editingEmployee.bonoPuntualidad} onChange={handleEditFormChange} className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-md"/>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">Bono Objetivos ($)</label>
                  <input type="number" step="0.01" min="0" name="bonoObjetivos" value={editingEmployee.bonoObjetivos} onChange={handleEditFormChange} className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-md"/>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">Apoyo Gasolina ($)</label>
                  <input type="number" step="0.01" min="0" name="apoyoGasolina" value={editingEmployee.apoyoGasolina} onChange={handleEditFormChange} className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-md"/>
                </div>
              </div>

              {/* Gestión de Contraseña */}
              {editingEmployee.firebaseUid && editingEmployee.email && (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                  <label className="block text-sm font-medium text-amber-800 mb-2">Gestión de Contraseña</label>
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-slate-600">
                      {editingEmployee.lastPasswordReset ? (
                        <p>Último restablecimiento: <strong>{new Date(editingEmployee.lastPasswordReset).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</strong></p>
                      ) : (
                        <p className="text-slate-400">Sin restablecimientos registrados</p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleResetPassword(editingEmployee)}
                      disabled={resettingPasswordForId === editingEmployee.id}
                      className="ml-3 px-3 py-1.5 text-sm text-white bg-amber-600 hover:bg-amber-700 rounded-md disabled:opacity-50 flex items-center gap-1"
                    >
                      {resettingPasswordForId === editingEmployee.id ? (
                        <>
                          <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Enviando...
                        </>
                      ) : (
                        'Enviar email de restablecimiento'
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* Info adicional */}
              <div className="p-3 bg-slate-50 rounded-lg text-sm text-slate-600">
                <p><strong>Código:</strong> {editingEmployee.codigo}</p>
                {editingEmployee.firebaseUid && (
                  <p className="text-green-600 mt-1">Este colaborador tiene cuenta de acceso activa.</p>
                )}
              </div>
            </div>

            <div className="p-6 border-t border-slate-200 flex justify-end space-x-3">
              <button
                onClick={() => { setIsEditModalOpen(false); setEditingEmployee(null); }}
                className="px-4 py-2 text-slate-700 bg-slate-100 rounded-md hover:bg-slate-200"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={isSavingEdit}
                className="px-4 py-2 text-white bg-gradient-to-r from-amber-600 to-orange-600 rounded-md hover:from-amber-700 hover:to-orange-700 disabled:opacity-50"
              >
                {isSavingEdit ? 'Guardando...' : 'Guardar Cambios'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Edición de Log de Asistencia */}
      {isLogEditModalOpen && editingLog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
            <div className="p-6 border-b border-slate-200">
              <div className="flex justify-between items-center">
                <h3 className="text-xl font-bold text-slate-800">Editar Registro de Asistencia</h3>
                <button
                  onClick={() => { setIsLogEditModalOpen(false); setEditingLog(null); }}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              {/* Colaborador (solo lectura) */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Colaborador</label>
                <input
                  type="text"
                  value={editingLog.employeeName}
                  readOnly
                  className="w-full px-3 py-2 bg-slate-100 border border-slate-300 rounded-md text-slate-600"
                />
              </div>

              {/* Tipo de registro */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Tipo de Registro</label>
                <select
                  value={editingLog.type}
                  onChange={(e) => setEditingLog({ ...editingLog, type: e.target.value as LogType })}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md shadow-sm"
                >
                  <option value={LogType.ENTRADA}>ENTRADA</option>
                  <option value={LogType.SALIDA}>SALIDA</option>
                  <option value={LogType.INICIO_COMIDA}>INICIO COMIDA</option>
                  <option value={LogType.FIN_COMIDA}>FIN COMIDA</option>
                </select>
              </div>

              {/* Fecha */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Fecha</label>
                <input
                  type="date"
                  value={editLogDate}
                  onChange={(e) => setEditLogDate(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md shadow-sm"
                />
              </div>

              {/* Hora */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Hora</label>
                <input
                  type="time"
                  value={editLogTime}
                  onChange={(e) => setEditLogTime(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md shadow-sm"
                />
              </div>

              {/* Ubicación (solo lectura si existe) */}
              {editingLog.location && (
                <div className="p-3 bg-slate-50 rounded-lg text-sm text-slate-600">
                  <p><strong>Ubicación registrada:</strong></p>
                  <p className="font-mono text-xs mt-1">
                    {editingLog.location.lat.toFixed(6)}, {editingLog.location.lon.toFixed(6)}
                  </p>
                  <a
                    href={`https://www.google.com/maps?q=${editingLog.location.lat},${editingLog.location.lon}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-amber-600 hover:underline text-xs"
                  >
                    Ver en mapa
                  </a>
                </div>
              )}

              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
                <p><strong>Nota:</strong> Esta función es para corregir errores en los registros. Use con responsabilidad.</p>
              </div>
            </div>

            <div className="p-6 border-t border-slate-200 flex justify-end space-x-3">
              <button
                onClick={() => { setIsLogEditModalOpen(false); setEditingLog(null); }}
                className="px-4 py-2 text-slate-700 bg-slate-100 rounded-md hover:bg-slate-200"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveLogEdit}
                disabled={isSavingLog}
                className="px-4 py-2 text-white bg-gradient-to-r from-amber-600 to-orange-600 rounded-md hover:from-amber-700 hover:to-orange-700 disabled:opacity-50"
              >
                {isSavingLog ? 'Guardando...' : 'Guardar Cambios'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};