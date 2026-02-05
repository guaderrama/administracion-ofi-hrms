import React from 'react';
import type { DetailedEmployee } from '../types';
import {
  PayrollPeriod,
  calculateSalary,
  formatCurrency,
  getPeriodLabel,
  getEmployeeFullName,
  getLastDayOfMonth,
  getMonthName,
} from './nominasUtils';

interface NominasPdfPreviewProps {
  employee: DetailedEmployee;
  period: PayrollPeriod;
}

function formatDate(dateStr: string): string {
  if (!dateStr) return 'N/A';
  const [year, month, day] = dateStr.split('-');
  const months = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];
  const monthIdx = parseInt(month, 10) - 1;
  return `${parseInt(day, 10)} de ${months[monthIdx]} ${year}`;
}

function getPaymentDate(period: PayrollPeriod): string {
  const day = period.quincena === 1 ? 15 : getLastDayOfMonth(period.year, period.month);
  return `${day} de ${getMonthName(period.month)} ${period.year}`;
}

export const NominasPdfPreview: React.FC<NominasPdfPreviewProps> = ({ employee, period }) => {
  const salary = calculateSalary(employee);
  const fullName = getEmployeeFullName(employee);

  return (
    <div
      id="pdf-content-nomina"
      style={{
        width: '210mm',
        minHeight: '297mm',
        padding: '20mm',
        backgroundColor: '#ffffff',
        fontFamily: 'Arial, Helvetica, sans-serif',
        fontSize: '12px',
        color: '#1a1a1a',
        boxSizing: 'border-box',
      }}
    >
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: '24px', borderBottom: '3px solid #92400e', paddingBottom: '16px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: 'bold', margin: '0 0 4px 0', color: '#92400e', letterSpacing: '2px' }}>
          IVAN GUADERRAMA ART
        </h1>
        <p style={{ fontSize: '16px', fontWeight: '600', margin: '0', color: '#78350f' }}>
          Recibo de Nómina Quincenal
        </p>
      </div>

      {/* Period Info */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px', fontSize: '11px' }}>
        <div>
          <strong>Periodo:</strong> {getPeriodLabel(period)}
        </div>
        <div>
          <strong>Fecha de Pago:</strong> {getPaymentDate(period)}
        </div>
      </div>

      {/* Employee Data */}
      <div style={{ border: '1px solid #d4d4d4', borderRadius: '4px', padding: '16px', marginBottom: '20px', backgroundColor: '#fefce8' }}>
        <h2 style={{ fontSize: '13px', fontWeight: 'bold', margin: '0 0 12px 0', color: '#92400e', textTransform: 'uppercase' }}>
          Datos del Colaborador
        </h2>
        <table style={{ width: '100%', fontSize: '11px', borderCollapse: 'collapse' }}>
          <tbody>
            <tr>
              <td style={{ padding: '4px 8px', width: '35%' }}><strong>Código:</strong></td>
              <td style={{ padding: '4px 8px' }}>{employee.codigo}</td>
            </tr>
            <tr>
              <td style={{ padding: '4px 8px' }}><strong>Nombre:</strong></td>
              <td style={{ padding: '4px 8px' }}>{fullName}</td>
            </tr>
            <tr>
              <td style={{ padding: '4px 8px' }}><strong>Departamento:</strong></td>
              <td style={{ padding: '4px 8px' }}>{employee.departamento || 'N/A'}</td>
            </tr>
            <tr>
              <td style={{ padding: '4px 8px' }}><strong>Puesto:</strong></td>
              <td style={{ padding: '4px 8px' }}>{employee.puesto || 'N/A'}</td>
            </tr>
            <tr>
              <td style={{ padding: '4px 8px' }}><strong>Fecha de Ingreso:</strong></td>
              <td style={{ padding: '4px 8px' }}>{formatDate(employee.fechaIngreso)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Percepciones */}
      <div style={{ border: '1px solid #d4d4d4', borderRadius: '4px', marginBottom: '20px', overflow: 'hidden' }}>
        <div style={{ backgroundColor: '#166534', color: '#ffffff', padding: '8px 16px' }}>
          <h2 style={{ fontSize: '13px', fontWeight: 'bold', margin: '0', textTransform: 'uppercase' }}>
            Percepciones
          </h2>
        </div>
        <table style={{ width: '100%', fontSize: '11px', borderCollapse: 'collapse' }}>
          <tbody>
            <tr style={{ borderBottom: '1px solid #e5e5e5' }}>
              <td style={{ padding: '10px 16px' }}>Bono de Puntualidad</td>
              <td style={{ padding: '10px 16px', textAlign: 'right', fontWeight: '600' }}>
                {formatCurrency(salary.bonoPuntualidad)}
              </td>
            </tr>
            <tr style={{ borderBottom: '1px solid #e5e5e5' }}>
              <td style={{ padding: '10px 16px' }}>Bono de Objetivos</td>
              <td style={{ padding: '10px 16px', textAlign: 'right', fontWeight: '600' }}>
                {formatCurrency(salary.bonoObjetivos)}
              </td>
            </tr>
            <tr style={{ borderBottom: '2px solid #166534' }}>
              <td style={{ padding: '10px 16px' }}>Apoyo de Gasolina</td>
              <td style={{ padding: '10px 16px', textAlign: 'right', fontWeight: '600' }}>
                {formatCurrency(salary.apoyoGasolina)}
              </td>
            </tr>
            <tr style={{ backgroundColor: '#f0fdf4' }}>
              <td style={{ padding: '10px 16px', fontWeight: 'bold' }}>Total Percepciones</td>
              <td style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 'bold', fontSize: '13px' }}>
                {formatCurrency(salary.totalPercepciones)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Deducciones */}
      <div style={{ border: '1px solid #d4d4d4', borderRadius: '4px', marginBottom: '20px', overflow: 'hidden' }}>
        <div style={{ backgroundColor: '#991b1b', color: '#ffffff', padding: '8px 16px' }}>
          <h2 style={{ fontSize: '13px', fontWeight: 'bold', margin: '0', textTransform: 'uppercase' }}>
            Deducciones
          </h2>
        </div>
        <table style={{ width: '100%', fontSize: '11px', borderCollapse: 'collapse' }}>
          <tbody>
            <tr style={{ borderBottom: '2px solid #991b1b' }}>
              <td style={{ padding: '10px 16px', color: '#737373', fontStyle: 'italic' }}>Sin deducciones</td>
              <td style={{ padding: '10px 16px', textAlign: 'right', fontWeight: '600' }}>
                {formatCurrency(0)}
              </td>
            </tr>
            <tr style={{ backgroundColor: '#fef2f2' }}>
              <td style={{ padding: '10px 16px', fontWeight: 'bold' }}>Total Deducciones</td>
              <td style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 'bold', fontSize: '13px' }}>
                {formatCurrency(salary.totalDeducciones)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Neto a Pagar */}
      <div style={{
        border: '2px solid #92400e',
        borderRadius: '4px',
        padding: '16px',
        marginBottom: '40px',
        backgroundColor: '#fffbeb',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <span style={{ fontSize: '16px', fontWeight: 'bold', color: '#92400e' }}>NETO A PAGAR</span>
        <span style={{ fontSize: '20px', fontWeight: 'bold', color: '#92400e' }}>
          {formatCurrency(salary.netoAPagar)}
        </span>
      </div>

      {/* Firmas */}
      <div style={{ display: 'flex', justifyContent: 'space-around', marginTop: '60px' }}>
        <div style={{ textAlign: 'center', width: '200px' }}>
          <div style={{ borderTop: '1px solid #1a1a1a', paddingTop: '8px', fontSize: '11px' }}>
            Firma del Colaborador
          </div>
        </div>
        <div style={{ textAlign: 'center', width: '200px' }}>
          <div style={{ borderTop: '1px solid #1a1a1a', paddingTop: '8px', fontSize: '11px' }}>
            Firma de la Empresa
          </div>
        </div>
      </div>
    </div>
  );
};
