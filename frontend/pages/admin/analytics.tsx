import { useState, useEffect } from 'react';
import { NextPage } from 'next';
import { useRouter } from 'next/router';
import Link from 'next/link';
import Layout from '../../components/Layout';
import { useAuth } from '../../hooks/useAuth';
import { 
  ArrowLeftIcon,
  ChartBarIcon,
  ShoppingBagIcon,
  UserIcon,
  ClockIcon,
  CheckCircleIcon
} from '@heroicons/react/24/outline';
import { 
  analyticsApi 
} from '../../lib/api/analytics-api';
import { 
  FinancialMetrics, 
  MenuMetrics, 
  CustomerMetrics, 
  OperationalMetrics
} from '../../types/analytics';

type TimeRange = 'today' | 'week' | 'month';

// Функция для получения названия категории по ID
const getCategoryName = (categoryId: number): string => {
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

const AdminAnalyticsPage: NextPage = () => {
  const router = useRouter();
  const { user, isAuthenticated, isLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<TimeRange>('month');
  
  // Состояния для различных типов метрик
  const [financialMetrics, setFinancialMetrics] = useState<FinancialMetrics | null>(null);
  const [menuMetrics, setMenuMetrics] = useState<MenuMetrics | null>(null);
  const [customerMetrics, setCustomerMetrics] = useState<CustomerMetrics | null>(null);
  const [operationalMetrics, setOperationalMetrics] = useState<OperationalMetrics | null>(null);

  useEffect(() => {
    // Проверка прав админа
    checkAdmin();
    
    // Загрузка данных аналитики
    loadAnalyticsData();
  }, [timeRange]);

  // Функция для проверки прав администратора
  const checkAdmin = async () => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login?from=/admin/analytics');
      return;
    }

    if (!isLoading && isAuthenticated && user?.role !== 'admin') {
      router.push('/');
      return;
    }
  };

  // Функция для загрузки данных аналитики
  const loadAnalyticsData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Определение временного диапазона для фильтров
      const today = new Date();
      let startDate = new Date();
      
      switch (timeRange) {
        case 'today':
          startDate = new Date(today.setHours(0, 0, 0, 0));
          break;
        case 'week':
          startDate = new Date(today);
          startDate.setDate(today.getDate() - 7);
          break;
        case 'month':
          startDate = new Date(today);
          startDate.setMonth(today.getMonth() - 1);
          break;
      }
      
      const filters = {
        startDate: startDate.toISOString().split('T')[0],
        endDate: new Date().toISOString().split('T')[0]
      };
      
      // Параллельная загрузка необходимых данных
      const [financial, menu, customers, operational] = await Promise.all([
        analyticsApi.getFinancialMetrics(filters),
        analyticsApi.getMenuMetrics(filters),
        analyticsApi.getCustomerMetrics(filters),
        analyticsApi.getOperationalMetrics(filters)
      ]);
      
      setFinancialMetrics(financial);
      setMenuMetrics(menu);
      setCustomerMetrics(customers);
      setOperationalMetrics(operational);
    } catch (err) {
      console.error('Ошибка при загрузке данных аналитики:', err);
      setError('Произошла ошибка при загрузке данных аналитики. Пожалуйста, попробуйте позже.');
    } finally {
      setLoading(false);
    }
  };

  // Форматирование валюты (без символа рубля)
  const formatCurrency = (value: number | undefined) => {
    if (value === undefined) return '0';
    return new Intl.NumberFormat('ru-RU', {
      maximumFractionDigits: 0
    }).format(value);
  };

  // Обработчик изменения временного диапазона
  const handleChangeTimeRange = (newRange: TimeRange) => {
    setTimeRange(newRange);
  };

  if (loading) {
    return (
      <Layout title="Аналитика | Админ-панель">
        <div className="container mx-auto px-4 py-8">
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
          </div>
        </div>
      </Layout>
    );
  }

  // Если данные не загружены, показываем сообщение об ошибке
  if (!financialMetrics || !menuMetrics || !customerMetrics || !operationalMetrics) {
    return (
      <Layout title="Аналитика | Админ-панель">
        <div className="container mx-auto px-4 py-8">
          <div className="bg-red-50 border-l-4 border-red-500 p-4">
            <div className="flex">
              <div className="ml-3">
                <p className="text-sm text-red-700">
                  {error || "Не удалось загрузить данные аналитики. Пожалуйста, попробуйте позже."}
                </p>
              </div>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  // Фильтрация статусов заказов (удаление статуса "Доставлен")
  const filteredOrderStatuses = Object.entries(operationalMetrics.orderCompletionRates)
    .filter(([status]) => status !== 'Доставлен')
    .reduce((acc, [status, value]) => {
      acc[status] = value;
      return acc;
    }, {} as Record<string, number>);

  return (
    <Layout title="Аналитика | Админ-панель">
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center mb-6">
          <Link href="/admin" className="text-gray-600 hover:text-primary mr-4">
            <ArrowLeftIcon className="h-5 w-5" />
          </Link>
          <h1 className="text-3xl font-bold">Аналитика</h1>
        </div>

        {/* Переключатель временного диапазона */}
        <div className="mb-8">
          <div className="flex flex-wrap gap-2 bg-white p-4 rounded-lg shadow-md">
            <button
              onClick={() => handleChangeTimeRange('today')}
              className={`px-4 py-2 rounded-md text-sm font-medium ${
                timeRange === 'today' 
                  ? 'bg-primary text-white' 
                  : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
              }`}
            >
              Сегодня
            </button>
            <button
              onClick={() => handleChangeTimeRange('week')}
              className={`px-4 py-2 rounded-md text-sm font-medium ${
                timeRange === 'week' 
                  ? 'bg-primary text-white' 
                  : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
              }`}
            >
              Неделя
            </button>
            <button
              onClick={() => handleChangeTimeRange('month')}
              className={`px-4 py-2 rounded-md text-sm font-medium ${
                timeRange === 'month' 
                  ? 'bg-primary text-white' 
                  : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
              }`}
            >
              Месяц
            </button>
          </div>
        </div>

        {/* Основные показатели */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-gray-500 text-sm uppercase font-medium">Выручка</h3>
            </div>
            <div className="flex items-center">
              <ChartBarIcon className="h-8 w-8 text-primary" />
              <div className="ml-4">
                <p className="text-2xl font-bold">{formatCurrency(financialMetrics.totalRevenue)}</p>
                <p className="text-sm text-gray-500">{timeRange === 'today' ? 'Сегодня' : timeRange === 'week' ? 'За неделю' : 'За месяц'}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-gray-500 text-sm uppercase font-medium">Заказы</h3>
            </div>
            <div className="flex items-center">
              <ShoppingBagIcon className="h-8 w-8 text-primary" />
              <div className="ml-4">
                <p className="text-2xl font-bold">{Math.round(financialMetrics.totalRevenue / financialMetrics.averageOrderValue)}</p>
                <p className="text-sm text-gray-500">{timeRange === 'today' ? 'Сегодня' : timeRange === 'week' ? 'За неделю' : 'За месяц'}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-gray-500 text-sm uppercase font-medium">Средний чек</h3>
            </div>
            <div className="flex items-center">
              <CheckCircleIcon className="h-8 w-8 text-primary" />
              <div className="ml-4">
                <p className="text-2xl font-bold">{formatCurrency(financialMetrics.averageOrderValue)}</p>
                <p className="text-sm text-gray-500">{timeRange === 'today' ? 'Сегодня' : timeRange === 'week' ? 'За неделю' : 'За месяц'}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-gray-500 text-sm uppercase font-medium">Клиенты</h3>
            </div>
            <div className="flex items-center">
              <UserIcon className="h-8 w-8 text-primary" />
              <div className="ml-4">
                <p className="text-2xl font-bold">{customerMetrics.totalCustomers}</p>
                <p className="text-sm text-gray-500">{timeRange === 'today' ? 'Сегодня' : timeRange === 'week' ? 'За неделю' : 'За месяц'}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Основные графики и таблицы */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Заказы по статусам */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-medium mb-4">Заказы по статусам</h3>
            <div className="mb-4">
              {Object.entries(filteredOrderStatuses).map(([status, percentage], index) => (
                <div key={index} className="mb-4">
                  <div className="flex justify-between mb-1">
                    <span className="text-sm font-medium capitalize">
                      {status}
                    </span>
                    <span className="text-sm font-medium">{Math.round(Number(percentage))}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className={`h-2 rounded-full ${
                        status === 'Выполнен' || status === 'Оплачен' ? 'bg-green-500' : 
                        status === 'Принят' || status === 'Готовится' || status === 'Готов' ? 'bg-blue-500' : 'bg-red-500'
                      }`}
                      style={{ width: `${percentage}%` }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Топ блюд */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-medium mb-4">Топ блюд</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Блюдо</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Кол-во</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Выручка</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {menuMetrics.topSellingDishes.slice(0, 5).map((dish) => (
                    <tr key={dish.dishId}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{dish.dishName}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{dish.salesCount}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{formatCurrency(dish.revenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Выручка по времени суток */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-medium mb-4">Выручка по времени суток</h3>
            <div className="h-64 flex items-end space-x-2">
              {Object.entries(financialMetrics.revenueByTimeOfDay).map(([time, value], index) => {
                const maxValue = Math.max(...Object.values(financialMetrics.revenueByTimeOfDay));
                const percentage = (value / maxValue) * 100;
                
                return (
                  <div key={index} className="flex flex-col items-center flex-1">
                    <div 
                      className="w-full bg-primary rounded-t" 
                      style={{ height: `${percentage}%` }}
                    ></div>
                    <div className="text-xs text-gray-600 mt-2">{time}</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Выручка по категориям */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-medium mb-4">Выручка по категориям</h3>
            <div className="space-y-4">
              {Object.entries(financialMetrics.revenueByCategory)
                .sort((a, b) => b[1] - a[1]) // Сортировка по убыванию выручки
                .slice(0, 5) // Только топ-5 категорий
                .map(([categoryId, value], index) => {
                  const totalRevenue = financialMetrics.totalRevenue;
                  const percentage = Math.round((value / totalRevenue) * 100);
                  const categoryName = getCategoryName(parseInt(categoryId, 10));
                  
                  return (
                    <div key={index} className="mb-4">
                      <div className="flex justify-between mb-1">
                        <span className="text-sm font-medium">{categoryName}</span>
                        <span className="text-sm font-medium">{formatCurrency(value)} ({percentage}%)</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className="h-2 bg-primary rounded-full"
                          style={{ width: `${percentage}%` }}
                        ></div>
                      </div>
                    </div>
                  );
                })
              }
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default AdminAnalyticsPage; 