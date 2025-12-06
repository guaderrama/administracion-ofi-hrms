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
import { logsService } from '../../src/services/firestoreService';

export const ChecadorPage: React.FC = () => {
    const { user, userData, isAdmin } = useAuth();
    const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
    const [authenticatedEmployee, setAuthenticatedEmployee] = useState<Employee | null>(null);
    const [dailyLogs, setDailyLogs] = useState<LogEntry[]>([]);
    const [clockStatus, setClockStatus] = useState<ClockStatus>(ClockStatus.OUT_OF_OFFICE);
    const [owedHours, setOwedHours] = useState<number>(0);
    const [incomes, setIncomes] = useState<IncomeEntry[]>([]);

    // Función para obtener el PIN correcto de detailed_employees o EMPLOYEES
    const getEmployeePin = useCallback((employeeName: string): string => {
        const storedEmployeesStr = localStorage.getItem('detailed_employees');
        if (storedEmployeesStr) {
            const detailedEmployees: DetailedEmployee[] = JSON.parse(storedEmployeesStr);
            // Buscar por nombre similar
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
        }
        // Fallback al PIN de EMPLOYEES
        const empFromConstants = EMPLOYEES.find(e => e.name === employeeName);
        return empFromConstants?.pin || '';
    }, []);

    // Generar lista de empleados con PINs sincronizados desde detailed_employees
    const syncedEmployees = useMemo((): Employee[] => {
        const storedEmployeesStr = localStorage.getItem('detailed_employees');
        if (!storedEmployeesStr) return EMPLOYEES;

        const detailedEmployees: DetailedEmployee[] = JSON.parse(storedEmployeesStr);

        // Actualizar PINs de EMPLOYEES con los códigos de detailed_employees
        return EMPLOYEES.map(emp => {
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
    }, []);

    // Filtrar empleados según el usuario autenticado
    // Admin ve todos, empleado solo ve su propio nombre
    const filteredEmployees = useMemo(() => {
        // Si es admin, mostrar todos los empleados (con PINs sincronizados)
        if (isAdmin) {
            return syncedEmployees;
        }

        // Si es empleado, buscar su registro en detailed_employees por email
        const userEmail = user?.email;
        if (!userEmail) return syncedEmployees; // Fallback si no hay email

        // Buscar en detailed_employees (localStorage) para encontrar el nombre del empleado
        const storedEmployeesStr = localStorage.getItem('detailed_employees');
        if (storedEmployeesStr) {
            const detailedEmployees: DetailedEmployee[] = JSON.parse(storedEmployeesStr);
            const matchingEmployee = detailedEmployees.find(
                emp => emp.email?.toLowerCase() === userEmail.toLowerCase()
            );

            if (matchingEmployee) {
                // Buscar en syncedEmployees por nombre similar
                const fullName = `${matchingEmployee.paterno} ${matchingEmployee.materno} ${matchingEmployee.nombres}`.toUpperCase();
                const matchingChecadorEmployee = syncedEmployees.find(emp => {
                    // Comparar nombres normalizados
                    const empNameNormalized = emp.name.toUpperCase().trim();
                    const fullNameNormalized = fullName.trim();
                    return empNameNormalized === fullNameNormalized ||
                           (empNameNormalized.includes(matchingEmployee.paterno.toUpperCase()) &&
                           empNameNormalized.includes(matchingEmployee.nombres.toUpperCase()));
                });

                if (matchingChecadorEmployee) {
                    // Usar el código de detailed_employees
                    return [{
                        ...matchingChecadorEmployee,
                        pin: matchingEmployee.codigo || matchingChecadorEmployee.pin
                    }];
                }
            }
        }

        // Si no se encuentra coincidencia, mostrar todos (fallback para admins o usuarios no encontrados)
        return syncedEmployees;
    }, [user, isAdmin, syncedEmployees]);

    const getTodayKey = (employeeName: string) => {
        const today = new Date().toISOString().slice(0, 10);
        return `logs_${employeeName.replace(/\s+/g, '_')}_${today}`;
    };

    const getIncomesKey = (employeeName: string) => {
        return `incomes_${employeeName.replace(/\s+/g, '_')}`;
    };
    
    const loadDailyLogs = useCallback((employee: Employee) => {
        const key = getTodayKey(employee.name);
        const storedLogs = localStorage.getItem(key);
        const logs: LogEntry[] = storedLogs ? JSON.parse(storedLogs) : [];
        setDailyLogs(logs);

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
    }, []);
    
    const loadIncomes = useCallback((employee: Employee) => {
        const key = getIncomesKey(employee.name);
        const storedIncomes = localStorage.getItem(key);
        const loadedIncomes: IncomeEntry[] = storedIncomes ? JSON.parse(storedIncomes) : [];
        setIncomes(loadedIncomes);
    }, []);

    const loadOwedHours = useCallback((employee: Employee) => {
        const storedOwedHours = localStorage.getItem('employee_owed_hours');
        if (storedOwedHours) {
            const allOwedHours = JSON.parse(storedOwedHours);
            setOwedHours(allOwedHours[employee.name] || 0);
        } else {
            setOwedHours(0);
        }
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
            setSelectedEmployee(employee);
        }
    };

    const handleLogin = (pin: string) => {
        if (selectedEmployee && selectedEmployee.pin === pin) {
            setAuthenticatedEmployee(selectedEmployee);
            setSelectedEmployee(null);
        } else {
            alert('PIN incorrecto. Intente de nuevo.');
        }
    };
    
    const handleLogout = () => {
        setAuthenticatedEmployee(null);
        setDailyLogs([]);
        setClockStatus(ClockStatus.OUT_OF_OFFICE);
    }

    const handleLog = (type: LogType) => {
        if (!authenticatedEmployee) return;

        navigator.geolocation.getCurrentPosition(
            (position) => {
                const location: Location = {
                    lat: position.coords.latitude,
                    lon: position.coords.longitude,
                };
                saveLog(type, location);
            },
            (error) => {
                console.error("Error obteniendo la geolocalización:", error);
                // Continuar sin ubicación si el usuario la deniega o hay un error
                saveLog(type);
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
    };

    const saveLog = async (type: LogType, location?: Location) => {
        if (!authenticatedEmployee) return;

        const newLog: LogEntry = {
            employeeName: authenticatedEmployee.name,
            type,
            timestamp: Date.now(),
            location,
        };

        try {
            // Guardar en Firestore (también actualiza localStorage como backup)
            await logsService.create(newLog);

            // Guardar en log diario (localStorage para vista rápida)
            const key = getTodayKey(authenticatedEmployee.name);
            const updatedLogs = [...dailyLogs, newLog];
            localStorage.setItem(key, JSON.stringify(updatedLogs));

            setDailyLogs(updatedLogs);
            loadDailyLogs(authenticatedEmployee); // Recargar para actualizar status
        } catch (error) {
            console.error('Error al guardar registro:', error);
            alert('Error al guardar registro. Intenta de nuevo.');
        }
    };

    const handleSaveIncome = (data: Omit<IncomeEntry, 'id' | 'employeeName' | 'notes'>) => {
        if (!authenticatedEmployee) return;

        const newIncome: IncomeEntry = {
            id: new Date().toISOString() + '-' + Math.random().toString(36).substr(2, 9),
            employeeName: authenticatedEmployee.name,
            ...data
        };

        const key = getIncomesKey(authenticatedEmployee.name);
        const updatedIncomes = [...incomes, newIncome];
        localStorage.setItem(key, JSON.stringify(updatedIncomes));
        setIncomes(updatedIncomes);
        alert('Ingreso registrado exitosamente.');
    };

    return (
        <div className="container mx-auto p-4 sm:p-6 lg:p-8 font-sans">
            <Header />

            {authenticatedEmployee ? (
                <div className="mt-8 space-y-8">
                    <div className="text-center">
                        <h2 className="text-2xl font-bold text-slate-800">Bienvenido, {authenticatedEmployee.name}</h2>
                        <button onClick={handleLogout} className="text-sm text-amber-600 hover:underline">Cerrar sesión</button>
                    </div>
                    {owedHours > 0 && <OwedHoursDisplay hours={owedHours} />}
                    <ActionButtons status={clockStatus} onLog={handleLog} />
                    <LogTable logs={dailyLogs} />
                    
                    <div className="border-t-2 border-slate-300/60 pt-8"></div>
                    
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
                        <div className="space-y-8">
                           <IncomeForm onSubmit={handleSaveIncome} />
                           <IncomeTable incomes={incomes} />
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
        </div>
    );
};