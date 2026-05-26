import type {
  SaleRecord,
  SaleGroup,
  ProductCategory,
  CommissionSettings,
  CommissionSummary,
  CommissionType,
  DetailedEmployee,
  EmployeeCommission,
} from '../types';

// ============================================
// PARSEO DE CSV
// ============================================

const RETAIL_KEYWORDS = ['JEWELRY', 'MIA', 'BOLSA', 'PERFUME'];
const ORIGINAL_KEYWORDS = ['ORIGINAL', 'LIMITED EDITION'];

function classifyProduct(details: string): ProductCategory {
  const upper = (details || '').toUpperCase();
  if (ORIGINAL_KEYWORDS.some(kw => upper.includes(kw))) return 'originales';
  if (RETAIL_KEYWORDS.some(kw => upper.includes(kw))) return 'joyeria';
  return 'souvenirs';
}

function parseDateStr(dateStr: string): { date: string; dayOfWeek: number } {
  // Formato esperado: DD/MM/YYYY HH:mm o variantes
  const parts = dateStr.trim().split(' ')[0]; // tomar solo la fecha
  const [day, month, year] = parts.split('/').map(Number);
  const d = new Date(year, month - 1, day);
  const iso = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  return { date: iso, dayOfWeek: d.getDay() };
}

function isEmployeeSale(customerCode: string, customerName: string, employees: DetailedEmployee[]): boolean {
  if (!customerCode && !customerName) return false;
  const nameUpper = (customerName || '').toUpperCase().trim();
  const codeUpper = (customerCode || '').toUpperCase().trim();

  return employees.some(emp => {
    const fullName = `${emp.paterno} ${emp.materno} ${emp.nombres}`.toUpperCase().trim();
    const empNames = emp.nombres.toUpperCase();
    const empPaterno = emp.paterno.toUpperCase();
    return nameUpper === fullName ||
      (nameUpper.includes(empPaterno) && nameUpper.includes(empNames)) ||
      (codeUpper && emp.codigo && codeUpper === emp.codigo.toUpperCase());
  });
}

export function parseCSV(csvText: string): string[][] {
  const rows: string[][] = [];
  let current = '';
  let inQuotes = false;
  let row: string[] = [];

  for (let i = 0; i < csvText.length; i++) {
    const ch = csvText[i];
    if (ch === '"') {
      if (inQuotes && csvText[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      row.push(current.trim());
      current = '';
    } else if ((ch === '\n' || ch === '\r') && !inQuotes) {
      if (ch === '\r' && csvText[i + 1] === '\n') i++;
      row.push(current.trim());
      current = '';
      if (row.some(cell => cell !== '')) rows.push(row);
      row = [];
    } else {
      current += ch;
    }
  }
  row.push(current.trim());
  if (row.some(cell => cell !== '')) rows.push(row);

  return rows;
}

export function parseSalesFromCSV(
  csvText: string,
  employees: DetailedEmployee[],
  existingReceiptNums?: Set<string>,
): SaleGroup[] {
  const rows = parseCSV(csvText);
  if (rows.length < 2) return [];

  // Saltar header
  const dataRows = rows.slice(1);

  // Agrupar por Receipt Num (columna B, index 1)
  const groups: Map<string, { rows: string[][] }> = new Map();

  dataRows.forEach(row => {
    const receiptNum = row[1] || '';
    if (!receiptNum) return;
    if (!groups.has(receiptNum)) groups.set(receiptNum, { rows: [] });
    groups.get(receiptNum)!.rows.push(row);
  });

  const saleGroups: SaleGroup[] = [];

  groups.forEach((group, receiptNum) => {
    const saleRow = group.rows.find(r => (r[2] || '').trim() === 'Sale');
    const paymentRow = group.rows.find(r => (r[2] || '').trim() === 'Payment');
    const saleLines = group.rows.filter(r => (r[2] || '').trim() === 'Sale Line');

    if (!saleRow) return;

    const { date, dayOfWeek } = parseDateStr(saleRow[0] || '');
    const customerCode = (saleRow[3] || '').trim();
    const customerName = (saleRow[4] || '').trim();
    const user = (saleRow[15] || '').trim(); // columna P
    const status = (saleRow[16] || '').trim(); // columna Q
    const totalAmount = parseFloat(saleRow[7] || '0') || 0; // columna H
    const paidAmount = parseFloat(paymentRow?.[12] || '0') || 0; // columna M
    const paymentMethod = (paymentRow?.[13] || '').trim(); // columna N en payment row
    const details = (saleRow[13] || '').trim(); // columna N

    // Determinar exclusión
    const statusUpper = status.toUpperCase();
    const isNotClosed = statusUpper !== 'CLOSED' && statusUpper !== '';
    const isZeroSale = totalAmount === 0 && paidAmount === 0;
    const isEmpSale = isEmployeeSale(customerCode, customerName, employees);
    const isDuplicate = existingReceiptNums ? existingReceiptNums.has(receiptNum) : false;
    const isExcluded = isNotClosed || isZeroSale || isEmpSale || isDuplicate;
    let excludeReason: string | undefined;
    if (isDuplicate) excludeReason = 'Ya registrada en otro reporte';
    else if (isNotClosed) excludeReason = `Status: ${status || 'vacío'} (solo CLOSED)`;
    else if (isZeroSale) excludeReason = 'Cortesía ($0)';
    else if (isEmpSale) excludeReason = 'Venta a colaborador';

    // Parsear líneas de detalle
    const lines: SaleRecord[] = saleLines.map(row => {
      const lineDetails = (row[13] || '').trim();
      const lineTotal = parseFloat(row[11] || '0') || 0; // columna L
      return {
        receiptNum,
        date,
        dayOfWeek,
        customerCode,
        customerName,
        quantity: parseInt(row[6] || '0', 10) || 0,
        subtotal: parseFloat(row[7] || '0') || 0,
        discount: parseFloat(row[9] || '0') || 0,
        total: lineTotal,
        paid: 0,
        details: lineDetails,
        register: (row[14] || '').trim(),
        user,
        status,
        sku: (row[17] || '').trim(),
        paymentMethod: '',
        category: classifyProduct(lineDetails),
        isExcluded,
        excludeReason,
      };
    });

    saleGroups.push({
      receiptNum,
      date,
      dayOfWeek,
      customerCode,
      customerName,
      user,
      totalAmount,
      paidAmount: paidAmount || totalAmount,
      paymentMethod: paymentMethod || details, // fallback to sale row details
      status,
      lines,
      isExcluded,
      excludeReason,
    });
  });

  return saleGroups.sort((a, b) => a.date.localeCompare(b.date) || a.receiptNum.localeCompare(b.receiptNum));
}

// ============================================
// CÁLCULO DE COMISIONES
// ============================================

export const DEFAULT_SETTINGS: CommissionSettings = {
  ivaPercent: 16,
  bankFeePercent: 4,
  exchangeRate: 17.5,
  joyeriaPercentJueves: 5,
  souvenirsPercentJueves: 25,
  originalesPercentJueves: 10,
  joyeriaPercentSemana: 5,
  souvenirsPercentSemana: 25,
  originalesPercentSemana: 10,
};

/**
 * Calcula la base comisionable:
 * 1. SIEMPRE convierte USD → MXN (todas las ventas del POS están en USD)
 * 2. SIEMPRE descuenta IVA (todas las transacciones generan IVA)
 * 3. Solo tarjetas: descuenta comisión bancaria
 */
export function getCommissionableBase(
  amount: number,
  paymentMethod: string,
  settings: CommissionSettings,
): number {
  // Paso 1: Convertir a MXN (el CSV siempre está en USD)
  let mxn = amount * settings.exchangeRate;

  // Paso 2: SIEMPRE quitar IVA (cash, tarjeta, transfer, todos generan IVA)
  mxn = mxn / (1 + settings.ivaPercent / 100); // / 1.16

  // Paso 3: Solo tarjetas: quitar comisión bancaria
  const upper = (paymentMethod || '').toUpperCase();
  const isTarjeta = upper.includes('CREDIT CARD MNX') || upper.includes('CREDIT CARD MXN') || upper.includes('TARJETA') || upper.includes('AMERICAN EXPRESS MNX');

  if (isTarjeta) {
    mxn = mxn / (1 + settings.bankFeePercent / 100); // / 1.04
  }

  return mxn;
}

/** Calcula comisiones por tipo (jueves/semana) */
export function calculateCommissions(
  sales: SaleGroup[],
  type: CommissionType,
  settings: CommissionSettings,
): CommissionSummary {
  // Filtrar ventas según tipo
  const filtered = sales.filter(s => {
    if (s.isExcluded) return false;
    if (type === 'jueves') return s.dayOfWeek === 4;
    return s.dayOfWeek !== 4; // semana = todos menos jueves
  });

  let joyeriaTotal = 0;
  let souvenirsTotal = 0;
  let originalesTotal = 0;

  filtered.forEach(sale => {
    // Si la venta tiene líneas de detalle, usar esas para clasificar
    if (sale.lines.length > 0) {
      sale.lines.forEach(line => {
        const base = getCommissionableBase(line.total, sale.paymentMethod, settings);
        switch (line.category) {
          case 'joyeria': joyeriaTotal += base; break;
          case 'originales': originalesTotal += base; break;
          default: souvenirsTotal += base; break;
        }
      });
    } else {
      // Si no hay líneas, usar el total de la venta como souvenirs
      const base = getCommissionableBase(sale.totalAmount, sale.paymentMethod, settings);
      souvenirsTotal += base;
    }
  });

  const joyeriaPct = type === 'jueves' ? settings.joyeriaPercentJueves : settings.joyeriaPercentSemana;
  const souvenirsPct = type === 'jueves' ? settings.souvenirsPercentJueves : settings.souvenirsPercentSemana;
  const originalesPct = type === 'jueves' ? settings.originalesPercentJueves : settings.originalesPercentSemana;

  const joyeriaCommission = Math.round(joyeriaTotal * joyeriaPct / 100 * 100) / 100;
  const souvenirsCommission = Math.round(souvenirsTotal * souvenirsPct / 100 * 100) / 100;
  const originalesCommission = Math.round(originalesTotal * originalesPct / 100 * 100) / 100;

  // Fechas del rango
  const dates = filtered.map(s => s.date).sort();

  return {
    type,
    dateRange: { start: dates[0] || '', end: dates[dates.length - 1] || '' },
    totalSales: filtered.length,
    excludedSales: sales.filter(s => s.isExcluded).length,
    joyeriaTotal: Math.round(joyeriaTotal * 100) / 100,
    souvenirsTotal: Math.round(souvenirsTotal * 100) / 100,
    originalesTotal: Math.round(originalesTotal * 100) / 100,
    joyeriaCommission,
    souvenirsCommission,
    originalesCommission,
    totalCommission: Math.round((joyeriaCommission + souvenirsCommission + originalesCommission) * 100) / 100,
  };
}

/** Distribuye comisión de jueves entre empleados presentes */
export function distributeJuevesCommission(
  summary: CommissionSummary,
  employees: DetailedEmployee[],
  presentMap: Record<string, boolean>,
): EmployeeCommission[] {
  const presentEmployees = employees.filter(emp => presentMap[emp.id]);
  const perPerson = presentEmployees.length > 0
    ? Math.round(summary.totalCommission / presentEmployees.length * 100) / 100
    : 0;

  return employees.map(emp => ({
    employeeCode: emp.codigo,
    employeeName: `${emp.paterno} ${emp.materno} ${emp.nombres}`,
    present: !!presentMap[emp.id],
    individualSales: 0,
    commission: presentMap[emp.id] ? perPerson : 0,
  }));
}

/** Distribuye comisión semanal por vendedor según sus ventas */
export function distributeSemanaCommission(
  sales: SaleGroup[],
  settings: CommissionSettings,
  employees: DetailedEmployee[],
): EmployeeCommission[] {
  // Ventas de la semana (no jueves, no excluidas)
  const weekSales = sales.filter(s => !s.isExcluded && s.dayOfWeek !== 4);

  // Agrupar ventas por vendedor (columna User)
  const byUser: Record<string, SaleGroup[]> = {};
  weekSales.forEach(s => {
    const user = s.user || 'Sin asignar';
    if (!byUser[user]) byUser[user] = [];
    byUser[user].push(s);
  });

  return employees.map(emp => {
    const empName = `${emp.paterno} ${emp.materno} ${emp.nombres}`;
    // Buscar ventas de este empleado — el CSV puede tener nombre corto ("Fatima", "Iluvia")
    const empNombres = emp.nombres.toUpperCase().split(' ');
    const empPaterno = emp.paterno.toUpperCase();

    let userSales: SaleGroup[] = [];
    Object.entries(byUser).forEach(([user, userGroupSales]) => {
      const userUpper = user.toUpperCase().trim();
      // Match exacto por nombre completo
      if (userUpper === empName.toUpperCase()) {
        userSales = [...userSales, ...userGroupSales];
      // Match por apellido paterno
      } else if (userUpper.includes(empPaterno)) {
        userSales = [...userSales, ...userGroupSales];
      // Match por primer nombre (ej: "Fatima" matchea con "CESEÑA OLIVAS FATIMA GUADALUPE")
      } else if (empNombres.some(n => n.length >= 3 && userUpper.includes(n))) {
        userSales = [...userSales, ...userGroupSales];
      }
    });

    // Calcular comisión individual
    let joyeriaTotal = 0;
    let souvenirsTotal = 0;
    let originalesTotal = 0;

    userSales.forEach(sale => {
      if (sale.lines.length > 0) {
        sale.lines.forEach(line => {
          const base = getCommissionableBase(line.total, sale.paymentMethod, settings);
          switch (line.category) {
            case 'joyeria': joyeriaTotal += base; break;
            case 'originales': originalesTotal += base; break;
            default: souvenirsTotal += base; break;
          }
        });
      } else {
        souvenirsTotal += getCommissionableBase(sale.totalAmount, sale.paymentMethod, settings);
      }
    });

    const commission =
      Math.round(joyeriaTotal * settings.joyeriaPercentSemana / 100 * 100) / 100 +
      Math.round(souvenirsTotal * settings.souvenirsPercentSemana / 100 * 100) / 100 +
      Math.round(originalesTotal * settings.originalesPercentSemana / 100 * 100) / 100;

    const totalSales = joyeriaTotal + souvenirsTotal + originalesTotal;

    return {
      employeeCode: emp.codigo,
      employeeName: empName,
      present: true,
      individualSales: Math.round(totalSales * 100) / 100,
      commission: Math.round(commission * 100) / 100,
    };
  });
}

export function formatMXN(amount: number): string {
  return amount.toLocaleString('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 2 });
}
