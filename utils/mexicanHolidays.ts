// Dias de descanso obligatorio segun la Ley Federal del Trabajo (Mexico)

export interface MexicanHoliday {
  date: string; // YYYY-MM-DD
  name: string;
}

export function getOfficialHolidays(year: number): MexicanHoliday[] {
  const holidays: MexicanHoliday[] = [];
  const pad = (n: number) => n.toString().padStart(2, '0');
  const fmt = (m: number, d: number) => `${year}-${pad(m)}-${pad(d)}`;

  // 1 enero - Año Nuevo
  holidays.push({ date: fmt(1, 1), name: 'Ano Nuevo' });

  // Primer lunes de febrero - Dia de la Constitucion
  const feb1 = new Date(year, 1, 1);
  const firstMonFeb = 1 + ((8 - feb1.getDay()) % 7);
  holidays.push({ date: fmt(2, firstMonFeb), name: 'Dia de la Constitucion' });

  // Tercer lunes de marzo - Natalicio de Benito Juarez
  const mar1 = new Date(year, 2, 1);
  const firstMonMar = 1 + ((8 - mar1.getDay()) % 7);
  holidays.push({ date: fmt(3, firstMonMar + 14), name: 'Natalicio de Benito Juarez' });

  // 1 mayo - Dia del Trabajo
  holidays.push({ date: fmt(5, 1), name: 'Dia del Trabajo' });

  // 16 septiembre - Dia de la Independencia
  holidays.push({ date: fmt(9, 16), name: 'Dia de la Independencia' });

  // Tercer lunes de noviembre - Revolucion Mexicana
  const nov1 = new Date(year, 10, 1);
  const firstMonNov = 1 + ((8 - nov1.getDay()) % 7);
  holidays.push({ date: fmt(11, firstMonNov + 14), name: 'Revolucion Mexicana' });

  // 25 diciembre - Navidad
  holidays.push({ date: fmt(12, 25), name: 'Navidad' });

  // 1 octubre cada 6 anos - Transmision del Poder Ejecutivo
  if (year % 6 === 0 || (year - 2024) % 6 === 0) {
    holidays.push({ date: fmt(10, 1), name: 'Transmision del Poder Ejecutivo' });
  }

  return holidays;
}

export function isOfficialHoliday(dateStr: string): MexicanHoliday | null {
  const year = parseInt(dateStr.slice(0, 4));
  const holidays = getOfficialHolidays(year);
  return holidays.find(h => h.date === dateStr) || null;
}
