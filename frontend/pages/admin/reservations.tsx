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
import { reservationsApi } from '../../lib/api/reservations-api';

// Интерфейс для типа бронирования
interface Reservation {
  id: number;
  user_id: number;
  user?: { full_name: string };
  guest_name: string;
  guest_phone: string;
  table_number?: number;
  guests_count: number;
  reservation_time: string;
  status: string;
  comment?: string;
  comments?: string;  // Добавляем поле comments для совместимости с типом из types/index.ts
  created_at: string;
}

const AdminReservationsPage: NextPage = () => {
  const router = useRouter();
  const { user, isAuthenticated, fetchUserProfile } = useAuthStore();
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<number>(Date.now());
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [fetchWarning, setFetchWarning] = useState<string | null>(null);
  const [fetchStatus, setFetchStatus] = useState<string | null>(null);
  const [isStatusUpdating, setIsStatusUpdating] = useState<Record<string, boolean>>({});
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [confirmationAction, setConfirmationAction] = useState<{ message: string; onConfirm: () => Promise<void> } | null>(null);

  // Функция для принудительного обновления данных
  const refreshData = () => {
    console.log('AdminReservations: Принудительное обновление данных');
    setLastRefresh(Date.now());
  };

  // Обработка истекших бронирований и сортировка
  const processReservations = (data: Reservation[]): Reservation[] => {
    if (!Array.isArray(data)) {
      console.error('AdminReservations: Полученные данные не являются массивом', data);
      return [];
    }
    
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // Обрабатываем истекшие брони
    const processed = data.map(reservation => {
      // Проверка на корректность даты
      if (!reservation.reservation_time) {
        return reservation;
      }
      
      const reservationDate = new Date(reservation.reservation_time);
      if (reservation.status === 'pending' && reservationDate < today) {
        return { ...reservation, status: 'cancelled' as const };
      }
      return reservation;
    });

    // Сортируем брони: сначала ожидающие, затем по дате
    return processed.sort((a, b) => {
      // Сначала сортируем по статусу (pending в начало)
      if (a.status === 'pending' && b.status !== 'pending') return -1;
      if (a.status !== 'pending' && b.status === 'pending') return 1;
      
      // Если оба pending или оба не pending, сортируем по дате
      const dateA = new Date(a.reservation_time || 0);
      const dateB = new Date(b.reservation_time || 0);
      return dateA.getTime() - dateB.getTime();
    });
  };

  // Загрузка бронирований
  const loadReservations = async () => {
    setIsLoading(true);
    setFetchError(null);
    setFetchWarning(null);
    setFetchStatus('Загрузка данных...');
    
    try {
      // Формируем параметры запроса
      const params: { status?: string; date?: string } = {};
      if (activeTab) {
        params.status = activeTab;
      }
      if (selectedDate) {
        params.date = selectedDate;
      }
      
      console.log('AdminReservations: Запрос бронирований с параметрами:', params);
      
      // Запрашиваем данные с использованием обновленного API
      // Всегда используем принудительное обновление для админа
      const forceRefresh = true;
      const data = await reservationsApi.getReservations(forceRefresh);
      
      // Фильтруем данные после получения
      let filteredData = [...data];
      if (params.status) {
        filteredData = filteredData.filter(r => r.status === params.status);
      }
      if (params.date) {
        filteredData = filteredData.filter(r => {
          if (r.reservation_time) {
            return r.reservation_time.startsWith(params.date!);
          }
          return false;
        });
      }
      
      if (!filteredData || !Array.isArray(filteredData)) {
        console.error('AdminReservations: Получены некорректные данные:', filteredData);
        setFetchWarning('Получены некорректные данные от сервера');
        setReservations([]);
      } else {
        // Обрабатываем и сортируем полученные данные
        const processedData = processReservations(filteredData);
        setReservations(processedData);
        console.log(`AdminReservations: Успешно загружено ${processedData.length} бронирований`);
        setFetchStatus(`Загружено ${processedData.length} бронирований`);
      }
    } catch (error) {
      console.error('AdminReservations: Ошибка при загрузке бронирований:', error);
      setFetchError('Ошибка при загрузке бронирований');
    } finally {
      setIsLoading(false);
    }
  };

  // Проверка прав администратора
  useEffect(() => {
    const checkAdmin = async () => {
      try {
        if (!isAuthenticated) {
          console.log('AdminReservations: Пользователь не авторизован, перенаправляем на страницу входа');
          router.push('/auth/login');
          return;
        }
        
        // Проверяем доступ только если пользователь авторизован
        if (isAuthenticated) {
          // Загружаем профиль, если его нет
          if (!user) {
            console.log('AdminReservations: Загружаем профиль пользователя');
            await fetchUserProfile();
          }
          
          // Проверяем права администратора
          if (user && user.role !== 'admin') {
            console.log(`AdminReservations: Доступ запрещен для роли ${user.role}`);
            router.push('/');
          }
        }
      } catch (error) {
        console.error('AdminReservations: Ошибка при проверке прав админа:', error);
      }
    };
    
    checkAdmin();
  }, [isAuthenticated, user, router, fetchUserProfile]);

  // Загрузка данных при изменении параметров
  useEffect(() => {
    // Проверяем, что мы находимся на странице администрирования бронирований
    const isAdminReservationsPage = window.location.pathname.includes('/admin/reservations');
    
    if (isAuthenticated && (user?.role === 'admin') && isAdminReservationsPage) {
      loadReservations();
    }
  }, [isAuthenticated, user, lastRefresh, activeTab, selectedDate]);

  // Форматирование даты и времени
  const formatDateTime = (dateTimeString: string | null | undefined) => {
    if (!dateTimeString) return 'Не указано';
    
    try {
      const date = new Date(dateTimeString);
      const formattedDate = date.toLocaleDateString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });
      
      const formattedTime = date.toLocaleTimeString('ru-RU', {
        hour: '2-digit',
        minute: '2-digit'
      });
      
      return `${formattedDate} в ${formattedTime}`;
    } catch (e) {
      return dateTimeString;
    }
  };

  // Обработчик изменения даты фильтра
  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSelectedDate(e.target.value);
  };

  // Сброс фильтров
  const handleResetFilters = () => {
    setActiveTab(null);
    setSelectedDate(null);
    setShowFilters(false);
  };

  // Обновление статуса бронирования
  const handleUpdateStatus = async (id: number, newStatus: string) => {
    // Проверяем, не обновляется ли уже статус
    if (isStatusUpdating[id.toString()]) return;
    
    // Обновляем состояние для отображения индикации загрузки
    setIsStatusUpdating(prev => ({ ...prev, [id.toString()]: true }));
    
    try {
      const success = await reservationsApi.updateReservationStatus(id, newStatus);
      
      if (success) {
        // Обновляем локальное состояние
        setReservations(prev => 
          prev.map(r => r.id === id ? { ...r, status: newStatus as any } : r)
        );
      } else {
        alert(`Ошибка при обновлении статуса бронирования #${id}`);
      }
    } catch (error) {
      console.error(`AdminReservations: Ошибка при обновлении статуса бронирования #${id}:`, error);
      alert(`Ошибка при обновлении статуса: ${error}`);
    } finally {
      // Снимаем индикацию загрузки
      setIsStatusUpdating(prev => ({ ...prev, [id.toString()]: false }));
    }
  };

  // Обработчик удаления бронирования
  const handleDelete = async (id: number) => {
    // Создаем функцию, которая будет запускаться при подтверждении
    const confirmDelete = async () => {
      try {
        const success = await reservationsApi.deleteReservation(id);
        
        if (success) {
          // Если удаление успешное, обновляем список бронирований
          setReservations(prev => prev.filter(r => r.id !== id));
        } else {
          throw new Error('Не удалось удалить бронирование');
        }
      } catch (error) {
        console.error(`AdminReservations: Ошибка при удалении бронирования #${id}:`, error);
        alert(`Ошибка при удалении бронирования: ${error}`);
      } finally {
        setShowConfirmation(false);
      }
    };
    
    // Показываем диалог подтверждения
    setConfirmationAction({
      message: 'Вы действительно хотите удалить это бронирование?',
      onConfirm: confirmDelete
    });
    setShowConfirmation(true);
  };

  // Диалог подтверждения действия
  const ConfirmationDialog = () => (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-lg shadow-xl max-w-md w-full">
        <h3 className="text-lg font-semibold mb-4">Подтверждение</h3>
        <p className="mb-6">{confirmationAction?.message}</p>
        <div className="flex justify-end space-x-3">
          <button 
            onClick={() => setShowConfirmation(false)}
            className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
          >
            Отмена
          </button>
          <button 
            onClick={() => confirmationAction?.onConfirm()}
            className="px-4 py-2 bg-red-600 rounded-md text-white hover:bg-red-700"
          >
            Подтвердить
          </button>
        </div>
      </div>
    </div>
  );

  // Получение стиля и иконки для отображения статуса
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return {
          className: 'bg-yellow-100 text-yellow-800',
          icon: <ClockIcon className="h-4 w-4 inline mr-1" />,
          text: 'Ожидает подтверждения'
        };
      case 'confirmed':
        return {
          className: 'bg-green-100 text-green-800',
          icon: <CheckCircleIcon className="h-4 w-4 inline mr-1" />,
          text: 'Подтверждено'
        };
      case 'completed':
        return {
          className: 'bg-blue-100 text-blue-800',
          icon: <CheckCircleIcon className="h-4 w-4 inline mr-1" />,
          text: 'Завершено'
        };
      case 'cancelled':
        return {
          className: 'bg-red-100 text-red-800',
          icon: <XCircleIcon className="h-4 w-4 inline mr-1" />,
          text: 'Отменено'
        };
      default:
        return {
          className: 'bg-gray-100 text-gray-800',
          icon: <ClockIcon className="h-4 w-4 inline mr-1" />,
          text: 'Неизвестный статус'
        };
    }
  };

  // Отображение карточки бронирования
  const ReservationCard = ({ reservation }: { reservation: Reservation }) => {
    const { id, guest_name, guest_phone, table_number, guests_count, reservation_time, status, comment } = reservation;
    const statusInfo = getStatusBadge(status);
    const isUpdating = isStatusUpdating[id.toString()];
    
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 mb-4">
        <div className="flex justify-between items-start">
          <div>
            <h3 className="text-lg font-bold dark:text-white">Стол #{table_number}</h3>
            <p className="text-sm text-gray-500">ID: {id}</p>
          </div>
          <span className={`px-2 py-1 rounded-full text-xs ${statusInfo.className}`}>
            {statusInfo.icon} {statusInfo.text}
          </span>
        </div>
        
        <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2">
          <div className="flex items-center">
            <UserIcon className="h-4 w-4 text-gray-500 mr-2" />
            <span>{guest_name || 'Не указано'}</span>
          </div>
          <div className="flex items-center">
            <PhoneIcon className="h-4 w-4 text-gray-500 mr-2" />
            <span>{guest_phone || 'Телефон не указан'}</span>
          </div>
          <div className="flex items-center">
            <CalendarIcon className="h-4 w-4 text-gray-500 mr-2" />
            <span>{formatDateTime(reservation_time)}</span>
          </div>
          <div className="flex items-center">
            <UserGroupIcon className="h-4 w-4 text-gray-500 mr-2" />
            <span>{guests_count} {guests_count === 1 ? 'гость' : guests_count <= 4 ? 'гостя' : 'гостей'}</span>
          </div>
        </div>
        
        {comment && (
          <div className="mt-3 p-2 bg-gray-50 rounded">
            <p className="text-sm text-gray-700">{comment}</p>
          </div>
        )}
        
        <div className="mt-4 flex flex-wrap gap-2">
          {/* Кнопки управления статусом */}
          {status === 'pending' && (
            <button
              onClick={() => handleUpdateStatus(id, 'confirmed')}
              disabled={isUpdating}
              className={`px-3 py-1 text-sm rounded-md bg-green-600 text-white hover:bg-green-700 
                ${isUpdating ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {isUpdating ? 'Подтверждение...' : 'Подтвердить'}
            </button>
          )}
          
          {status === 'confirmed' && (
            <button
              onClick={() => handleUpdateStatus(id, 'completed')}
              disabled={isUpdating}
              className={`px-3 py-1 text-sm rounded-md bg-blue-600 text-white hover:bg-blue-700
                ${isUpdating ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {isUpdating ? 'Завершение...' : 'Завершить'}
            </button>
          )}
          
          {(status === 'pending' || status === 'confirmed') && (
            <button
              onClick={() => handleUpdateStatus(id, 'cancelled')}
              disabled={isUpdating}
              className={`px-3 py-1 text-sm rounded-md bg-red-100 text-red-800 hover:bg-red-200
                ${isUpdating ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {isUpdating ? 'Отмена...' : 'Отменить'}
            </button>
          )}
          
          <button
            onClick={() => handleDelete(id)}
            disabled={isUpdating}
            className="px-3 py-1 text-sm rounded-md bg-gray-100 text-gray-700 hover:bg-gray-200 ml-auto"
          >
            Удалить
          </button>
        </div>
      </div>
    );
  };

  // Получение вкладок для фильтрации
  const tabs = [
    { id: null, name: 'Все' },
    { id: 'pending', name: 'Ожидающие' },
    { id: 'confirmed', name: 'Подтвержденные' },
    { id: 'completed', name: 'Завершенные' },
    { id: 'cancelled', name: 'Отмененные' }
  ];

  return (
    <Layout title="Управление бронированиями">
      <div className="container mx-auto px-4 py-8 dark:bg-gray-900 min-h-screen">
        <div className="flex items-center mb-6">
          <Link href="/admin" className="flex items-center text-blue-600 hover:text-blue-800">
            <ArrowLeftIcon className="h-5 w-5 mr-1" />
            <span>Назад</span>
          </Link>
          <h1 className="text-2xl font-bold ml-4 dark:text-white">Управление бронированиями</h1>
          
          <div className="ml-auto flex space-x-2">
            <button 
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center px-3 py-2 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            >
              <FilterIcon className="h-5 w-5 mr-1 text-gray-600 dark:text-white dark:bg-gray-800" />
              <span>Фильтры</span>
            </button>
            
            <button 
              onClick={refreshData} 
              className="flex items-center px-3 py-2 bg-white border border-gray-300 rounded-md hover:bg-gray-50 dark:bg-gray-800 dark:text-white dark:hover:bg-gray-700"
              disabled={isLoading}
            >
              <ArrowPathIcon className={`h-5 w-5 mr-1 text-gray-600 ${isLoading ? 'animate-spin' : ''}`} />
              <span>{isLoading ? 'Загрузка...' : 'Обновить'}</span>
            </button>
          </div>
        </div>
        
        {/* Панель фильтров */}
        {showFilters && (
          <div className="bg-white dark:bg-gray-800 p-4 mb-6 rounded-lg shadow-md">
            <div className="flex flex-col space-y-4 sm:flex-row sm:space-y-0 sm:space-x-4">
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">Дата бронирования</label>
                <input 
                  type="date" 
                  value={selectedDate || ''} 
                  onChange={handleDateChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              
              <div className="self-end">
                <button 
                  onClick={handleResetFilters}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
                >
                  Сбросить
                </button>
              </div>
            </div>
          </div>
        )}
        
        {/* Статус загрузки и ошибки */}
        {(fetchStatus || fetchWarning || fetchError) && (
          <div className={`p-3 mb-4 rounded-md ${
            fetchError ? 'bg-red-100 text-red-800' : 
            fetchWarning ? 'bg-yellow-100 text-yellow-800' : 
            'bg-blue-100 text-blue-800'
          }`}>
            {fetchError || fetchWarning || fetchStatus}
          </div>
        )}
        
        {/* Вкладки для фильтрации статуса */}
        <div className="border-b border-gray-200 mb-6">
          <nav className="-mb-px flex space-x-6 overflow-x-auto">
            {tabs.map(tab => (
              <button
                key={tab.id || 'all'}
                onClick={() => setActiveTab(tab.id)}
                className={`py-2 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
                  activeTab === tab.id 
                    ? 'border-blue-500 text-blue-600' 
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab.name}
              </button>
            ))}
          </nav>
        </div>
        
        {/* Список бронирований */}
        {isLoading ? (
          <div className="flex justify-center items-center py-12">
            <ArrowPathIcon className="animate-spin h-8 w-8 text-blue-500" />
            <span className="ml-2 text-lg text-gray-700">Загрузка бронирований...</span>
          </div>
        ) : reservations.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {reservations.map(reservation => (
              <ReservationCard key={reservation.id} reservation={reservation} />
            ))}
          </div>
        ) : (
          <div className="text-center py-12 bg-gray-50 rounded-lg">
            <p className="text-lg text-gray-600">Бронирования не найдены</p>
            <p className="text-sm text-gray-500 mt-2">Попробуйте изменить параметры фильтрации или обновите страницу</p>
          </div>
        )}
      </div>
      
      {/* Диалог подтверждения */}
      {showConfirmation && <ConfirmationDialog />}
    </Layout>
  );
};

export default AdminReservationsPage; 