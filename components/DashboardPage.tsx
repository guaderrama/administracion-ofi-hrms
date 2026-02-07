import React, { useState, useEffect } from 'react';
import type { DetailedEmployee } from '@/types';
import { Card } from './ui/Card';

// Icons
const CakeIcon: React.FC = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 21.75c2.42 0 4.68-.945 6.364-2.629-2.06-3.162-4.23-4.13-6.364-4.13s-4.304.968-6.364 4.13C7.32 20.805 9.58 21.75 12 21.75z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v10.5M12 3c2.485 0 4.5 2.015 4.5 4.5S14.485 12 12 12s-4.5-2.015-4.5-4.5S9.515 3 12 3z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 7.5h9" />
    </svg>
);

const AwardIcon: React.FC = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 18.75h-9a2.25 2.25 0 01-2.25-2.25v-9a2.25 2.25 0 012.25-2.25h9A2.25 2.25 0 0118.75 7.5v9a2.25 2.25 0 01-2.25 2.25z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 15.75l-3-3 3-3 3 3-3 3z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 4.5l-1.5 1.5M7.5 4.5l1.5 1.5" />
    </svg>
);

const CalendarIcon: React.FC = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-sky-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0h18M12 14.25h.008v.008H12v-.008z" />
    </svg>
);

const BellIcon: React.FC = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
    </svg>
);


const InfoCard: React.FC<{ title: string; icon: React.ReactNode; children: React.ReactNode }> = ({ title, icon, children }) => (
    <Card title={title} icon={icon}>
        <div className="pl-11 space-y-2 max-h-48 overflow-y-auto">
            {children}
        </div>
    </Card>
);

const EmployeeListItem: React.FC<{ name: string; date: string; years?: number }> = ({ name, date, years }) => (
    <div className="flex justify-between items-center text-sm py-1 border-b border-slate-200/50">
        <p className="text-slate-700">{name}</p>
        <p className="font-medium text-slate-900">
            {date}
            {years !== undefined && <span className="text-xs text-slate-500 ml-2">({years} año{years === 1 ? '' : 's'})</span>}
        </p>
    </div>
);


export const DashboardPage: React.FC = () => {
    const [employees, setEmployees] = useState<DetailedEmployee[]>([]);

    useEffect(() => {
        const storedEmployees = localStorage.getItem('detailed_employees');
        if (storedEmployees) {
            setEmployees(JSON.parse(storedEmployees));
        }
    }, []);

    const today = new Date();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();

    const monthlyBirthdays = employees
        .filter(emp => emp.fechaNacimiento && new Date(emp.fechaNacimiento + 'T12:00:00').getMonth() === currentMonth)
        .map(emp => {
            const birthDate = new Date(emp.fechaNacimiento + 'T12:00:00');
            return {
                name: `${emp.nombres} ${emp.paterno} ${emp.materno}`.trim(),
                day: birthDate.getDate(),
                date: birthDate.toLocaleDateString('es-MX', { month: 'long', day: 'numeric' })
            };
        })
        .sort((a, b) => a.day - b.day);

    const monthlyAnniversaries = employees
        .map(emp => {
            if (!emp.fechaIngreso) return null;
            const hireDate = new Date(emp.fechaIngreso + 'T12:00:00');
            
            if (hireDate.getMonth() !== currentMonth) {
                return null;
            }
            
            const yearsOfService = currentYear - hireDate.getFullYear();
            
            // No mostrar aniversarios de menos de 1 año.
            if (yearsOfService < 1 && hireDate.getFullYear() === currentYear) {
                return null;
            }

            return {
                name: `${emp.nombres} ${emp.paterno} ${emp.materno}`.trim(),
                date: hireDate.toLocaleDateString('es-MX', { month: 'long', day: 'numeric' }),
                years: yearsOfService,
                day: hireDate.getDate(),
            };
        })
        .filter((a): a is NonNullable<typeof a> => a !== null)
        .sort((a, b) => a.day - b.day);
    
    const importantDates = [
        { event: "Aniversario de la empresa", date: "20 de Agosto" },
        { event: "Posada Navideña", date: "15 de Diciembre" },
    ];

    const reminders = [
        "Revisar inventario de herramientas al final del día.",
        "Mantener el área de trabajo limpia y ordenada.",
        "Reportar cualquier incidente de seguridad de inmediato.",
    ];

    return (
        <div className="container mx-auto p-4 sm:p-6 lg:p-8 font-sans">
            <header className="text-left mb-8">
                <h1 className="font-serif text-4xl font-bold text-slate-900">Bienvenido al Portal</h1>
                <p className="mt-2 text-lg text-slate-700">Aquí tienes un resumen de lo que está pasando este mes.</p>
            </header>

            <main className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <InfoCard title="Cumpleaños del Mes" icon={<CakeIcon />}>
                    {employees.length === 0 ? (
                        <p className="text-sm text-slate-500">No hay colaboradores registrados.</p>
                    ) : monthlyBirthdays.length > 0 ? (
                        monthlyBirthdays.map(b => <EmployeeListItem key={b.name} name={b.name} date={b.date} />)
                    ) : (
                        <p className="text-sm text-slate-500">No hay cumpleaños este mes.</p>
                    )}
                </InfoCard>

                <InfoCard title="Aniversarios Laborales" icon={<AwardIcon />}>
                     {employees.length === 0 ? (
                        <p className="text-sm text-slate-500">No hay colaboradores registrados.</p>
                    ) : monthlyAnniversaries.length > 0 ? (
                        monthlyAnniversaries.map(a => <EmployeeListItem key={a.name} name={a.name} date={a.date} years={a.years} />)
                    ) : (
                        <p className="text-sm text-slate-500">No hay aniversarios este mes.</p>
                    )}
                </InfoCard>
                
                <InfoCard title="Fechas Importantes" icon={<CalendarIcon />}>
                    {importantDates.map(item => (
                        <div key={item.event} className="flex justify-between items-center text-sm py-1 border-b border-slate-200/50">
                            <p className="text-slate-700">{item.event}</p>
                            <p className="font-medium text-slate-900">{item.date}</p>
                        </div>
                    ))}
                </InfoCard>

                <InfoCard title="Recordatorios" icon={<BellIcon />}>
                    <ul className="list-disc list-inside space-y-1 text-sm text-slate-700">
                        {reminders.map((item, index) => (
                            <li key={index}>{item}</li>
                        ))}
                    </ul>
                </InfoCard>
            </main>
        </div>
    );
};
