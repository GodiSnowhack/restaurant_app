import React from 'react';
import { CustomerMetrics } from '../types/analytics';
import { UserIcon, UsersIcon, UserPlusIcon, StarIcon } from '@heroicons/react/24/outline';

interface CustomerMetricsViewProps {
  data: CustomerMetrics | null;
  loading: boolean;
}

/**
 * Компонент для отображения метрик по клиентам в аналитике
 */
const CustomerMetricsView: React.FC<CustomerMetricsViewProps> = ({ 
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

  // Получение цвета для рейтинга
  const getRatingColor = (rating: number): string => {
    if (rating >= 4.5) return 'text-green-500';
    if (rating >= 3.5) return 'text-yellow-500';
    return 'text-red-500';
  };

  // Преобразование рейтинга в звезды
  const renderStars = (rating: number) => {
    const stars = [];
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 >= 0.5;
    
    for (let i = 0; i < fullStars; i++) {
      stars.push(<StarIcon key={`full-${i}`} className="h-5 w-5 text-yellow-400 fill-current" />);
    }
    
    if (hasHalfStar) {
      stars.push(
        <svg key="half" className="h-5 w-5 text-yellow-400" viewBox="0 0 24 24" fill="none">
          <path fillRule="evenodd" clipRule="evenodd" d="M12 17.27L18.18 21L16.54 13.97L22 9.24L14.81 8.63L12 2L9.19 8.63L2 9.24L7.46 13.97L5.82 21L12 17.27Z" fill="currentColor" fillOpacity="0.5" />
          <path fillRule="evenodd" clipRule="evenodd" d="M12 17.27V2L9.19 8.63L2 9.24L7.46 13.97L5.82 21L12 17.27Z" fill="currentColor" />
        </svg>
      );
    }
    
    const remainingStars = 5 - Math.ceil(rating);
    for (let i = 0; i < remainingStars; i++) {
      stars.push(<StarIcon key={`empty-${i}`} className="h-5 w-5 text-gray-300" />);
    }
    
    return <div className="flex">{stars}</div>;
  };

  // Массив ключевых клиентских показателей
  const keyMetrics = [
    { 
      name: 'Всего клиентов', 
      value: data.totalCustomers, 
      icon: UsersIcon,
      iconClassName: 'text-blue-500 dark:text-blue-400'
    },
    { 
      name: 'Новые клиенты', 
      value: data.newCustomers,
      change: data.newCustomersChange,
      icon: UserPlusIcon,
      iconClassName: 'text-green-500 dark:text-green-400'
    },
    { 
      name: 'Возвращающиеся клиенты', 
      value: data.returningCustomers,
      icon: UserIcon,
      iconClassName: 'text-indigo-500 dark:text-indigo-400'
    },
    { 
      name: 'Процент удержания', 
      value: formatPercent(data.customerRetentionRate),
      change: data.returnRateChange,
      icon: UserIcon,
      iconClassName: 'text-purple-500 dark:text-purple-400'
    },
    { 
      name: 'Средний рейтинг еды', 
      value: data.foodRating.toFixed(1),
      ratingStars: true,
      icon: StarIcon,
      iconClassName: 'text-yellow-500 dark:text-yellow-400'
    },
    { 
      name: 'Средний рейтинг обслуживания', 
      value: data.serviceRating.toFixed(1),
      ratingStars: true,
      icon: StarIcon,
      iconClassName: 'text-yellow-500 dark:text-yellow-400'
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
                {metric.ratingStars && renderStars(parseFloat(metric.value))}
                {metric.change !== undefined && (
                  <div className="flex items-center mt-1">
                    {metric.change > 0 ? (
                      <svg className="h-4 w-4 text-green-500 mr-1" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M12 7a1 1 0 01-2 0V5H8a1 1 0 01 0-2h2V1a1 1 0 112 0v2h2a1 1 0 110 2h-2v2z" clipRule="evenodd" />
                      </svg>
                    ) : (
                      <svg className="h-4 w-4 text-red-500 mr-1" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M5 10a1 1 0 011-1h8a1 1 0 110 2H6a1 1 0 01-1-1z" clipRule="evenodd" />
                      </svg>
                    )}
                    <span className={`text-xs font-medium ${
                      metric.change > 0 ? 'text-green-500' : 'text-red-500'
                    }`}>
                      {Math.abs(metric.change).toFixed(1)}%
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Топ клиентов */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
          Самые активные клиенты
        </h3>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Клиент
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Email
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Потрачено
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Заказов
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Рейтинг
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Последний визит
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {data.topCustomers.map((customer) => (
                <tr key={customer.userId}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                    {customer.fullName}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    {customer.email}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    {formatCurrency(customer.totalSpent)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    {customer.ordersCount}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    <div className="flex items-center">
                      <span className={`mr-2 font-medium ${getRatingColor(customer.averageRating)}`}>
                        {customer.averageRating.toFixed(1)}
                      </span>
                      {renderStars(customer.averageRating)}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    {formatDate(customer.lastVisit)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default CustomerMetricsView; 