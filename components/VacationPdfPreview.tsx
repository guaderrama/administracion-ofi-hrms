import React from 'react';
import type { VacationRequest } from '../types';

interface VacationPdfPreviewProps {
  data: VacationRequest;
}

const DetailRow: React.FC<{ label: string; value?: string | number }> = ({ label, value }) => (
  value || value === 0 ? <p className="leading-relaxed"><strong className="font-medium text-gray-800">{label}:</strong> {String(value)}</p> : null
);

const DatesTable: React.FC<{ dates: string[] }> = ({ dates }) => {
  if (!dates || dates.length === 0) {
    return <p className="mt-2 text-sm text-gray-600">No se especificaron fechas.</p>;
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr + 'T12:00:00');
    return date.toLocaleDateString('es-MX', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  return (
    <div className="mt-2">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr>
            <th className="border-b-2 border-gray-300 py-2 px-4 bg-gray-50 text-sm font-semibold text-gray-600">Fechas de Vacaciones Solicitadas</th>
          </tr>
        </thead>
        <tbody>
          {dates.map((date, index) => (
            <tr key={index}>
              <td className="border-b border-gray-200 py-2 px-4 text-sm capitalize">{formatDate(date)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export const VacationPdfPreview: React.FC<VacationPdfPreviewProps> = ({ data }) => {
  const formatDate = (dateStr: string) => new Date(dateStr + 'T12:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <div id="pdf-content-vacation" className="p-8 bg-white text-gray-900 font-sans text-sm max-w-2xl mx-auto border border-gray-300 shadow-lg" style={{ lineHeight: '1.6' }}>
        <header className="text-center mb-8 border-b pb-4">
          <h1 className="font-serif text-3xl text-gray-800">IVAN GUADERRAMA ART</h1>
          <h2 className="text-xl font-light text-gray-600 mt-2">Papeleta de Vacaciones</h2>
        </header>

        <section className="mb-6">
          <DetailRow label="Fecha de Solicitud" value={formatDate(data.requestDate)} />
          <p className="mt-4">
              Por medio de la presente, solicito tomar los siguientes días a cuenta de mis vacaciones correspondientes.
          </p>
        </section>

        <section className="mb-6">
          <h3 className="text-base font-semibold border-b pb-1 mb-2 text-gray-700">Datos del Colaborador</h3>
          <p className="font-bold text-lg text-gray-900">
              {`${data.firstName} ${data.lastName} ${data.motherLastName}`.toUpperCase()}
          </p>
          <DetailRow label="Fecha de Ingreso" value={formatDate(data.hireDate)} />
        </section>

        <section className="mb-6">
          <h3 className="text-base font-semibold border-b pb-1 mb-2 text-gray-700">Resumen de Vacaciones</h3>
          <div className="grid grid-cols-3 gap-2 mt-2 text-center">
              <div>
                <p className="text-xs text-gray-500">Días Correspondientes</p>
                <p className="text-lg font-bold text-gray-900">{data.vacationDaysEntitled}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Días Solicitados</p>
                <p className="text-lg font-bold text-gray-900">{data.daysRequested}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Días Pendientes</p>
                <p className="text-lg font-bold text-gray-900">{data.daysRemaining}</p>
              </div>
          </div>
        </section>

        <section className="mb-6">
          <h3 className="text-base font-semibold border-b pb-1 mb-2 text-gray-700">Período Solicitado</h3>
          <DatesTable dates={data.dates} />
        </section>
        
        {data.additionalNotes && (
          <section className="mb-6">
              <h3 className="text-base font-semibold border-b pb-1 mb-2 text-gray-700">Comentarios Adicionales</h3>
              <p className="whitespace-pre-wrap">{data.additionalNotes}</p>
          </section>
        )}

        <p className="text-xs text-gray-500 my-8 italic text-center">
          La presente solicitud está sujeta a la aprobación de la Dirección General y a la disponibilidad operativa del departamento.
        </p>

        <footer className="mt-16">
          <h3 className="text-base font-semibold border-b pb-1 mb-10 text-gray-700 text-center">Firmas de Autorización</h3>
          <div className="grid grid-cols-3 gap-8 text-center pt-8">
            <div>
              <div className="border-t border-gray-400 pt-2">Firma del Solicitante</div>
            </div>
            <div>
              <div className="border-t border-gray-400 pt-2">Dirección General</div>
            </div>
            <div>
              <div className="border-t border-gray-400 pt-2">Administración</div>
            </div>
          </div>
        </footer>
    </div>
  );
};
