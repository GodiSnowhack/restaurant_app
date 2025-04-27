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
  ArrowPathIcon,
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
      setIsLoading(true);
      console.log(`Изменение статуса бронирования #${id} на "${newStatus}"`);
      
      await reservationsApi.updateReservationStatus(id, newStatus)
        .then(() => {
          // Обновляем статус брони в локальном массиве
          const updatedReservations = reservations.map(reservation => {
            if (reservation.id === id) {
              return { ...reservation, status: newStatus as 'pending' | 'confirmed' | 'completed' | 'cancelled' };
            }
            return reservation;
          });
          
          setReservations(updatedReservations);
          
          // Показываем уведомление об успешном обновлении
          alert(`Статус бронирования #${id} изменен на "${newStatus}"`);
        });
    } catch (error) {
      console.error(`Ошибка при обновлении статуса бронирования #${id}:`, error);
      alert(`Ошибка при изменении статуса бронирования #${id}. Попробуйте еще раз.`);
    } finally {
      setIsLoading(false);
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
      <Layout title="Управление бронированиями | Админ-панель" section="admin">
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-primary"></div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="Управление бронированиями | Админ-панель" section="admin">
      <div className="space-y-6">
        {/* Заголовок и навигация */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
          <div className="flex items-center">
            <Link href="/admin" className="mr-4 hover:bg-gray-100 p-2 rounded-full transition-colors">
              <ArrowLeftIcon className="h-5 w-5 text-gray-600" />
            </Link>
            <h1 className="text-2xl font-bold text-gray-900">Управление бронированиями</h1>
          </div>
          
          <button 
            onClick={refreshData} 
            className="flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-primary hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary shadow-sm transition-colors"
          >
            <ArrowPathIcon className="h-4 w-4 mr-2" />
            Обновить данные
          </button>
        </div>
        
        {/* Панель фильтров */}
        <div className="bg-white shadow-md rounded-lg overflow-hidden border border-gray-200">
          <div className="px-6 py-5">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-medium text-gray-900">Фильтры</h2>
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="text-sm text-primary hover:text-primary-dark font-medium"
              >
                {showFilters ? 'Скрыть фильтры' : 'Развернуть фильтры'}
              </button>
            </div>
            
            {/* Фильтры по статусу */}
            <div className="flex flex-wrap gap-2 mb-4">
              <button
                onClick={() => setActiveTab(null)}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  activeTab === null ? 'bg-primary text-white shadow-sm' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Все
              </button>
              <button
                onClick={() => setActiveTab('pending')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  activeTab === 'pending' ? 'bg-yellow-500 text-white shadow-sm' : 'bg-yellow-50 text-yellow-700 hover:bg-yellow-100'
                }`}
              >
                Ожидающие
              </button>
              <button
                onClick={() => setActiveTab('confirmed')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  activeTab === 'confirmed' ? 'bg-green-500 text-white shadow-sm' : 'bg-green-50 text-green-700 hover:bg-green-100'
                }`}
              >
                Подтвержденные
              </button>
              <button
                onClick={() => setActiveTab('completed')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  activeTab === 'completed' ? 'bg-blue-500 text-white shadow-sm' : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
                }`}
              >
                Завершенные
              </button>
              <button
                onClick={() => setActiveTab('cancelled')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  activeTab === 'cancelled' ? 'bg-red-500 text-white shadow-sm' : 'bg-red-50 text-red-700 hover:bg-red-100'
                }`}
              >
                Отмененные
              </button>
            </div>
            
            {/* Дополнительные фильтры */}
            {showFilters && (
              <div className="flex flex-col md:flex-row gap-4 items-start md:items-end pt-4 border-t border-gray-200">
                <div className="w-full md:w-auto">
                  <label htmlFor="date-filter" className="block text-sm font-medium text-gray-700 mb-1">
                    Выберите дату
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                      <CalendarIcon className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      type="date"
                      id="date-filter"
                      value={selectedDate || ''}
                      onChange={handleDateChange}
                      className="pl-10 shadow-sm focus:ring-primary focus:border-primary block w-full md:w-48 sm:text-sm border-gray-300 rounded-md"
                    />
                  </div>
                </div>
                
                <button
                  onClick={handleResetFilters}
                  className="mt-2 md:mt-0 inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary transition-colors"
                >
                  Сбросить все фильтры
                </button>
              </div>
            )}
          </div>
        </div>
        
        {/* Счётчик и информация о результатах */}
        {filteredReservations.length > 0 && (
          <div className="bg-gray-50 shadow-inner rounded-lg px-6 py-3 text-sm text-gray-700 border border-gray-200">
            <p>
              Найдено бронирований: <span className="font-medium">{filteredReservations.length}</span>
              {activeTab && (
                <span className="ml-2">
                  со статусом: <span className="font-medium capitalize">{activeTab}</span>
                </span>
              )}
              {selectedDate && (
                <span className="ml-2">
                  за дату: <span className="font-medium">{new Date(selectedDate).toLocaleDateString('ru-RU')}</span>
                </span>
              )}
            </p>
          </div>
        )}
        
        {/* Список бронирований */}
        {reservations.length === 0 ? (
          <div className="bg-white shadow-md rounded-lg overflow-hidden border border-gray-200">
            <div className="px-6 py-10 text-center">
              <CalendarIcon className="h-16 w-16 mx-auto text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Нет доступных бронирований</h3>
              <p className="text-gray-500 max-w-md mx-auto">
                В данный момент нет бронирований в системе. Когда клиенты начнут бронировать столики, они появятся здесь.
              </p>
            </div>
          </div>
        ) : filteredReservations.length === 0 ? (
          <div className="bg-white shadow-md rounded-lg overflow-hidden border border-gray-200">
            <div className="px-6 py-10 text-center">
              <FilterIcon className="h-16 w-16 mx-auto text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Нет результатов для текущих фильтров</h3>
              <p className="text-gray-500 max-w-md mx-auto">
                По выбранным фильтрам не найдено бронирований. Попробуйте изменить параметры фильтрации или сбросить фильтры.
              </p>
              <button
                onClick={handleResetFilters}
                className="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-primary hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
              >
                Сбросить фильтры
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredReservations.map((reservation) => (
              <div key={reservation.id} className="bg-white shadow-md rounded-lg overflow-hidden border border-gray-200 hover:shadow-lg transition-shadow duration-200">
                <div className={`px-4 py-3 flex justify-between items-center border-b ${
                  reservation.status === 'pending' ? 'bg-yellow-50 border-yellow-200' :
                  reservation.status === 'confirmed' ? 'bg-green-50 border-green-200' :
                  reservation.status === 'completed' ? 'bg-blue-50 border-blue-200' :
                  'bg-red-50 border-red-200'
                }`}>
                  <h3 className="text-base font-semibold text-gray-900">Бронирование #{reservation.id}</h3>
                  {getStatusBadge(reservation.status)}
                </div>
                
                <div className="px-4 py-4 border-b border-gray-200">
                  <div className="flex items-center text-sm text-gray-700 mb-2">
                    <CalendarIcon className="flex-shrink-0 mr-2 h-5 w-5 text-gray-500" />
                    <span className="font-medium">{formatDateTime(reservation.reservation_time)}</span>
                  </div>
                  
                  <div className="flex items-center text-sm text-gray-700 mb-2">
                    <UserIcon className="flex-shrink-0 mr-2 h-5 w-5 text-gray-500" />
                    <span>{reservation.guest_name || (reservation.user?.full_name || 'Гость')}</span>
                  </div>
                  
                  <div className="flex items-center text-sm text-gray-700 mb-2">
                    <PhoneIcon className="flex-shrink-0 mr-2 h-5 w-5 text-gray-500" />
                    <span>{reservation.guest_phone || 'Телефон не указан'}</span>
                  </div>
                  
                  <div className="flex items-center text-sm text-gray-700">
                    <UserGroupIcon className="flex-shrink-0 mr-2 h-5 w-5 text-gray-500" />
                    <span><strong>{reservation.guests_count}</strong> гостей, стол №<strong>{reservation.table_number || '—'}</strong></span>
                  </div>
                </div>
                
                {reservation.comment && (
                  <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
                    <p className="text-sm text-gray-700">
                      <span className="font-medium block mb-1">Комментарий:</span>
                      <span className="italic">{reservation.comment}</span>
                    </p>
                  </div>
                )}
                
                <div className="px-4 py-3 bg-gray-50">
                  <div className="flex flex-wrap gap-2 justify-center">
                    {reservation.status === 'pending' && (
                      <>
                        <button
                          onClick={() => handleUpdateStatus(reservation.id, 'confirmed')}
                          className="inline-flex items-center px-3 py-1.5 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-colors"
                        >
                          <CheckCircleIcon className="h-4 w-4 mr-1.5" />
                          Подтвердить
                        </button>
                        
                        <button
                          onClick={() => handleUpdateStatus(reservation.id, 'cancelled')}
                          className="inline-flex items-center px-3 py-1.5 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors"
                        >
                          <XCircleIcon className="h-4 w-4 mr-1.5" />
                          Отменить
                        </button>
                      </>
                    )}
                    
                    {reservation.status === 'confirmed' && (
                      <>
                        <button
                          onClick={() => handleUpdateStatus(reservation.id, 'completed')}
                          className="inline-flex items-center px-3 py-1.5 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
                        >
                          <CheckCircleIcon className="h-4 w-4 mr-1.5" />
                          Завершить
                        </button>
                        
                        <button
                          onClick={() => handleUpdateStatus(reservation.id, 'cancelled')}
                          className="inline-flex items-center px-3 py-1.5 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors"
                        >
                          <XCircleIcon className="h-4 w-4 mr-1.5" />
                          Отменить
                        </button>
                      </>
                    )}
                    
                    {(reservation.status === 'completed' || reservation.status === 'cancelled') && (
                      <button
                        onClick={() => handleUpdateStatus(reservation.id, 'confirmed')}
                        className="inline-flex items-center px-3 py-1.5 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary transition-colors"
                      >
                        <ArrowLeftIcon className="h-4 w-4 mr-1.5" />
                        Вернуть в подтвержденные
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        
        {/* Пагинация (если потребуется) */}
        {filteredReservations.length > 15 && (
          <div className="flex justify-center pt-6">
            <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
              <a href="#" className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50">
                <span className="sr-only">Предыдущая</span>
                <ArrowLeftIcon className="h-5 w-5" aria-hidden="true" />
              </a>
              <a href="#" className="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50">
                1
              </a>
              <a href="#" className="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-primary text-sm font-medium text-white">
                2
              </a>
              <a href="#" className="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50">
                3
              </a>
              <span className="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-700">
                ...
              </span>
              <a href="#" className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50">
                <span className="sr-only">Следующая</span>
                <ArrowLeftIcon className="h-5 w-5 transform rotate-180" aria-hidden="true" />
              </a>
            </nav>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default AdminReservationsPage; 