import React, { useState, useCallback, useEffect } from 'react';
import { LoanRequestForm } from './LoanRequestForm';
import { LoanRequestPdfPreview } from './LoanRequestPdfPreview';
import type { LoanRequest, LoanPayment } from '../types';
import { useAuth } from '../src/contexts/AuthContext';
import { loansService, employeesService } from '../src/services/firestoreService';
import { useToast } from './ui/Toast';
import type { DetailedEmployee } from '../types';

declare const jspdf: any;
declare const html2canvas: any;

export const LoanRequestPage: React.FC = () => {
  const { user } = useAuth();
  const toast = useToast();
  const [loanData, setLoanData] = useState<LoanRequest | null>(null);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [formKey, setFormKey] = useState<number>(0);
  const [employees, setEmployees] = useState<DetailedEmployee[]>([]);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    const unsub = employeesService.subscribe(setEmployees);
    return () => unsub();
  }, []);

  const handleFormSubmit = async (data: LoanRequest) => {
    setLoanData(data);

    // Guardar solicitud en Firestore como préstamo pendiente
    try {
      const emp = employees.find(e =>
        e.nombres === data.firstName && e.paterno === data.lastName && e.materno === data.motherLastName
      );
      if (!emp) {
        toast.warning('No se encontró el empleado para vincular la solicitud.');
        return;
      }

      const bw = Math.round(data.loanAmount / data.installments * 100) / 100;
      const payments: LoanPayment[] = [];
      for (let i = 0; i < data.installments; i++) {
        const isLast = i === data.installments - 1;
        payments.push({
          quincena: i + 1,
          periodLabel: '',
          amount: isLast ? Math.round((data.loanAmount - bw * (data.installments - 1)) * 100) / 100 : bw,
          applied: false,
        });
      }

      await loansService.create({
        employeeId: emp.id,
        employeeCode: emp.codigo,
        employeeName: `${emp.paterno} ${emp.materno} ${emp.nombres}`,
        loanAmount: data.loanAmount,
        installments: data.installments,
        biweeklyPayment: bw,
        remainingBalance: data.loanAmount,
        paidAmount: 0,
        payments,
        status: 'pendiente',
        requestDate: data.requestDate,
        notes: '',
        createdBy: user?.email || '',
      });
      setSubmitted(true);
      toast.success('Solicitud de préstamo enviada. Pendiente de aprobación.');
    } catch (err: any) {
      console.error('Error guardando solicitud:', err);
      toast.error('Error al enviar solicitud.');
    }
  };

  const handleReset = () => {
    setLoanData(null);
    setFormKey(prevKey => prevKey + 1);
  };

  const generatePdf = useCallback(async () => {
    if (!loanData) return;

    const content = document.getElementById('pdf-content-loan');
    if (!content) {
        console.error("PDF content element not found");
        return;
    }

    setIsGenerating(true);
    try {
        const canvas = await html2canvas(content, { scale: 2 });
        const imgData = canvas.toDataURL('image/png');
        
        const pdf = new jspdf.jsPDF({
            orientation: 'portrait',
            unit: 'mm',
            format: 'a4'
        });

        const imgProps = pdf.getImageProperties(imgData);
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
        
        pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
        
        const fileName = `prestamo_${loanData.firstName.replace(/\s/g, '_')}_${loanData.lastName.replace(/\s/g, '_')}.pdf`;
        pdf.save(fileName);
    } catch (error) {
        console.error("Error generating PDF:", error);
    } finally {
        setIsGenerating(false);
    }
  }, [loanData]);

  return (
    <div className="container mx-auto p-4 sm:p-6 lg:p-8 font-sans">
      <header className="text-center mb-8">
        <h1 className="font-serif text-4xl font-bold text-slate-900">IVAN GUADERRAMA ART</h1>
        <p className="mt-2 text-lg text-slate-700">Solicitud de Préstamo Personal</p>
      </header>

      <main className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
        <div className="lg:sticky lg:top-8">
            <LoanRequestForm key={formKey} onSubmit={handleFormSubmit} isGenerating={isGenerating} />
        </div>
        
        <div>
            {loanData ? (
                <div className="bg-white/30 backdrop-blur-lg rounded-xl shadow-lg border border-white/20 p-6 space-y-4">
                    <h3 className="text-lg leading-6 font-medium text-slate-800">Vista Previa del Documento</h3>
                    <div className="transform scale-90 origin-top bg-white rounded-lg overflow-hidden shadow-lg">
                        <LoanRequestPdfPreview data={loanData} />
                    </div>
                    <div className="space-y-2 pt-2">
                        <button
                            onClick={generatePdf}
                            disabled={isGenerating}
                            className="w-full inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-gradient-to-r from-orange-500 to-rose-500 hover:from-orange-600 hover:to-rose-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 disabled:from-orange-300 disabled:to-rose-300 disabled:cursor-not-allowed"
                        >
                            {isGenerating ? 'Descargando PDF...' : 'Descargar como PDF'}
                        </button>
                        <button
                            onClick={handleReset}
                            className="w-full inline-flex justify-center py-2 px-4 border border-white/50 shadow-sm text-sm font-medium rounded-md text-slate-800 bg-white/50 hover:bg-white/70 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500"
                        >
                            Nueva Solicitud
                        </button>
                    </div>
                </div>
            ) : (
                <div className="flex items-center justify-center h-full bg-white/30 backdrop-blur-lg rounded-xl shadow-lg border border-white/20 p-12 text-center">
                    <div>
                        <h3 className="text-sm font-medium text-slate-800">Vista Previa</h3>
                        <p className="mt-1 text-sm text-slate-600">
                            Complete el formulario para ver la vista previa del pagaré aquí.
                        </p>
                    </div>
                </div>
            )}
        </div>
      </main>
    </div>
  );
};