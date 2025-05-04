import { useState, useEffect } from 'react';
import { NextPage } from 'next';
import { useRouter } from 'next/router';
import Link from 'next/link';
import WaiterLayout from '../../../components/WaiterLayout';
import useAuthStore from '../../../lib/auth-store';
import { usersApi } from '../../../lib/api';
import { 
  UserIcon,
  EnvelopeIcon, 
  PhoneIcon,
  CalendarIcon,
  ArrowRightOnRectangleIcon,
  StarIcon
} from '@heroicons/react/24/outline';
import dynamic from 'next/dynamic';

// Динамически импортируем компонент с отзывами для лучшей производительности
const WaiterReviews = dynamic(() => import('../../../components/waiter/WaiterReviews'), {
  loading: () => <div className="animate-pulse bg-gray-200 h-40 rounded-lg"></div>,
  ssr: false
});

const WaiterProfilePage: NextPage = () => {
  const router = useRouter();
  const { user, isAuthenticated, logout } = useAuthStore();
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState({
    ordersCompleted: 0,
    ordersActive: 0,
    reservationsToday: 0,
    totalEarnings: 0
  });

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/auth/login?redirect=/waiter/profile');
    } else {
      setIsLoading(false);
      // Тут можно добавить запрос для получения статистики официанта
      // Сейчас используем тестовые данные
      setStats({
        ordersCompleted: 34,
        ordersActive: 2,
        reservationsToday: 5,
        totalEarnings: 12500
      });
    }
  }, [isAuthenticated, router]);

  const handleLogout = () => {
    logout();
    router.push('/auth/login');
  };

  if (isLoading || !user) {
    return (
      <WaiterLayout title="Загрузка...">
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-primary"></div>
        </div>
      </WaiterLayout>
    );
  }

  return (
    <WaiterLayout title="Профиль" activeTab="profile">
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <div className="flex items-center mb-8">
          <div className="bg-gray-200 rounded-full p-3 mr-4">
            <UserIcon className="h-12 w-12 text-gray-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">{user.full_name}</h1>
            <p className="text-gray-600">Официант</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center">
            <EnvelopeIcon className="h-5 w-5 text-gray-500 mr-3" />
            <span>{user.email}</span>
          </div>
          {user.phone && (
            <div className="flex items-center">
              <PhoneIcon className="h-5 w-5 text-gray-500 mr-3" />
              <span>{user.phone}</span>
            </div>
          )}
          <div className="flex items-center">
            <CalendarIcon className="h-5 w-5 text-gray-500 mr-3" />
            <span>Работает с {user.created_at ? new Date(user.created_at).toLocaleDateString('ru-RU') : 'Н/Д'}</span>
          </div>
        </div>
      </div>

      <h2 className="text-xl font-semibold mb-4">Моя статистика</h2>
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-white p-4 rounded-lg shadow-md">
          <p className="text-gray-600 text-sm">Выполнено заказов</p>
          <p className="text-2xl font-bold">{stats.ordersCompleted}</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-md">
          <p className="text-gray-600 text-sm">Активных заказов</p>
          <p className="text-2xl font-bold">{stats.ordersActive}</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-md">
          <p className="text-gray-600 text-sm">Бронирований сегодня</p>
          <p className="text-2xl font-bold">{stats.reservationsToday}</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-md">
          <p className="text-gray-600 text-sm">Общий заработок</p>
          <p className="text-2xl font-bold">{stats.totalEarnings.toFixed(2)} ₽</p>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Настройки</h2>
        <div className="space-y-4">
          <Link href="/profile/edit" className="block text-blue-600 hover:underline">
            Редактировать профиль
          </Link>
          <Link href="/profile/change-password" className="block text-blue-600 hover:underline">
            Изменить пароль
          </Link>
        </div>
      </div>

      {/* Отзывы об официанте */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <div className="flex items-center mb-4">
          <StarIcon className="h-6 w-6 text-yellow-500 mr-2" />
          <h2 className="text-xl font-semibold">Мои отзывы</h2>
        </div>
        
        {user && user.id && (
          <WaiterReviews waiterId={user.id} />
        )}
      </div>

      <button
        onClick={handleLogout}
        className="w-full bg-red-500 hover:bg-red-600 text-white font-medium py-3 px-4 rounded-lg flex items-center justify-center mb-8"
      >
        <ArrowRightOnRectangleIcon className="h-5 w-5 mr-2" />
        Выйти из аккаунта
      </button>
    </WaiterLayout>
  );
};

export default WaiterProfilePage; 