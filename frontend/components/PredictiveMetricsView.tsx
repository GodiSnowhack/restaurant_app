import React from 'react';
import { PredictiveMetrics } from '../types/analytics';
import { 
  ChartBarIcon, 
  PresentationChartLineIcon,
  CurrencyDollarIcon,
  LightBulbIcon,
  UserGroupIcon,
  ClockIcon
} from '@heroicons/react/24/outline';

interface PredictiveMetricsViewProps {
  data: PredictiveMetrics | null;
  loading: boolean;
}

/**
 * Компонент для отображения предиктивных метрик в аналитике
 */
const PredictiveMetricsView: React.FC<PredictiveMetricsViewProps> = ({ 
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

  // Форматирование даты
  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  // Получение названия товара по ID
  const getProductName = (productId: number): string => {
    const products: Record<number, string> = {
      1: 'Мука',
      2: 'Сахар',
      3: 'Соль',
      4: 'Масло',
      5: 'Яйца',
      6: 'Молоко',
      7: 'Томаты',
      8: 'Сыр',
      9: 'Говядина',
      10: 'Курица'
    };
    
    return products[productId] || `Товар ${productId}`;
  };

  return (
    <div className="space-y-6">
      {/* Прогноз продаж */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4 flex items-center">
          <PresentationChartLineIcon className="h-5 w-5 mr-2 text-indigo-600" />
          Прогноз продаж
        </h3>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-white uppercase tracking-wider">
                  Дата
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-white uppercase tracking-wider">
                  Прогнозируемая выручка
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {data.salesForecast.map((forecast, index) => (
                <tr key={index}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                    {formatDate(forecast.date)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-white">
                    {formatCurrency(forecast.value)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Прогноз необходимых запасов */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4 flex items-center">
          <ChartBarIcon className="h-5 w-5 mr-2 text-blue-600" />
          Прогноз необходимых запасов
        </h3>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
          {Object.entries(data.inventoryForecast).map(([productId, quantity]) => (
            <div key={productId} className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
              <p className="text-sm font-medium text-gray-500 dark:text-white">
                {getProductName(parseInt(productId))}
              </p>
              <p className="text-2xl font-semibold text-gray-900 dark:text-white mt-1">
                {quantity} шт.
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Потребность в персонале */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4 flex items-center">
          <UserGroupIcon className="h-5 w-5 mr-2 text-green-600" />
          Прогноз потребности в персонале
        </h3>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-white uppercase tracking-wider">
                  День
                </th>
                {Object.keys(Object.values(data.staffingNeeds)[0] || {}).map((timeSlot) => (
                  <th key={timeSlot} scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-white uppercase tracking-wider">
                    {timeSlot}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {Object.entries(data.staffingNeeds).map(([day, slots]) => (
                <tr key={day}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                    {day}
                  </td>
                  {Object.values(slots).map((count, index) => (
                    <td key={index} className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-white">
                      {count} чел.
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Прогноз пиковых часов */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4 flex items-center">
          <ClockIcon className="h-5 w-5 mr-2 text-purple-600" />
          Прогноз пиковых часов
        </h3>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Object.entries(data.peakTimePrediction).map(([day, hours]) => (
            <div key={day} className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                {day}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {hours.map((hour, index) => (
                  <span key={index} className="bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200 px-2 py-1 rounded text-xs font-medium">
                    {hour}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Рекомендации по акциям */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4 flex items-center">
          <LightBulbIcon className="h-5 w-5 mr-2 text-yellow-500" />
          Рекомендуемые акции
        </h3>
        <div className="space-y-4">
          {data.suggestedPromotions.map((promo, index) => (
            <div key={index} className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-lg font-medium text-gray-900 dark:text-white">
                    {promo.dishName}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-white mt-1">
                    {promo.reason}
                  </p>
                </div>
                <div className="flex flex-col items-end">
                  <div className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 px-3 py-1 rounded-full text-sm font-medium">
                    {formatPercent(promo.suggestedDiscount)} скидка
                  </div>
                  <p className="text-sm text-gray-500 dark:text-white mt-2">
                    Потенциальная выручка: {formatCurrency(promo.potentialRevenue)}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default PredictiveMetricsView; 