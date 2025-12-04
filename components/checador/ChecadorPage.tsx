import React, { useState, useEffect, useCallback } from 'react';
import { EmployeeSelector } from './EmployeeSelector';
import { LoginModal } from './LoginModal';
import { ActionButtons } from './ActionButtons';
import { LogTable } from './LogTable';
import { OwedHoursDisplay } from './OwedHoursDisplay';
import { Header } from './Header';
import { IncomeForm } from './IncomeForm';
import { IncomeTable } from './IncomeTable';
import { IncomeChart } from './IncomeChart';
import type { Employee, LogEntry, Location, IncomeEntry } from '../../types';
import { ClockStatus, LogType } from '../../types';
import { EMPLOYEES } from '../../checadorConstants';

export const ChecadorPage: React.FC = () => {
    const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
    const [authenticatedEmployee, setAuthenticatedEmployee] = useState<Employee | null>(null);
    const [dailyLogs, setDailyLogs] = useState<LogEntry[]>([]);
    const [clockStatus, setClockStatus] = useState<ClockStatus>(ClockStatus.OUT_OF_OFFICE);
    const [owedHours, setOwedHours] = useState<number>(0);
    const [incomes, setIncomes] = useState<IncomeEntry[]>([]);

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
        const employee = EMPLOYEES.find(e => e.name === employeeName);
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

    const saveLog = (type: LogType, location?: Location) => {
        if (!authenticatedEmployee) return;

        const newLog: LogEntry = {
            employeeName: authenticatedEmployee.name,
            type,
            timestamp: Date.now(),
            location,
        };

        // Guardar en log diario
        const key = getTodayKey(authenticatedEmployee.name);
        const updatedLogs = [...dailyLogs, newLog];
        localStorage.setItem(key, JSON.stringify(updatedLogs));
        
        // Guardar en log global
        const allLogsStr = localStorage.getItem('all_employee_logs');
        const allLogs = allLogsStr ? JSON.parse(allLogsStr) : [];
        allLogs.push(newLog);
        localStorage.setItem('all_employee_logs', JSON.stringify(allLogs));

        setDailyLogs(updatedLogs);
        loadDailyLogs(authenticatedEmployee); // Recargar para actualizar status
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
                    <EmployeeSelector onSelect={handleEmployeeSelect} />
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