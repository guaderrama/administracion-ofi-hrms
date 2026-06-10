import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { EmployeeSelector } from './EmployeeSelector';
import { LoginModal } from './LoginModal';
import { ActionButtons } from './ActionButtons';
import { LogTable } from './LogTable';
import { OwedHoursDisplay } from './OwedHoursDisplay';
import { Header } from './Header';
import { IncomeForm } from './IncomeForm';
import { IncomeTable } from './IncomeTable';
import { IncomeChart } from './IncomeChart';
import type { Employee, LogEntry, Location, IncomeEntry, DetailedEmployee } from '../../types';
import { ClockStatus, LogType } from '../../types';
import { EMPLOYEES } from '../../checadorConstants';
import { useAuth } from '../../src/contexts/AuthContext';
import { logsService, employeesService, incomesService } from '../../src/services/firestoreService';
import { PaymentConcept } from '../../types';
import { useToast } from '../ui/Toast';
import { ConfirmDialog } from '../ui/ConfirmDialog';

export const ChecadorPage: React.FC = () => {
    const { user, userData, isAdmin, isSupervisor } = useAuth();
    const toast = useToast();
    const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
    const [authenticatedEmployee, setAuthenticatedEmployee] = useState<Employee | null>(null);
    const [dailyLogs, setDailyLogs] = useState<LogEntry[]>([]);
    const [clockStatus, setClockStatus] = useState<ClockStatus>(ClockStatus.OUT_OF_OFFICE);
    const [owedHours, setOwedHours] = useState<number>(0);
    const [incomes, setIncomes] = useState<IncomeEntry[]>([]);
    const [detailedEmployees, setDetailedEmployees] = useState<DetailedEmployee[]>([]);

    // Estados para edición de ingresos (solo admin)
    const [editingIncome, setEditingIncome] = useState<IncomeEntry | null>(null);
    const [isIncomeEditModalOpen, setIsIncomeEditModalOpen] = useState(false);
    const [isSavingIncome, setIsSavingIncome] = useState(false);

    // Estado para diálogo de confirmación
    const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; income: IncomeEntry | null }>({ isOpen: false, income: null });

    // Proteccion contra doble click en checador
    const [isProcessingLog, setIsProcessingLog] = useState(false);
    const [logConfirm, setLogConfirm] = useState<{ isOpen: boolean; type: LogType | null }>({ isOpen: false, type: null });

    // Cargar empleados desde Firestore
    useEffect(() => {
        const unsubscribe = employeesService.subscribe((employees) => {
            setDetailedEmployees(employees.filter(e => e.activo !== false));
        });
        return () => unsubscribe();
    }, []);

    // Función para obtener el PIN correcto de detailed_employees o EMPLOYEES
    const getEmployeePin = useCallback((employeeName: string): string => {
        // Buscar en detailedEmployees (Firestore)
        const matchingDetailedEmp = detailedEmployees.find(emp => {
            const fullName = `${emp.paterno} ${emp.materno} ${emp.nombres}`.toUpperCase().trim();
            const empNameNormalized = employeeName.toUpperCase().trim();
            return empNameNormalized === fullName ||
                   (empNameNormalized.includes(emp.paterno.toUpperCase()) &&
                    empNameNormalized.includes(emp.nombres.toUpperCase()));
        });
        if (matchingDetailedEmp && matchingDetailedEmp.codigo) {
            return matchingDetailedEmp.codigo;
        }
        // Fallback al PIN de EMPLOYEES
        const empFromConstants = EMPLOYEES.find(e => e.name === employeeName);
        return empFromConstants?.pin || '';
    }, [detailedEmployees]);

    // Generar lista de empleados combinando EMPLOYEES constante + detailedEmployees de Firestore
    const syncedEmployees = useMemo((): Employee[] => {
        // Crear lista base desde EMPLOYEES
        const baseEmployees = EMPLOYEES.map(emp => {
            const matchingDetailedEmp = detailedEmployees.find(detEmp => {
                const fullName = `${detEmp.paterno} ${detEmp.materno} ${detEmp.nombres}`.toUpperCase().trim();
                const empNameNormalized = emp.name.toUpperCase().trim();
                return empNameNormalized === fullName ||
                       (empNameNormalized.includes(detEmp.paterno.toUpperCase()) &&
                        empNameNormalized.includes(detEmp.nombres.toUpperCase()));
            });

            if (matchingDetailedEmp && matchingDetailedEmp.codigo) {
                return { ...emp, pin: matchingDetailedEmp.codigo };
            }
            return emp;
        });

        // Agregar empleados de Firestore que no están en EMPLOYEES
        const additionalEmployees: Employee[] = detailedEmployees
            .filter(detEmp => {
                const fullName = `${detEmp.paterno} ${detEmp.materno} ${detEmp.nombres}`.toUpperCase().trim();
                return !baseEmployees.some(emp =>
                    emp.name.toUpperCase().trim() === fullName ||
                    (emp.name.toUpperCase().includes(detEmp.paterno.toUpperCase()) &&
                     emp.name.toUpperCase().includes(detEmp.nombres.toUpperCase()))
                );
            })
            .map(detEmp => ({
                name: `${detEmp.paterno} ${detEmp.materno} ${detEmp.nombres}`.toUpperCase(),
                pin: detEmp.codigo || '',
                scheduleStartTime: '09:00',
                birthDate: detEmp.fechaNacimiento || '',
                hireDate: detEmp.fechaIngreso || ''
            }));

        return [...baseEmployees, ...additionalEmployees];
    }, [detailedEmployees]);

    // Filtrar empleados según el usuario autenticado
    // Admin ve todos, empleado solo ve su propio nombre
    const filteredEmployees = useMemo(() => {
        // Admin y Supervisor ven todos los empleados
        if (isAdmin || isSupervisor) {
            return syncedEmployees;
        }

        // Si es empleado, buscar su registro en detailed_employees por email
        const userEmail = user?.email;
        if (!userEmail) return []; // Si no hay email, no mostrar empleados

        // Buscar en detailedEmployees (Firestore) por email
        const matchingEmployee = detailedEmployees.find(
            emp => emp.email?.toLowerCase() === userEmail.toLowerCase()
        );

        if (matchingEmployee) {
            // Construir nombre completo del empleado
            const fullName = `${matchingEmployee.paterno} ${matchingEmployee.materno} ${matchingEmployee.nombres}`.toUpperCase();

            // Buscar en syncedEmployees por nombre similar
            const matchingChecadorEmployee = syncedEmployees.find(emp => {
                const empNameNormalized = emp.name.toUpperCase().trim();
                const fullNameNormalized = fullName.trim();
                return empNameNormalized === fullNameNormalized ||
                       (empNameNormalized.includes(matchingEmployee.paterno.toUpperCase()) &&
                        empNameNormalized.includes(matchingEmployee.nombres.toUpperCase()));
            });

            if (matchingChecadorEmployee) {
                // Retornar solo el empleado que coincide con el email del usuario
                return [{
                    ...matchingChecadorEmployee,
                    pin: matchingEmployee.codigo || matchingChecadorEmployee.pin
                }];
            }

            // Si no está en syncedEmployees, crear uno nuevo
            return [{
                name: fullName,
                pin: matchingEmployee.codigo || '',
                scheduleStartTime: '09:00',
                birthDate: matchingEmployee.fechaNacimiento || '',
                hireDate: matchingEmployee.fechaIngreso || ''
            }];
        }

        // Si no se encuentra el empleado por email, retornar lista vacía
        return [];
    }, [user, isAdmin, isSupervisor, syncedEmployees, detailedEmployees]);

    const loadDailyLogs = useCallback(async (employee: Employee) => {
        try {
            // Cargar desde Firestore (fuente de verdad)
            const logs = await logsService.getByEmployeeAndDate(employee.name);
            setDailyLogs(logs);

            // Determinar estado del reloj basado en el último registro
            const lastLog = logs[logs.length - 1];
            if (!lastLog) {
                setClockStatus(ClockStatus.OUT_OF_OFFICE);
            } else {
                switch (lastLog.type) {
                    case LogType.ENTRADA:
                        setClockStatus(ClockStatus.WORKING);
                        break;
                    case LogType.INICIO_COMIDA:
                        setClockStatus(ClockStatus.ON_LUNCH);
                        break;
                    case LogType.FIN_COMIDA:
                        setClockStatus(ClockStatus.WORKING);
                        break;
                    case LogType.SALIDA:
                        setClockStatus(ClockStatus.OUT_OF_OFFICE);
                        break;
                }
            }
        } catch (error) {
            console.error('Error al cargar registros desde Firestore:', error);
            setDailyLogs([]);
        }
    }, []);
    
    const loadIncomes = useCallback(async (employee: Employee) => {
        try {
            // Cargar desde Firestore (fuente de verdad)
            const loadedIncomes = await incomesService.getByEmployee(employee.name);
            setIncomes(loadedIncomes);
        } catch (error) {
            console.error('Error al cargar ingresos:', error);
            setIncomes([]);
        }
    }, []);

    const loadOwedHours = useCallback((_employee: Employee) => {
        // TODO: Migrar owed hours a Firestore cuando se implemente el servicio
        setOwedHours(0);
    }, []);

    useEffect(() => {
        if (authenticatedEmployee) {
            loadDailyLogs(authenticatedEmployee);
            loadOwedHours(authenticatedEmployee);
            loadIncomes(authenticatedEmployee);
        }
    }, [authenticatedEmployee, loadDailyLogs, loadOwedHours, loadIncomes]);

    const handleEmployeeSelect = (employeeName: string) => {
        // Buscar primero en la lista filtrada, luego en EMPLOYEES
        const employee = filteredEmployees.find(e => e.name === employeeName) ||
                        EMPLOYEES.find(e => e.name === employeeName);
        if (employee) {
            // Acceso directo sin PIN para todos los colaboradores
            setAuthenticatedEmployee(employee);
        }
    };

    const handleLogin = (pin: string) => {
        if (selectedEmployee && selectedEmployee.pin === pin) {
            setAuthenticatedEmployee(selectedEmployee);
            setSelectedEmployee(null);
        } else {
            toast.error('PIN incorrecto. Intente de nuevo.');
        }
    };
    
    const handleLogout = () => {
        setAuthenticatedEmployee(null);
        setDailyLogs([]);
        setClockStatus(ClockStatus.OUT_OF_OFFICE);
    }

    const logTypeLabels: Record<string, string> = {
        [LogType.ENTRADA]: 'Registrar Entrada',
        [LogType.INICIO_COMIDA]: 'Iniciar Comida',
        [LogType.FIN_COMIDA]: 'Terminar Comida',
        [LogType.SALIDA]: 'Registrar Salida',
    };

    const handleLog = (type: LogType) => {
        if (!authenticatedEmployee || isProcessingLog) return;
        // Mostrar confirmacion antes de registrar
        setLogConfirm({ isOpen: true, type });
    };

    const confirmLog = () => {
        const type = logConfirm.type;
        setLogConfirm({ isOpen: false, type: null });
        if (!type || !authenticatedEmployee || isProcessingLog) return;

        setIsProcessingLog(true);

        // Obtener ubicación rápido (timeout corto, acepta cache reciente)
        navigator.geolocation.getCurrentPosition(
            (position) => {
                saveLog(type, { lat: position.coords.latitude, lon: position.coords.longitude });
            },
            () => saveLog(type),
            { enableHighAccuracy: false, timeout: 2000, maximumAge: 30000 }
        );
    };

    const saveLog = async (type: LogType, location?: Location) => {
        if (!authenticatedEmployee) {
            setIsProcessingLog(false);
            return;
        }

        const matchedEmp = detailedEmployees.find(emp => {
            const fullName = `${emp.paterno} ${emp.materno} ${emp.nombres}`.toUpperCase().trim();
            return authenticatedEmployee.name.toUpperCase().trim() === fullName ||
                (authenticatedEmployee.name.toUpperCase().includes(emp.paterno.toUpperCase()) &&
                 authenticatedEmployee.name.toUpperCase().includes(emp.nombres.toUpperCase()));
        });

        const newLog: LogEntry = {
            employeeName: authenticatedEmployee.name,
            employeeCode: matchedEmp?.codigo || '',
            type,
            timestamp: Date.now(),
            ...(location ? { location } : {}),
        };

        try {
            // Crear log directamente (rápido, sin transacción)
            await logsService.create(newLog);
            toast.success(`${logTypeLabels[type] || type} registrado.`);
            // Actualizar logs en background
            loadDailyLogs(authenticatedEmployee);
        } catch (error: any) {
            console.error('Error al guardar registro:', error);
            toast.error(`Error: ${error.message || 'desconocido'}`);
            loadDailyLogs(authenticatedEmployee);
        } finally {
            setIsProcessingLog(false);
        }
    };

    const handleSaveIncome = async (data: Omit<IncomeEntry, 'id' | 'employeeName' | 'notes'>) => {
        if (!authenticatedEmployee) return;

        try {
            const newIncome = await incomesService.create({
                employeeName: authenticatedEmployee.name,
                ...data
            });
            setIncomes([...incomes, newIncome]);
            toast.success('Ingreso registrado exitosamente.');
        } catch (error) {
            console.error('Error al guardar ingreso:', error);
            toast.error('Error al guardar ingreso. Intenta de nuevo.');
        }
    };

    // Funciones para edición de ingresos (solo admin)
    const handleEditIncome = (income: IncomeEntry) => {
        setEditingIncome({ ...income });
        setIsIncomeEditModalOpen(true);
    };

    const handleDeleteIncome = (income: IncomeEntry) => {
        setDeleteConfirm({ isOpen: true, income });
    };

    const confirmDeleteIncome = async () => {
        const income = deleteConfirm.income;
        if (!income) return;
        setDeleteConfirm({ isOpen: false, income: null });

        try {
            await incomesService.delete(income.id, income.employeeName);
            setIncomes(incomes.filter(i => i.id !== income.id));
            toast.success('Ingreso eliminado exitosamente.');
        } catch (error: any) {
            console.error('Error al eliminar ingreso:', error);
            toast.error(`Error al eliminar: ${error.message}`);
        }
    };

    const handleSaveIncomeEdit = async () => {
        if (!editingIncome) return;

        setIsSavingIncome(true);
        try {
            await incomesService.update(editingIncome.id, editingIncome);
            setIncomes(incomes.map(i => i.id === editingIncome.id ? editingIncome : i));
            toast.success('Ingreso actualizado exitosamente.');
            setIsIncomeEditModalOpen(false);
            setEditingIncome(null);
        } catch (error: any) {
            console.error('Error al actualizar ingreso:', error);
            toast.error(`Error al actualizar: ${error.message}`);
        } finally {
            setIsSavingIncome(false);
        }
    };

    return (
        <div className="container mx-auto p-4 sm:p-6 lg:p-8 font-sans">
            <Header />

            {authenticatedEmployee ? (
                <div className="mt-8 space-y-8">
                    <div className="text-center">
                        <h2 className="text-2xl font-bold text-slate-800">Bienvenido, {authenticatedEmployee.name}</h2>
                        {isAdmin && <span className="text-xs bg-amber-100 text-amber-800 px-2 py-1 rounded-full ml-2">Admin</span>}
                        <button onClick={handleLogout} className="text-sm text-amber-600 hover:underline">Cerrar sesión</button>
                    </div>
                    {owedHours > 0 && <OwedHoursDisplay hours={owedHours} />}
                    <ActionButtons status={clockStatus} onLog={handleLog} disabled={isProcessingLog} />
                    <LogTable logs={dailyLogs} />
                    
                    <div className="border-t-2 border-slate-300/60 pt-8"></div>
                    
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
                        <div className="space-y-8">
                           <IncomeForm onSubmit={handleSaveIncome} />
                           <IncomeTable
                             incomes={incomes}
                             onEditIncome={isAdmin ? handleEditIncome : undefined}
                             onDeleteIncome={isAdmin ? handleDeleteIncome : undefined}
                           />
                        </div>
                        <div>
                           <IncomeChart incomes={incomes} />
                        </div>
                    </div>

                </div>
            ) : (
                <div className="mt-8 max-w-sm mx-auto">
                    <EmployeeSelector
                        onSelect={handleEmployeeSelect}
                        filteredEmployees={filteredEmployees}
                    />
                </div>
            )}

            {selectedEmployee && (
                <LoginModal
                    employeeName={selectedEmployee.name}
                    onLogin={handleLogin}
                    onClose={() => setSelectedEmployee(null)}
                />
            )}

            {/* Confirmacion para registrar asistencia */}
            <ConfirmDialog
                isOpen={logConfirm.isOpen}
                title={logConfirm.type ? logTypeLabels[logConfirm.type] || 'Confirmar' : 'Confirmar'}
                message={`¿Confirmas que deseas ${logConfirm.type ? (logTypeLabels[logConfirm.type] || '').toLowerCase() : ''}?`}
                variant="info"
                onConfirm={confirmLog}
                onCancel={() => setLogConfirm({ isOpen: false, type: null })}
                confirmText="Confirmar"
                cancelText="Cancelar"
            />

            {/* Diálogo de confirmación para eliminar ingreso */}
            <ConfirmDialog
                isOpen={deleteConfirm.isOpen}
                title="Eliminar Ingreso"
                message={deleteConfirm.income ? `¿Eliminar ingreso de ${deleteConfirm.income.paymentConcept} por $${deleteConfirm.income.amount.toLocaleString('es-MX', { minimumFractionDigits: 2 })}? Esta acción no se puede deshacer.` : ''}
                variant="danger"
                onConfirm={confirmDeleteIncome}
                onCancel={() => setDeleteConfirm({ isOpen: false, income: null })}
            />

            {/* Modal de Edición de Ingreso (solo admin) */}
            {isIncomeEditModalOpen && editingIncome && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
                        <div className="p-6 border-b border-slate-200">
                            <div className="flex justify-between items-center">
                                <h3 className="text-xl font-bold text-slate-800">Editar Ingreso</h3>
                                <button
                                    onClick={() => { setIsIncomeEditModalOpen(false); setEditingIncome(null); }}
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
                                    value={editingIncome.employeeName}
                                    readOnly
                                    className="w-full px-3 py-2 bg-slate-100 border border-slate-300 rounded-md text-slate-600"
                                />
                            </div>

                            {/* Fecha de Pago */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Fecha de Pago</label>
                                <input
                                    type="date"
                                    value={editingIncome.paymentDate}
                                    onChange={(e) => setEditingIncome({ ...editingIncome, paymentDate: e.target.value })}
                                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md shadow-sm"
                                />
                            </div>

                            {/* Concepto de Pago */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Concepto de Pago</label>
                                <select
                                    value={editingIncome.paymentConcept}
                                    onChange={(e) => setEditingIncome({ ...editingIncome, paymentConcept: e.target.value as PaymentConcept })}
                                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md shadow-sm"
                                >
                                    <option value={PaymentConcept.NOMINA}>Nómina</option>
                                    <option value={PaymentConcept.BONOS}>Bonos</option>
                                    <option value={PaymentConcept.CAMINATA}>Caminata</option>
                                    <option value={PaymentConcept.COMISIONES_SOUVENIRS}>Comisiones Souvenirs</option>
                                    <option value={PaymentConcept.COMISIONES_OBRAS}>Comisiones Obras</option>
                                    <option value={PaymentConcept.RETAIL}>Retail</option>
                                </select>
                            </div>

                            {/* Importe */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Importe ($)</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={editingIncome.amount}
                                    onChange={(e) => setEditingIncome({ ...editingIncome, amount: parseFloat(e.target.value) || 0 })}
                                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md shadow-sm"
                                />
                            </div>

                            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
                                <p><strong>Nota:</strong> Esta función es para corregir errores en los registros de ingresos.</p>
                            </div>
                        </div>

                        <div className="p-6 border-t border-slate-200 flex justify-end space-x-3">
                            <button
                                onClick={() => { setIsIncomeEditModalOpen(false); setEditingIncome(null); }}
                                className="px-4 py-2 text-slate-700 bg-slate-100 rounded-md hover:bg-slate-200"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleSaveIncomeEdit}
                                disabled={isSavingIncome}
                                className="px-4 py-2 text-white bg-gradient-to-r from-amber-600 to-orange-600 rounded-md hover:from-amber-700 hover:to-orange-700 disabled:opacity-50"
                            >
                                {isSavingIncome ? 'Guardando...' : 'Guardar Cambios'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};