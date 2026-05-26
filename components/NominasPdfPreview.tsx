import React from 'react';
import type { DetailedEmployee } from '../types';
import {
  PayrollPeriod,
  calculateSalary,
  formatCurrency,
  getPeriodLabel,
  getEmployeeFullName,
  getDaysInQuincena,
} from './nominasUtils';

export interface CommissionBreakdown {
  caminata: number;
  semana: number;
  originales: number;
}

interface NominasPdfPreviewProps {
  employee: DetailedEmployee;
  period: PayrollPeriod;
  diasTrabajados: number;
  forPdf?: boolean;
  comision?: number;
  comisionDesglose?: CommissionBreakdown;
  comisionLabels?: { caminata?: string; semana?: string };
}

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

function formatDate(dateStr: string): string {
  if (!dateStr) return 'N/A';
  const [year, month, day] = dateStr.split('-');
  const monthIdx = parseInt(month, 10) - 1;
  return `${parseInt(day, 10)} de ${MESES[monthIdx]} ${year}`;
}

function getPaymentDate(period: PayrollPeriod): string {
  const end = new Date(period.endDate + 'T00:00:00');
  return `${end.getDate()} de ${MESES[end.getMonth()]} ${end.getFullYear()}`;
}

const s = {
  label: { padding: '4px 10px', fontSize: '12px', fontWeight: '600' as const },
  value: { padding: '4px 10px', fontSize: '12px', textAlign: 'right' as const },
  row: { borderBottom: '1px solid #e5e5e5' },
};

/** Un recibo individual — diseñado para ocupar exactamente media carta */
const ReciboSection: React.FC<{
  employee: DetailedEmployee;
  period: PayrollPeriod;
  diasTrabajados: number;
  diasEnPeriodo: number;
  salary: ReturnType<typeof calculateSalary>;
  fullName: string;
  copyLabel: string;
  comision: number;
  comisionDesglose?: CommissionBreakdown;
  comisionLabels?: { caminata?: string; semana?: string };
}> = ({ employee, period, diasTrabajados, diasEnPeriodo, salary, fullName, copyLabel, comision, comisionDesglose, comisionLabels }) => (
  <div style={{ height: '127mm', padding: '8mm 12mm', boxSizing: 'border-box', display: 'flex', flexDirection: 'column' }}>
    {/* Header */}
    <div style={{ textAlign: 'center', borderBottom: '2px solid #92400e', paddingBottom: '6px', marginBottom: '8px' }}>
      <h1 style={{ fontSize: '18px', fontWeight: 'bold', margin: '0', color: '#92400e', letterSpacing: '1px' }}>
        IVAN GUADERRAMA ART
      </h1>
      <p style={{ fontSize: '12px', fontWeight: '600', margin: '2px 0 0 0', color: '#78350f' }}>
        Recibo de Nómina Quincenal — <span style={{ fontSize: '10px', color: '#a3a3a3', fontStyle: 'italic' }}>{copyLabel}</span>
      </p>
    </div>

    {/* Periodo + Pago */}
    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '11px' }}>
      <span><strong>Periodo:</strong> {getPeriodLabel(period)}</span>
      <span><strong>Fecha de Pago:</strong> {getPaymentDate(period)}</span>
    </div>

    {/* Datos del colaborador */}
    <div style={{ display: 'flex', gap: '16px', marginBottom: '6px', fontSize: '11px', backgroundColor: '#fefce8', border: '1px solid #d4d4d4', borderRadius: '4px', padding: '6px 10px' }}>
      <div style={{ flex: 1 }}>
        <div><strong>Código:</strong> {employee.codigo}</div>
        <div><strong>Nombre:</strong> {fullName}</div>
        <div><strong>Puesto:</strong> {employee.puesto || 'N/A'}</div>
        <div><strong>RFC:</strong> {employee.rfc || 'N/A'}</div>
      </div>
      <div style={{ flex: 1 }}>
        <div><strong>Departamento:</strong> {employee.departamento || 'N/A'}</div>
        <div><strong>Fecha Ingreso:</strong> {formatDate(employee.fechaIngreso)}</div>
        <div><strong>CURP:</strong> {employee.curp || 'N/A'}</div>
        <div><strong>NSS:</strong> {employee.nss || 'N/A'}</div>
      </div>
      <div style={{ flex: 1 }}>
        <div><strong>Días Trabajados:</strong> {diasTrabajados} de {diasEnPeriodo}</div>
      </div>
    </div>

    {/* Percepciones y Deducciones */}
    <div style={{ flex: 1 }}>
      <table style={{ width: '100%', fontSize: '12px', borderCollapse: 'collapse', border: '1px solid #d4d4d4' }}>
        <thead>
          <tr style={{ backgroundColor: '#166534', color: '#fff' }}>
            <th style={{ padding: '5px 10px', textAlign: 'left', fontSize: '11px', fontWeight: 'bold' }}>PERCEPCIONES</th>
            <th style={{ padding: '5px 10px', textAlign: 'right', fontSize: '11px' }}>IMPORTE</th>
          </tr>
        </thead>
        <tbody>
          <tr style={s.row}>
            <td style={s.label}>Bono de Puntualidad</td>
            <td style={s.value}>{formatCurrency(salary.bonoPuntualidad)}</td>
          </tr>
          <tr style={s.row}>
            <td style={s.label}>Bono de Objetivos</td>
            <td style={s.value}>{formatCurrency(salary.bonoObjetivos)}</td>
          </tr>
          <tr style={s.row}>
            <td style={s.label}>Apoyo de Gasolina</td>
            <td style={s.value}>{formatCurrency(salary.apoyoGasolina)}</td>
          </tr>
          {comisionDesglose && comisionDesglose.caminata > 0 && (
            <tr style={s.row}>
              <td style={{ ...s.label, color: '#92400e' }}>Com. Caminata {comisionLabels?.caminata ? `— ${comisionLabels.caminata}` : ''}</td>
              <td style={{ ...s.value, color: '#92400e' }}>{formatCurrency(comisionDesglose.caminata)}</td>
            </tr>
          )}
          {comisionDesglose && comisionDesglose.semana > 0 && (
            <tr style={s.row}>
              <td style={{ ...s.label, color: '#92400e' }}>Com. Semanal {comisionLabels?.semana ? `— ${comisionLabels.semana}` : ''}</td>
              <td style={{ ...s.value, color: '#92400e' }}>{formatCurrency(comisionDesglose.semana)}</td>
            </tr>
          )}
          {comisionDesglose && comisionDesglose.originales > 0 && (
            <tr style={s.row}>
              <td style={{ ...s.label, color: '#92400e' }}>Com. Obras Originales</td>
              <td style={{ ...s.value, color: '#92400e' }}>{formatCurrency(comisionDesglose.originales)}</td>
            </tr>
          )}
          {!comisionDesglose && comision > 0 && (
            <tr style={s.row}>
              <td style={{ ...s.label, color: '#92400e' }}>Comisiones</td>
              <td style={{ ...s.value, color: '#92400e' }}>{formatCurrency(comision)}</td>
            </tr>
          )}
          <tr style={{ backgroundColor: '#f0fdf4', borderBottom: '2px solid #166534' }}>
            <td style={{ ...s.label, fontWeight: 'bold' }}>Total Percepciones</td>
            <td style={{ ...s.value, fontWeight: 'bold', fontSize: '13px' }}>{formatCurrency(salary.totalPercepciones + comision)}</td>
          </tr>
          <tr style={{ backgroundColor: '#991b1b', color: '#fff' }}>
            <td style={{ padding: '5px 10px', fontSize: '11px', fontWeight: 'bold' }}>DEDUCCIONES</td>
            <td style={{ padding: '5px 10px', textAlign: 'right', fontSize: '11px' }}></td>
          </tr>
          <tr style={{ backgroundColor: '#fef2f2' }}>
            <td style={{ ...s.label, fontWeight: 'bold' }}>Total Deducciones</td>
            <td style={{ ...s.value, fontWeight: 'bold', fontSize: '13px' }}>{formatCurrency(salary.totalDeducciones)}</td>
          </tr>
        </tbody>
      </table>
    </div>

    {/* Neto a Pagar */}
    <div style={{
      border: '2px solid #92400e',
      borderRadius: '4px',
      padding: '6px 12px',
      margin: '6px 0',
      backgroundColor: '#fffbeb',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
    }}>
      <span style={{ fontSize: '14px', fontWeight: 'bold', color: '#92400e' }}>NETO A PAGAR</span>
      <span style={{ fontSize: '18px', fontWeight: 'bold', color: '#92400e' }}>{formatCurrency(salary.netoAPagar + comision)}</span>
    </div>

    {/* Firmas */}
    <div style={{ display: 'flex', justifyContent: 'space-around', marginTop: '4px' }}>
      <div style={{ textAlign: 'center', width: '180px' }}>
        <div style={{ borderTop: '1px solid #333', paddingTop: '4px', fontSize: '10px' }}>Firma del Colaborador</div>
      </div>
      <div style={{ textAlign: 'center', width: '180px' }}>
        <div style={{ borderTop: '1px solid #333', paddingTop: '4px', fontSize: '10px' }}>Firma de la Empresa</div>
      </div>
    </div>
  </div>
);

export const NominasPdfPreview: React.FC<NominasPdfPreviewProps> = ({ employee, period, diasTrabajados, forPdf = false, comision = 0, comisionDesglose, comisionLabels }) => {
  const diasEnPeriodo = getDaysInQuincena(period);
  const salary = calculateSalary(employee, diasTrabajados, diasEnPeriodo);
  const fullName = getEmployeeFullName(employee);
  const commonProps = { employee, period, diasTrabajados, diasEnPeriodo, salary, fullName, comision, comisionDesglose, comisionLabels };

  return (
    <div
      id={forPdf ? 'pdf-content-nomina' : undefined}
      style={{
        width: forPdf ? '216mm' : '100%',
        backgroundColor: '#ffffff',
        fontFamily: 'Arial, Helvetica, sans-serif',
        color: '#1a1a1a',
        boxSizing: 'border-box',
        overflow: 'hidden',
      }}
    >
      <ReciboSection {...commonProps} copyLabel="Copia Empresa" />

      {/* Línea de corte */}
      <div style={{ borderTop: '2px dashed #999', margin: '0 12mm', position: 'relative', height: '25mm', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ backgroundColor: '#fff', padding: '0 12px', fontSize: '9px', color: '#999', letterSpacing: '3px' }}>
          ✂ CORTAR AQUÍ
        </span>
      </div>

      <ReciboSection {...commonProps} copyLabel="Copia Colaborador" />
    </div>
  );
};
