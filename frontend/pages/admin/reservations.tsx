import { useState, useEffect } from 'react';
import { NextPage } from 'next';
import { useRouter } from 'next/router';
import Link from 'next/link';
import Layout from '../../components/Layout';
import useAuthStore from '../../lib/auth-store';
import { 
  ArrowLeftIcon,
  CheckCircleIcon,
  ClockIcon,
  XCircleIcon,
  CalendarIcon,
  UserIcon,
  PhoneIcon,
  UserGroupIcon,
  FunnelIcon as FilterIcon
} from '@heroicons/react/24/outline';
import { reservationsApi } from '../../lib/api';

interface Reservation {
  id: number;
  user_id: number;
  user?: { full_name: string };
  guest_name: string;
  guest_phone: string;
  table_number: number;
  guests_count: number;
  reservation_time: string;
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled';
  comment: string;
  created_at: string;
}

const AdminReservationsPage: NextPage = () => {
  const router = useRouter();
  const { user, isAuthenticated } = useAuthStore();
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<number>(Date.now());

  // Функция для принудительного обновления данных
  const refreshData = () => {
    setLastRefresh(Date.now());
  };

  // Обработка истекших бронирований и сортировка
  const processReservations = (data: any[]): Reservation[] => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // Обрабатываем истекшие брони (меняем статус на "cancelled")
    const processed = data.map(reservation => {
      const reservationDate = new Date(reservation.reservation_time);
      if (reservation.status === 'pending' && reservationDate < today) {
        return { ...reservation, status: 'cancelled' as const };
      }
      return { ...reservation, status: reservation.status as 'pending' | 'confirmed' | 'completed' | 'cancelled' };
    });

    // Сортируем брони: сначала ожидающие подтверждения, затем по дате (ближайшие вперед)
    return processed.sort((a, b) => {
      // Сначала сортируем по статусу (pending в начало)
      if (a.status === 'pending' && b.status !== 'pending') return -1;
      if (a.status !== 'pending' && b.status === 'pending') return 1;
      
      // Если оба pending или оба не pending, сортируем по дате
      const dateA = new Date(a.reservation_time);
      const dateB = new Date(b.reservation_time);
      return dateA.getTime() - dateB.getTime();
    });
  };

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

      try {
        setIsLoading(true);
        
        // Получаем данные с сервера с учетом фильтров
        const params: {status?: string, date?: string} = {};
        if (activeTab) params.status = activeTab;
        if (selectedDate) params.date = selectedDate;
        
        const data = await reservationsApi.getReservations(params);
        
        // Обрабатываем и сортируем полученные данные
        const processedData = processReservations(data);
        setReservations(processedData);
        
        setIsLoading(false);
      } catch (error) {
        console.error('Ошибка при загрузке бронирований:', error);
        
        // В случае ошибки, используем демо-данные для отображения интерфейса
        const demoData = [
          {
            id: 101,
            user_id: 1,
            user: { full_name: 'Иванов Иван' },
            guest_name: 'Иванов Иван',
            guest_phone: '+7 (999) 123-45-67',
            table_number: 5,
            guests_count: 4,
            reservation_time: '2023-04-10T19:00:00',
            status: 'confirmed',
            comment: 'Празднование дня рождения',
            created_at: '2023-04-01T15:30:00',
          },
          // Другие демо-бронирования могут быть добавлены здесь
        ];
        
        setReservations(processReservations(demoData));
        setIsLoading(false);
      }
    };

    checkAdmin();
    
    // Автоматическое обновление данных каждые 30 секунд
    const refreshInterval = setInterval(refreshData, 30000);
    
    return () => {
      clearInterval(refreshInterval);
    };
  }, [isAuthenticated, user, router, activeTab, selectedDate, lastRefresh]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
            <ClockIcon className="h-3 w-3 mr-1" />
            Ожидает подтверждения
          </span>
        );
      case 'confirmed':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
            <CheckCircleIcon className="h-3 w-3 mr-1" />
            Подтверждено
          </span>
        );
      case 'completed':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
            <CheckCircleIcon className="h-3 w-3 mr-1" />
            Завершено
          </span>
        );
      case 'cancelled':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
            <XCircleIcon className="h-3 w-3 mr-1" />
            Отменено
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
            {status}
          </span>
        );
    }
  };

  const formatDateTime = (dateTimeString: string | null | undefined) => {
    if (!dateTimeString) return '—';
    
    // Создаем объект Date и проверяем его валидность
    const date = new Date(dateTimeString);
    if (isNaN(date.getTime())) return '—';
    
    return new Intl.DateTimeFormat('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSelectedDate(value || null);
  };
  
  const handleResetFilters = () => {
    setActiveTab(null);
    setSelectedDate(null);
  };

  const handleUpdateStatus = async (id: number, newStatus: string) => {
    try {
      // Обновляем статус через API
      await reservationsApi.updateReservationStatus(id, newStatus);
      
      // Обновляем состояние в UI
      setReservations(reservations.map(res => 
        res.id === id ? { ...res, status: newStatus as any } : res
      ));
    } catch (error) {
      console.error('Ошибка при обновлении статуса бронирования:', error);
      alert('Не удалось обновить статус бронирования. Попробуйте позже.');
    }
  };

  // Применяем фильтры к списку бронирований
  const filteredReservations = reservations.filter(reservation => {
    // Фильтрация по статусу, если выбран статус
    if (activeTab && reservation.status !== activeTab) {
      return false;
    }
    
    // Фильтрация по дате, если выбрана дата
    if (selectedDate) {
      const reservationDate = new Date(reservation.reservation_time);
      const filterDate = new Date(selectedDate);
      if (
        reservationDate.getFullYear() !== filterDate.getFullYear() ||
        reservationDate.getMonth() !== filterDate.getMonth() ||
        reservationDate.getDate() !== filterDate.getDate()
      ) {
        return false;
      }
    }
    
    return true;
  });

  if (isLoading) {
    return (
      <Layout title="Управление бронированиями | Админ-панель">
        <div className="container mx-auto px-4 py-8">
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="Управление бронированиями | Админ-панель">
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center mb-6">
          <Link href="/admin" className="text-gray-600 hover:text-primary mr-4">
            <ArrowLeftIcon className="h-5 w-5" />
          </Link>
          <h1 className="text-3xl font-bold">Управление бронированиями</h1>
        </div>

        {/* Кнопка фильтров */}
        <div className="mb-4">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center px-4 py-2 bg-white shadow rounded-md text-gray-700 hover:bg-gray-50"
          >
            <FilterIcon className="h-5 w-5 mr-2" />
            {showFilters ? 'Скрыть фильтры' : 'Показать фильтры'}
          </button>
        </div>

        {/* Фильтры */}
        {showFilters && (
          <div className="mb-8">
            <div className="flex flex-col md:flex-row md:items-center gap-4 bg-white p-4 rounded-lg shadow-md">
              {/* Статус бронирования */}
              <div className="flex-1">
                <h3 className="text-sm font-medium text-gray-700 mb-2">Статус бронирования</h3>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setActiveTab('pending')}
                    className={`px-4 py-2 rounded-md text-sm font-medium ${
                      activeTab === 'pending' 
                        ? 'bg-primary text-white' 
                        : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                    }`}
                  >
                    Ожидают
                  </button>
                  <button
                    onClick={() => setActiveTab('confirmed')}
                    className={`px-4 py-2 rounded-md text-sm font-medium ${
                      activeTab === 'confirmed' 
                        ? 'bg-primary text-white' 
                        : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                    }`}
                  >
                    Подтверждены
                  </button>
                  <button
                    onClick={() => setActiveTab('completed')}
                    className={`px-4 py-2 rounded-md text-sm font-medium ${
                      activeTab === 'completed' 
                        ? 'bg-primary text-white' 
                        : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                    }`}
                  >
                    Завершены
                  </button>
                  <button
                    onClick={() => setActiveTab('cancelled')}
                    className={`px-4 py-2 rounded-md text-sm font-medium ${
                      activeTab === 'cancelled' 
                        ? 'bg-primary text-white' 
                        : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                    }`}
                  >
                    Отменены
                  </button>
                </div>
              </div>

              {/* Выбор даты */}
              <div className="md:w-64">
                <label htmlFor="date" className="block text-sm font-medium text-gray-700 mb-2">Дата бронирования</label>
                <div className="relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <CalendarIcon className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type="date"
                    id="date"
                    name="date"
                    value={selectedDate || ''}
                    onChange={handleDateChange}
                    className="focus:ring-primary focus:border-primary block w-full pl-10 sm:text-sm border-gray-300 rounded-md"
                  />
                </div>
              </div>
              
              {/* Кнопка сброса фильтров */}
              <div className="flex items-end">
                <button
                  onClick={handleResetFilters}
                  className="px-4 py-2 bg-gray-200 rounded-md text-gray-700 hover:bg-gray-300"
                >
                  Сбросить фильтры
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Индикатор активных фильтров */}
        {(activeTab || selectedDate) && (
          <div className="flex items-center mb-4 text-sm text-gray-600">
            <span>Активные фильтры:</span>
            {activeTab && (
              <span className="ml-2 px-2 py-1 bg-gray-100 rounded-md">
                {activeTab === 'pending' && 'Ожидают подтверждения'}
                {activeTab === 'confirmed' && 'Подтверждены'}
                {activeTab === 'completed' && 'Завершены'}
                {activeTab === 'cancelled' && 'Отменены'}
              </span>
            )}
            {selectedDate && (
              <span className="ml-2 px-2 py-1 bg-gray-100 rounded-md">
                Дата: {new Date(selectedDate).toLocaleDateString('ru-RU')}
              </span>
            )}
            <button 
              onClick={handleResetFilters}
              className="ml-2 text-primary hover:text-primary-dark"
            >
              Сбросить
            </button>
          </div>
        )}

        {/* Список бронирований */}
        {filteredReservations.length === 0 ? (
          <div className="bg-white rounded-lg shadow-md p-8 text-center">
            <div className="flex justify-center mb-4">
              <CalendarIcon className="h-16 w-16 text-gray-400" />
            </div>
            <h2 className="text-2xl font-medium mb-4">Нет бронирований</h2>
            <p className="text-gray-600 mb-6">
              {activeTab || selectedDate
                ? 'По выбранным фильтрам не найдено ни одного бронирования'
                : 'В системе пока нет ни одного бронирования'}
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      № брони
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Дата и время
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Гость
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Столик
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Гости
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Статус
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Действия
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredReservations.map((reservation) => (
                    <tr key={reservation.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">#{reservation.id}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{formatDateTime(reservation.reservation_time)}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm font-medium text-gray-900">{reservation.guest_name}</div>
                        <div className="text-sm text-gray-500 flex items-center">
                          <PhoneIcon className="h-3 w-3 mr-1" />
                          {reservation.guest_phone}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">№{reservation.table_number}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900 flex items-center">
                          <UserGroupIcon className="h-4 w-4 mr-1" />
                          {reservation.guests_count}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {getStatusBadge(reservation.status)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex space-x-2">
                          {reservation.status === 'pending' && (
                            <>
                              <button 
                                onClick={() => handleUpdateStatus(reservation.id, 'confirmed')}
                                className="px-3 py-1 bg-green-500 text-white text-xs rounded hover:bg-green-600"
                              >
                                Подтвердить
                              </button>
                              <button 
                                onClick={() => handleUpdateStatus(reservation.id, 'cancelled')}
                                className="px-3 py-1 bg-red-500 text-white text-xs rounded hover:bg-red-600"
                              >
                                Отменить
                              </button>
                            </>
                          )}
                          {reservation.status === 'confirmed' && (
                            <button 
                              onClick={() => handleUpdateStatus(reservation.id, 'completed')}
                              className="px-3 py-1 bg-blue-500 text-white text-xs rounded hover:bg-blue-600"
                            >
                              Завершить
                            </button>
                          )}
                          <button
                            onClick={() => router.push(`/admin/reservations/${reservation.id}`)}
                            className="px-3 py-1 bg-gray-200 text-gray-700 text-xs rounded hover:bg-gray-300"
                          >
                            Детали
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default AdminReservationsPage; 