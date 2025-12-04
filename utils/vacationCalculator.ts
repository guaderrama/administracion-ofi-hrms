export const calculateVacationDays = (hireDateStr: string, currentDateStr: string): number => {
  if (!hireDateStr || !currentDateStr) {
    return 0;
  }

  const hireDate = new Date(hireDateStr + 'T12:00:00');
  const currentDate = new Date(currentDateStr + 'T12:00:00');

  if (hireDate > currentDate || isNaN(hireDate.getTime())) {
    return 0;
  }

  let yearsOfService = currentDate.getFullYear() - hireDate.getFullYear();
  const m = currentDate.getMonth() - hireDate.getMonth();
  if (m < 0 || (m === 0 && currentDate.getDate() < hireDate.getDate())) {
    yearsOfService--;
  }
  
  if (yearsOfService < 1) return 0;
  if (yearsOfService === 1) return 12;
  if (yearsOfService === 2) return 14;
  if (yearsOfService === 3) return 16;
  if (yearsOfService === 4) return 18;
  if (yearsOfService === 5) return 20;
  if (yearsOfService >= 6 && yearsOfService <= 10) return 22;
  if (yearsOfService >= 11 && yearsOfService <= 15) return 24;
  if (yearsOfService >= 16 && yearsOfService <= 20) return 26; // Corrected from prompt's typo
  if (yearsOfService >= 21 && yearsOfService <= 25) return 28; // Corrected from prompt's typo
  if (yearsOfService >= 26 && yearsOfService <= 30) return 30;
  if (yearsOfService >= 31 && yearsOfService <= 35) return 32;
  
  return 32; // Max out at 32 for > 35 years
};
