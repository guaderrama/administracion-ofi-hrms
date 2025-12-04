import React, { useState, useCallback } from 'react';
import { PermissionForm } from './PermissionForm';
import { PdfPreview } from './PdfPreview';
import type { PermissionRequest } from '../types';

// Declare jspdf and html2canvas from global scope (loaded via CDN)
declare const jspdf: any;
declare const html2canvas: any;

export const PermissionGeneratorPage: React.FC = () => {
  const [permissionData, setPermissionData] = useState<Omit<PermissionRequest, 'id' | 'status'> | null>(null);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [formKey, setFormKey] = useState<number>(0);

  const handleFormSubmit = (data: Omit<PermissionRequest, 'id' | 'status'>) => {
    setPermissionData(data);
  };

  const handleReset = () => {
    setPermissionData(null);
    setFormKey(prevKey => prevKey + 1);
  };

  const generatePdf = useCallback(async () => {
    if (!permissionData) return;

    // Save the request to localStorage
    try {
        const storedRequests = localStorage.getItem('permission_requests');
        const requests: PermissionRequest[] = storedRequests ? JSON.parse(storedRequests) : [];
        const newRequest: PermissionRequest = {
            ...permissionData,
            id: new Date().toISOString() + '-' + Math.random().toString(36).substr(2, 9),
            status: 'Pendiente',
        };
        requests.push(newRequest);
        localStorage.setItem('permission_requests', JSON.stringify(requests));
    } catch (error) {
        console.error("Error saving permission request:", error);
    }


    const content = document.getElementById('pdf-content');
    if (!content) {
        console.error("PDF content element not found");
        return;
    }

    setIsGenerating(true);
    try {
        const canvas = await html2canvas(content, { scale: 2 });
        const imgData = canvas.toDataURL('image/png');
        
        // A4 size: 210 x 297 mm
        const pdf = new jspdf.jsPDF({
            orientation: 'portrait',
            unit: 'mm',
            format: 'a4'
        });

        const imgProps = pdf.getImageProperties(imgData);
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
        
        pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
        
        const fileName = `permiso_${permissionData.firstName.replace(/\s/g, '_')}_${permissionData.lastName.replace(/\s/g, '_')}.pdf`;
        pdf.save(fileName);
    } catch (error) {
        console.error("Error generating PDF:", error);
    } finally {
        setIsGenerating(false);
    }
  }, [permissionData]);

  return (
    <div className="container mx-auto p-4 sm:p-6 lg:p-8 font-sans">
      <header className="text-center mb-8">
        <h1 className="font-serif text-4xl font-bold text-slate-900">IVAN GUADERRAMA ART</h1>
        <p className="mt-2 text-lg text-slate-700">Solicitud de Permiso Laboral</p>
      </header>

      <main className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
        <div className="lg:sticky lg:top-8">
            <PermissionForm key={formKey} onSubmit={handleFormSubmit} isGenerating={isGenerating} />
        </div>
        
        <div>
            {permissionData ? (
                <div className="bg-white/30 backdrop-blur-lg rounded-xl shadow-lg border border-white/20 p-6 space-y-4">
                    <h3 className="text-lg leading-6 font-medium text-slate-800">Vista Previa del Documento</h3>
                    <div className="transform scale-90 origin-top bg-white rounded-lg overflow-hidden shadow-lg">
                        <PdfPreview data={{...permissionData, id: '', status: ''}} />
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
                            Complete y envíe el formulario para ver la vista previa del permiso aquí.
                        </p>
                    </div>
                </div>
            )}
        </div>
      </main>
    </div>
  );
};