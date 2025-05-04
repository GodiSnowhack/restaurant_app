import React from 'react';
import { OperationalMetrics } from '../types/analytics';
import { 
  ClockIcon, 
  UserGroupIcon, 
  TableCellsIcon,
  CheckCircleIcon
} from '@heroicons/react/24/outline';

interface OperationalMetricsViewProps {
  data: OperationalMetrics | null;
  loading: boolean;
}

/**
 * Компонент для отображения операционных метрик в аналитике
 */
const OperationalMetricsView: React.FC<OperationalMetricsViewProps> = ({ 
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

  // Форматирование процентов
  const formatPercent = (value: number): string => {
    return new Intl.NumberFormat('ru-RU', { 
      style: 'percent', 
      minimumFractionDigits: 1,
      maximumFractionDigits: 1 
    }).format(value / 100);
  };

  // Форматирование времени в минутах в читаемый формат
  const formatMinutes = (minutes: number): string => {
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    
    if (hours > 0) {
      return `${hours} ч ${mins} мин`;
    }
    return `${mins} мин`;
  };

  // Получение цвета для загруженности
  const getUtilizationColor = (percent: number): string => {
    if (percent >= 85) return 'text-red-500';
    if (percent >= 65) return 'text-yellow-500';
    return 'text-green-500';
  };

  // Массив ключевых операционных показателей
  const keyMetrics = [
    { 
      name: 'Ср. время подготовки заказа', 
      value: formatMinutes(data.averageOrderPreparationTime),
      icon: ClockIcon,
      iconClassName: 'text-blue-500 dark:text-blue-400'
    },
    { 
      name: 'Ср. время оборота стола', 
      value: formatMinutes(data.averageTableTurnoverTime),
      icon: TableCellsIcon,
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
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Пиковые часы */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
          Пиковые часы (% загруженности)
        </h3>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
          {Object.entries(data.peakHours).map(([hour, percentage]) => (
            <div key={hour} className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                {hour}
              </p>
              <div className="mt-2 flex items-center">
                <p className={`text-xl font-semibold ${getUtilizationColor(percentage)}`}>
                  {formatPercent(percentage)}
                </p>
                <div className="ml-auto w-16 h-2 bg-gray-200 dark:bg-gray-600 rounded-full">
                  <div 
                    className={`h-2 rounded-full ${
                      percentage >= 85
                        ? 'bg-red-500'
                        : percentage >= 65
                          ? 'bg-yellow-500'
                          : 'bg-green-500'
                    }`}
                    style={{ width: `${percentage}%` }}
                  ></div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Эффективность персонала */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
          Эффективность персонала
        </h3>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Сотрудник
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Обслужено заказов
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Средний чек
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Среднее время обслуживания
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Рейтинг клиентов
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {Object.values(data.staffEfficiency).map((staff) => (
                <tr key={staff.userId}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                    {staff.userName}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    {staff.ordersServed}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    {new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB' }).format(staff.averageOrderValue)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    {formatMinutes(staff.averageServiceTime)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    <div className="flex items-center">
                      <span className={`mr-2 font-medium ${
                        staff.customerRating >= 4.5
                          ? 'text-green-500'
                          : staff.customerRating >= 3.5
                            ? 'text-yellow-500'
                            : 'text-red-500'
                      }`}>
                        {staff.customerRating.toFixed(1)}
                      </span>
                      <div className="w-16 h-2 bg-gray-200 dark:bg-gray-600 rounded-full">
                        <div 
                          className={`h-2 rounded-full ${
                            staff.customerRating >= 4.5
                              ? 'bg-green-500'
                              : staff.customerRating >= 3.5
                                ? 'bg-yellow-500'
                                : 'bg-red-500'
                          }`}
                          style={{ width: `${(staff.customerRating / 5) * 100}%` }}
                        ></div>
                      </div>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Загруженность столиков */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
          Загруженность столиков
        </h3>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-6">
          {Object.entries(data.tableUtilization).map(([tableId, utilization]) => (
            <div key={tableId} className="bg-gray-50 dark:bg-gray-700 p-3 rounded-lg text-center">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Столик #{tableId}
              </p>
              <p className={`text-xl font-semibold mt-2 ${getUtilizationColor(utilization)}`}>
                {formatPercent(utilization)}
              </p>
              <div className="mt-2 w-full h-2 bg-gray-200 dark:bg-gray-600 rounded-full">
                <div 
                  className={`h-2 rounded-full ${
                    utilization >= 85
                      ? 'bg-red-500'
                      : utilization >= 65
                        ? 'bg-yellow-500'
                        : 'bg-green-500'
                  }`}
                  style={{ width: `${utilization}%` }}
                ></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default OperationalMetricsView; 