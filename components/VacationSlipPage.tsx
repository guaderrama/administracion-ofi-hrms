import React, { useState, useCallback } from 'react';
import { VacationForm } from './VacationForm';
import { VacationPdfPreview } from './VacationPdfPreview';
import type { VacationRequest } from '../types';

// Declare jspdf from global scope (loaded via CDN)
declare const jspdf: any;

export const VacationSlipPage: React.FC = () => {
  const [vacationData, setVacationData] = useState<VacationRequest | null>(null);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [formKey, setFormKey] = useState<number>(0);

  const handleFormSubmit = (data: VacationRequest) => {
    setVacationData(data);
  };

  const handleReset = () => {
    setVacationData(null);
    setFormKey(prevKey => prevKey + 1);
  };

  const generatePdf = useCallback(async () => {
    if (!vacationData) return;

    setIsGenerating(true);
    try {
        const pdf = new jspdf.jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' });
        const pageWidth = pdf.internal.pageSize.getWidth();
        const ml = 20;
        const mr = 20;
        const cw = pageWidth - ml - mr;
        let y = 18;

        const fmtDate = (s: string) => new Date(s + 'T12:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' });
        const fmtDateShort = (s: string) => {
            const f = new Date(s + 'T12:00:00').toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
            return f.charAt(0).toUpperCase() + f.slice(1);
        };
        const line = (yy: number) => { pdf.setDrawColor(200, 200, 200); pdf.setLineWidth(0.3); pdf.line(ml, yy, pageWidth - mr, yy); };

        // Header
        pdf.setFont('times', 'bold'); pdf.setFontSize(20); pdf.setTextColor(30, 41, 59);
        pdf.text('IVAN GUADERRAMA ART', pageWidth / 2, y, { align: 'center' }); y += 6;
        pdf.setFont('helvetica', 'normal'); pdf.setFontSize(12); pdf.setTextColor(100, 116, 139);
        pdf.text('Papeleta de Vacaciones', pageWidth / 2, y, { align: 'center' }); y += 4;
        line(y); y += 7;

        // Fecha solicitud
        pdf.setFont('helvetica', 'bold'); pdf.setFontSize(9); pdf.setTextColor(30, 41, 59);
        pdf.text('Fecha de Solicitud: ', ml, y);
        const lw = pdf.getTextWidth('Fecha de Solicitud: ');
        pdf.setFont('helvetica', 'normal');
        pdf.text(fmtDate(vacationData.requestDate), ml + lw, y); y += 6;

        pdf.setFontSize(9); pdf.setTextColor(55, 65, 81);
        pdf.text('Por medio de la presente, solicito tomar los siguientes días a cuenta de mis vacaciones correspondientes.', ml, y);
        y += 7;

        // Datos colaborador
        pdf.setFont('helvetica', 'bold'); pdf.setFontSize(10); pdf.setTextColor(55, 65, 81);
        pdf.text('Datos del Colaborador', ml, y); y += 2; line(y); y += 5;
        const fullName = `${vacationData.firstName} ${vacationData.lastName} ${vacationData.motherLastName}`.toUpperCase();
        pdf.setFontSize(13); pdf.setTextColor(17, 24, 39);
        pdf.text(fullName, ml, y); y += 5;
        pdf.setFontSize(9); pdf.setTextColor(30, 41, 59);
        pdf.text('Fecha de Ingreso: ', ml, y);
        const hw = pdf.getTextWidth('Fecha de Ingreso: ');
        pdf.setFont('helvetica', 'normal');
        pdf.text(fmtDate(vacationData.hireDate), ml + hw, y); y += 8;

        // Resumen
        pdf.setFont('helvetica', 'bold'); pdf.setFontSize(10); pdf.setTextColor(55, 65, 81);
        pdf.text('Resumen de Vacaciones', ml, y); y += 2; line(y); y += 6;
        const colWidth = cw / 3;
        [
            { label: 'Días Correspondientes', value: String(vacationData.vacationDaysEntitled) },
            { label: 'Días Solicitados', value: String(vacationData.daysRequested) },
            { label: 'Días Pendientes', value: String(vacationData.daysRemaining) },
        ].forEach((item, i) => {
            const cx = ml + colWidth * i + colWidth / 2;
            pdf.setFont('helvetica', 'normal'); pdf.setFontSize(7); pdf.setTextColor(107, 114, 128);
            pdf.text(item.label, cx, y, { align: 'center' });
            pdf.setFont('helvetica', 'bold'); pdf.setFontSize(14); pdf.setTextColor(17, 24, 39);
            pdf.text(item.value, cx, y + 6, { align: 'center' });
        });
        y += 14;

        // Periodo - 2 column grid
        pdf.setFont('helvetica', 'bold'); pdf.setFontSize(10); pdf.setTextColor(55, 65, 81);
        pdf.text('Período Solicitado', ml, y); y += 2; line(y); y += 5;

        const halfW = cw / 2;
        pdf.setFillColor(245, 245, 245);
        pdf.rect(ml, y - 2, cw, 6, 'F');
        pdf.setFont('helvetica', 'bold'); pdf.setFontSize(8); pdf.setTextColor(75, 85, 99);
        pdf.text('#', ml + 2, y + 2);
        pdf.text('Fecha', ml + 8, y + 2);
        pdf.text('#', ml + halfW + 2, y + 2);
        pdf.text('Fecha', ml + halfW + 8, y + 2);
        y += 6; line(y); y += 1;

        const dates = vacationData.dates;
        const rows = Math.ceil(dates.length / 2);
        pdf.setFont('helvetica', 'normal'); pdf.setFontSize(8); pdf.setTextColor(55, 65, 81);

        for (let r = 0; r < rows; r++) {
            y += 4;
            const idxL = r;
            pdf.setFont('helvetica', 'bold'); pdf.setTextColor(150, 150, 150);
            pdf.text(String(idxL + 1), ml + 2, y);
            pdf.setFont('helvetica', 'normal'); pdf.setTextColor(55, 65, 81);
            pdf.text(fmtDateShort(dates[idxL]), ml + 8, y);
            const idxR = r + rows;
            if (idxR < dates.length) {
                pdf.setFont('helvetica', 'bold'); pdf.setTextColor(150, 150, 150);
                pdf.text(String(idxR + 1), ml + halfW + 2, y);
                pdf.setFont('helvetica', 'normal'); pdf.setTextColor(55, 65, 81);
                pdf.text(fmtDateShort(dates[idxR]), ml + halfW + 8, y);
            }
            y += 1.5;
            pdf.setDrawColor(230, 230, 230); pdf.setLineWidth(0.15);
            pdf.line(ml, y, pageWidth - mr, y);
            y += 0.5;
        }
        y += 5;

        // Notas
        if (vacationData.additionalNotes) {
            pdf.setFont('helvetica', 'bold'); pdf.setFontSize(10); pdf.setTextColor(55, 65, 81);
            pdf.text('Comentarios', ml, y); y += 2; line(y); y += 5;
            pdf.setFont('helvetica', 'normal'); pdf.setFontSize(9); pdf.setTextColor(55, 65, 81);
            const nl = pdf.splitTextToSize(vacationData.additionalNotes, cw);
            nl.forEach((l: string) => { pdf.text(l, ml, y); y += 4; });
            y += 3;
        }

        // Disclaimer
        y += 2;
        pdf.setFont('helvetica', 'italic'); pdf.setFontSize(7); pdf.setTextColor(140, 140, 140);
        pdf.text('La presente solicitud está sujeta a la aprobación de la Dirección General y a la disponibilidad operativa del departamento.', pageWidth / 2, y, { align: 'center', maxWidth: cw });
        y += 10;

        // Firmas
        pdf.setFont('helvetica', 'bold'); pdf.setFontSize(10); pdf.setTextColor(55, 65, 81);
        pdf.text('Firmas de Autorización', pageWidth / 2, y, { align: 'center' }); y += 2; line(y); y += 25;

        const sigColWidth = cw / 3;
        const signatureLabels = ['Firma del Solicitante', 'Dirección General', 'Administración'];
        signatureLabels.forEach((label, i) => {
            const sigX = ml + sigColWidth * i;
            const sigCenterX = sigX + sigColWidth / 2;
            pdf.setDrawColor(156, 163, 175); pdf.setLineWidth(0.4);
            pdf.line(sigX + 5, y, sigX + sigColWidth - 5, y);
            pdf.setFont('helvetica', 'normal');
            pdf.setFontSize(7);
            pdf.setTextColor(75, 85, 99);
            pdf.text(label, sigCenterX, y + 4, { align: 'center' });
        });

        const fileName = `vacaciones_${vacationData.firstName.replace(/\s/g, '_')}_${vacationData.lastName.replace(/\s/g, '_')}.pdf`;
        pdf.save(fileName);
    } catch (error) {
        console.error("Error generating PDF:", error);
    } finally {
        setIsGenerating(false);
    }
  }, [vacationData]);

  return (
    <div className="container mx-auto p-4 sm:p-6 lg:p-8 font-sans">
      <header className="text-center mb-8">
        <h1 className="font-serif text-4xl font-bold text-slate-900">IVAN GUADERRAMA ART</h1>
        <p className="mt-2 text-lg text-slate-700">Papeleta de Vacaciones</p>
      </header>

      <main className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
        <div className="lg:sticky lg:top-8">
            <VacationForm key={formKey} onSubmit={handleFormSubmit} isGenerating={isGenerating} />
        </div>
        
        <div>
            {vacationData ? (
                <div className="bg-white/30 backdrop-blur-lg rounded-xl shadow-lg border border-white/20 p-6 space-y-4">
                    <h3 className="text-lg leading-6 font-medium text-slate-800">Vista Previa del Documento</h3>
                    <div className="transform scale-90 origin-top bg-white rounded-lg overflow-auto shadow-lg max-h-[600px]">
                        <VacationPdfPreview data={vacationData} />
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
                            Complete y envíe el formulario para ver la vista previa de la papeleta aquí.
                        </p>
                    </div>
                </div>
            )}
        </div>
      </main>
    </div>
  );
};