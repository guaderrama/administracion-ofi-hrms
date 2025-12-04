import React from 'react';
import type { LoanRequest } from '../types';

interface LoanRequestPdfPreviewProps {
  data: LoanRequest;
}

// Helper function to convert number to Spanish words
const numberToWords = (num: number): string => {
  if (num === null || num === undefined) return '';

  const toWords = (n: number): string => {
    const a = [
      '', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve',
      'diez', 'once', 'doce', 'trece', 'catorce', 'quince', 'dieciséis', 'diecisiete', 'dieciocho', 'diecinueve'
    ];
    const b = ['', '', 'veinte', 'treinta', 'cuarenta', 'cincuenta', 'sesenta', 'setenta', 'ochenta', 'noventa'];
    const c = [
      '', 'ciento', 'doscientos', 'trescientos', 'cuatrocientos', 'quinientos', 'seiscientos', 'setecientos', 'ochocientos', 'novecientos'
    ];

    if (n < 20) return a[n];
    if (n < 30) return 'veinti' + a[n-20];
    if (n < 100) return b[Math.floor(n/10)] + (n%10 !== 0 ? ' y ' + a[n%10] : '');
    if (n < 200) return 'ciento ' + toWords(n-100);
    if (n < 1000) return c[Math.floor(n/100)] + ' ' + toWords(n%100);
    if (n < 2000) return 'mil ' + toWords(n-1000);
    if (n < 1000000) {
      const thousands = Math.floor(n / 1000);
      const remainder = n % 1000;
      return (thousands === 1 ? 'mil' : toWords(thousands) + ' mil') + (remainder > 0 ? ' ' + toWords(remainder) : '');
    }
    return '';
  }

  const integerPart = Math.floor(num);
  const decimalPart = Math.round((num - integerPart) * 100);
  const integerWords = toWords(integerPart).toUpperCase();

  return `${integerWords} PESOS ${decimalPart.toString().padStart(2, '0')}/100 M.N.`;
};

export const LoanRequestPdfPreview: React.FC<LoanRequestPdfPreviewProps> = ({ data }) => {
  const formatDate = (dateStr: string) => new Date(dateStr + 'T12:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' });
  const biweeklyPayment = data.loanAmount > 0 && data.installments > 0 ? (data.loanAmount / data.installments).toFixed(2) : '0.00';
  const fullName = `${data.firstName} ${data.lastName} ${data.motherLastName}`.toUpperCase();
  
  return (
    <div id="pdf-content-loan" className="p-8 bg-white text-gray-900 font-sans text-xs max-w-2xl mx-auto border border-gray-300 shadow-lg">
        <header className="text-center mb-6 border-b pb-3">
          <h1 className="font-serif text-2xl text-gray-800">IVAN GUADERRAMA ART</h1>
          <h2 className="text-lg font-light text-gray-600 mt-1">Solicitud y Pagaré de Préstamo Personal</h2>
        </header>

        <section className="mb-4">
            <p className="text-right">Fecha de Solicitud: <span className="font-semibold">{formatDate(data.requestDate)}</span></p>
        </section>

        <section className="mb-4 text-justify leading-relaxed">
            <p>
                Por medio del presente, yo, <strong className="font-semibold">{fullName}</strong>,
                solicito a la empresa un préstamo personal por la cantidad de 
                <strong className="font-semibold"> ${data.loanAmount.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MXN </strong>
                (<span className="font-semibold">{numberToWords(data.loanAmount)}</span>).
            </p>
            <p className="mt-2">
                Me comprometo a liquidar dicho préstamo mediante descuentos vía nómina en <strong className="font-semibold">{data.installments} pagos quincenales</strong>,
                cada uno por la cantidad de <strong className="font-semibold">${biweeklyPayment} MXN</strong>.
                El primer descuento se aplicará en la quincena inmediata posterior a la entrega del préstamo.
            </p>
            <p className="mt-2">
                Autorizo expresamente a la empresa para que realice los descuentos correspondientes de mi salario. Entiendo que en caso de terminación de la relación laboral,
                cualquier saldo pendiente será liquidado de mi finiquito.
            </p>
        </section>
        
        <section className="mb-4 p-3 bg-gray-50 border rounded-md">
            <h3 className="text-sm font-semibold border-b pb-1 mb-2 text-gray-700">Resumen del Préstamo</h3>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                <p><strong className="font-medium text-gray-800">Solicitante:</strong></p><p>{fullName}</p>
                <p><strong className="font-medium text-gray-800">Monto Total:</strong></p><p>${data.loanAmount.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MXN</p>
                <p><strong className="font-medium text-gray-800">Plazo:</strong></p><p>{data.installments} quincenas</p>
                <p><strong className="font-medium text-gray-800">Pago Quincenal:</strong></p><p>${biweeklyPayment} MXN</p>
            </div>
        </section>
        
        <p className="text-xs text-gray-500 my-6 italic text-center">
            Este documento funciona como un pagaré y acuse de recibo del monto solicitado.
        </p>

        <footer className="mt-12">
          <div className="grid grid-cols-2 gap-8 text-center pt-8">
            <div>
              <div className="border-t border-gray-400 pt-2">Firma del Solicitante</div>
              <p className="mt-1 text-xs">{fullName}</p>
            </div>
            <div>
              <div className="border-t border-gray-400 pt-2">Autorización de la Empresa</div>
            </div>
          </div>
        </footer>
    </div>
  );
};
