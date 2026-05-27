import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../src/contexts/AuthContext';
import { employeesService, loansService } from '../src/services/firestoreService';
import { AccessDenied } from './ui/AccessDenied';
import { Card } from './ui/Card';
import { useToast } from './ui/Toast';
import { ConfirmDialog } from './ui/ConfirmDialog';
import type { DetailedEmployee, EmployeeLoan, LoanPayment } from '../types';

interface PrestamosPageProps {
  setView: (view: string) => void;
}

export const PrestamosPage: React.FC<PrestamosPageProps> = ({ setView }) => {
  const { user, canViewAll, isAdmin } = useAuth();
  const toast = useToast();
  const [employees, setEmployees] = useState<DetailedEmployee[]>([]);
  const [loans, setLoans] = useState<EmployeeLoan[]>([]);
  const [activeTab, setActiveTab] = useState<'activos' | 'pendientes' | 'historial' | 'nuevo'>('activos');
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; loan: EmployeeLoan | null }>({ isOpen: false, loan: null });

  // Form para nuevo préstamo manual
  const [formEmployeeId, setFormEmployeeId] = useState('');
  const [formAmount, setFormAmount] = useState('');
  const [formInstallments, setFormInstallments] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [formStartQuincena, setFormStartQuincena] = useState('');
  const [formPaidCount, setFormPaidCount] = useState('0');
  const [isSaving, setIsSaving] = useState(false);

  // Edición de pago individual
  const [editingLoan, setEditingLoan] = useState<EmployeeLoan | null>(null);

  useEffect(() => {
    const u1 = employeesService.subscribe(setEmployees);
    const u2 = loansService.subscribe(setLoans);
    return () => { u1(); u2(); };
  }, []);

  const activoLoans = useMemo(() => loans.filter(l => l.status === 'aprobado' && l.remainingBalance > 0), [loans]);
  const pendienteLoans = useMemo(() => loans.filter(l => l.status === 'pendiente'), [loans]);
  const historialLoans = useMemo(() => loans.filter(l => l.status === 'liquidado' || l.status === 'rechazado'), [loans]);

  const selectedEmployee = useMemo(() => employees.find(e => e.id === formEmployeeId), [employees, formEmployeeId]);

  const biweeklyPayment = useMemo(() => {
    const amt = parseFloat(formAmount);
    const inst = parseInt(formInstallments);
    return amt > 0 && inst > 0 ? Math.round(amt / inst * 100) / 100 : 0;
  }, [formAmount, formInstallments]);

  const handleCreateLoan = async () => {
    if (!selectedEmployee || !formAmount || !formInstallments) {
      toast.warning('Selecciona empleado, monto y plazo.');
      return;
    }
    setIsSaving(true);
    try {
      const amt = parseFloat(formAmount);
      const inst = parseInt(formInstallments);
      const bw = Math.round(amt / inst * 100) / 100;
      const paidCount = parseInt(formPaidCount) || 0;

      // Generar plan de pagos
      const payments: LoanPayment[] = [];
      for (let i = 0; i < inst; i++) {
        const isLastPayment = i === inst - 1;
        const paymentAmt = isLastPayment ? Math.round((amt - bw * (inst - 1)) * 100) / 100 : bw;
        payments.push({
          quincena: i + 1,
          periodLabel: '',
          amount: paymentAmt,
          applied: i < paidCount,
          date: i < paidCount ? 'anterior al sistema' : '',
        });
      }

      const paidAmount = payments.filter(p => p.applied).reduce((s, p) => s + p.amount, 0);

      await loansService.create({
        employeeId: selectedEmployee.id,
        employeeCode: selectedEmployee.codigo,
        employeeName: `${selectedEmployee.paterno} ${selectedEmployee.materno} ${selectedEmployee.nombres}`,
        loanAmount: amt,
        installments: inst,
        biweeklyPayment: bw,
        remainingBalance: amt - paidAmount,
        paidAmount,
        payments,
        status: 'aprobado', // Si lo crea el admin, ya está aprobado
        requestDate: new Date().toISOString().slice(0, 10),
        approvedDate: new Date().toISOString().slice(0, 10),
        approvedBy: user?.email || '',
        notes: formNotes || '',
        createdBy: user?.email || '',
      });

      toast.success('Préstamo registrado.');
      setFormEmployeeId('');
      setFormAmount('');
      setFormInstallments('');
      setFormNotes('');
      setFormPaidCount('0');
      setActiveTab('activos');
    } catch (err: any) {
      toast.error(`Error: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleApproveLoan = async (loan: EmployeeLoan) => {
    if (!loan.id) return;
    await loansService.update(loan.id, {
      status: 'aprobado',
      approvedDate: new Date().toISOString().slice(0, 10),
      approvedBy: user?.email || '',
    });
    toast.success('Préstamo aprobado.');
  };

  const handleRejectLoan = async (loan: EmployeeLoan) => {
    if (!loan.id) return;
    await loansService.update(loan.id, {
      status: 'rechazado',
      rejectedDate: new Date().toISOString().slice(0, 10),
      rejectedBy: user?.email || '',
    });
    toast.success('Préstamo rechazado.');
  };

  const handleDeleteLoan = async () => {
    const loan = deleteConfirm.loan;
    if (!loan?.id) return;
    setDeleteConfirm({ isOpen: false, loan: null });
    await loansService.delete(loan.id);
    toast.success('Préstamo eliminado.');
  };

  const handleUpdatePaymentAmount = async (loan: EmployeeLoan, index: number, newAmount: number) => {
    if (!loan.id) return;
    const payments = [...loan.payments];
    payments[index].amount = newAmount;
    const paidAmount = payments.filter(p => p.applied).reduce((s, p) => s + p.amount, 0);
    await loansService.update(loan.id, {
      payments,
      paidAmount,
      remainingBalance: loan.loanAmount - paidAmount,
    });
  };

  const fmt = (n: number) => n.toLocaleString('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 2 });

  if (!user) return <AccessDenied icon="🔒" title="Acceso Restringido" message="Debes iniciar sesión." onBack={() => setView('dashboard')} />;
  if (!canViewAll) return <AccessDenied message="No tienes permisos." onBack={() => setView('dashboard')} />;

  return (
    <div className="container mx-auto p-4 sm:p-6 lg:p-8 font-sans">
      <header className="text-center mb-6">
        <h1 className="font-serif text-3xl font-bold text-slate-900">Préstamos</h1>
        <p className="text-slate-600">Control de préstamos y descuentos quincenales</p>
      </header>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-slate-100 rounded-lg p-1">
        {[
          { key: 'activos', label: `Activos (${activoLoans.length})` },
          { key: 'pendientes', label: `Pendientes (${pendienteLoans.length})` },
          { key: 'historial', label: `Historial (${historialLoans.length})` },
          { key: 'nuevo', label: '+ Registrar Préstamo' },
        ].map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key as any)}
            className={`flex-1 py-2 px-3 text-sm font-medium rounded-md transition-colors ${activeTab === tab.key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >{tab.label}</button>
        ))}
      </div>

      {/* TAB: Activos */}
      {activeTab === 'activos' && (
        <div className="space-y-4">
          {activoLoans.length === 0 ? (
            <Card><p className="text-center text-slate-500 py-8">No hay préstamos activos.</p></Card>
          ) : activoLoans.map(loan => (
            <Card key={loan.id}>
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h3 className="font-bold text-slate-800">{loan.employeeName}</h3>
                  <p className="text-xs text-slate-500">Código: {loan.employeeCode} — Aprobado: {loan.approvedDate}</p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-slate-900">{fmt(loan.loanAmount)}</p>
                  <p className="text-xs text-slate-500">Saldo: <span className="text-red-600 font-semibold">{fmt(loan.remainingBalance)}</span></p>
                </div>
              </div>

              {/* Barra de progreso */}
              <div className="mb-3">
                <div className="flex justify-between text-xs text-slate-500 mb-1">
                  <span>Pagado: {fmt(loan.paidAmount)}</span>
                  <span>{Math.round(loan.paidAmount / loan.loanAmount * 100)}%</span>
                </div>
                <div className="w-full h-2 bg-slate-200 rounded-full">
                  <div className="h-2 bg-emerald-500 rounded-full" style={{ width: `${Math.min(100, loan.paidAmount / loan.loanAmount * 100)}%` }} />
                </div>
              </div>

              {/* Plan de pagos */}
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="py-1.5 px-2 text-left">#</th>
                      <th className="py-1.5 px-2 text-right">Monto</th>
                      <th className="py-1.5 px-2 text-center">Estado</th>
                      <th className="py-1.5 px-2 text-left">Periodo</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {loan.payments.map((p, i) => (
                      <tr key={i} className={p.applied ? 'bg-emerald-50' : ''}>
                        <td className="py-1.5 px-2 font-mono">{p.quincena}</td>
                        <td className="py-1.5 px-2 text-right">
                          {editingLoan?.id === loan.id ? (
                            <input type="number" step="0.01" value={p.amount}
                              onChange={e => {
                                const newPayments = [...loan.payments];
                                newPayments[i].amount = parseFloat(e.target.value) || 0;
                                setEditingLoan({ ...loan, payments: newPayments });
                              }}
                              className="w-20 px-1 py-0.5 border border-slate-300 rounded text-right text-xs"
                            />
                          ) : fmt(p.amount)}
                        </td>
                        <td className="py-1.5 px-2 text-center">
                          {p.applied ? (
                            <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-800 rounded-full text-[10px] font-medium">Pagado</span>
                          ) : (
                            <span className="px-1.5 py-0.5 bg-amber-100 text-amber-800 rounded-full text-[10px] font-medium">Pendiente</span>
                          )}
                        </td>
                        <td className="py-1.5 px-2 text-slate-500">{p.periodLabel || p.date || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex gap-2 mt-3 justify-end">
                {editingLoan?.id === loan.id ? (
                  <>
                    <button onClick={async () => {
                      if (!loan.id || !editingLoan) return;
                      try {
                        const payments = editingLoan.payments;
                        const paidAmount = payments.filter(p => p.applied).reduce((s, p) => s + p.amount, 0);
                        await loansService.update(loan.id, {
                          payments,
                          paidAmount,
                          remainingBalance: loan.loanAmount - paidAmount,
                        });
                        setEditingLoan(null);
                        toast.success('Pagos actualizados.');
                      } catch (err: any) {
                        toast.error(`Error: ${err.message}`);
                      }
                    }} className="px-3 py-1 text-xs font-medium text-white bg-emerald-600 rounded-md hover:bg-emerald-700">
                      Guardar Cambios
                    </button>
                    <button onClick={() => setEditingLoan(null)} className="px-3 py-1 text-xs text-slate-600 border border-slate-300 rounded-md">
                      Cancelar
                    </button>
                  </>
                ) : (
                  <>
                    {loan.payments.some(p => !p.applied) && (
                      <button onClick={async () => {
                        if (!loan.id) return;
                        const nextIdx = loan.payments.findIndex(p => !p.applied);
                        if (nextIdx < 0) return;
                        const periodo = prompt('¿En qué periodo se aplicó este pago?', `Quincena ${new Date().toLocaleDateString('es-MX')}`);
                        if (!periodo) return;
                        try {
                          await loansService.applyPayment(loan.id, loan, nextIdx, periodo);
                          toast.success(`Pago #${nextIdx + 1} aplicado.`);
                        } catch (err: any) {
                          toast.error(`Error: ${err.message}`);
                        }
                      }} className="px-3 py-1 text-xs font-medium text-white bg-emerald-600 rounded-md hover:bg-emerald-700">
                        Aplicar Pago #{loan.payments.findIndex(p => !p.applied) + 1}
                      </button>
                    )}
                    <button onClick={() => setEditingLoan({ ...loan })} className="px-3 py-1 text-xs font-medium text-blue-700 bg-blue-100 rounded-md hover:bg-blue-200">
                      Editar Pagos
                    </button>
                    <button onClick={() => setDeleteConfirm({ isOpen: true, loan })} className="px-3 py-1 text-xs font-medium text-red-700 bg-red-100 rounded-md hover:bg-red-200">
                      Eliminar
                    </button>
                  </>
                )}
              </div>
              {loan.notes && <p className="mt-2 text-xs text-slate-500 italic">Nota: {loan.notes}</p>}
            </Card>
          ))}
        </div>
      )}

      {/* TAB: Pendientes */}
      {activeTab === 'pendientes' && (
        <div className="space-y-4">
          {pendienteLoans.length === 0 ? (
            <Card><p className="text-center text-slate-500 py-8">No hay solicitudes pendientes.</p></Card>
          ) : pendienteLoans.map(loan => (
            <Card key={loan.id}>
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-bold text-slate-800">{loan.employeeName}</h3>
                  <p className="text-sm text-slate-600">Monto: {fmt(loan.loanAmount)} — {loan.installments} quincenas — {fmt(loan.biweeklyPayment)}/qna</p>
                  <p className="text-xs text-slate-500">Solicitado: {loan.requestDate}</p>
                  {loan.notes && <p className="text-xs text-slate-400 mt-1">"{loan.notes}"</p>}
                </div>
                <div className="flex gap-2">
                  <button onClick={() => handleApproveLoan(loan)} className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700">
                    Aprobar
                  </button>
                  <button onClick={() => handleRejectLoan(loan)} className="px-4 py-2 text-sm font-medium text-red-700 bg-red-100 rounded-lg hover:bg-red-200">
                    Rechazar
                  </button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* TAB: Historial */}
      {activeTab === 'historial' && (
        <div className="space-y-4">
          {historialLoans.length === 0 ? (
            <Card><p className="text-center text-slate-500 py-8">No hay préstamos en el historial.</p></Card>
          ) : historialLoans.map(loan => (
            <Card key={loan.id}>
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="font-medium text-slate-800">{loan.employeeName}</h3>
                  <p className="text-xs text-slate-500">{fmt(loan.loanAmount)} — {loan.installments} quincenas</p>
                </div>
                <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${loan.status === 'liquidado' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>
                  {loan.status === 'liquidado' ? 'Liquidado' : 'Rechazado'}
                </span>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* TAB: Nuevo préstamo manual */}
      {activeTab === 'nuevo' && (
        <Card>
          <h3 className="text-lg font-bold text-slate-800 mb-4">Registrar Préstamo</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Colaborador</label>
              <select value={formEmployeeId} onChange={e => setFormEmployeeId(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white">
                <option value="">-- Seleccionar --</option>
                {employees.map(emp => (
                  <option key={emp.id} value={emp.id}>{emp.paterno} {emp.materno} {emp.nombres}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Monto del Préstamo</label>
                <input type="number" step="0.01" min="1" value={formAmount} onChange={e => setFormAmount(e.target.value)}
                  placeholder="Ej: 5000" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Plazo (quincenas)</label>
                <input type="number" min="1" value={formInstallments} onChange={e => setFormInstallments(e.target.value)}
                  placeholder="Ej: 10" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
              </div>
            </div>

            {biweeklyPayment > 0 && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-center">
                <p className="text-sm text-slate-700">Descuento quincenal: <strong className="text-lg text-amber-800">{fmt(biweeklyPayment)}</strong></p>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Quincenas ya pagadas (si ya amortizaba antes)</label>
              <input type="number" min="0" value={formPaidCount} onChange={e => setFormPaidCount(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
              <p className="text-xs text-slate-400 mt-1">Si el empleado ya tenía tiempo pagando, indica cuántas quincenas lleva.</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Notas</label>
              <input type="text" value={formNotes} onChange={e => setFormNotes(e.target.value)}
                placeholder="Opcional: motivo, acuerdos, etc." className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
            </div>

            <button onClick={handleCreateLoan} disabled={isSaving || !formEmployeeId || !formAmount || !formInstallments}
              className="w-full py-2.5 bg-gradient-to-r from-emerald-600 to-green-600 text-white rounded-lg font-medium hover:from-emerald-700 hover:to-green-700 disabled:opacity-50 transition-all">
              {isSaving ? 'Guardando...' : 'Registrar Préstamo'}
            </button>
          </div>
        </Card>
      )}

      <ConfirmDialog isOpen={deleteConfirm.isOpen} title="Eliminar Préstamo"
        message={deleteConfirm.loan ? `¿Eliminar préstamo de ${deleteConfirm.loan.employeeName} por ${fmt(deleteConfirm.loan.loanAmount)}?` : ''}
        variant="danger" onConfirm={handleDeleteLoan}
        onCancel={() => setDeleteConfirm({ isOpen: false, loan: null })} />
    </div>
  );
};
