import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../src/contexts/AuthContext';
import { importantDatesService, employeesService, type ImportantDate, type DateCategory } from '../src/services/firestoreService';
import type { DetailedEmployee } from '../types';
import { getOfficialHolidays } from '../utils/mexicanHolidays';
import { AccessDenied } from './ui/AccessDenied';
import { Card } from './ui/Card';
import { useToast } from './ui/Toast';
import { ConfirmDialog } from './ui/ConfirmDialog';

interface CalendarPageProps {
  setView: (view: string) => void;
}

type ExtendedCategory = DateCategory | 'cumpleanos' | 'feriado_ley';

const CATEGORY_CONFIG: Record<ExtendedCategory, { label: string; color: string; bg: string; border: string }> = {
  festivo: { label: 'Dia Festivo', color: 'text-red-800', bg: 'bg-red-100', border: 'border-red-200' },
  feriado_ley: { label: 'Feriado LFT', color: 'text-red-800', bg: 'bg-red-50', border: 'border-red-200' },
  vacaciones: { label: 'Vacaciones', color: 'text-emerald-800', bg: 'bg-emerald-100', border: 'border-emerald-200' },
  empresa: { label: 'Empresa', color: 'text-amber-800', bg: 'bg-amber-100', border: 'border-amber-200' },
  capacitacion: { label: 'Capacitacion', color: 'text-blue-800', bg: 'bg-blue-100', border: 'border-blue-200' },
  cumpleanos: { label: 'Cumpleanos', color: 'text-rose-800', bg: 'bg-rose-100', border: 'border-rose-200' },
  otro: { label: 'Otro', color: 'text-slate-800', bg: 'bg-slate-100', border: 'border-slate-200' },
};

const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

export const CalendarPage: React.FC<CalendarPageProps> = ({ setView }) => {
  const { canViewAll, canEdit, user } = useAuth();
  const toast = useToast();

  const [dbDates, setDbDates] = useState<ImportantDate[]>([]);
  const [employees, setEmployees] = useState<DetailedEmployee[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingDate, setEditingDate] = useState<ImportantDate | null>(null);
  const [saving, setSaving] = useState(false);
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [viewYear, setViewYear] = useState(new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState(new Date().getMonth());
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; date: ImportantDate | null }>({ isOpen: false, date: null });

  const [form, setForm] = useState({
    title: '',
    date: '',
    endDate: '',
    category: 'empresa' as DateCategory,
    description: '',
    recurring: false,
    noLabor: false,
  });

  useEffect(() => {
    const unsub = importantDatesService.subscribe((d) => setDbDates(d));
    return () => unsub();
  }, []);

  useEffect(() => {
    const unsub = employeesService.subscribe((e) => setEmployees(e));
    return () => unsub();
  }, []);

  // Combinar: DB dates + feriados LFT + cumpleanos empleados
  const dates = useMemo(() => {
    const all: ImportantDate[] = [...dbDates];

    // Feriados oficiales del ano actual del calendario
    const holidays = getOfficialHolidays(viewYear);
    holidays.forEach(h => {
      // No duplicar si ya existe en DB
      if (!dbDates.some(d => d.date === h.date)) {
        all.push({
          title: h.name,
          date: h.date,
          category: 'festivo' as DateCategory,
          recurring: true,
          noLabor: true,
          description: 'Ley Federal del Trabajo',
          createdBy: 'sistema',
          createdAt: new Date(),
        });
      }
    });

    // Cumpleanos de empleados
    employees.forEach(emp => {
      if (!emp.fechaNacimiento) return;
      const mmdd = emp.fechaNacimiento.slice(5); // MM-DD
      const birthDateThisYear = `${viewYear}-${mmdd}`;
      const empName = `${emp.nombres} ${emp.paterno}`.trim();
      all.push({
        title: `Cumpleanos de ${empName}`,
        date: birthDateThisYear,
        category: 'otro' as DateCategory, // usaremos _virtual para render
        recurring: true,
        noLabor: false,
        description: `${emp.nombres} ${emp.paterno} ${emp.materno}`,
        createdBy: 'sistema',
        createdAt: new Date(),
        _isBirthday: true,
      } as ImportantDate & { _isBirthday?: boolean });
    });

    // Aniversarios laborales
    employees.forEach(emp => {
      if (!emp.fechaIngreso) return;
      const hireDate = new Date(emp.fechaIngreso + 'T12:00:00');
      const years = viewYear - hireDate.getFullYear();
      if (years < 1) return;
      const mmdd = emp.fechaIngreso.slice(5);
      const empName = `${emp.nombres} ${emp.paterno}`.trim();
      all.push({
        title: `${years} año${years > 1 ? 's' : ''} de ${empName}`,
        date: `${viewYear}-${mmdd}`,
        category: 'empresa' as DateCategory,
        recurring: true,
        noLabor: false,
        description: `Aniversario laboral - ${emp.nombres} ${emp.paterno} ${emp.materno}`,
        createdBy: 'sistema',
        createdAt: new Date(),
        _isAnniversary: true,
      } as ImportantDate & { _isAnniversary?: boolean });
    });

    all.sort((a, b) => a.date.localeCompare(b.date));
    return all;
  }, [dbDates, viewYear, employees]);

  // Fechas filtradas
  const filteredDates = useMemo(() => {
    let result = dates;
    if (filterCategory !== 'all') {
      result = result.filter(d => d.category === filterCategory);
    }
    return result;
  }, [dates, filterCategory]);

  // Fechas del mes actual del calendario
  const monthDates = useMemo(() => {
    const yearStr = viewYear.toString();
    const monthStr = (viewMonth + 1).toString().padStart(2, '0');
    return dates.filter(d => {
      const dMonth = d.date.slice(0, 7); // YYYY-MM
      if (dMonth === `${yearStr}-${monthStr}`) return true;
      // Check ranges
      if (d.endDate) {
        const start = new Date(d.date + 'T00:00:00');
        const end = new Date(d.endDate + 'T00:00:00');
        const monthStart = new Date(viewYear, viewMonth, 1);
        const monthEnd = new Date(viewYear, viewMonth + 1, 0);
        return start <= monthEnd && end >= monthStart;
      }
      // Recurring: same month different year
      if (d.recurring && d.date.slice(5, 7) === monthStr) return true;
      return false;
    });
  }, [dates, viewYear, viewMonth]);

  // Calendar grid
  const calendarDays = useMemo(() => {
    const firstDay = new Date(viewYear, viewMonth, 1);
    const lastDay = new Date(viewYear, viewMonth + 1, 0);
    const startPad = firstDay.getDay(); // 0=Sunday
    const totalDays = lastDay.getDate();

    const days: { day: number; events: ImportantDate[] }[] = [];

    // Empty padding
    for (let i = 0; i < startPad; i++) {
      days.push({ day: 0, events: [] });
    }

    for (let d = 1; d <= totalDays; d++) {
      const dateStr = `${viewYear}-${(viewMonth + 1).toString().padStart(2, '0')}-${d.toString().padStart(2, '0')}`;
      const events = dates.filter(evt => {
        if (evt.date === dateStr) return true;
        if (evt.endDate && dateStr >= evt.date && dateStr <= evt.endDate) return true;
        if (evt.recurring) {
          const evtMMDD = evt.date.slice(5);
          const dayMMDD = dateStr.slice(5);
          if (evtMMDD === dayMMDD) return true;
        }
        return false;
      });
      days.push({ day: d, events });
    }

    return days;
  }, [dates, viewYear, viewMonth]);

  const resetForm = () => {
    setForm({ title: '', date: '', endDate: '', category: 'empresa', description: '', recurring: false, noLabor: false });
    setEditingDate(null);
  };

  const handleEdit = (d: ImportantDate) => {
    setForm({
      title: d.title,
      date: d.date,
      endDate: d.endDate || '',
      category: d.category,
      description: d.description || '',
      recurring: d.recurring,
      noLabor: d.noLabor ?? false,
    });
    setEditingDate(d);
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.date) return;
    setSaving(true);
    try {
      const data: Omit<ImportantDate, 'id'> = {
        title: form.title,
        date: form.date,
        endDate: form.endDate || '',
        category: form.category,
        description: form.description || '',
        recurring: form.recurring,
        noLabor: form.noLabor,
        createdBy: user?.email || '',
        createdAt: new Date(),
      };
      if (editingDate?.id) {
        await importantDatesService.update(editingDate.id, data);
        toast.success('Fecha actualizada.');
      } else {
        await importantDatesService.create(data);
        toast.success('Fecha agregada al calendario.');
      }
      resetForm();
      setShowForm(false);
    } catch (err: any) {
      console.error('Error al guardar fecha:', err);
      toast.error(`Error al guardar: ${err?.message || 'Intenta de nuevo.'}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm.date?.id) return;
    try {
      await importantDatesService.remove(deleteConfirm.date.id);
      toast.success('Fecha eliminada.');
    } catch {
      toast.error('Error al eliminar.');
    }
    setDeleteConfirm({ isOpen: false, date: null });
  };

  if (!user) {
    return <AccessDenied icon="lock" title="Acceso Restringido" message="Debes iniciar sesion." onBack={() => setView('dashboard')} />;
  }
  if (!canViewAll) {
    return <AccessDenied message="No tienes permisos para acceder." onBack={() => setView('dashboard')} />;
  }

  const today = new Date();
  const todayStr = `${today.getFullYear()}-${(today.getMonth() + 1).toString().padStart(2, '0')}-${today.getDate().toString().padStart(2, '0')}`;

  return (
    <div className="container mx-auto p-4 sm:p-6 lg:p-8 font-sans">
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Calendario y Fechas Importantes</h1>
          <p className="text-sm text-slate-500 mt-1">Gestiona dias festivos, vacaciones, eventos de empresa y mas.</p>
        </div>
        {canEdit && (
          <button
            onClick={() => { resetForm(); setShowForm(!showForm); }}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white font-medium rounded-lg shadow-sm transition-all"
          >
            {showForm ? (
              <><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg> Cancelar</>
            ) : (
              <><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg> Nueva Fecha</>
            )}
          </button>
        )}
      </header>

      {/* Form */}
      {showForm && canEdit && (
        <Card className="mb-6">
          <h2 className="text-lg font-semibold text-slate-800 mb-4">{editingDate ? 'Editar Fecha' : 'Agregar Fecha'}</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Titulo *</label>
                <input type="text" required value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none" placeholder="Ej: Dia de la Independencia" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Fecha Inicio *</label>
                <input type="date" required value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Fecha Fin (opcional)</label>
                <input type="date" value={form.endDate} min={form.date} onChange={e => setForm(p => ({ ...p, endDate: e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Categoria *</label>
                <select value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value as DateCategory }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-amber-500 outline-none">
                  {Object.entries(CATEGORY_CONFIG).map(([key, cfg]) => (
                    <option key={key} value={key}>{cfg.label}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Descripcion (opcional)</label>
                <input type="text" value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none" placeholder="Descripcion breve..." />
              </div>
              <div className="flex items-center gap-6 pt-6">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.noLabor} onChange={e => setForm(p => ({ ...p, noLabor: e.target.checked }))} className="w-4 h-4 text-red-600 rounded border-slate-300 focus:ring-red-500" />
                  <span className="text-sm text-slate-700">No se labora</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.recurring} onChange={e => setForm(p => ({ ...p, recurring: e.target.checked }))} className="w-4 h-4 text-amber-600 rounded border-slate-300 focus:ring-amber-500" />
                  <span className="text-sm text-slate-700">Se repite cada ano</span>
                </label>
              </div>
            </div>
            <button type="submit" disabled={saving} className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-green-600 text-white font-medium rounded-lg text-sm disabled:opacity-50 hover:from-emerald-700 hover:to-green-700 transition-all">
              {saving ? 'Guardando...' : editingDate ? 'Actualizar Fecha' : 'Agregar Fecha'}
            </button>
          </form>
        </Card>
      )}

      {/* Calendar View */}
      <Card className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => { if (viewMonth === 0) { setViewMonth(11); setViewYear(viewYear - 1); } else setViewMonth(viewMonth - 1); }} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
            <svg className="w-5 h-5 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" /></svg>
          </button>
          <h2 className="text-lg font-bold text-slate-800">{MONTHS[viewMonth]} {viewYear}</h2>
          <button onClick={() => { if (viewMonth === 11) { setViewMonth(0); setViewYear(viewYear + 1); } else setViewMonth(viewMonth + 1); }} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
            <svg className="w-5 h-5 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
          </button>
        </div>

        <div className="grid grid-cols-7 gap-px bg-slate-200 rounded-lg overflow-hidden">
          {['Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab'].map(d => (
            <div key={d} className="bg-slate-50 py-2 text-center text-xs font-semibold text-slate-600 uppercase">{d}</div>
          ))}
          {calendarDays.map((cell, i) => {
            const dateStr = cell.day > 0 ? `${viewYear}-${(viewMonth + 1).toString().padStart(2, '0')}-${cell.day.toString().padStart(2, '0')}` : '';
            const isToday = dateStr === todayStr;
            return (
              <div key={i} className={`bg-white min-h-[70px] p-1 ${cell.day === 0 ? 'bg-slate-50' : ''}`}>
                {cell.day > 0 && (
                  <>
                    <div className={`text-xs font-medium mb-0.5 ${isToday ? 'bg-amber-600 text-white w-6 h-6 rounded-full flex items-center justify-center' : 'text-slate-600'}`}>
                      {cell.day}
                    </div>
                    {cell.events.slice(0, 2).map((evt, j) => {
                      const isBirthday = (evt as any)._isBirthday;
                      const isSystemHoliday = evt.createdBy === 'sistema' && evt.noLabor;
                      const catKey = isBirthday ? 'cumpleanos' : isSystemHoliday ? 'feriado_ley' : evt.category;
                      const cfg = CATEGORY_CONFIG[catKey as ExtendedCategory] || CATEGORY_CONFIG.otro;
                      const isEditable = canEdit && evt.createdBy !== 'sistema';
                      return (
                        <div key={j} className={`text-[10px] px-1 py-0.5 rounded truncate mb-0.5 ${isEditable ? 'cursor-pointer' : ''} ${cfg.bg} ${cfg.color}`} title={evt.title} onClick={() => isEditable && handleEdit(evt)}>
                          {isBirthday ? '🎂 ' : isSystemHoliday ? '🏛️ ' : ''}{evt.title}
                        </div>
                      );
                    })}
                    {cell.events.length > 2 && (
                      <div className="text-[10px] text-slate-400">+{cell.events.length - 2} mas</div>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>

        {/* Events this month */}
        {monthDates.length > 0 && (
          <div className="mt-4 border-t border-slate-200 pt-4">
            <h3 className="text-sm font-semibold text-slate-700 mb-2">Eventos de {MONTHS[viewMonth]}</h3>
            <div className="space-y-2">
              {monthDates.map((d, idx) => {
                const isBirthday = (d as any)._isBirthday;
                const isSystem = d.createdBy === 'sistema';
                const catKey = isBirthday ? 'cumpleanos' : (isSystem && d.noLabor) ? 'feriado_ley' : d.category;
                const cfg = CATEGORY_CONFIG[catKey as ExtendedCategory] || CATEGORY_CONFIG.otro;
                return (
                  <div key={d.id || `sys-${idx}`} className={`flex items-center justify-between p-3 rounded-lg border ${cfg.border} ${cfg.bg}`}>
                    <div className="flex items-center gap-3">
                      <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full uppercase ${cfg.bg} ${cfg.color} border ${cfg.border}`}>{cfg.label}</span>
                      <div>
                        <p className={`text-sm font-semibold ${cfg.color}`}>{isBirthday ? '🎂 ' : ''}{d.title}</p>
                        <p className="text-xs text-slate-500">
                          {new Date(d.date + 'T12:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'long' })}
                          {d.endDate && d.endDate !== '' && ` - ${new Date(d.endDate + 'T12:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'long' })}`}
                          {d.recurring && ' (cada ano)'}
                          {d.noLabor && !isBirthday && ' - No se labora'}
                        </p>
                        {d.description && <p className="text-xs text-slate-500 mt-0.5">{d.description}</p>}
                      </div>
                    </div>
                    {canEdit && !isSystem && (
                      <div className="flex gap-1">
                        <button onClick={() => handleEdit(d)} className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors" title="Editar">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" /></svg>
                        </button>
                        <button onClick={() => setDeleteConfirm({ isOpen: true, date: d })} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Eliminar">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </Card>

      {/* All Dates List */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-800">Todas las Fechas ({filteredDates.length})</h2>
          <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)} className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-amber-500 outline-none">
            <option value="all">Todas las categorias</option>
            {Object.entries(CATEGORY_CONFIG).map(([key, cfg]) => (
              <option key={key} value={key}>{cfg.label}</option>
            ))}
          </select>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-slate-200">
                <th className="text-left py-2 px-3 font-semibold text-slate-600 text-xs">Titulo</th>
                <th className="text-center py-2 px-3 font-semibold text-slate-600 text-xs">Categoria</th>
                <th className="text-center py-2 px-3 font-semibold text-slate-600 text-xs">Fecha</th>
                <th className="text-center py-2 px-3 font-semibold text-slate-600 text-xs">Recurrente</th>
                {canEdit && <th className="text-center py-2 px-3 font-semibold text-slate-600 text-xs">Acciones</th>}
              </tr>
            </thead>
            <tbody>
              {filteredDates.length === 0 ? (
                <tr><td colSpan={canEdit ? 5 : 4} className="text-center py-8 text-slate-400">No hay fechas registradas.</td></tr>
              ) : filteredDates.map((d, idx) => {
                const isBirthday = (d as any)._isBirthday;
                const isSystem = d.createdBy === 'sistema';
                const catKey = isBirthday ? 'cumpleanos' : (isSystem && d.noLabor) ? 'feriado_ley' : d.category;
                const cfg = CATEGORY_CONFIG[catKey as ExtendedCategory] || CATEGORY_CONFIG.otro;
                return (
                  <tr key={d.id || `sys-${idx}`} className="border-b border-slate-100 hover:bg-amber-50/50">
                    <td className="py-2.5 px-3">
                      <p className="font-medium text-slate-800">{isBirthday ? '🎂 ' : ''}{d.title}</p>
                      {d.description && <p className="text-xs text-slate-400">{d.description}</p>}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${cfg.bg} ${cfg.color}`}>{cfg.label}</span>
                    </td>
                    <td className="py-2.5 px-3 text-center text-slate-600">
                      {new Date(d.date + 'T12:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })}
                      {d.endDate && d.endDate !== '' && ` - ${new Date(d.endDate + 'T12:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })}`}
                    </td>
                    <td className="py-2.5 px-3 text-center">{d.recurring ? 'Cada ano' : 'No'}</td>
                    {canEdit && (
                      <td className="py-2.5 px-3 text-center">
                        {!isSystem ? (
                          <div className="flex gap-1 justify-center">
                            <button onClick={() => handleEdit(d)} className="p-1 text-slate-400 hover:text-amber-600 rounded transition-colors" title="Editar">
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" /></svg>
                            </button>
                            <button onClick={() => setDeleteConfirm({ isOpen: true, date: d })} className="p-1 text-slate-400 hover:text-red-600 rounded transition-colors" title="Eliminar">
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>
                            </button>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400">Automatico</span>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <ConfirmDialog isOpen={deleteConfirm.isOpen} title="Eliminar Fecha" message={`Eliminar "${deleteConfirm.date?.title}" del calendario?`} variant="danger" onConfirm={handleDelete} onCancel={() => setDeleteConfirm({ isOpen: false, date: null })} />
    </div>
  );
};
