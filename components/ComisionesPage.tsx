import React, { useState, useMemo, useEffect } from 'react';
import { useAuth } from '../src/contexts/AuthContext';
import { employeesService, commissionsService, type SavedCommissionReport } from '../src/services/firestoreService';
import { ConfirmDialog } from './ui/ConfirmDialog';
import { AccessDenied } from './ui/AccessDenied';
import { Card } from './ui/Card';
import { useToast } from './ui/Toast';
import type { DetailedEmployee, SaleGroup, CommissionSettings, EmployeeCommission } from '../types';
import {
  parseSalesFromCSV,
  calculateCommissions,
  distributeJuevesCommission,
  distributeSemanaCommission,
  getCommissionableBase,
  DEFAULT_SETTINGS,
  formatMXN,
} from '../utils/commissionUtils';

const MESES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

function formatDateShort(dateStr: string): string {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-');
  return `${parseInt(d)} ${MESES[parseInt(m) - 1]} ${y}`;
}

function generateReportName(sales: SaleGroup[]): string {
  const valid = sales.filter(s => !s.isExcluded);
  if (valid.length === 0) return 'Reporte vacío';

  const dates = valid.map(s => s.date).sort();
  const firstDate = dates[0];
  const lastDate = dates[dates.length - 1];

  const hasJueves = valid.some(s => s.dayOfWeek === 4);
  const hasSemana = valid.some(s => s.dayOfWeek !== 4);

  if (hasJueves && !hasSemana) {
    return `Caminata ${formatDateShort(firstDate)}`;
  }
  if (hasSemana && !hasJueves) {
    return `Semana ${formatDateShort(firstDate)} a ${formatDateShort(lastDate)}`;
  }
  return `Comisiones ${formatDateShort(firstDate)} a ${formatDateShort(lastDate)}`;
}

interface ComisionesPageProps {
  setView: (view: string) => void;
}

export const ComisionesPage: React.FC<ComisionesPageProps> = ({ setView }) => {
  const { user, canViewAll } = useAuth();
  const toast = useToast();

  const [employees, setEmployees] = useState<DetailedEmployee[]>([]);
  const [sales, setSales] = useState<SaleGroup[]>([]);
  const [settings, setSettings] = useState<CommissionSettings>(DEFAULT_SETTINGS);
  const [presentMap, setPresentMap] = useState<Record<string, boolean>>({});
  const [activeTab, setActiveTab] = useState<'upload' | 'jueves' | 'semana'>('upload');
  const [fileName, setFileName] = useState('');

  // Persistencia
  const [savedReports, setSavedReports] = useState<SavedCommissionReport[]>([]);
  const [currentReportId, setCurrentReportId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [reportName, setReportName] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; report: SavedCommissionReport | null }>({ isOpen: false, report: null });

  useEffect(() => {
    const unsub = employeesService.subscribe(emps => {
      setEmployees(emps);
      // Todos presentes por defecto
      const map: Record<string, boolean> = {};
      emps.forEach(emp => { map[emp.id] = true; });
      setPresentMap(prev => {
        const merged = { ...map };
        Object.keys(prev).forEach(k => { if (k in merged) merged[k] = prev[k]; });
        return merged;
      });
    });
    return () => unsub();
  }, []);

  // Cargar reportes guardados
  useEffect(() => {
    const unsub = commissionsService.subscribe(reports => setSavedReports(reports));
    return () => unsub();
  }, []);

  // Guardar reporte actual
  const handleSaveReport = async () => {
    if (sales.length === 0) return;
    setIsSaving(true);
    try {
      const name = reportName || generateReportName(sales);
      // Calcular comisiones por empleado para guardar con el reporte
      const empCommissions: Record<string, number> = {};
      juevesDistribution.forEach(e => {
        if (e.commission > 0) {
          empCommissions[e.employeeCode] = (empCommissions[e.employeeCode] || 0) + e.commission;
        }
      });
      semanaDistribution.forEach(e => {
        if (e.commission > 0) {
          empCommissions[e.employeeCode] = (empCommissions[e.employeeCode] || 0) + e.commission;
        }
      });

      const reportData = { name, fileName, settings, sales, presentMap, status: 'active' as const, employeeCommissions: empCommissions };
      if (currentReportId) {
        await commissionsService.update(currentReportId, reportData);
        toast.success('Reporte actualizado.');
      } else {
        const id = await commissionsService.save(reportData);
        setCurrentReportId(id);
        toast.success('Reporte guardado.');
      }
    } catch (err) {
      console.error('Error guardando reporte:', err);
      toast.error('Error al guardar reporte.');
    } finally {
      setIsSaving(false);
    }
  };

  // Cargar reporte guardado
  const handleLoadReport = (report: SavedCommissionReport) => {
    setSales(report.sales || []);
    setSettings(report.settings || DEFAULT_SETTINGS);
    setPresentMap(prev => {
      const merged: Record<string, boolean> = {};
      employees.forEach(emp => { merged[emp.id] = true; });
      if (report.presentMap) {
        Object.keys(report.presentMap).forEach(k => { if (k in merged) merged[k] = report.presentMap[k]; });
      }
      return merged;
    });
    setFileName(report.fileName || '');
    setReportName(report.name || '');
    setCurrentReportId(report.id || null);
    setActiveTab('jueves');
    toast.success(`Reporte "${report.name}" cargado.`);
  };

  // Eliminar reporte
  const confirmDeleteReport = async () => {
    const report = deleteConfirm.report;
    if (!report?.id) return;
    setDeleteConfirm({ isOpen: false, report: null });
    try {
      await commissionsService.delete(report.id);
      if (currentReportId === report.id) {
        setCurrentReportId(null);
        setSales([]);
        setReportName('');
        setActiveTab('upload');
      }
      toast.success('Reporte eliminado.');
    } catch (err) {
      console.error('Error eliminando reporte:', err);
      toast.error('Error al eliminar reporte.');
    }
  };

  // Nuevo reporte (limpiar todo)
  const handleNewReport = () => {
    setSales([]);
    setCurrentReportId(null);
    setFileName('');
    setReportName('');
    setSettings(DEFAULT_SETTINGS);
    setActiveTab('upload');
  };

  // Recolectar folios ya guardados en reportes existentes (para deduplicar)
  const existingReceiptNums = useMemo(() => {
    const nums = new Set<string>();
    savedReports.forEach(report => {
      // No incluir el reporte actual (si está cargado) para no excluirse a sí mismo
      if (report.id === currentReportId) return;
      (report.sales || []).forEach((sale: any) => {
        if (!sale.isExcluded) nums.add(sale.receiptNum);
      });
    });
    return nums;
  }, [savedReports, currentReportId]);

  // Parsear CSV
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setCurrentReportId(null); // Nuevo reporte
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      if (!text) { toast.error('No se pudo leer el archivo.'); return; }
      const parsed = parseSalesFromCSV(text, employees, existingReceiptNums);
      if (parsed.length === 0) {
        toast.warning('No se encontraron ventas en el archivo.');
        return;
      }
      const excluded = parsed.filter(s => s.isExcluded);
      const duplicates = excluded.filter(s => s.excludeReason?.includes('otro reporte'));
      setSales(parsed);
      setReportName(generateReportName(parsed));
      let msg = `${parsed.length} ventas importadas. ${excluded.length} excluidas.`;
      if (duplicates.length > 0) msg += ` ${duplicates.length} ya registradas en otros reportes.`;
      toast.success(msg);
      setActiveTab('jueves');
    };
    reader.readAsText(file, 'UTF-8');
  };

  // Calcular resúmenes
  const juevesSummary = useMemo(
    () => sales.length > 0 ? calculateCommissions(sales, 'jueves', settings) : null,
    [sales, settings]
  );
  const semanaSummary = useMemo(
    () => sales.length > 0 ? calculateCommissions(sales, 'semana', settings) : null,
    [sales, settings]
  );

  // Distribuir comisiones
  const juevesDistribution = useMemo(
    () => juevesSummary ? distributeJuevesCommission(juevesSummary, employees, presentMap) : [],
    [juevesSummary, employees, presentMap]
  );
  const semanaDistribution = useMemo(
    () => sales.length > 0 ? distributeSemanaCommission(sales, settings, employees) : [],
    [sales, settings, employees]
  );

  // Ventas excluidas
  const excludedSales = useMemo(() => sales.filter(s => s.isExcluded), [sales]);
  const juevesVentas = useMemo(() => sales.filter(s => !s.isExcluded && s.dayOfWeek === 4), [sales]);
  const semanaVentas = useMemo(() => sales.filter(s => !s.isExcluded && s.dayOfWeek !== 4), [sales]);

  // Desglose de líneas por categoría (para verificación)
  const juevesLinesByCategory = useMemo(() => {
    const lines: { folio: string; details: string; totalUSD: number; tc: number; mxn: number; iva: number; comBancaria: number; neto: number; category: string; paymentMethod: string }[] = [];
    juevesVentas.forEach(sale => {
      sale.lines.forEach(line => {
        const usd = line.total;
        const tc = settings.exchangeRate;
        const mxn = usd * tc;
        const upper = (sale.paymentMethod || '').toUpperCase();
        const isTarjeta = upper.includes('CREDIT CARD MNX') || upper.includes('CREDIT CARD MXN') || upper.includes('TARJETA') || upper.includes('AMERICAN EXPRESS MNX');
        // IVA siempre aplica (cash, tarjeta, transfer)
        const iva = mxn - (mxn / (1 + settings.ivaPercent / 100));
        const mxnSinIva = mxn - iva;
        // Comisión bancaria solo en tarjetas
        const comBancaria = isTarjeta ? mxnSinIva - (mxnSinIva / (1 + settings.bankFeePercent / 100)) : 0;
        const neto = mxn - iva - comBancaria;
        lines.push({
          folio: sale.receiptNum,
          details: line.details,
          totalUSD: usd,
          tc,
          mxn,
          iva,
          comBancaria,
          neto,
          category: line.category,
          paymentMethod: sale.paymentMethod,
        });
      });
    });
    return lines;
  }, [juevesVentas, settings]);

  const semanaLinesByCategory = useMemo(() => {
    const lines: { folio: string; details: string; totalUSD: number; tc: number; mxn: number; iva: number; comBancaria: number; neto: number; category: string; paymentMethod: string; user: string }[] = [];
    semanaVentas.forEach(sale => {
      sale.lines.forEach(line => {
        const usd = line.total;
        const tc = settings.exchangeRate;
        const mxn = usd * tc;
        const upper = (sale.paymentMethod || '').toUpperCase();
        const isTarjeta = upper.includes('CREDIT CARD MNX') || upper.includes('CREDIT CARD MXN') || upper.includes('TARJETA') || upper.includes('AMERICAN EXPRESS MNX');
        const iva = mxn - (mxn / (1 + settings.ivaPercent / 100));
        const mxnSinIva = mxn - iva;
        const comBancaria = isTarjeta ? mxnSinIva - (mxnSinIva / (1 + settings.bankFeePercent / 100)) : 0;
        const neto = mxn - iva - comBancaria;
        lines.push({
          folio: sale.receiptNum,
          details: line.details,
          totalUSD: usd,
          tc, mxn, iva, comBancaria, neto,
          category: line.category,
          paymentMethod: sale.paymentMethod,
          user: sale.user,
        });
      });
    });
    return lines;
  }, [semanaVentas, settings]);

  const handleSettingChange = (key: keyof CommissionSettings, value: string) => {
    setSettings(prev => ({ ...prev, [key]: parseFloat(value) || 0 }));
  };

  if (!user) return <AccessDenied icon="🔒" title="Acceso Restringido" message="Debes iniciar sesión." onBack={() => setView('dashboard')} />;
  if (!canViewAll) return <AccessDenied message="No tienes permisos para acceder a Comisiones." onBack={() => setView('dashboard')} />;

  return (
    <div className="container mx-auto p-4 sm:p-6 lg:p-8 font-sans">
      <header className="text-center mb-6">
        <h1 className="font-serif text-3xl font-bold text-slate-900">Comisiones</h1>
        <p className="text-slate-600">Cálculo de comisiones semanales y de caminata (jueves)</p>
      </header>

      {/* Barra de acciones */}
      {sales.length > 0 && (
        <div className="flex items-center gap-3 mb-4">
          <input
            type="text"
            value={reportName}
            onChange={e => setReportName(e.target.value)}
            placeholder="Nombre del reporte (ej: Semana 21 Mayo)"
            className="flex-1 px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-amber-400"
          />
          <button
            onClick={handleSaveReport}
            disabled={isSaving}
            className="px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-emerald-600 to-green-600 rounded-lg hover:from-emerald-700 hover:to-green-700 disabled:opacity-50 transition-colors"
          >
            {isSaving ? 'Guardando...' : currentReportId ? 'Actualizar' : 'Guardar'}
          </button>
          <button
            onClick={handleNewReport}
            className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
          >
            Nuevo
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-slate-100 rounded-lg p-1">
        {[
          { key: 'upload', label: 'Importar CSV' },
          { key: 'jueves', label: `Jueves (Caminata)${juevesSummary ? ` — ${formatMXN(juevesSummary.totalCommission)}` : ''}` },
          { key: 'semana', label: `Semana (Galería)${semanaSummary ? ` — ${formatMXN(semanaSummary.totalCommission)}` : ''}` },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as any)}
            className={`flex-1 py-2 px-3 text-sm font-medium rounded-md transition-colors ${
              activeTab === tab.key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Parámetros editables — siempre visible */}
      {sales.length > 0 && (
        <Card className="mb-6">
          <h3 className="text-sm font-bold text-slate-700 mb-3">Parámetros de Cálculo</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
            <SettingInput label="IVA %" value={settings.ivaPercent} onChange={v => handleSettingChange('ivaPercent', v)} />
            <SettingInput label="Com. Bancaria %" value={settings.bankFeePercent} onChange={v => handleSettingChange('bankFeePercent', v)} />
            <SettingInput label="Tipo Cambio USD" value={settings.exchangeRate} onChange={v => handleSettingChange('exchangeRate', v)} />
            <SettingInput label="Joyería % Jue" value={settings.joyeriaPercentJueves} onChange={v => handleSettingChange('joyeriaPercentJueves', v)} />
            <SettingInput label="Souvenirs % Jue" value={settings.souvenirsPercentJueves} onChange={v => handleSettingChange('souvenirsPercentJueves', v)} />
            <SettingInput label="Originales % Jue" value={settings.originalesPercentJueves} onChange={v => handleSettingChange('originalesPercentJueves', v)} />
            <SettingInput label="Joyería % Sem" value={settings.joyeriaPercentSemana} onChange={v => handleSettingChange('joyeriaPercentSemana', v)} />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 mt-2">
            <SettingInput label="Souvenirs % Sem" value={settings.souvenirsPercentSemana} onChange={v => handleSettingChange('souvenirsPercentSemana', v)} />
            <SettingInput label="Originales % Sem" value={settings.originalesPercentSemana} onChange={v => handleSettingChange('originalesPercentSemana', v)} />
          </div>
        </Card>
      )}

      {/* TAB: Importar CSV */}
      {activeTab === 'upload' && (
        <Card>
          <h3 className="text-lg font-bold text-slate-800 mb-4">Importar Ventas</h3>
          <div className="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center hover:border-amber-400 transition-colors">
            <input
              type="file"
              accept=".csv"
              onChange={handleFileUpload}
              className="hidden"
              id="csv-upload"
            />
            <label htmlFor="csv-upload" className="cursor-pointer">
              <div className="text-4xl mb-3">📊</div>
              <p className="text-slate-800 font-medium">
                {fileName ? fileName : 'Arrastra o haz clic para subir el CSV'}
              </p>
              <p className="text-sm text-slate-500 mt-1">
                Archivo CSV exportado del punto de venta
              </p>
            </label>
          </div>

          {sales.length > 0 && (
            <div className="mt-6 space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <StatCard label="Total Ventas" value={sales.length} />
                <StatCard label="Excluidas" value={excludedSales.length} color="red" />
                <StatCard label="Jueves" value={juevesVentas.length} color="amber" />
                <StatCard label="Semana" value={semanaVentas.length} color="green" />
              </div>

              {/* Ventas excluidas */}
              {excludedSales.length > 0 && (
                <div>
                  <h4 className="text-sm font-bold text-red-700 mb-2">Ventas Excluidas ({excludedSales.length})</h4>
                  <div className="max-h-48 overflow-y-auto rounded-lg border border-red-200">
                    <table className="w-full text-xs">
                      <thead className="bg-red-50 sticky top-0">
                        <tr>
                          <th className="py-2 px-3 text-left">Folio</th>
                          <th className="py-2 px-3 text-left">Cliente</th>
                          <th className="py-2 px-3 text-right">Total</th>
                          <th className="py-2 px-3 text-left">Razón</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-red-100">
                        {excludedSales.map(s => (
                          <tr key={s.receiptNum} className="text-red-800">
                            <td className="py-1.5 px-3 font-mono">{s.receiptNum}</td>
                            <td className="py-1.5 px-3">{s.customerName || 'N/A'}</td>
                            <td className="py-1.5 px-3 text-right">{formatMXN(s.totalAmount)}</td>
                            <td className="py-1.5 px-3">{s.excludeReason}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </Card>
      )}

      {/* Reportes guardados — siempre visible en tab upload */}
      {activeTab === 'upload' && savedReports.length > 0 && (
        <Card className="mt-6">
          <h3 className="text-lg font-bold text-slate-800 mb-4">Reportes Guardados ({savedReports.length})</h3>
          <div className="space-y-2">
            {savedReports.map(report => (
              <div
                key={report.id}
                className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
                  currentReportId === report.id ? 'border-amber-400 bg-amber-50' : 'border-slate-200 hover:bg-slate-50'
                }`}
              >
                <div className="flex-1 cursor-pointer" onClick={() => handleLoadReport(report)}>
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-slate-800">{report.name}</p>
                    {report.lockedByPayroll && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-slate-200 text-slate-700">
                        🔒 {report.lockedByPayroll}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500">
                    {report.fileName} — {report.sales?.length || 0} ventas —
                    {report.createdAt instanceof Date ? report.createdAt.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }) : ''}
                  </p>
                </div>
                <div className="flex gap-2 ml-4">
                  <button
                    onClick={() => handleLoadReport(report)}
                    className="px-3 py-1 text-xs font-medium text-amber-700 bg-amber-100 rounded-md hover:bg-amber-200 transition-colors"
                  >
                    {report.lockedByPayroll ? 'Ver' : 'Cargar'}
                  </button>
                  {!report.lockedByPayroll && (
                    <button
                      onClick={() => setDeleteConfirm({ isOpen: true, report })}
                      className="px-3 py-1 text-xs font-medium text-red-700 bg-red-100 rounded-md hover:bg-red-200 transition-colors"
                    >
                      Eliminar
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Confirmación de eliminar */}
      <ConfirmDialog
        isOpen={deleteConfirm.isOpen}
        title="Eliminar Reporte"
        message={deleteConfirm.report ? `¿Eliminar "${deleteConfirm.report.name}"? Esta acción no se puede deshacer.` : ''}
        variant="danger"
        onConfirm={confirmDeleteReport}
        onCancel={() => setDeleteConfirm({ isOpen: false, report: null })}
      />

      {/* TAB: Jueves (Caminata) */}
      {activeTab === 'jueves' && juevesSummary && (
        <div className="space-y-6">
          {/* Resumen */}
          <Card>
            <h3 className="text-lg font-bold text-amber-800 mb-4">
              Comisiones de Jueves (Caminata)
              {juevesSummary.dateRange.start && (
                <span className="text-sm font-normal text-slate-500 ml-2">
                  {juevesSummary.dateRange.start} → {juevesSummary.dateRange.end}
                </span>
              )}
            </h3>
            <div className="grid grid-cols-3 gap-4 mb-4">
              <SummaryCard label="Joyería" base={juevesSummary.joyeriaTotal} commission={juevesSummary.joyeriaCommission} pct={settings.joyeriaPercentJueves} color="blue" />
              <SummaryCard label="Souvenirs" base={juevesSummary.souvenirsTotal} commission={juevesSummary.souvenirsCommission} pct={settings.souvenirsPercentJueves} color="green" />
              <SummaryCard label="Originales" base={juevesSummary.originalesTotal} commission={juevesSummary.originalesCommission} pct={settings.originalesPercentJueves} color="purple" />
            </div>
            <div className="bg-amber-50 border-2 border-amber-300 rounded-lg p-4 flex justify-between items-center">
              <span className="text-lg font-bold text-amber-900">Total a Comisionar</span>
              <span className="text-2xl font-bold text-amber-900">{formatMXN(juevesSummary.totalCommission)}</span>
            </div>
          </Card>

          {/* Desglose por categoría */}
          {(['joyeria', 'souvenirs', 'originales'] as const).map(cat => {
            const catLines = juevesLinesByCategory.filter(l => l.category === cat);
            if (catLines.length === 0) return null;
            const catLabel = cat === 'joyeria' ? 'Joyería' : cat === 'souvenirs' ? 'Souvenirs' : 'Originales';
            const catColor = cat === 'joyeria' ? 'blue' : cat === 'souvenirs' ? 'green' : 'purple';
            return (
              <Card key={cat}>
                <h3 className={`text-sm font-bold text-${catColor}-700 mb-2`}>Desglose {catLabel} ({catLines.length} líneas)</h3>
                <div className="max-h-64 overflow-auto rounded-lg border border-slate-200">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-50 sticky top-0">
                      <tr>
                        <th className="py-2 px-2 text-left">Folio</th>
                        <th className="py-2 px-2 text-left">Detalle</th>
                        <th className="py-2 px-2 text-left">Pago</th>
                        <th className="py-2 px-2 text-right">USD</th>
                        <th className="py-2 px-2 text-right">T.C.</th>
                        <th className="py-2 px-2 text-right">MXN</th>
                        <th className="py-2 px-2 text-right">IVA</th>
                        <th className="py-2 px-2 text-right">Com. Banc.</th>
                        <th className="py-2 px-2 text-right font-bold">Neto</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {catLines.map((line, i) => (
                        <tr key={`${line.folio}-${i}`}>
                          <td className="py-1.5 px-2 font-mono">{line.folio}</td>
                          <td className="py-1.5 px-2 max-w-[200px] truncate">{line.details}</td>
                          <td className="py-1.5 px-2 text-xs">{line.paymentMethod}</td>
                          <td className="py-1.5 px-2 text-right">${line.totalUSD.toFixed(2)}</td>
                          <td className="py-1.5 px-2 text-right text-slate-500">{line.tc.toFixed(2)}</td>
                          <td className="py-1.5 px-2 text-right">{formatMXN(line.mxn)}</td>
                          <td className="py-1.5 px-2 text-right text-red-600">{line.iva > 0 ? `-${formatMXN(line.iva)}` : '—'}</td>
                          <td className="py-1.5 px-2 text-right text-red-600">{line.comBancaria > 0 ? `-${formatMXN(line.comBancaria)}` : '—'}</td>
                          <td className="py-1.5 px-2 text-right font-semibold">{formatMXN(line.neto)}</td>
                        </tr>
                      ))}
                      <tr className="bg-slate-50 font-bold border-t-2 border-slate-300">
                        <td colSpan={3} className="py-2 px-2">Total {catLabel}</td>
                        <td className="py-2 px-2 text-right">${catLines.reduce((s, l) => s + l.totalUSD, 0).toFixed(2)}</td>
                        <td className="py-2 px-2"></td>
                        <td className="py-2 px-2 text-right">{formatMXN(catLines.reduce((s, l) => s + l.mxn, 0))}</td>
                        <td className="py-2 px-2 text-right text-red-600">-{formatMXN(catLines.reduce((s, l) => s + l.iva, 0))}</td>
                        <td className="py-2 px-2 text-right text-red-600">-{formatMXN(catLines.reduce((s, l) => s + l.comBancaria, 0))}</td>
                        <td className="py-2 px-2 text-right">{formatMXN(catLines.reduce((s, l) => s + l.neto, 0))}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </Card>
            );
          })}

          {/* Distribución entre empleados */}
          <Card>
            <h3 className="text-lg font-bold text-slate-800 mb-4">Distribución entre Colaboradores</h3>
            <p className="text-sm text-slate-500 mb-4">
              Presentes: {Object.values(presentMap).filter(Boolean).length} de {employees.length} —
              Comisión por persona: <strong>{formatMXN(juevesDistribution.find(e => e.present)?.commission || 0)}</strong>
            </p>
            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="w-full text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="py-2.5 px-4 text-left font-semibold">Colaborador</th>
                    <th className="py-2.5 px-4 text-center font-semibold">Presente</th>
                    <th className="py-2.5 px-4 text-right font-semibold">Comisión</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {juevesDistribution.map(emp => (
                    <tr key={emp.employeeCode} className={emp.present ? '' : 'bg-slate-50 text-slate-400'}>
                      <td className="py-2.5 px-4 font-medium">{emp.employeeName}</td>
                      <td className="py-2.5 px-4 text-center">
                        <select
                          value={presentMap[employees.find(e => e.codigo === emp.employeeCode)?.id || ''] ? 'si' : 'no'}
                          onChange={(e) => {
                            const empId = employees.find(em => em.codigo === emp.employeeCode)?.id;
                            if (empId) setPresentMap(prev => ({ ...prev, [empId]: e.target.value === 'si' }));
                          }}
                          className="px-2 py-1 border border-slate-300 rounded text-sm bg-white"
                        >
                          <option value="si">Presente</option>
                          <option value="no">Ausente</option>
                        </select>
                      </td>
                      <td className="py-2.5 px-4 text-right font-bold text-amber-800">
                        {emp.present ? formatMXN(emp.commission) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Detalle de ventas del jueves */}
          <Card>
            <h3 className="text-sm font-bold text-slate-700 mb-3">Detalle de Ventas — Jueves ({juevesVentas.length})</h3>
            <SalesTable sales={juevesVentas} />
          </Card>
        </div>
      )}

      {activeTab === 'jueves' && !juevesSummary && (
        <Card><p className="text-center text-slate-500 py-8">Importa un CSV primero para ver las comisiones de jueves.</p></Card>
      )}

      {/* TAB: Semana (Galería) */}
      {activeTab === 'semana' && semanaSummary && (
        <div className="space-y-6">
          <Card>
            <h3 className="text-lg font-bold text-green-800 mb-4">
              Comisiones Semanales (Galería)
              {semanaSummary.dateRange.start && (
                <span className="text-sm font-normal text-slate-500 ml-2">
                  {semanaSummary.dateRange.start} → {semanaSummary.dateRange.end}
                </span>
              )}
            </h3>
            <div className="grid grid-cols-3 gap-4 mb-4">
              <SummaryCard label="Joyería" base={semanaSummary.joyeriaTotal} commission={semanaSummary.joyeriaCommission} pct={settings.joyeriaPercentSemana} color="blue" />
              <SummaryCard label="Souvenirs" base={semanaSummary.souvenirsTotal} commission={semanaSummary.souvenirsCommission} pct={settings.souvenirsPercentSemana} color="green" />
              <SummaryCard label="Originales" base={semanaSummary.originalesTotal} commission={semanaSummary.originalesCommission} pct={settings.originalesPercentSemana} color="purple" />
            </div>
            <div className="bg-green-50 border-2 border-green-300 rounded-lg p-4 flex justify-between items-center">
              <span className="text-lg font-bold text-green-900">Total a Comisionar</span>
              <span className="text-2xl font-bold text-green-900">{formatMXN(semanaSummary.totalCommission)}</span>
            </div>
          </Card>

          {/* Desglose por categoría — Semana */}
          {(['joyeria', 'souvenirs', 'originales'] as const).map(cat => {
            const catLines = semanaLinesByCategory.filter(l => l.category === cat);
            if (catLines.length === 0) return null;
            const catLabel = cat === 'joyeria' ? 'Joyería' : cat === 'souvenirs' ? 'Souvenirs' : 'Originales';
            const catColor = cat === 'joyeria' ? 'blue' : cat === 'souvenirs' ? 'green' : 'purple';
            return (
              <Card key={cat}>
                <h3 className={`text-sm font-bold text-${catColor}-700 mb-2`}>Desglose {catLabel} ({catLines.length} líneas)</h3>
                <div className="max-h-64 overflow-auto rounded-lg border border-slate-200">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-50 sticky top-0">
                      <tr>
                        <th className="py-2 px-2 text-left">Folio</th>
                        <th className="py-2 px-2 text-left">Detalle</th>
                        <th className="py-2 px-2 text-left">Vendedor</th>
                        <th className="py-2 px-2 text-left">Pago</th>
                        <th className="py-2 px-2 text-right">USD</th>
                        <th className="py-2 px-2 text-right">T.C.</th>
                        <th className="py-2 px-2 text-right">MXN</th>
                        <th className="py-2 px-2 text-right">IVA</th>
                        <th className="py-2 px-2 text-right">Com. Banc.</th>
                        <th className="py-2 px-2 text-right font-bold">Neto</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {catLines.map((line, i) => (
                        <tr key={`${line.folio}-${i}`}>
                          <td className="py-1.5 px-2 font-mono">{line.folio}</td>
                          <td className="py-1.5 px-2 max-w-[200px] truncate">{line.details}</td>
                          <td className="py-1.5 px-2">{line.user}</td>
                          <td className="py-1.5 px-2 text-xs">{line.paymentMethod}</td>
                          <td className="py-1.5 px-2 text-right">${line.totalUSD.toFixed(2)}</td>
                          <td className="py-1.5 px-2 text-right text-slate-500">{line.tc.toFixed(2)}</td>
                          <td className="py-1.5 px-2 text-right">{formatMXN(line.mxn)}</td>
                          <td className="py-1.5 px-2 text-right text-red-600">{line.iva > 0 ? `-${formatMXN(line.iva)}` : '—'}</td>
                          <td className="py-1.5 px-2 text-right text-red-600">{line.comBancaria > 0 ? `-${formatMXN(line.comBancaria)}` : '—'}</td>
                          <td className="py-1.5 px-2 text-right font-semibold">{formatMXN(line.neto)}</td>
                        </tr>
                      ))}
                      <tr className="bg-slate-50 font-bold border-t-2 border-slate-300">
                        <td colSpan={4} className="py-2 px-2">Total {catLabel}</td>
                        <td className="py-2 px-2 text-right">${catLines.reduce((s, l) => s + l.totalUSD, 0).toFixed(2)}</td>
                        <td className="py-2 px-2"></td>
                        <td className="py-2 px-2 text-right">{formatMXN(catLines.reduce((s, l) => s + l.mxn, 0))}</td>
                        <td className="py-2 px-2 text-right text-red-600">-{formatMXN(catLines.reduce((s, l) => s + l.iva, 0))}</td>
                        <td className="py-2 px-2 text-right text-red-600">-{formatMXN(catLines.reduce((s, l) => s + l.comBancaria, 0))}</td>
                        <td className="py-2 px-2 text-right">{formatMXN(catLines.reduce((s, l) => s + l.neto, 0))}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </Card>
            );
          })}

          {/* Distribución por vendedor */}
          <Card>
            <h3 className="text-lg font-bold text-slate-800 mb-4">Comisión por Vendedor</h3>
            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="w-full text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="py-2.5 px-4 text-left font-semibold">Vendedor</th>
                    <th className="py-2.5 px-4 text-right font-semibold">Ventas Base</th>
                    <th className="py-2.5 px-4 text-right font-semibold">Comisión</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {semanaDistribution
                    .filter(e => e.commission > 0 || e.individualSales > 0)
                    .map(emp => (
                    <tr key={emp.employeeCode}>
                      <td className="py-2.5 px-4 font-medium">{emp.employeeName}</td>
                      <td className="py-2.5 px-4 text-right">{formatMXN(emp.individualSales)}</td>
                      <td className="py-2.5 px-4 text-right font-bold text-green-800">{formatMXN(emp.commission)}</td>
                    </tr>
                  ))}
                  {semanaDistribution.every(e => e.commission === 0) && (
                    <tr><td colSpan={3} className="py-4 text-center text-slate-500">No se encontraron ventas asignadas a vendedores registrados.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Detalle */}
          <Card>
            <h3 className="text-sm font-bold text-slate-700 mb-3">Detalle de Ventas — Semana ({semanaVentas.length})</h3>
            <SalesTable sales={semanaVentas} />
          </Card>
        </div>
      )}

      {activeTab === 'semana' && !semanaSummary && (
        <Card><p className="text-center text-slate-500 py-8">Importa un CSV primero para ver las comisiones semanales.</p></Card>
      )}
    </div>
  );
};

// ============================================
// Sub-componentes
// ============================================

const SettingInput: React.FC<{ label: string; value: number; onChange: (v: string) => void }> = ({ label, value, onChange }) => {
  const [localValue, setLocalValue] = React.useState(String(value));
  React.useEffect(() => { setLocalValue(String(value)); }, [value]);
  return (
    <div>
      <label className="block text-xs font-medium text-slate-500">{label}</label>
      <input
        type="text"
        inputMode="decimal"
        value={localValue}
        onChange={e => {
          const v = e.target.value;
          if (v === '' || /^[0-9]*\.?[0-9]*$/.test(v)) {
            setLocalValue(v);
          }
        }}
        onBlur={() => {
          const num = parseFloat(localValue) || 0;
          setLocalValue(String(num));
          onChange(String(num));
        }}
        className="mt-0.5 w-full px-2 py-1.5 text-sm border border-slate-300 rounded-md bg-white focus:ring-2 focus:ring-amber-400 focus:border-transparent"
      />
    </div>
  );
};

const StatCard: React.FC<{ label: string; value: number; color?: string }> = ({ label, value, color = 'slate' }) => (
  <div className={`p-3 rounded-lg bg-${color}-50 border border-${color}-200 text-center`}>
    <p className={`text-2xl font-bold text-${color}-800`}>{value}</p>
    <p className={`text-xs text-${color}-600`}>{label}</p>
  </div>
);

const SummaryCard: React.FC<{ label: string; base: number; commission: number; pct: number; color: string }> = ({ label, base, commission, pct, color }) => (
  <div className={`p-4 rounded-lg border bg-white`}>
    <p className="text-xs font-medium text-slate-500 mb-1">{label} ({pct}%)</p>
    <p className="text-sm text-slate-600">Base: {formatMXN(base)}</p>
    <p className={`text-lg font-bold text-${color}-700`}>{formatMXN(commission)}</p>
  </div>
);

const SalesTable: React.FC<{ sales: SaleGroup[] }> = ({ sales }) => (
  <div className="max-h-64 overflow-y-auto rounded-lg border border-slate-200">
    <table className="w-full text-xs">
      <thead className="bg-slate-50 sticky top-0">
        <tr>
          <th className="py-2 px-3 text-left">Folio</th>
          <th className="py-2 px-3 text-left">Fecha</th>
          <th className="py-2 px-3 text-left">Cliente</th>
          <th className="py-2 px-3 text-left">Vendedor</th>
          <th className="py-2 px-3 text-left">Pago</th>
          <th className="py-2 px-3 text-right">Total</th>
          <th className="py-2 px-3 text-left">Productos</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100">
        {sales.map(s => (
          <tr key={s.receiptNum}>
            <td className="py-1.5 px-3 font-mono">{s.receiptNum}</td>
            <td className="py-1.5 px-3">{s.date}</td>
            <td className="py-1.5 px-3">{s.customerName || 'N/A'}</td>
            <td className="py-1.5 px-3">{s.user}</td>
            <td className="py-1.5 px-3">{s.paymentMethod}</td>
            <td className="py-1.5 px-3 text-right font-semibold">{formatMXN(s.totalAmount)}</td>
            <td className="py-1.5 px-3 text-slate-500">{s.lines.map(l => l.category).filter((v, i, a) => a.indexOf(v) === i).join(', ')}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);
