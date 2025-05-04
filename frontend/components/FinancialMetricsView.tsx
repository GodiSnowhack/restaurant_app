import React from 'react';
import { FinancialMetrics } from '../types/analytics';
import { 
  ArrowTrendingUpIcon, 
  ArrowTrendingDownIcon,
  CurrencyDollarIcon,
  ReceiptPercentIcon,
  ShoppingCartIcon,
  ArchiveBoxIcon,
  ScaleIcon
} from '@heroicons/react/24/outline';

interface FinancialMetricsViewProps {
  data: FinancialMetrics | null;
  loading: boolean;
}

/**
 * Компонент для отображения финансовых метрик в аналитике
 */
const FinancialMetricsView: React.FC<FinancialMetricsViewProps> = ({ 
  data, 
  loading 
}) => {
  if (loading || !data) {
    return (
      <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow">
        <div className="animate-pulse flex flex-col space-y-4">
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/4"></div>
          <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
          <div className="h-32 bg-gray-200 dark:bg-gray-700 rounded"></div>
          <div className="h-24 bg-gray-200 dark:bg-gray-700 rounded"></div>
        </div>
      </div>
    );
  }

  // Форматирование чисел как валюты
  const formatCurrency = (value: number): string => {
    return new Intl.NumberFormat('ru-RU', { 
      style: 'currency', 
      currency: 'RUB',
      maximumFractionDigits: 0 
    }).format(value);
  };

  // Форматирование процентов
  const formatPercent = (value: number): string => {
    return new Intl.NumberFormat('ru-RU', { 
      style: 'percent', 
      minimumFractionDigits: 1,
      maximumFractionDigits: 1 
    }).format(value / 100);
  };

  // Проверка положительного или отрицательного изменения
  const isPositiveChange = (value: number | undefined): boolean => {
    return value !== undefined && value > 0;
  };

  // Массив ключевых финансовых показателей
  const keyMetrics = [
    { 
      name: 'Общая выручка', 
      value: formatCurrency(data.totalRevenue), 
      change: data.revenueChange,
      changeLabel: isPositiveChange(data.revenueChange) ? 'рост' : 'снижение',
      icon: CurrencyDollarIcon,
      iconClassName: 'text-green-500 dark:text-green-400'
    },
    { 
      name: 'Общие затраты', 
      value: formatCurrency(data.totalCost), 
      change: data.profitChange ? -data.profitChange : undefined,
      changeLabel: isPositiveChange(data.profitChange) ? 'снижение' : 'рост',
      icon: ArchiveBoxIcon,
      iconClassName: 'text-red-500 dark:text-red-400'
    },
    { 
      name: 'Валовая прибыль', 
      value: formatCurrency(data.grossProfit), 
      change: data.profitChange,
      changeLabel: isPositiveChange(data.profitChange) ? 'рост' : 'снижение',
      icon: ScaleIcon,
      iconClassName: 'text-blue-500 dark:text-blue-400'
    },
    { 
      name: 'Маржа прибыли', 
      value: formatPercent(data.profitMargin), 
      change: undefined,
      icon: ReceiptPercentIcon,
      iconClassName: 'text-purple-500 dark:text-purple-400'
    },
    { 
      name: 'Средний чек', 
      value: formatCurrency(data.averageOrderValue), 
      change: data.averageOrderValueChange,
      changeLabel: isPositiveChange(data.averageOrderValueChange) ? 'рост' : 'снижение',
      icon: ShoppingCartIcon,
      iconClassName: 'text-indigo-500 dark:text-indigo-400'
    }
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {keyMetrics.map((metric, index) => (
          <div 
            key={index} 
            className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700"
          >
            <div className="flex items-center">
              <div className="p-3 rounded-full bg-gray-100 dark:bg-gray-700 mr-4">
                <metric.icon className={`h-6 w-6 ${metric.iconClassName}`} />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                  {metric.name}
                </p>
                <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                  {metric.value}
                </p>
                {metric.change !== undefined && (
                  <div className="flex items-center mt-1">
                    {isPositiveChange(metric.change) ? (
                      <ArrowTrendingUpIcon className="h-4 w-4 text-green-500 mr-1" />
                    ) : (
                      <ArrowTrendingDownIcon className="h-4 w-4 text-red-500 mr-1" />
                    )}
                    <span className={`text-xs font-medium ${
                      isPositiveChange(metric.change) 
                        ? 'text-green-500' 
                        : 'text-red-500'
                    }`}>
                      {Math.abs(metric.change || 0).toFixed(1)}% ({metric.changeLabel})
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Выручка по категориям */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
          Выручка по категориям
        </h3>
        <div className="space-y-4">
          {Object.entries(data.revenueByCategory).map(([categoryId, revenue]) => (
            <div key={categoryId} className="flex items-center justify-between">
              <span className="text-sm text-gray-700 dark:text-gray-300">
                {getCategoryName(parseInt(categoryId))}
              </span>
              <div className="flex items-center">
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  {formatCurrency(revenue)}
                </span>
                <div className="ml-2 w-24 bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
                  <div 
                    className="bg-blue-600 h-2.5 rounded-full" 
                    style={{ width: `${(revenue / data.totalRevenue * 100)}%` }}
                  ></div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// Функция для получения названия категории по ID
const getCategoryName = (categoryId: number): string => {
  // Пытаемся найти категорию в предопределенном списке
  const categories: Record<number, string> = {
    1: 'Супы',
    2: 'Основные блюда',
    3: 'Салаты',
    4: 'Десерты',
    5: 'Напитки',
    6: 'Закуски',
    7: 'Выпечка',
    8: 'Завтраки',
    9: 'Веганское меню',
    10: 'Детское меню'
  };
  
  return categories[categoryId] || `Категория ${categoryId}`;
};

export default FinancialMetricsView; 