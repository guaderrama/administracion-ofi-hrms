import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import type { DetailedEmployee, PermissionRequest, LogEntry } from '@/types';
import { LogType } from '@/types';
import { employeesService, permissionsService, logsService, motivationalService, toleranceService, announcementsService, importantDatesService, vacationRequestsService, dashboardLayoutService, policiesService, policyAcksService, type Announcement, type ImportantDate, type VacationRequestRecord, type InternalPolicy, type PolicyAcknowledgment } from '../src/services/firestoreService';
import { getOfficialHolidays } from '../utils/mexicanHolidays';
import { useAuth } from '../src/contexts/AuthContext';
import { calculateVacation } from './nominasUtils';
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

const ClipboardIcon: React.FC = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
    </svg>
);

const SunIcon: React.FC = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
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
    const { user, isAdmin, isSupervisor, canEdit, canViewAll } = useAuth();
    const [employees, setEmployees] = useState<DetailedEmployee[]>([]);
    const [permissionRequests, setPermissionRequests] = useState<PermissionRequest[]>([]);
    const [allLogs, setAllLogs] = useState<LogEntry[]>([]);
    const [motivationalEnabled, setMotivationalEnabled] = useState(true);
    const [toleranceMinutes, setToleranceMinutes] = useState(10);

    // Anuncios
    const [announcements, setAnnouncements] = useState<Announcement[]>([]);
    const [showAnnouncementForm, setShowAnnouncementForm] = useState(false);
    const [announcementForm, setAnnouncementForm] = useState({ title: '', body: '', priority: 'normal' as 'normal' | 'important' | 'urgent', expiresAt: '' });
    const [savingAnnouncement, setSavingAnnouncement] = useState(false);

    useEffect(() => {
        const unsubscribe = employeesService.subscribe((emps) => setEmployees(emps));
        return () => unsubscribe();
    }, []);

    useEffect(() => {
        const unsubscribe = permissionsService.subscribe((reqs) => setPermissionRequests(reqs));
        return () => unsubscribe();
    }, []);

    useEffect(() => {
        const unsubscribe = logsService.subscribe((logs) => setAllLogs(logs));
        return () => unsubscribe();
    }, []);

    useEffect(() => {
        const unsubscribe = motivationalService.subscribe((settings) => setMotivationalEnabled(settings.enabled));
        return () => unsubscribe();
    }, []);

    useEffect(() => {
        const unsubscribe = toleranceService.subscribe((settings) => setToleranceMinutes(settings.minutes));
        return () => unsubscribe();
    }, []);

    useEffect(() => {
        const unsubscribe = announcementsService.subscribe((data) => setAnnouncements(data));
        return () => unsubscribe();
    }, []);

    // Fechas importantes desde Firestore
    const [importantDatesFromDb, setImportantDatesFromDb] = useState<ImportantDate[]>([]);
    useEffect(() => {
        const unsubscribe = importantDatesService.subscribe((data) => setImportantDatesFromDb(data));
        return () => unsubscribe();
    }, []);

    // State for vacation requests (subscription set up after currentEmployee is defined)
    const [myVacationRequests, setMyVacationRequests] = useState<VacationRequestRecord[]>([]);

    // Filtrar anuncios activos (no expirados)
    const activeAnnouncements = useMemo(() => {
        const today = new Date().toISOString().slice(0, 10);
        return announcements.filter(a => a.active && (!a.expiresAt || a.expiresAt >= today));
    }, [announcements]);

    const handleCreateAnnouncement = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!announcementForm.title.trim() || !announcementForm.body.trim()) return;
        setSavingAnnouncement(true);
        try {
            const empName = employees.find(emp => emp.email?.toLowerCase() === user?.email?.toLowerCase());
            await announcementsService.create({
                title: announcementForm.title,
                body: announcementForm.body,
                priority: announcementForm.priority,
                createdBy: user?.email || '',
                createdByName: empName ? `${empName.nombres} ${empName.paterno}` : user?.email || '',
                createdAt: new Date(),
                expiresAt: announcementForm.expiresAt || undefined,
                active: true,
            });
            setAnnouncementForm({ title: '', body: '', priority: 'normal', expiresAt: '' });
            setShowAnnouncementForm(false);
        } catch {
            // Error silencioso
        } finally {
            setSavingAnnouncement(false);
        }
    };

    // Buscar el empleado actual por email
    const currentEmployee = user?.email
        ? employees.find(emp => emp.email?.toLowerCase() === user.email?.toLowerCase())
        : null;

    // Calcular vacaciones del empleado actual
    const vacationInfo = currentEmployee ? calculateVacation(currentEmployee.fechaIngreso) : null;

    // Suscribirse a solicitudes de vacaciones del empleado actual
    useEffect(() => {
        if (!currentEmployee?.codigo) { setMyVacationRequests([]); return; }
        const unsubscribe = vacationRequestsService.subscribeByEmployee(currentEmployee.codigo, (reqs) => setMyVacationRequests(reqs));
        return () => unsubscribe();
    }, [currentEmployee?.codigo]);

    // Dias de vacaciones usados (pendientes + aprobadas)
    const vacationUsedDays = useMemo(() => {
        return myVacationRequests
            .filter(r => r.status !== 'rechazada')
            .reduce((sum, r) => sum + (r.dates?.length || 0), 0);
    }, [myVacationRequests]);

    const vacationAvailable = vacationInfo ? vacationInfo.daysEntitled - vacationUsedDays : 0;

    // Filtrar solicitudes del empleado actual
    const myRequests = currentEmployee
        ? permissionRequests.filter(req => {
            const empName = `${currentEmployee.nombres}`.toLowerCase();
            const empPaterno = `${currentEmployee.paterno}`.toLowerCase();
            return req.firstName?.toLowerCase() === empName && req.lastName?.toLowerCase() === empPaterno;
        })
        : [];

    // ========== RETARDOS DEL EMPLEADO ACTUAL (ultimos 15 dias) ==========
    const getScheduleTimeForDay = (employee: DetailedEmployee, timestamp: number): string | null => {
        const date = new Date(timestamp);
        const dayOfWeek = date.getDay(); // 0=dom, 1=lun, 2=mar, 3=mie, 4=jue, 5=vie, 6=sab
        let schedule = '';
        if (dayOfWeek === 4) { // jueves
            schedule = employee.horarioJueves;
        } else if (dayOfWeek === 6) { // sabado
            schedule = employee.horarioSabado;
        } else if (dayOfWeek === 0) { // domingo
            return null;
        } else {
            schedule = employee.horarioLunesMiercolesViernes;
        }
        if (!schedule || schedule.toLowerCase().includes('no labora')) return null;
        const parts = schedule.split('-');
        if (parts.length >= 1) {
            const timePart = parts[0].trim();
            const match = timePart.match(/(\d{1,2}):(\d{2})/);
            if (match) return `${match[1].padStart(2, '0')}:${match[2]}`;
        }
        return null;
    };

    const myTardinessInfo = useMemo(() => {
        if (!currentEmployee) return { count: 0, dates: [] as { date: string; minutesLate: number }[] };

        const fullName = `${currentEmployee.nombres} ${currentEmployee.paterno} ${currentEmployee.materno || ''}`.trim().toUpperCase();
        const fifteenDaysAgo = new Date();
        fifteenDaysAgo.setDate(fifteenDaysAgo.getDate() - 15);
        const cutoff = fifteenDaysAgo.getTime();

        const myEntries = allLogs.filter(log =>
            log.type === LogType.ENTRADA &&
            log.timestamp >= cutoff &&
            log.employeeName.toUpperCase().trim() === fullName
        );

        const lateDates: { date: string; minutesLate: number }[] = [];

        for (const log of myEntries) {
            const scheduleTime = getScheduleTimeForDay(currentEmployee, log.timestamp);
            if (!scheduleTime) continue;

            const checkInDate = new Date(log.timestamp);
            const [h, m] = scheduleTime.split(':').map(Number);
            const schedDate = new Date(checkInDate);
            schedDate.setHours(h, m, 0, 0);
            const tolerance = new Date(schedDate.getTime() + toleranceMinutes * 60 * 1000);

            if (checkInDate > tolerance) {
                const minutesLate = Math.round((checkInDate.getTime() - schedDate.getTime()) / 60000);
                const dateStr = checkInDate.toISOString().slice(0, 10);
                // Evitar duplicados por dia
                if (!lateDates.find(d => d.date === dateStr)) {
                    lateDates.push({ date: dateStr, minutesLate });
                }
            }
        }

        lateDates.sort((a, b) => b.date.localeCompare(a.date));
        return { count: lateDates.length, dates: lateDates };
    }, [allLogs, currentEmployee, toleranceMinutes]);

    // Mensaje motivacional del dia (mismo sistema que AdminView)
    const dailyMotivationalMessage = useMemo(() => {
        const messages = [
            { title: 'La puntualidad es respeto', body: 'Llegar a tiempo demuestra respeto por tu equipo y por tu propio trabajo. Cada minuto cuenta para construir un ambiente profesional.' },
            { title: 'El exito comienza temprano', body: 'Las personas exitosas tienen algo en comun: valoran el tiempo. Ser puntual te da ventaja para organizar tu dia y ser mas productivo.' },
            { title: 'Tu compromiso se nota', body: 'Cuando llegas puntual, envias un mensaje claro: eres confiable, responsable y comprometido con la empresa.' },
            { title: 'Cada minuto importa', body: 'Un minuto de retraso puede parecer poco, pero multiplicado por el equipo y los dias, representa horas perdidas.' },
            { title: 'La disciplina abre puertas', body: 'La puntualidad es una forma de disciplina que habla de tu caracter. Los lideres se forman con habitos consistentes.' },
            { title: 'Respeta tu tiempo y el de los demas', body: 'Tu tiempo es valioso, y el de tus companeros tambien. Llegar a tiempo es la forma mas simple de mostrar profesionalismo.' },
            { title: 'Comienza el dia con el pie derecho', body: 'Llegar temprano te permite prepararte y empezar el dia sin estres. Es un regalo que te das a ti mismo.' },
            { title: 'La confianza se construye con constancia', body: 'Cada dia que llegas a tiempo estas construyendo tu reputacion. La confianza se gana con acciones repetidas.' },
            { title: 'Se el ejemplo que inspira', body: 'Tu puntualidad puede motivar a otros. Se el companero que llega primero y marca la pauta para todo el equipo.' },
            { title: 'El tiempo no espera a nadie', body: 'No podemos recuperar el tiempo perdido, pero si podemos decidir aprovecharlo mejor desde hoy.' },
            { title: 'Puntualidad = Profesionalismo', body: 'En el mundo laboral, la puntualidad es tu carta de presentacion. Dice mas de ti que cualquier curriculum.' },
            { title: 'Hoy es un buen dia para ser puntual', body: 'No importa como fue ayer. Hoy tienes una nueva oportunidad para demostrar tu compromiso.' },
            { title: 'Un equipo puntual es un equipo fuerte', body: 'Cuando todos llegamos a tiempo, el trabajo fluye mejor. Se parte de un equipo que se respeta mutuamente.' },
            { title: 'Planifica tu manana desde la noche', body: 'Preparar tu ropa, llaves y ruta la noche anterior te ahorra estres. Pequenos habitos, grandes resultados.' },
            { title: 'La puntualidad refleja tus valores', body: 'Mas alla de una regla, ser puntual es un valor personal. Demuestra integridad y responsabilidad.' },
            { title: 'Llega antes, logra mas', body: 'Los primeros minutos del dia son los mas productivos. Aprovecha esa energia llegando a tiempo.' },
            { title: 'Tu actitud marca la diferencia', body: 'Llegar con buena actitud y a tiempo transforma tu dia laboral. El positivismo y la puntualidad van de la mano.' },
            { title: 'Construye tu legado dia a dia', body: 'Las grandes carreras se construyen con pequenas acciones diarias. La puntualidad es el cimiento de tu crecimiento.' },
            { title: 'El mejor momento es ahora', body: 'No esperes a manana para mejorar tu puntualidad. Hoy es el dia perfecto para empezar un nuevo habito.' },
            { title: 'Juntos somos mas fuertes', body: 'Cuando cada miembro del equipo respeta los horarios, la productividad se multiplica.' },
            { title: 'La constancia vence al talento', body: 'Un profesional constante y puntual siempre supera a uno talentoso pero impredecible. Se constante, se confiable.' },
            { title: 'Tu futuro se decide hoy', body: 'Cada decision de llegar a tiempo es una inversion en tu futuro profesional.' },
            { title: 'Celebra tus logros de puntualidad', body: 'Si llevas una buena racha de puntualidad, felicitate. Reconocer tus logros te motiva a mantener el buen habito.' },
            { title: 'La excelencia es un habito', body: 'Somos lo que hacemos repetidamente. La excelencia no es un acto, es un habito. Se puntual por habito.' },
            { title: 'Piensa en tu equipo', body: 'Cuando llegas tarde, alguien mas cubre tu ausencia. Piensa en el impacto positivo de tu puntualidad.' },
            { title: 'Pequenos cambios, grandes resultados', body: 'Salir 10 minutos antes de casa, preparar todo la noche anterior. Pequenos ajustes que transforman tu puntualidad.' },
            { title: 'Se parte del cambio', body: 'Una cultura de puntualidad empieza por cada uno de nosotros. Se el cambio que quieres ver en tu equipo.' },
        ];
        const now = new Date();
        const dayIndex = (now.getFullYear() * 366 + (now.getMonth() + 1) * 31 + now.getDate()) % messages.length;
        return messages[dayIndex];
    }, []);

    const today = new Date();
    const currentMonth = today.getMonth();
    const currentDay = today.getDate();
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
    
    // Fechas importantes: combinar DB + fallback si DB está vacía
    const importantDates = useMemo(() => {
        if (importantDatesFromDb.length > 0) {
            // Filtrar próximas o recurrentes, ordenar por fecha
            const todayStr = new Date().toISOString().slice(0, 10);
            return importantDatesFromDb
                .filter(d => d.date >= todayStr || d.recurring)
                .slice(0, 10)
                .map(d => ({
                    event: d.title,
                    date: new Date(d.date + 'T12:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'long' }),
                    endDate: d.endDate && d.endDate !== '' ? new Date(d.endDate + 'T12:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'long' }) : undefined,
                    category: d.category,
                    noLabor: d.noLabor ?? false,
                }));
        }
        return [
            { event: "Aniversario de la empresa", date: "20 de Agosto", endDate: undefined, category: 'empresa' as const, noLabor: false },
            { event: "Posada Navideña", date: "15 de Diciembre", endDate: undefined, category: 'empresa' as const, noLabor: false },
        ];
    }, [importantDatesFromDb]);

    // Mini calendario para Dashboard
    const [calMonth, setCalMonth] = useState(new Date().getMonth());
    const [calYear, setCalYear] = useState(new Date().getFullYear());
    const MONTHS_ES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

    const calendarAllEvents = useMemo(() => {
        const all: { date: string; title: string; color: string; isBirthday?: boolean }[] = [];
        // DB dates
        importantDatesFromDb.forEach(d => {
            const color = d.noLabor ? 'bg-red-200' : d.category === 'vacaciones' ? 'bg-emerald-200' : d.category === 'empresa' ? 'bg-amber-200' : 'bg-blue-200';
            if (d.endDate && d.endDate !== '') {
                const cursor = new Date(d.date + 'T12:00:00');
                const end = new Date(d.endDate + 'T12:00:00');
                while (cursor <= end) {
                    all.push({ date: cursor.toISOString().slice(0, 10), title: d.title, color });
                    cursor.setDate(cursor.getDate() + 1);
                }
            } else {
                all.push({ date: d.date, title: d.title, color });
                if (d.recurring) {
                    const mmdd = d.date.slice(5);
                    all.push({ date: `${calYear}-${mmdd}`, title: d.title, color });
                }
            }
        });
        // Feriados LFT
        getOfficialHolidays(calYear).forEach(h => {
            if (!all.some(a => a.date === h.date)) {
                all.push({ date: h.date, title: h.name, color: 'bg-red-300' });
            }
        });
        // Cumpleanos
        employees.forEach(emp => {
            if (!emp.fechaNacimiento) return;
            const mmdd = emp.fechaNacimiento.slice(5);
            all.push({ date: `${calYear}-${mmdd}`, title: `🎂 ${emp.nombres} ${emp.paterno}`, color: 'bg-rose-200', isBirthday: true });
        });
        // Aniversarios laborales
        employees.forEach(emp => {
            if (!emp.fechaIngreso) return;
            const hireDate = new Date(emp.fechaIngreso + 'T12:00:00');
            const years = calYear - hireDate.getFullYear();
            if (years < 1) return;
            const mmdd = emp.fechaIngreso.slice(5);
            all.push({ date: `${calYear}-${mmdd}`, title: `🏆 ${years} año${years > 1 ? 's' : ''} - ${emp.nombres} ${emp.paterno}`, color: 'bg-amber-200' });
        });
        return all;
    }, [importantDatesFromDb, calYear, employees]);

    const calDays = useMemo(() => {
        const firstDay = new Date(calYear, calMonth, 1);
        const lastDay = new Date(calYear, calMonth + 1, 0);
        const pad = firstDay.getDay();
        const total = lastDay.getDate();
        const days: { day: number; events: typeof calendarAllEvents }[] = [];
        for (let i = 0; i < pad; i++) days.push({ day: 0, events: [] });
        for (let d = 1; d <= total; d++) {
            const ds = `${calYear}-${(calMonth + 1).toString().padStart(2, '0')}-${d.toString().padStart(2, '0')}`;
            days.push({ day: d, events: calendarAllEvents.filter(e => e.date === ds) });
        }
        return days;
    }, [calendarAllEvents, calYear, calMonth]);

    const todayCalStr = `${new Date().getFullYear()}-${(new Date().getMonth() + 1).toString().padStart(2, '0')}-${new Date().getDate().toString().padStart(2, '0')}`;

    // ====== Politicas Internas ======
    const [policies, setPolicies] = useState<InternalPolicy[]>([]);
    const [myAcks, setMyAcks] = useState<PolicyAcknowledgment[]>([]);
    const [viewingPolicy, setViewingPolicy] = useState<InternalPolicy | null>(null);
    const [showPolicyForm, setShowPolicyForm] = useState(false);
    const [editingPolicy, setEditingPolicy] = useState<InternalPolicy | null>(null);
    const [savingPolicy, setSavingPolicy] = useState(false);
    const policyTitleRef = useRef<HTMLInputElement>(null);
    const policyCategoryRef = useRef<HTMLSelectElement>(null);
    const policyContentRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const unsub = policiesService.subscribe((p) => setPolicies(p));
        return () => unsub();
    }, []);

    useEffect(() => {
        if (!user?.email) return;
        const unsub = policyAcksService.subscribeByEmployee(user.email, (a) => setMyAcks(a));
        return () => unsub();
    }, [user?.email]);

    const hasPolicyAck = (policyId: string) => myAcks.some(a => a.policyId === policyId);

    const handleAckPolicy = async (policy: InternalPolicy) => {
        if (!user?.email || !currentEmployee) return;
        await policyAcksService.acknowledge({
            policyId: policy.id!,
            policyTitle: policy.title,
            policyVersion: policy.version,
            employeeEmail: user.email,
            employeeName: `${currentEmployee.nombres} ${currentEmployee.paterno} ${currentEmployee.materno}`.trim(),
            acknowledgedAt: new Date(),
        });
    };

    const handleSavePolicy = async (e: React.FormEvent) => {
        e.preventDefault();
        const title = policyTitleRef.current?.value || '';
        const category = policyCategoryRef.current?.value || 'general';
        const content = policyContentRef.current?.innerHTML || '';
        if (!title.trim() || !content.trim()) return;
        setSavingPolicy(true);
        try {
            if (editingPolicy?.id) {
                await policiesService.update(editingPolicy.id, {
                    title, category, content,
                    version: (editingPolicy.version || 1) + 1,
                });
            } else {
                await policiesService.create({
                    title, category, content,
                    version: 1,
                    active: true,
                    createdBy: user?.email || '',
                    createdAt: new Date(),
                });
            }
            setShowPolicyForm(false);
            setEditingPolicy(null);
        } finally {
            setSavingPolicy(false);
        }
    };

    const POLICY_CATEGORIES: Record<string, string> = {
        general: 'Reglamento General',
        oficinas: 'Oficinas Administrativas',
        galerias: 'Galerias',
        seguridad: 'Seguridad',
        otro: 'Otro',
    };

    // ====== Drag & Drop Layout (solo admin) ======
    const DEFAULT_WIDGET_ORDER = ['announcements', 'birthdays', 'anniversaries', 'calendar', 'vacations', 'tardiness', 'solicitudes', 'policies'];
    const [widgetOrder, setWidgetOrder] = useState<string[]>(DEFAULT_WIDGET_ORDER);
    const [editingLayout, setEditingLayout] = useState(false);
    const dragItem = useRef<number | null>(null);
    const dragOverItem = useRef<number | null>(null);

    useEffect(() => {
        const unsub = dashboardLayoutService.subscribe((order) => {
            if (order.length > 0) {
                // Merge: keep saved order, append any new widgets not in saved order
                const merged = [...order];
                DEFAULT_WIDGET_ORDER.forEach(w => { if (!merged.includes(w)) merged.push(w); });
                setWidgetOrder(merged);
            }
        });
        return () => unsub();
    }, []);

    const handleDragStart = useCallback((idx: number) => {
        dragItem.current = idx;
    }, []);

    const handleDragEnter = useCallback((idx: number) => {
        dragOverItem.current = idx;
    }, []);

    const handleDragEnd = useCallback(() => {
        if (dragItem.current === null || dragOverItem.current === null) return;
        const newOrder = [...widgetOrder];
        const draggedItem = newOrder.splice(dragItem.current, 1)[0];
        newOrder.splice(dragOverItem.current, 0, draggedItem);
        dragItem.current = null;
        dragOverItem.current = null;
        setWidgetOrder(newOrder);
    }, [widgetOrder]);

    const handleSaveLayout = useCallback(async () => {
        await dashboardLayoutService.save(widgetOrder);
        setEditingLayout(false);
    }, [widgetOrder]);

    // Wrapper para widgets arrastrables
    const DragWrap: React.FC<{ id: string; idx: number; fullWidth?: boolean; children: React.ReactNode }> = ({ id, idx, fullWidth, children }) => (
        <div
            className={`relative ${fullWidth ? 'col-span-1 md:col-span-2' : ''} ${editingLayout ? 'ring-2 ring-dashed ring-amber-300 rounded-2xl' : ''}`}
            draggable={editingLayout}
            onDragStart={() => handleDragStart(idx)}
            onDragEnter={() => handleDragEnter(idx)}
            onDragEnd={handleDragEnd}
            onDragOver={(e) => e.preventDefault()}
        >
            {editingLayout && (
                <div className="absolute -top-2 -right-2 z-10 bg-amber-500 text-white rounded-full w-6 h-6 flex items-center justify-center cursor-grab text-xs font-bold shadow" title="Arrastra para mover">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 9h16.5m-16.5 6.75h16.5" /></svg>
                </div>
            )}
            {children}
        </div>
    );

    return (
        <div className="container mx-auto p-4 sm:p-6 lg:p-8 font-sans">
            <header className="text-left mb-8">
                <h1 className="font-serif text-4xl font-bold text-slate-900">Bienvenido al Portal</h1>
                <p className="mt-2 text-lg text-slate-700">Aquí tienes un resumen de lo que está pasando este mes.</p>
            </header>

            {/* Anuncios */}
            {(activeAnnouncements.length > 0 || (isAdmin || isSupervisor)) && (
                <div className="mb-8">
                    <div className="flex items-center justify-between mb-3">
                        <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                            <svg className="w-5 h-5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M10.34 15.84c-.688-.06-1.386-.09-2.09-.09H7.5a4.5 4.5 0 110-9h.75c.704 0 1.402-.03 2.09-.09m0 9.18c.253.962.584 1.892.985 2.783.247.55.06 1.21-.463 1.511l-.657.38c-.551.318-1.26.117-1.527-.461a20.845 20.845 0 01-1.44-4.282m3.102.069a18.03 18.03 0 01-.59-4.59c0-1.586.205-3.124.59-4.59m0 9.18a23.848 23.848 0 018.835 2.535M10.34 6.66a23.847 23.847 0 008.835-2.535m0 0A23.74 23.74 0 0018.795 3m.38 1.125a23.91 23.91 0 011.014 5.395m-1.014 8.855c-.118.38-.245.754-.38 1.125m.38-1.125a23.91 23.91 0 001.014-5.395m0-3.46c.495.413.811 1.035.811 1.73 0 .695-.316 1.317-.811 1.73m0-3.46a24.347 24.347 0 010 3.46" />
                            </svg>
                            Anuncios
                        </h2>
                        {(isAdmin || isSupervisor) && (
                            <button
                                onClick={() => setShowAnnouncementForm(!showAnnouncementForm)}
                                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
                            >
                                {showAnnouncementForm ? (
                                    <><svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg> Cancelar</>
                                ) : (
                                    <><svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg> Nuevo Anuncio</>
                                )}
                            </button>
                        )}
                    </div>

                    {/* Formulario para crear anuncio */}
                    {showAnnouncementForm && (isAdmin || isSupervisor) && (
                        <form onSubmit={handleCreateAnnouncement} className="bg-white border border-indigo-200 rounded-xl p-4 mb-4 shadow-sm">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                                <input
                                    type="text"
                                    required
                                    value={announcementForm.title}
                                    onChange={(e) => setAnnouncementForm(p => ({ ...p, title: e.target.value }))}
                                    placeholder="Titulo del anuncio"
                                    className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                                />
                                <div className="flex gap-2">
                                    <select
                                        value={announcementForm.priority}
                                        onChange={(e) => setAnnouncementForm(p => ({ ...p, priority: e.target.value as 'normal' | 'important' | 'urgent' }))}
                                        className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                                    >
                                        <option value="normal">Normal</option>
                                        <option value="important">Importante</option>
                                        <option value="urgent">Urgente</option>
                                    </select>
                                    <input
                                        type="date"
                                        value={announcementForm.expiresAt}
                                        onChange={(e) => setAnnouncementForm(p => ({ ...p, expiresAt: e.target.value }))}
                                        className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                        title="Fecha de expiracion (opcional)"
                                    />
                                </div>
                            </div>
                            <textarea
                                required
                                value={announcementForm.body}
                                onChange={(e) => setAnnouncementForm(p => ({ ...p, body: e.target.value }))}
                                placeholder="Escribe el contenido del anuncio..."
                                rows={3}
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none mb-3 resize-none"
                            />
                            <button
                                type="submit"
                                disabled={savingAnnouncement}
                                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                            >
                                {savingAnnouncement ? 'Publicando...' : 'Publicar Anuncio'}
                            </button>
                        </form>
                    )}

                    {/* Lista de anuncios */}
                    {activeAnnouncements.length > 0 ? (
                        <div className="space-y-3">
                            {activeAnnouncements.map(a => {
                                const priorityStyles = {
                                    normal: 'bg-indigo-50 border-indigo-200',
                                    important: 'bg-amber-50 border-amber-300',
                                    urgent: 'bg-red-50 border-red-300',
                                };
                                const priorityBadge = {
                                    normal: '',
                                    important: 'bg-amber-100 text-amber-800',
                                    urgent: 'bg-red-100 text-red-800',
                                };
                                return (
                                    <div key={a.id} className={`border rounded-xl p-4 ${priorityStyles[a.priority]}`}>
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <h3 className="text-sm font-bold text-slate-800">{a.title}</h3>
                                                    {a.priority !== 'normal' && (
                                                        <span className={`px-1.5 py-0.5 text-[10px] font-bold rounded-full uppercase ${priorityBadge[a.priority]}`}>
                                                            {a.priority === 'urgent' ? 'Urgente' : 'Importante'}
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-sm text-slate-700 whitespace-pre-line">{a.body}</p>
                                                <p className="text-xs text-slate-400 mt-2">
                                                    Publicado por {a.createdByName} - {new Date(a.createdAt).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })}
                                                    {a.expiresAt && ` | Expira: ${new Date(a.expiresAt + 'T12:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}`}
                                                </p>
                                            </div>
                                            {(isAdmin || (isSupervisor && a.createdBy === user?.email)) && (
                                                <button
                                                    onClick={() => a.id && announcementsService.update(a.id, { active: false })}
                                                    className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0"
                                                    title="Ocultar anuncio"
                                                >
                                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                                    </svg>
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <p className="text-sm text-slate-400">No hay anuncios activos.</p>
                    )}
                </div>
            )}

            {/* Mensajes de cumpleaños del mes */}
            {monthlyBirthdays.length > 0 && (
                <div className="mb-8 space-y-4">
                    {monthlyBirthdays.map((b) => (
                        <div key={b.name} className="bg-gradient-to-r from-rose-50 to-pink-50 border border-rose-200 rounded-xl p-5">
                            <div className="flex items-start gap-4">
                                <div className="text-3xl flex-shrink-0">🎂</div>
                                <div>
                                    <h3 className="font-semibold text-rose-800 text-lg">
                                        {b.day === currentDay
                                            ? `¡Feliz Cumpleaños, ${b.name}!`
                                            : `¡Este mes cumple años ${b.name}! (${b.date})`
                                        }
                                    </h3>
                                    <p className="text-sm text-rose-700 mt-1">
                                        {b.day === currentDay
                                            ? `Hoy es un día muy especial. ${b.name} es parte fundamental de Ivan Guaderrama Art. Su dedicación y energía hacen la diferencia cada día. ¡Que este nuevo año de vida le traiga grandes logros y mucha felicidad!`
                                            : `En Ivan Guaderrama Art valoramos a cada persona que forma parte de nuestro equipo. ${b.name} es parte fundamental de esta familia. ¡Esperamos celebrarlo juntos!`
                                        }
                                    </p>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Mensajes de aniversarios laborales del mes */}
            {monthlyAnniversaries.length > 0 && (
                <div className="mb-8 space-y-4">
                    {monthlyAnniversaries.map((a) => (
                        <div key={a.name} className="bg-gradient-to-r from-amber-50 to-yellow-50 border border-amber-200 rounded-xl p-5">
                            <div className="flex items-start gap-4">
                                <div className="text-3xl flex-shrink-0">🏆</div>
                                <div>
                                    <h3 className="font-semibold text-amber-800 text-lg">
                                        {a.day === currentDay
                                            ? `¡Feliz Aniversario Laboral, ${a.name}!`
                                            : `¡${a.name} cumple ${a.years} ${a.years === 1 ? 'año' : 'años'} con nosotros! (${a.date})`
                                        }
                                    </h3>
                                    <p className="text-sm text-amber-700 mt-1">
                                        {a.years === 1
                                            ? `${a.name} cumple su primer año en Ivan Guaderrama Art. Su compromiso y esfuerzo han sido fundamentales para el equipo. Agradecemos su lealtad y su confianza en este proyecto. ¡Esperamos seguir creciendo juntos por muchos años más!`
                                            : `${a.years} años de compromiso, lealtad y dedicación. La permanencia de ${a.name} en Ivan Guaderrama Art es un reflejo de su profesionalismo y del valor que aporta cada día. Es pieza clave de este equipo y su trayectoria es motivo de orgullo para toda la empresa. ¡Gracias por ser parte de esta familia!`
                                        }
                                    </p>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Boton editar layout - solo admin */}
            {isAdmin && (
                <div className="flex justify-end mb-2">
                    {editingLayout ? (
                        <div className="flex gap-2">
                            <button onClick={handleSaveLayout} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-colors">
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                                Guardar Distribucion
                            </button>
                            <button onClick={() => { setWidgetOrder(DEFAULT_WIDGET_ORDER); setEditingLayout(false); }} className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50 transition-colors">
                                Cancelar
                            </button>
                        </div>
                    ) : (
                        <button onClick={() => setEditingLayout(true)} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50 transition-colors">
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25a2.25 2.25 0 01-2.25-2.25v-2.25z" /></svg>
                            Editar Distribucion
                        </button>
                    )}
                </div>
            )}

            <main className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {widgetOrder.map((widgetId, idx) => {
              // ===== BIRTHDAYS =====
              if (widgetId === 'birthdays') return (
                <DragWrap key={widgetId} id={widgetId} idx={idx}>
                <InfoCard title="Cumpleaños del Mes" icon={<CakeIcon />}>
                    {employees.length === 0 ? (
                        <p className="text-sm text-slate-500">No hay colaboradores registrados.</p>
                    ) : monthlyBirthdays.length > 0 ? (
                        monthlyBirthdays.map(b => <EmployeeListItem key={b.name} name={b.name} date={b.date} />)
                    ) : (
                        <p className="text-sm text-slate-500">No hay cumpleaños este mes.</p>
                    )}
                </InfoCard>
                </DragWrap>
              );

              // ===== ANNIVERSARIES =====
              if (widgetId === 'anniversaries') return (
                <DragWrap key={widgetId} id={widgetId} idx={idx}>
                <InfoCard title="Aniversarios Laborales" icon={<AwardIcon />}>
                     {employees.length === 0 ? (
                        <p className="text-sm text-slate-500">No hay colaboradores registrados.</p>
                    ) : monthlyAnniversaries.length > 0 ? (
                        monthlyAnniversaries.map(a => <EmployeeListItem key={a.name} name={a.name} date={a.date} years={a.years} />)
                    ) : (
                        <p className="text-sm text-slate-500">No hay aniversarios este mes.</p>
                    )}
                </InfoCard>
                </DragWrap>
              );
                
              // ===== CALENDAR =====
              if (widgetId === 'calendar') return (
                <DragWrap key={widgetId} id={widgetId} idx={idx} fullWidth>
                <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-5">
                    <div className="flex items-center justify-between mb-4">
                        <button onClick={() => { if (calMonth === 0) { setCalMonth(11); setCalYear(calYear - 1); } else setCalMonth(calMonth - 1); }} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors">
                            <svg className="w-5 h-5 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" /></svg>
                        </button>
                        <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                            <CalendarIcon />
                            {MONTHS_ES[calMonth]} {calYear}
                        </h3>
                        <button onClick={() => { if (calMonth === 11) { setCalMonth(0); setCalYear(calYear + 1); } else setCalMonth(calMonth + 1); }} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors">
                            <svg className="w-5 h-5 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
                        </button>
                    </div>

                    <div className="grid grid-cols-7 gap-px bg-slate-200 rounded-lg overflow-hidden">
                        {['Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab'].map(d => (
                            <div key={d} className="bg-slate-50 py-2 text-center text-xs font-semibold text-slate-500 uppercase">{d}</div>
                        ))}
                        {calDays.map((cell, i) => {
                            const ds = cell.day > 0 ? `${calYear}-${(calMonth + 1).toString().padStart(2, '0')}-${cell.day.toString().padStart(2, '0')}` : '';
                            const isToday = ds === todayCalStr;
                            return (
                                <div key={i} className={`bg-white min-h-[72px] p-1.5 ${cell.day === 0 ? 'bg-slate-50/50' : ''}`}>
                                    {cell.day > 0 && (
                                        <>
                                            <div className={`text-xs font-medium mb-0.5 ${isToday ? 'bg-amber-600 text-white w-6 h-6 rounded-full flex items-center justify-center' : 'text-slate-600'}`}>
                                                {cell.day}
                                            </div>
                                            {cell.events.slice(0, 2).map((evt, j) => (
                                                <div key={j} className={`text-[10px] px-1 py-0.5 rounded truncate mb-0.5 ${evt.color} ${evt.isBirthday ? 'text-rose-800' : 'text-slate-800'}`} title={evt.title}>
                                                    {evt.isBirthday ? '🎂 ' : ''}{evt.title}
                                                </div>
                                            ))}
                                            {cell.events.length > 2 && (
                                                <div className="text-[10px] text-slate-400">+{cell.events.length - 2}</div>
                                            )}
                                        </>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    {/* Leyenda */}
                    <div className="flex flex-wrap gap-3 mt-3 text-[10px]">
                        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-300"></span> Feriado LFT</span>
                        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-200"></span> No se labora</span>
                        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-emerald-200"></span> Vacaciones</span>
                        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-amber-200"></span> Empresa</span>
                        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-rose-200"></span> Cumpleanos</span>
                        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-amber-200"></span> Aniversario</span>
                        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-blue-200"></span> Otro</span>
                    </div>

                    {/* Tabla de todas las fechas estilo CalendarPage */}
                    {(() => {
                        // Construir lista completa igual que CalendarPage
                        type CalRow = { title: string; description: string; catLabel: string; catBg: string; catColor: string; dateRaw: string; dateStr: string; recurring: boolean; isSystem: boolean };
                        const rows: CalRow[] = [];
                        const catStyles: Record<string, { label: string; bg: string; color: string }> = {
                            festivo: { label: 'Dia Festivo', bg: 'bg-red-100', color: 'text-red-800' },
                            feriado_ley: { label: 'Feriado LFT', bg: 'bg-red-50', color: 'text-red-800' },
                            vacaciones: { label: 'Vacaciones', bg: 'bg-emerald-100', color: 'text-emerald-800' },
                            empresa: { label: 'Empresa', bg: 'bg-amber-100', color: 'text-amber-800' },
                            capacitacion: { label: 'Capacitacion', bg: 'bg-blue-100', color: 'text-blue-800' },
                            cumpleanos: { label: 'Cumpleanos', bg: 'bg-rose-100', color: 'text-rose-800' },
                            aniversario: { label: 'Aniversario', bg: 'bg-purple-100', color: 'text-purple-800' },
                            otro: { label: 'Otro', bg: 'bg-slate-100', color: 'text-slate-800' },
                        };
                        // DB dates
                        importantDatesFromDb.forEach(d => {
                            const cat = d.noLabor ? 'festivo' : d.category;
                            const s = catStyles[cat] || catStyles.otro;
                            const dateLabel = new Date(d.date + 'T12:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })
                                + (d.endDate && d.endDate !== '' ? ` - ${new Date(d.endDate + 'T12:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })}` : '');
                            rows.push({ title: d.title, description: d.description || '', catLabel: s.label, catBg: s.bg, catColor: s.color, dateRaw: d.date, dateStr: dateLabel, recurring: d.recurring, isSystem: false });
                        });
                        // LFT
                        const holidays = getOfficialHolidays(calYear);
                        holidays.forEach(h => {
                            if (importantDatesFromDb.some(d => d.date === h.date)) return;
                            const s = catStyles.feriado_ley;
                            rows.push({ title: h.name, description: 'Ley Federal del Trabajo', catLabel: s.label, catBg: s.bg, catColor: s.color, dateRaw: h.date, dateStr: new Date(h.date + 'T12:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' }), recurring: true, isSystem: true });
                        });
                        // Cumpleanos
                        employees.forEach(emp => {
                            if (!emp.fechaNacimiento) return;
                            const mmdd = emp.fechaNacimiento.slice(5);
                            const bd = `${calYear}-${mmdd}`;
                            const s = catStyles.cumpleanos;
                            const empName = `${emp.nombres} ${emp.paterno}`.trim();
                            rows.push({ title: `🎂 Cumpleanos de ${empName}`, description: `${emp.nombres} ${emp.paterno} ${emp.materno}`, catLabel: s.label, catBg: s.bg, catColor: s.color, dateRaw: bd, dateStr: new Date(bd + 'T12:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' }), recurring: true, isSystem: true });
                        });
                        // Aniversarios laborales
                        employees.forEach(emp => {
                            if (!emp.fechaIngreso) return;
                            const hireDate = new Date(emp.fechaIngreso + 'T12:00:00');
                            const years = calYear - hireDate.getFullYear();
                            if (years < 1) return;
                            const mmdd = emp.fechaIngreso.slice(5);
                            const ad = `${calYear}-${mmdd}`;
                            const s = catStyles.aniversario;
                            const empName = `${emp.nombres} ${emp.paterno}`.trim();
                            rows.push({ title: `🏆 ${years} año${years > 1 ? 's' : ''} de ${empName}`, description: `Aniversario laboral - ${emp.nombres} ${emp.paterno} ${emp.materno}`, catLabel: s.label, catBg: s.bg, catColor: s.color, dateRaw: ad, dateStr: new Date(ad + 'T12:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' }), recurring: true, isSystem: true });
                        });
                        // Ordenar por fecha cruda
                        rows.sort((a, b) => a.dateRaw.localeCompare(b.dateRaw));

                        return (
                            <div className="mt-4 border-t border-slate-200 pt-3">
                                <h4 className="text-sm font-bold text-slate-700 mb-2">Todas las Fechas ({rows.length})</h4>
                                <div className="overflow-x-auto max-h-[350px]">
                                    <table className="w-full text-sm">
                                        <thead className="sticky top-0 bg-slate-50">
                                            <tr className="border-b border-slate-200">
                                                <th className="text-left py-2 px-2 font-semibold text-slate-500 text-xs">Titulo</th>
                                                <th className="text-center py-2 px-2 font-semibold text-slate-500 text-xs">Categoria</th>
                                                <th className="text-center py-2 px-2 font-semibold text-slate-500 text-xs">Fecha</th>
                                                <th className="text-center py-2 px-2 font-semibold text-slate-500 text-xs">Recurrente</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {rows.map((r, idx) => (
                                                <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50/50">
                                                    <td className="py-2 px-2">
                                                        <p className="font-medium text-slate-800 text-sm">{r.title}</p>
                                                        {r.description && <p className="text-xs text-slate-400">{r.description}</p>}
                                                    </td>
                                                    <td className="py-2 px-2 text-center">
                                                        <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${r.catBg} ${r.catColor}`}>{r.catLabel}</span>
                                                    </td>
                                                    <td className="py-2 px-2 text-center text-xs text-slate-600">{r.dateStr}</td>
                                                    <td className="py-2 px-2 text-center text-xs text-slate-500">{r.recurring ? 'Cada ano' : 'No'}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        );
                    })()}
                </div>
                </DragWrap>
              );

              // ===== VACATIONS =====
              if (widgetId === 'vacations') return (
                <DragWrap key={widgetId} id={widgetId} idx={idx}>
                <InfoCard title="Tus Vacaciones" icon={<SunIcon />}>
                    {!currentEmployee ? (
                        <p className="text-sm text-slate-500">No se encontro tu registro de empleado.</p>
                    ) : !vacationInfo ? (
                        <p className="text-sm text-slate-500">No se pudo calcular la informacion de vacaciones.</p>
                    ) : vacationInfo.eligible ? (
                        <div className="space-y-3">
                            {/* Resumen de dias */}
                            <div className="grid grid-cols-3 gap-2">
                                <div className="text-center p-2 bg-emerald-50 border border-emerald-200 rounded-lg">
                                    <p className="text-lg font-bold text-emerald-800">{vacationInfo.daysEntitled}</p>
                                    <p className="text-[10px] text-emerald-600 font-medium">Por ley</p>
                                </div>
                                <div className="text-center p-2 bg-orange-50 border border-orange-200 rounded-lg">
                                    <p className="text-lg font-bold text-orange-800">{vacationUsedDays}</p>
                                    <p className="text-[10px] text-orange-600 font-medium">Tomados</p>
                                </div>
                                <div className={`text-center p-2 rounded-lg border ${vacationAvailable > 0 ? 'bg-blue-50 border-blue-200' : 'bg-red-50 border-red-200'}`}>
                                    <p className={`text-lg font-bold ${vacationAvailable > 0 ? 'text-blue-800' : 'text-red-800'}`}>{vacationAvailable}</p>
                                    <p className={`text-[10px] font-medium ${vacationAvailable > 0 ? 'text-blue-600' : 'text-red-600'}`}>Disponibles</p>
                                </div>
                            </div>
                            <p className="text-xs text-slate-500">
                                {vacationInfo.yearsWorked} {vacationInfo.yearsWorked === 1 ? 'ano' : 'anos'} de antiguedad | Proximo aniversario: {vacationInfo.nextAnniversary}
                            </p>

                            {/* Solicitudes de vacaciones */}
                            {myVacationRequests.length > 0 && (
                                <div className="border-t border-slate-200/80 pt-2">
                                    <p className="text-xs font-semibold text-slate-600 mb-1.5">Solicitudes:</p>
                                    {myVacationRequests.map(vr => (
                                        <div key={vr.id} className="flex justify-between items-center text-xs py-1.5 border-b border-slate-100">
                                            <div>
                                                <span className="font-medium text-slate-700">{vr.daysRequested} dia{vr.daysRequested !== 1 ? 's' : ''}</span>
                                                <span className="text-slate-400 ml-1">
                                                    ({vr.dates.length > 0 && new Date(vr.dates[0] + 'T12:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}
                                                    {vr.dates.length > 1 && ` - ${new Date(vr.dates[vr.dates.length - 1] + 'T12:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}`})
                                                </span>
                                            </div>
                                            <span className={`px-1.5 py-0.5 text-[10px] font-semibold rounded-full ${
                                                vr.status === 'aprobada' ? 'bg-green-100 text-green-800' :
                                                vr.status === 'rechazada' ? 'bg-red-100 text-red-800' :
                                                'bg-yellow-100 text-yellow-800'
                                            }`}>{vr.status}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="space-y-2">
                            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                                <p className="text-sm font-medium text-amber-800">
                                    Aun no cumples 1 ano de antiguedad
                                </p>
                                <p className="text-xs text-amber-600 mt-1">
                                    Podras gozar de vacaciones a partir del {vacationInfo.nextAnniversary}
                                </p>
                            </div>
                        </div>
                    )}
                </InfoCard>
                </DragWrap>
              );

              // ===== TARDINESS =====
              if (widgetId === 'tardiness') return (
                motivationalEnabled && myTardinessInfo.count >= 2 ? (
                <DragWrap key={widgetId} id={widgetId} idx={idx} fullWidth>
                    <div className="p-5 bg-gradient-to-r from-amber-50 via-orange-50 to-red-50 border border-amber-300 rounded-xl shadow-sm">
                        <div className="flex items-start gap-3">
                            <div className="flex-shrink-0 mt-0.5">
                                <svg className="w-6 h-6 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                                </svg>
                            </div>
                            <div className="flex-1">
                                <h3 className="font-semibold text-amber-900 text-base mb-1">{dailyMotivationalMessage.title}</h3>
                                <p className="text-sm text-amber-800 mb-3">{dailyMotivationalMessage.body}</p>
                                <div className="bg-white/60 rounded-lg p-3 border border-amber-200">
                                    <p className="text-xs font-semibold text-red-700 mb-2">
                                        Tienes {myTardinessInfo.count} retardo{myTardinessInfo.count !== 1 ? 's' : ''} en los ultimos 15 dias:
                                    </p>
                                    <div className="flex flex-wrap gap-2">
                                        {myTardinessInfo.dates.map(d => (
                                            <span key={d.date} className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 text-red-800 rounded-md text-xs font-medium">
                                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                </svg>
                                                {new Date(d.date + 'T12:00:00').toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'short' })}
                                                <span className="text-red-600">({d.minutesLate} min)</span>
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </DragWrap>
                ) : <React.Fragment key={widgetId} />
              );

              // ===== SOLICITUDES =====
              if (widgetId === 'solicitudes') return (
                <DragWrap key={widgetId} id={widgetId} idx={idx}>
                <InfoCard title="Mis Solicitudes" icon={<ClipboardIcon />}>
                    {/* Papeletas de vacaciones aprobadas/pendientes */}
                    {myVacationRequests.filter(v => v.status !== 'rechazada').length > 0 && (
                        <div className="mb-3">
                            <p className="text-xs font-semibold text-emerald-700 mb-1.5 flex items-center gap-1">
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25" /></svg>
                                Vacaciones
                            </p>
                            {myVacationRequests.filter(v => v.status !== 'rechazada').map(vr => (
                                <div key={vr.id} className={`rounded-lg border p-2.5 mb-2 ${vr.status === 'aprobada' ? 'border-green-200 bg-green-50/50' : 'border-yellow-200 bg-yellow-50/50'}`}>
                                    <div className="flex justify-between items-center">
                                        <div>
                                            <p className="text-sm font-medium text-slate-800">{vr.daysRequested} dia{vr.daysRequested !== 1 ? 's' : ''} de vacaciones</p>
                                            <p className="text-xs text-slate-500">
                                                {vr.dates.map(d => new Date(d + 'T12:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })).join(', ')}
                                            </p>
                                        </div>
                                        <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${
                                            vr.status === 'aprobada' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                                        }`}>{vr.status}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Permisos laborales */}
                    {!currentEmployee ? (
                        <p className="text-sm text-slate-500">No se encontro tu registro de empleado.</p>
                    ) : myRequests.length === 0 && myVacationRequests.filter(v => v.status !== 'rechazada').length === 0 ? (
                        <p className="text-sm text-slate-500">No tienes solicitudes registradas.</p>
                    ) : myRequests.length === 0 ? null : (
                        <div className="space-y-3">
                        {[...myRequests].reverse().map(req => {
                            const statusColors: Record<string, string> = {
                                'Pendiente': 'bg-yellow-100 text-yellow-800 border-yellow-200',
                                'Aprobado por Supervisor': 'bg-blue-100 text-blue-800 border-blue-200',
                                'Aprobado': 'bg-green-100 text-green-800 border-green-200',
                                'Denegado por Supervisor': 'bg-red-100 text-red-800 border-red-200',
                                'Denegado por Admin': 'bg-red-100 text-red-800 border-red-200',
                            };
                            const statusClass = statusColors[req.status] || 'bg-gray-100 text-gray-800 border-gray-200';
                            const typeLabel = req.permissionType || 'Permiso';

                            // Detalles de fechas
                            const dateDetails = req.dates && req.dates.length > 0
                                ? req.dates.map(d => new Date(d + 'T12:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })).join(', ')
                                : req.permissionDate
                                    ? new Date(req.permissionDate + 'T12:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })
                                    : '';

                            const supStatus = req.supervisorApproval?.status || 'pendiente';
                            const admStatus = req.adminApproval?.status || 'pendiente';
                            const isDenied = req.status?.startsWith('Denegado');
                            const deniedComment = isDenied
                                ? (supStatus === 'denegado' ? req.supervisorApproval?.comment : req.adminApproval?.comment)
                                : null;

                            return (
                                <div key={req.id} className={`rounded-lg border p-3 ${isDenied ? 'border-red-200 bg-red-50/50' : req.status === 'Aprobado' ? 'border-green-200 bg-green-50/50' : 'border-slate-200 bg-white/60'}`}>
                                    {/* Header: tipo + estado */}
                                    <div className="flex justify-between items-start mb-2">
                                        <div>
                                            <p className="text-sm font-semibold text-slate-800">{typeLabel}</p>
                                            <p className="text-xs text-slate-500">Solicitado: {new Date(req.requestDate + 'T12:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                                        </div>
                                        <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${statusClass}`}>
                                            {req.status}
                                        </span>
                                    </div>

                                    {/* Dias solicitados */}
                                    {dateDetails && (
                                        <div className="mb-2">
                                            <p className="text-xs font-medium text-slate-600">Dias solicitados:</p>
                                            <p className="text-xs text-slate-700">{dateDetails}</p>
                                        </div>
                                    )}

                                    {/* Horarios si aplica */}
                                    {req.arrivalTime && (
                                        <p className="text-xs text-slate-600 mb-1">Hora llegada: <span className="font-medium">{req.arrivalTime}</span></p>
                                    )}
                                    {req.departureTime && (
                                        <p className="text-xs text-slate-600 mb-1">Hora salida: <span className="font-medium">{req.departureTime}</span></p>
                                    )}
                                    {req.absenceStartTime && req.absenceEndTime && (
                                        <p className="text-xs text-slate-600 mb-1">Ausencia: <span className="font-medium">{req.absenceStartTime} - {req.absenceEndTime}</span></p>
                                    )}

                                    {/* Motivo */}
                                    <p className="text-xs text-slate-600 mb-2">Motivo: <span className="font-medium">{req.reason}</span></p>

                                    {/* Flujo de aprobacion */}
                                    <div className="flex gap-3 text-xs border-t border-slate-200/80 pt-2">
                                        <div className="flex items-center gap-1">
                                            <span className="text-slate-500">Supervisor:</span>
                                            {supStatus === 'aprobado' ? (
                                                <span className="text-green-700 font-semibold">Aprobado</span>
                                            ) : supStatus === 'denegado' ? (
                                                <span className="text-red-700 font-semibold">Denegado</span>
                                            ) : (
                                                <span className="text-yellow-700 font-semibold">Pendiente</span>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <span className="text-slate-500">Admin:</span>
                                            {supStatus !== 'aprobado' ? (
                                                <span className="text-slate-400">Esperando</span>
                                            ) : admStatus === 'aprobado' ? (
                                                <span className="text-green-700 font-semibold">Aprobado</span>
                                            ) : admStatus === 'denegado' ? (
                                                <span className="text-red-700 font-semibold">Denegado</span>
                                            ) : (
                                                <span className="text-yellow-700 font-semibold">Pendiente</span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Motivo de denegacion */}
                                    {isDenied && deniedComment && (
                                        <div className="mt-2 p-2 bg-red-100/60 rounded text-xs text-red-800">
                                            <span className="font-semibold">Motivo de rechazo:</span> {deniedComment}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                        </div>
                    )}
                </InfoCard>
                </DragWrap>
              );

              // ===== REMINDERS =====
              // ===== POLICIES =====
              if (widgetId === 'reminders') return null; // migrado a policies
              if (widgetId === 'policies') return (
                <DragWrap key="policies" id="policies" idx={idx}>
                <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-5">
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                            <BellIcon />
                            Politicas Internas
                        </h3>
                        {isAdmin && (
                            <button
                                onClick={() => {
                                    if (!showPolicyForm) {
                                        setEditingPolicy(null);
                                        setTimeout(() => { if (policyTitleRef.current) policyTitleRef.current.value = ''; if (policyCategoryRef.current) policyCategoryRef.current.value = 'general'; if (policyContentRef.current) policyContentRef.current.innerHTML = ''; }, 0);
                                    }
                                    setShowPolicyForm(!showPolicyForm);
                                }}
                                className="text-xs px-3 py-1.5 rounded-lg bg-amber-600 text-white hover:bg-amber-700 transition-colors"
                            >
                                {showPolicyForm ? 'Cancelar' : '+ Nueva Politica'}
                            </button>
                        )}
                    </div>

                    {/* Form admin - se abre como modal */}

                    {/* Lista de politicas */}
                    {policies.length === 0 ? (
                        <p className="text-sm text-slate-400">No hay politicas registradas.</p>
                    ) : (
                        <div className="space-y-2">
                            {policies.map(pol => {
                                const acked = hasPolicyAck(pol.id!);
                                const catLabel = POLICY_CATEGORIES[pol.category] || pol.category;
                                return (
                                    <div key={pol.id} className={`border rounded-lg p-3 transition-colors ${acked ? 'border-green-200 bg-green-50/30' : 'border-amber-200 bg-amber-50/30'}`}>
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="flex-1 min-w-0">
                                                <button onClick={() => setViewingPolicy(pol)} className="text-sm font-semibold text-slate-800 hover:text-amber-700 text-left transition-colors">
                                                    {pol.title}
                                                </button>
                                                <div className="flex items-center gap-2 mt-0.5">
                                                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-200 text-slate-600 font-medium">{catLabel}</span>
                                                    <span className="text-[10px] text-slate-400">v{pol.version}</span>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-1 flex-shrink-0">
                                                {acked ? (
                                                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-100 text-green-800 font-semibold">Aceptada</span>
                                                ) : (
                                                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-semibold">Pendiente</span>
                                                )}
                                                {isAdmin && (
                                                    <button onClick={() => { setEditingPolicy(pol); setShowPolicyForm(true); setTimeout(() => { if (policyTitleRef.current) policyTitleRef.current.value = pol.title; if (policyCategoryRef.current) policyCategoryRef.current.value = pol.category; if (policyContentRef.current) policyContentRef.current.innerHTML = pol.content; }, 50); }} className="p-1 text-slate-400 hover:text-amber-600 rounded" title="Editar">
                                                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" /></svg>
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
                </DragWrap>
              );

              return null;
            })}
            </main>

            {/* Modal de Politica */}
            {viewingPolicy && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setViewingPolicy(null)}>
                    <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
                        <div className="p-5 border-b border-slate-200 flex items-center justify-between">
                            <div>
                                <h2 className="text-lg font-bold text-slate-800">{viewingPolicy.title}</h2>
                                <p className="text-xs text-slate-500">{POLICY_CATEGORIES[viewingPolicy.category] || viewingPolicy.category} | Version {viewingPolicy.version}</p>
                            </div>
                            <button onClick={() => setViewingPolicy(null)} className="p-2 hover:bg-slate-100 rounded-lg">
                                <svg className="w-5 h-5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>
                        <div className="p-5 overflow-y-auto flex-1">
                            <div className="prose prose-sm max-w-none text-slate-700" dangerouslySetInnerHTML={{ __html: viewingPolicy.content.replace(/\n/g, '<br/>') }} />
                        </div>
                        <div className="p-5 border-t border-slate-200 flex items-center justify-between">
                            {hasPolicyAck(viewingPolicy.id!) ? (
                                <div className="flex items-center gap-2 text-green-700">
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                    <span className="text-sm font-medium">Ya aceptaste esta politica</span>
                                </div>
                            ) : (
                                <button
                                    onClick={async () => { await handleAckPolicy(viewingPolicy); }}
                                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-green-600 text-white font-medium rounded-lg text-sm hover:from-emerald-700 hover:to-green-700 transition-all"
                                >
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                    Acepto y estoy de acuerdo con esta politica
                                </button>
                            )}
                            <button onClick={() => setViewingPolicy(null)} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">Cerrar</button>
                        </div>
                    </div>
                </div>
            )}
            {/* Modal Editor de Politica (Admin) */}
            {showPolicyForm && isAdmin && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col">
                        <div className="p-5 border-b border-slate-200 flex items-center justify-between">
                            <h2 className="text-lg font-bold text-slate-800">{editingPolicy ? 'Editar Politica' : 'Nueva Politica'}</h2>
                            <button onClick={() => { setShowPolicyForm(false); setEditingPolicy(null); }} className="p-2 hover:bg-slate-100 rounded-lg">
                                <svg className="w-5 h-5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>
                        <form onSubmit={handleSavePolicy} className="flex flex-col flex-1 overflow-hidden">
                            <div className="p-5 space-y-4 overflow-y-auto flex-1">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Titulo de la Politica *</label>
                                        <input ref={policyTitleRef} type="text" required defaultValue={editingPolicy?.title || ''} placeholder="Ej: Reglamento Interno de Oficinas" className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-amber-500" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Categoria *</label>
                                        <select ref={policyCategoryRef} defaultValue={editingPolicy?.category || 'general'} className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-amber-500">
                                            {Object.entries(POLICY_CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                                        </select>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Contenido de la Politica *</label>
                                    {/* Barra de herramientas rich text */}
                                    <div className="flex flex-wrap items-center gap-0.5 p-2 bg-slate-100 border border-slate-300 border-b-0 rounded-t-lg">
                                        <button type="button" onClick={() => { document.execCommand('bold'); policyContentRef.current?.focus(); }} className="px-2.5 py-1.5 hover:bg-white rounded text-slate-700 text-sm font-bold border border-transparent hover:border-slate-200 transition-colors" title="Negrita (Ctrl+B)">N</button>
                                        <button type="button" onClick={() => { document.execCommand('italic'); policyContentRef.current?.focus(); }} className="px-2.5 py-1.5 hover:bg-white rounded text-slate-700 text-sm italic border border-transparent hover:border-slate-200 transition-colors" title="Cursiva (Ctrl+I)">C</button>
                                        <button type="button" onClick={() => { document.execCommand('underline'); policyContentRef.current?.focus(); }} className="px-2.5 py-1.5 hover:bg-white rounded text-slate-700 text-sm underline border border-transparent hover:border-slate-200 transition-colors" title="Subrayado (Ctrl+U)">S</button>
                                        <div className="w-px h-5 bg-slate-300 mx-1"></div>
                                        <button type="button" onClick={() => { document.execCommand('insertUnorderedList'); policyContentRef.current?.focus(); }} className="px-2 py-1.5 hover:bg-white rounded text-slate-600 text-xs font-medium border border-transparent hover:border-slate-200" title="Lista con vinetas">• Lista</button>
                                        <button type="button" onClick={() => { document.execCommand('insertOrderedList'); policyContentRef.current?.focus(); }} className="px-2 py-1.5 hover:bg-white rounded text-slate-600 text-xs font-medium border border-transparent hover:border-slate-200" title="Lista numerada">1. Numerar</button>
                                        <div className="w-px h-5 bg-slate-300 mx-1"></div>
                                        <button type="button" onClick={() => { document.execCommand('justifyLeft'); policyContentRef.current?.focus(); }} className="px-2 py-1.5 hover:bg-white rounded text-slate-600 border border-transparent hover:border-slate-200" title="Alinear izquierda">
                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h10.5M3.75 17.25h16.5" /></svg>
                                        </button>
                                        <button type="button" onClick={() => { document.execCommand('justifyCenter'); policyContentRef.current?.focus(); }} className="px-2 py-1.5 hover:bg-white rounded text-slate-600 border border-transparent hover:border-slate-200" title="Centrar">
                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M6.75 12h10.5M3.75 17.25h16.5" /></svg>
                                        </button>
                                        <div className="w-px h-5 bg-slate-300 mx-1"></div>
                                        <select onChange={(e) => { if (e.target.value) { document.execCommand('fontSize', false, '7'); const sel = window.getSelection(); if (sel && sel.rangeCount) { const range = sel.getRangeAt(0); const spans = range.commonAncestorContainer.parentElement?.querySelectorAll('font[size="7"]'); spans?.forEach(s => { (s as HTMLElement).removeAttribute('size'); (s as HTMLElement).style.fontSize = e.target.value; }); } policyContentRef.current?.focus(); e.target.value = ''; } }} className="px-1 py-1 text-xs border border-slate-200 rounded bg-white text-slate-600 outline-none" defaultValue="">
                                            <option value="" disabled>Tamano</option>
                                            <option value="12px">Normal</option>
                                            <option value="16px">Mediano</option>
                                            <option value="20px">Grande</option>
                                            <option value="24px">Titulo</option>
                                        </select>
                                        <div className="w-px h-5 bg-slate-300 mx-1"></div>
                                        <button type="button" onClick={() => { document.execCommand('insertHorizontalRule'); policyContentRef.current?.focus(); }} className="px-2 py-1.5 hover:bg-white rounded text-slate-600 text-xs font-medium border border-transparent hover:border-slate-200" title="Separador">── Linea</button>
                                        <button type="button" onClick={() => { document.execCommand('undo'); policyContentRef.current?.focus(); }} className="px-2 py-1.5 hover:bg-white rounded text-slate-500 text-xs border border-transparent hover:border-slate-200" title="Deshacer">Deshacer</button>
                                        <button type="button" onClick={() => { document.execCommand('redo'); policyContentRef.current?.focus(); }} className="px-2 py-1.5 hover:bg-white rounded text-slate-500 text-xs border border-transparent hover:border-slate-200" title="Rehacer">Rehacer</button>
                                    </div>
                                    {/* Editor contentEditable */}
                                    <div
                                        ref={policyContentRef}
                                        contentEditable
                                        suppressContentEditableWarning
                                        className="w-full px-4 py-3 border border-slate-300 rounded-b-lg text-sm outline-none focus:ring-2 focus:ring-amber-500 min-h-[350px] max-h-[500px] overflow-y-auto leading-relaxed bg-white"
                                        style={{ whiteSpace: 'pre-wrap' }}
                                        dangerouslySetInnerHTML={{ __html: editingPolicy?.content || '' }}
                                    />
                                </div>
                            </div>
                            <div className="p-5 border-t border-slate-200 flex items-center justify-between">
                                <button type="submit" disabled={savingPolicy} className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-green-600 text-white font-medium rounded-lg text-sm hover:from-emerald-700 hover:to-green-700 disabled:opacity-50 transition-all">
                                    {savingPolicy ? 'Guardando...' : editingPolicy ? 'Actualizar Politica' : 'Crear Politica'}
                                </button>
                                <button type="button" onClick={() => { setShowPolicyForm(false); setEditingPolicy(null); }} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">Cancelar</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};
