import { useState, useEffect } from 'react';
import { NextPage } from 'next';
import { useRouter } from 'next/router';
import Link from 'next/link';
import Layout from '../../components/Layout';
import useAuthStore from '../../lib/auth-store';
import { 
  ArrowLeftIcon,
  ChartPieIcon,
  ChartBarIcon,
  CalendarIcon,
  CurrencyIcon,
  ShoppingBagIcon,
  ClockIcon
} from '@heroicons/react/24/outline';

type TimeRange = 'today' | 'week' | 'month' | 'year';

const AdminAnalyticsPage: NextPage = () => {
  const router = useRouter();
  const { user, isAuthenticated } = useAuthStore();
  const [isLoading, setIsLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<TimeRange>('week');
  const [activeTab, setActiveTab] = useState('overview');
  const [statsData, setStatsData] = useState({
    revenue: {
      total: 0,
      today: 0,
      week: 0,
      month: 0,
      year: 0,
      growth: 0
    },
    orders: {
      total: 0,
      today: 0,
      week: 0,
      month: 0,
      year: 0,
      growth: 0
    },
    average_order: {
      total: 0,
      today: 0,
      week: 0,
      month: 0,
      year: 0,
      growth: 0
    },
    customers: {
      total: 0,
      today: 0,
      week: 0,
      month: 0,
      year: 0,
      growth: 0
    },
    top_dishes: [
      { id: 1, name: 'Стейк Рибай', count: 42, revenue: 63000 },
      { id: 2, name: 'Цезарь с курицей', count: 38, revenue: 38000 },
      { id: 3, name: 'Паста Карбонара', count: 35, revenue: 35000 },
      { id: 4, name: 'Тирамису', count: 30, revenue: 18000 },
      { id: 5, name: 'Борщ', count: 28, revenue: 19600 }
    ],
    revenue_by_time: [
      { time: '10:00', value: 5000 },
      { time: '12:00', value: 12000 },
      { time: '14:00', value: 18000 },
      { time: '16:00', value: 10000 },
      { time: '18:00', value: 15000 },
      { time: '20:00', value: 25000 },
      { time: '22:00', value: 20000 }
    ],
    orders_by_status: [
      { status: 'completed', count: 120, percentage: 60 },
      { status: 'processing', count: 45, percentage: 22.5 },
      { status: 'cancelled', count: 35, percentage: 17.5 }
    ],
    revenue_by_category: [
      { category: 'Горячие блюда', value: 180000, percentage: 35 },
      { category: 'Закуски', value: 90000, percentage: 18 },
      { category: 'Салаты', value: 70000, percentage: 14 },
      { category: 'Десерты', value: 60000, percentage: 12 },
      { category: 'Напитки', value: 55000, percentage: 11 },
      { category: 'Супы', value: 45000, percentage: 9 }
    ]
  });

  useEffect(() => {
    const checkAdmin = async () => {
      if (!isAuthenticated) {
        router.push('/auth/login');
        return;
      }

      if (user?.role !== 'admin') {
        router.push('/');
        return;
      }

      // В реальном приложении здесь будет загрузка статистики с сервера
      // API запрос будет выглядеть примерно так:
      // const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/analytics?timeRange=${timeRange}`);
      
      // Имитируем загрузку данных
      setTimeout(() => {
        setIsLoading(false);
        // В реальности данные будут получены от сервера в зависимости от timeRange
        
        // Для демонстрации обновим некоторые числа в зависимости от выбранного диапазона
        const multiplier = 
          timeRange === 'today' ? 1 :
          timeRange === 'week' ? 7 :
          timeRange === 'month' ? 30 : 365;
          
        setStatsData(prevData => ({
          ...prevData,
          revenue: {
            ...prevData.revenue,
            [timeRange]: Math.floor(15000 * multiplier * (0.8 + Math.random() * 0.4))
          },
          orders: {
            ...prevData.orders,
            [timeRange]: Math.floor(10 * multiplier * (0.8 + Math.random() * 0.4))
          },
          average_order: {
            ...prevData.average_order,
            [timeRange]: Math.floor(1500 * (0.8 + Math.random() * 0.4))
          },
          customers: {
            ...prevData.customers,
            [timeRange]: Math.floor(8 * multiplier * (0.8 + Math.random() * 0.4))
          }
        }));
      }, 1000);
    };

    checkAdmin();
  }, [isAuthenticated, user, router, timeRange]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency: 'KZT',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const handleChangeTimeRange = (newRange: TimeRange) => {
    setTimeRange(newRange);
    setIsLoading(true);
  };

  if (isLoading) {
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
            <button
              onClick={() => handleChangeTimeRange('year')}
              className={`px-4 py-2 rounded-md text-sm font-medium ${
                timeRange === 'year' 
                  ? 'bg-primary text-white' 
                  : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
              }`}
            >
              Год
            </button>
          </div>
        </div>

        {/* Навигация по вкладкам */}
        <div className="mb-8">
          <div className="flex flex-wrap gap-2 border-b">
            <button
              onClick={() => setActiveTab('overview')}
              className={`px-4 py-2 font-medium text-sm border-b-2 -mb-px ${
                activeTab === 'overview' 
                  ? 'border-primary text-primary' 
                  : 'border-transparent text-gray-600 hover:text-gray-800'
              }`}
            >
              Обзор
            </button>
            <button
              onClick={() => setActiveTab('sales')}
              className={`px-4 py-2 font-medium text-sm border-b-2 -mb-px ${
                activeTab === 'sales' 
                  ? 'border-primary text-primary' 
                  : 'border-transparent text-gray-600 hover:text-gray-800'
              }`}
            >
              Продажи
            </button>
            <button
              onClick={() => setActiveTab('customers')}
              className={`px-4 py-2 font-medium text-sm border-b-2 -mb-px ${
                activeTab === 'customers' 
                  ? 'border-primary text-primary' 
                  : 'border-transparent text-gray-600 hover:text-gray-800'
              }`}
            >
              Клиенты
            </button>
            <button
              onClick={() => setActiveTab('menu')}
              className={`px-4 py-2 font-medium text-sm border-b-2 -mb-px ${
                activeTab === 'menu' 
                  ? 'border-primary text-primary' 
                  : 'border-transparent text-gray-600 hover:text-gray-800'
              }`}
            >
              Меню
            </button>
          </div>
        </div>

        {/* Карточки с основными метриками */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-gray-500 text-sm uppercase font-medium">Выручка</h3>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                +{statsData.revenue.growth}%
              </span>
            </div>
            <div className="flex items-center">
              <CurrencyIcon className="h-8 w-8 text-primary" />
              <div className="ml-4">
                <p className="text-2xl font-bold">{formatCurrency(statsData.revenue[timeRange])}</p>
                <p className="text-sm text-gray-500">{timeRange === 'today' ? 'Сегодня' : timeRange === 'week' ? 'За неделю' : timeRange === 'month' ? 'За месяц' : 'За год'}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-gray-500 text-sm uppercase font-medium">Заказы</h3>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                +{statsData.orders.growth}%
              </span>
            </div>
            <div className="flex items-center">
              <ShoppingBagIcon className="h-8 w-8 text-primary" />
              <div className="ml-4">
                <p className="text-2xl font-bold">{statsData.orders[timeRange]}</p>
                <p className="text-sm text-gray-500">{timeRange === 'today' ? 'Сегодня' : timeRange === 'week' ? 'За неделю' : timeRange === 'month' ? 'За месяц' : 'За год'}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-gray-500 text-sm uppercase font-medium">Средний чек</h3>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                +{statsData.average_order.growth}%
              </span>
            </div>
            <div className="flex items-center">
              <ChartBarIcon className="h-8 w-8 text-primary" />
              <div className="ml-4">
                <p className="text-2xl font-bold">{formatCurrency(statsData.average_order[timeRange])}</p>
                <p className="text-sm text-gray-500">{timeRange === 'today' ? 'Сегодня' : timeRange === 'week' ? 'За неделю' : timeRange === 'month' ? 'За месяц' : 'За год'}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-gray-500 text-sm uppercase font-medium">Клиенты</h3>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                +{statsData.customers.growth}%
              </span>
            </div>
            <div className="flex items-center">
              <ClockIcon className="h-8 w-8 text-primary" />
              <div className="ml-4">
                <p className="text-2xl font-bold">{statsData.customers[timeRange]}</p>
                <p className="text-sm text-gray-500">{timeRange === 'today' ? 'Сегодня' : timeRange === 'week' ? 'За неделю' : timeRange === 'month' ? 'За месяц' : 'За год'}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Контент вкладок */}
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Выручка по времени суток */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-lg font-medium mb-4">Выручка по времени суток</h3>
              <div className="h-64 flex items-end space-x-2">
                {statsData.revenue_by_time.map((item, index) => (
                  <div key={index} className="flex flex-col items-center flex-1">
                    <div 
                      className="w-full bg-primary rounded-t" 
                      style={{ 
                        height: `${(item.value / Math.max(...statsData.revenue_by_time.map(i => i.value))) * 100}%` 
                      }}
                    ></div>
                    <div className="text-xs text-gray-600 mt-2">{item.time}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Заказы по статусам */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-lg font-medium mb-4">Заказы по статусам</h3>
              <div className="mb-4">
                {statsData.orders_by_status.map((item, index) => (
                  <div key={index} className="mb-4">
                    <div className="flex justify-between mb-1">
                      <span className="text-sm font-medium capitalize">
                        {item.status === 'completed' ? 'Выполнены' : 
                         item.status === 'processing' ? 'В обработке' : 'Отменены'}
                      </span>
                      <span className="text-sm font-medium">{item.count} ({item.percentage}%)</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className={`h-2 rounded-full ${
                          item.status === 'completed' ? 'bg-green-500' : 
                          item.status === 'processing' ? 'bg-blue-500' : 'bg-red-500'
                        }`}
                        style={{ width: `${item.percentage}%` }}
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
                    {statsData.top_dishes.map((dish) => (
                      <tr key={dish.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{dish.name}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{dish.count}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{formatCurrency(dish.revenue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Выручка по категориям */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-lg font-medium mb-4">Выручка по категориям</h3>
              <div className="space-y-4">
                {statsData.revenue_by_category.map((item, index) => (
                  <div key={index} className="mb-4">
                    <div className="flex justify-between mb-1">
                      <span className="text-sm font-medium">{item.category}</span>
                      <span className="text-sm font-medium">{formatCurrency(item.value)} ({item.percentage}%)</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="h-2 bg-primary rounded-full"
                        style={{ width: `${item.percentage}%` }}
                      ></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'sales' && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-bold mb-6">Детальная аналитика продаж</h2>
            <p className="text-gray-600">Детальная статистика по продажам будет добавлена позже.</p>
          </div>
        )}

        {activeTab === 'customers' && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-bold mb-6">Аналитика по клиентам</h2>
            <p className="text-gray-600">Детальная статистика по клиентам будет добавлена позже.</p>
          </div>
        )}

        {activeTab === 'menu' && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-bold mb-6">Аналитика по меню</h2>
            <p className="text-gray-600">Детальная статистика по меню будет добавлена позже.</p>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default AdminAnalyticsPage; 