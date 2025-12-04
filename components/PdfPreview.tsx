
import React from 'react';
import type { PermissionRequest } from '../types';
import { PermissionType } from '../types';

interface PdfPreviewProps {
  data: PermissionRequest;
}

const DetailRow: React.FC<{ label: string; value?: string | number }> = ({ label, value }) => (
  value ? <p><strong className="font-medium text-gray-800">{label}:</strong> {value}</p> : null
);

const DatesTable: React.FC<{ dates: string[] | undefined }> = ({ dates }) => {
  if (!dates || dates.length === 0) {
    return <p className="mt-2 text-sm text-gray-600">No se especificaron fechas.</p>;
  }

  const formatDate = (dateStr: string) => {
    // Input is "YYYY-MM-DD", add time to avoid timezone issues
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
            <th className="border-b-2 border-gray-300 py-2 px-4 bg-gray-50 text-sm font-semibold text-gray-600">Fechas Solicitadas</th>
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


export const PdfPreview: React.FC<PdfPreviewProps> = ({ data }) => {
  const getPermissionDetails = () => {
    switch (data.permissionType) {
      case PermissionType.LATE_ARRIVAL:
        return `Llegar a las ${data.arrivalTime}`;
      case PermissionType.EARLY_DEPARTURE:
        return `Salir a las ${data.departureTime}`;
      case PermissionType.PARTIAL_ABSENCE:
        return `Ausentarse de ${data.absenceStartTime} a ${data.absenceEndTime}`;
      default:
        return 'No especificado';
    }
  };

  return (
    <div id="pdf-content" className="p-8 bg-white text-gray-900 font-sans text-sm max-w-2xl mx-auto border border-gray-300 shadow-lg">
        <header className="text-center mb-8 border-b pb-4">
          <h1 className="font-serif text-3xl text-gray-800">IVAN GUADERRAMA ART</h1>
          <h2 className="text-xl font-light text-gray-600 mt-2">Solicitud de Permiso Laboral</h2>
        </header>

        <section className="mb-6">
          <DetailRow label="Fecha de Solicitud" value={new Date(data.requestDate + 'T12:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })} />
          <p className="mt-4">
              Por medio de la presente, me dirijo a usted para solicitar un permiso para ausentarme de mis labores. A continuación, detallo los días/horas en cuestión:
          </p>
        </section>

        <section className="mb-6">
          <h3 className="text-base font-semibold border-b pb-1 mb-2 text-gray-700">Datos del Colaborador</h3>
          <p className="font-bold text-lg text-gray-900">
              {`${data.firstName} ${data.lastName} ${data.motherLastName}`.toUpperCase()}
          </p>
        </section>

        <section className="mb-6">
          <h3 className="text-base font-semibold border-b pb-1 mb-2 text-gray-700">Detalles del Permiso</h3>
          <DetailRow label="Tipo" value={data.permissionType} />
          {data.permissionType === PermissionType.FULL_DAYS ? (
            <>
              <DetailRow label="Cantidad de días" value={data.daysCount} />
              <DatesTable dates={data.dates} />
            </>
          ) : (
            <>
              <DetailRow label="Fecha" value={data.permissionDate ? new Date(data.permissionDate + 'T12:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' }) : ''} />
              <p><strong className="font-medium text-gray-800">Detalle:</strong> {getPermissionDetails()}</p>
            </>
          )}
          <DetailRow label="Motivo" value={data.reason} />
        </section>

        <section className="mb-6">
          <h3 className="text-base font-semibold border-b pb-1 mb-2 text-gray-700">Forma de Compensación</h3>
          <DetailRow label="Método" value={data.compensation} />
          <DetailRow label="Detalles de Reposición" value={data.extraTimeDetails} />
        </section>
        
        {data.additionalNotes && (
          <section className="mb-6">
              <h3 className="text-base font-semibold border-b pb-1 mb-2 text-gray-700">Notas Adicionales</h3>
              <p className="whitespace-pre-wrap">{data.additionalNotes}</p>
          </section>
        )}

        <p className="text-xs text-gray-500 my-8 italic text-center">
          El presente permiso está sujeto a la aprobación de la Dirección General. La aceptación de este documento implica el acuerdo con los términos de compensación aquí descritos.
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