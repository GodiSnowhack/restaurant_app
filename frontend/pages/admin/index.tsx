import {useState, useEffect} from 'react';
import {NextPage} from 'next';
import {useRouter} from 'next/router';
import Link from 'next/link';
import Layout from '../../components/Layout';
import useAuthStore from '../../lib/auth-store';
import {adminApi, ordersApi, menuApi, DashboardStats} from '../../lib/api';
import {UserIcon, ShoppingCartIcon, DocumentTextIcon, CalendarIcon, Cog6ToothIcon as CogIcon, ChartPieIcon, Bars3Icon as MenuIcon, PhotoIcon as PhotographIcon} from '@heroicons/react/24/outline';
import {CurrencyDollarIcon, UsersIcon, ClipboardDocumentListIcon} from '@heroicons/react/24/outline';
import { useTheme } from '@/lib/theme-context';

const AdminPage: NextPage = () => {
  const router = useRouter();
  const { user, isAuthenticated } = useAuthStore();
  const { isDark } = useTheme();
  const [stats, setStats] = useState<DashboardStats>({
    ordersToday: 0,
    ordersTotal: 0,
    revenue: 0,
    reservationsToday: 0,
    users: 0,
    dishes: 0
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const checkAdminAndLoadStats = async () => {
      if (!isAuthenticated) {
        router.push('/auth/login');
        return;
      }

      if (user?.role !== 'admin') {
        router.push('/');
        return;
      }

      try {
        setIsLoading(true);
        
        // Проверяем доступ к adminApi и получаем статистику
        if (adminApi && typeof adminApi.getDashboardStats === 'function') {
          try {
            const data = await adminApi.getDashboardStats();
            setStats(data);
            console.log('AdminDashboard - Получена статистика:', data);
          } catch (adminError) {
            console.error('AdminDashboard - Ошибка при запросе статистики:', adminError);
            setError('Ошибка при загрузке статистики');
          }
        } else {
          console.error('AdminDashboard - adminApi недоступен или метод getDashboardStats отсутствует');
          setError('API статистики недоступно');
        }
        
        // Проверка наличия заказов напрямую - для отладки
        console.log('Проверка наличия заказов в базе данных...');
        try {
          if (ordersApi && typeof ordersApi.getOrders === 'function') {
            const orders = await ordersApi.getOrders();
            console.log('AdminDashboard - Заказы без фильтров:', orders);
            console.log('AdminDashboard - Количество заказов:', orders.length);
            console.log('AdminDashboard - Структура первого заказа:', orders.length > 0 ? orders[0] : 'нет данных');
          } else {
            console.error('AdminDashboard - ordersApi или метод getOrders недоступен');
          }
        } catch (ordersError) {
          console.error('AdminDashboard - Ошибка при запросе заказов:', ordersError);
        }
        
      } catch (error) {
        console.error('Ошибка при загрузке статистики:', error);
        setError('Ошибка при загрузке данных');
      } finally {
        setIsLoading(false);
      }
    };

    checkAdminAndLoadStats();
  }, [isAuthenticated, user, router]);

  const menuItems = [
    {
      title: 'Управление меню',
      description: 'Добавление, редактирование и удаление блюд, категорий и ингредиентов',
      icon: <MenuIcon className="h-8 w-8 text-primary dark:text-primary" />,
      link: '/admin/menu'
    },
    {
      title: 'Заказы',
      description: 'Просмотр и управление заказами, отчеты по продажам',
      icon: <ShoppingCartIcon className="h-8 w-8 text-primary dark:text-primary" />,
      link: '/admin/orders'
    },
    {
      title: 'Бронирования',
      description: 'Управление бронированием столиков',
      icon: <CalendarIcon className="h-8 w-8 text-primary dark:text-primary" />,
      link: '/admin/reservations'
    },
    {
      title: 'Пользователи',
      description: 'Управление пользователями и персоналом',
      icon: <UserIcon className="h-8 w-8 text-primary dark:text-primary" />,
      link: '/admin/users'
    },
    {
      title: 'Изображения',
      description: 'Управление изображениями блюд и оформления',
      icon: <PhotographIcon className="h-8 w-8 text-primary dark:text-primary" />,
      link: '/admin/images'
    },
    {
      title: 'Аналитика',
      description: 'Статистика, отчеты и прогнозы',
      icon: <ChartPieIcon className="h-8 w-8 text-primary dark:text-primary" />,
      link: '/admin/analytics'
    },
    {
      title: 'Настройки',
      description: 'Настройки ресторана и системы',
      icon: <CogIcon className="h-8 w-8 text-primary dark:text-primary" />,
      link: '/admin/settings'
    }
  ];

  if (isLoading) {
    return (
      <Layout title="Админ-панель">
        <div className="container mx-auto px-4 py-8">
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary dark:border-primary"></div>
          </div>
        </div>
      </Layout>
    );
  }

  if (error) {
    return (
      <Layout title="Админ-панель">
        <div className="container mx-auto px-4 py-8">
          <div className="text-center text-red-600 dark:text-red-400">{error}</div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="Админ-панель">
      <div className="max-w-[1400px] w-full mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-2 dark:text-white">Панель управления</h1>
        <p className="text-gray-600 dark:text-gray-300 mb-8">Добро пожаловать, {user?.full_name || 'Администратор'}</p>

        {/* Карточки статистики */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
            <div className="flex items-center">
              <div className="rounded-full bg-blue-100 dark:bg-blue-900 p-3 mr-4">
                <ShoppingCartIcon className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-700 dark:text-gray-200">Заказы сегодня</h2>
                <p className="text-2xl font-bold dark:text-white">{stats.ordersToday}</p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
            <div className="flex items-center">
              <div className="rounded-full bg-green-100 dark:bg-green-900 p-3 mr-4">
                <CurrencyDollarIcon className="h-6 w-6 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-700 dark:text-gray-200">Выручка</h2>
                <p className="text-2xl font-bold dark:text-white">{(stats.revenue || 0).toLocaleString()} ₸</p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
            <div className="flex items-center">
              <div className="rounded-full bg-purple-100 dark:bg-purple-900 p-3 mr-4">
                <CalendarIcon className="h-6 w-6 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-700 dark:text-gray-200">Брони сегодня</h2>
                <p className="text-2xl font-bold dark:text-white">{stats.reservationsToday}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Разделы админки */}
        <h2 className="text-2xl font-semibold mb-6 dark:text-white">Управление рестораном</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {menuItems.map((item, index) => (
            <Link 
              href={item.link} 
              key={index}
              className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 transition-transform hover:scale-105 hover:shadow-lg"
            >
              <div className="flex items-start">
                <div className="mr-4">{item.icon}</div>
                <div>
                  <h3 className="text-xl font-semibold mb-2 dark:text-white">{item.title}</h3>
                  <p className="text-gray-600 dark:text-gray-300">{item.description}</p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </Layout>
  );
};

export default AdminPage; 