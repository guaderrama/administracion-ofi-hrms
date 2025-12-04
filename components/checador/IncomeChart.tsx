import React, { useEffect, useRef, useMemo, useState } from 'react';
import type { IncomeEntry } from '../../types';
import { PAYMENT_CONCEPT_OPTIONS } from './incomeConstants';

declare const Chart: any; // Using Chart.js from CDN

interface IncomeChartProps {
  incomes: IncomeEntry[];
}

const chartColors = [
    '#D8A788', // Terracotta
    '#4A3728', // Dark Brown from sidebar
    '#F5EFE6', // Light Beige
    '#E8D8C4', // Beige
    '#B08D57', // Tan
    '#704241'  // Darker Terracotta
];


export const IncomeChart: React.FC<IncomeChartProps> = ({ incomes }) => {
  const chartRef = useRef<HTMLCanvasElement>(null);
  const chartInstance = useRef<any>(null);
  const [selectedMonths, setSelectedMonths] = useState<string[]>([]);

  const availableMonths = useMemo(() => {
    const months = new Set<string>();
    incomes.forEach(income => {
        months.add(income.paymentDate.substring(0, 7)); // 'YYYY-MM'
    });
    return Array.from(months).sort().reverse(); // Sort descending to show recent months first
  }, [incomes]);
  
  const handleMonthToggle = (month: string) => {
    setSelectedMonths(prev => {
        const newSelection = new Set(prev);
        if (newSelection.has(month)) {
            newSelection.delete(month);
        } else {
            newSelection.add(month);
        }
        return Array.from(newSelection);
    });
  };

  const filteredIncomes = useMemo(() => {
    if (selectedMonths.length === 0) {
        return incomes;
    }
    return incomes.filter(income => selectedMonths.includes(income.paymentDate.substring(0, 7)));
  }, [incomes, selectedMonths]);

  const chartData = useMemo(() => {
    if (filteredIncomes.length === 0) {
        return {
            labels: [],
            datasets: [],
        };
    }

    const monthlyData: { [month: string]: { [concept: string]: number } } = {};

    filteredIncomes.forEach(income => {
        const month = income.paymentDate.substring(0, 7); // 'YYYY-MM'
        if (!monthlyData[month]) {
            monthlyData[month] = {};
            PAYMENT_CONCEPT_OPTIONS.forEach(c => monthlyData[month][c] = 0);
        }
        monthlyData[month][income.paymentConcept] += income.amount;
    });

    const sortedMonths = Object.keys(monthlyData).sort();
    
    const monthLabels = sortedMonths.map(monthStr => {
        const [year, month] = monthStr.split('-');
        // Use UTC to avoid timezone issues when creating date from YYYY-MM
        const date = new Date(Date.UTC(Number(year), Number(month) - 1, 2));
        const formattedDate = date.toLocaleString('es-MX', { month: 'long', year: 'numeric', timeZone: 'UTC' });
        return formattedDate.charAt(0).toUpperCase() + formattedDate.slice(1).replace('.', '');
    });

    const datasets = PAYMENT_CONCEPT_OPTIONS.map((concept, index) => {
        return {
            label: concept,
            data: sortedMonths.map(month => monthlyData[month][concept] || 0),
            backgroundColor: chartColors[index % chartColors.length],
        };
    });

    return {
        labels: monthLabels,
        datasets: datasets,
    };
  }, [filteredIncomes]);

  useEffect(() => {
    if (chartInstance.current) {
      chartInstance.current.destroy();
    }
    if (chartRef.current && chartData.labels && chartData.labels.length > 0) {
      const ctx = chartRef.current.getContext('2d');
      if (ctx) {
        const totalizerPlugin = {
            id: 'totalizer',
            afterDatasetsDraw: (chart: any) => {
                const { ctx, data } = chart;
                
                let lastVisibleDatasetIndex = -1;
                for (let i = data.datasets.length - 1; i >= 0; i--) {
                    if (chart.isDatasetVisible(i)) {
                        lastVisibleDatasetIndex = i;
                        break;
                    }
                }

                if (lastVisibleDatasetIndex === -1) return;

                const meta = chart.getDatasetMeta(lastVisibleDatasetIndex);

                ctx.save();
                ctx.font = 'bold 12px sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'bottom';
                ctx.fillStyle = '#4A3728';

                meta.data.forEach((bar: any, index: number) => {
                    const total = data.datasets.reduce((sum: number, dataset: any, i: number) => {
                        if (chart.isDatasetVisible(i)) {
                           return sum + (dataset.data[index] || 0);
                        }
                        return sum;
                    }, 0);

                    if (total > 0) {
                        const yPos = bar.y;
                        const xPos = bar.x;
                        const formattedTotal = '$' + total.toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
                        ctx.fillText(formattedTotal, xPos, yPos - 5);
                    }
                });
                ctx.restore();
            }
        };

        chartInstance.current = new Chart(ctx, {
          type: 'bar',
          data: chartData,
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: {
                position: 'top',
              },
              title: {
                display: true,
                text: 'Distribución de Ingresos por Mes',
                font: {
                    size: 18,
                    family: "'Playfair Display', serif"
                },
                color: '#4A3728'
              },
              tooltip: {
                callbacks: {
                    label: function(context: any) {
                        let label = context.dataset.label || '';
                        if (label) {
                            label += ': ';
                        }
                        if (context.parsed.y !== null) {
                            label += new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(context.parsed.y);
                        }
                        return label;
                    }
                }
              }
            },
            scales: {
              x: {
                stacked: true,
              },
              y: {
                stacked: true,
                beginAtZero: true,
                ticks: {
                    callback: function(value: string | number) {
                        if (typeof value === 'number') {
                          return '$' + value.toLocaleString('es-MX');
                        }
                        return value;
                    }
                }
              }
            }
          },
          plugins: [totalizerPlugin],
        });
      }
    }
    
    return () => {
      if (chartInstance.current) {
        chartInstance.current.destroy();
      }
    };
  }, [chartData]);
  
  const totalIncome = useMemo(() => filteredIncomes.reduce((sum, entry) => sum + entry.amount, 0), [filteredIncomes]);

  return (
    <div className="p-6 bg-white/30 backdrop-blur-lg rounded-xl shadow-lg border border-white/20">
        {availableMonths.length > 0 && (
          <div className="mb-4">
            <h4 className="text-sm font-medium text-slate-700 mb-2">Filtrar por Mes:</h4>
            <div className="flex flex-wrap gap-2">
                <button
                    onClick={() => setSelectedMonths([])}
                    className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${selectedMonths.length === 0 ? 'bg-amber-800 text-white shadow' : 'bg-white/60 text-slate-700 hover:bg-white/90'}`}
                >
                    Mostrar Todos
                </button>
                {availableMonths.map(month => {
                    const isSelected = selectedMonths.includes(month);
                    const [year, monthNum] = month.split('-');
                    const date = new Date(Date.UTC(Number(year), Number(monthNum) - 1, 2));
                    let formattedMonth = date.toLocaleString('es-MX', { month: 'short', year: 'numeric', timeZone: 'UTC' });
                    formattedMonth = formattedMonth.charAt(0).toUpperCase() + formattedMonth.slice(1).replace('.', '');

                    return (
                        <button
                            key={month}
                            onClick={() => handleMonthToggle(month)}
                            className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${isSelected ? 'bg-amber-800 text-white shadow' : 'bg-white/60 text-slate-700 hover:bg-white/90'}`}
                        >
                            {formattedMonth}
                        </button>
                    )
                })}
            </div>
          </div>
        )}
        <div style={{ position: 'relative', height: '40vh' }}>
            <canvas ref={chartRef}></canvas>
            {filteredIncomes.length === 0 && (
                <div className="absolute inset-0 flex items-center justify-center text-slate-500">
                    {incomes.length > 0 ? 'Seleccione un mes para ver los datos.' : 'No hay datos de ingresos para mostrar.'}
                </div>
            )}
        </div>
        <div className="text-center mt-4">
            <p className="text-lg font-medium text-slate-700">{selectedMonths.length > 0 ? 'Ingreso Total (Selección)' : 'Ingreso Total Registrado'}</p>
            <p className="text-3xl font-bold font-mono text-slate-900">
                ${totalIncome.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
        </div>
    </div>
  );
};
