import { useState, useEffect } from 'react';
import { NextPage } from 'next';
import { useRouter } from 'next/router';
import Link from 'next/link';
import Layout from '../../components/Layout';
import useAuthStore from '../../lib/auth-store';
import useReservationsStore from '../../lib/reservations-store';
import { 
  CalendarIcon, 
  ClockIcon, 
  UserGroupIcon, 
  PhoneIcon,
  EnvelopeIcon as MailIcon,
  CheckCircleIcon,
  XCircleIcon,
  KeyIcon,
  ChevronLeftIcon,
  MapPinIcon as LocationMarkerIcon
} from '@heroicons/react/24/outline';
import { format } from 'date-fns';

const ReservationDetailPage: NextPage = () => {
  const router = useRouter();
  const { id } = router.query;
  const { isAuthenticated, user } = useAuthStore();
  const { reservations, getReservations, isLoading, error } = useReservationsStore();
  const [reservation, setReservation] = useState<any>(null);
  const [reservationCode, setReservationCode] = useState<string | null>(null);

  useEffect(() => {
    // Проверка авторизации
    if (!isAuthenticated) {
      router.push('/auth/login?redirect=' + router.asPath);
      return;
    }

    const fetchData = async () => {
      try {
        // Загружаем бронирования, если их еще нет
        if (reservations.length === 0) {
          await getReservations();
        }
        
        // Находим нужное бронирование по id
        if (id && typeof id === 'string') {
          const reservationId = parseInt(id, 10);
          const foundReservation = reservations.find(r => r.id === reservationId);
          
          if (foundReservation) {
            setReservation(foundReservation);
            
            // Получаем код бронирования из localStorage
            const storedCodes = JSON.parse(localStorage.getItem('reservationCodes') || '{}');
            for (const [code, resId] of Object.entries(storedCodes)) {
              if (resId === reservationId) {
                setReservationCode(code);
                break;
              }
            }
          }
        }
      } catch (err) {
        console.error('Ошибка при загрузке данных бронирования:', err);
      }
    };

    fetchData();
  }, [isAuthenticated, router, id, getReservations, reservations]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-yellow-100 text-yellow-800">
            <ClockIcon className="h-4 w-4 mr-1" />
            Ожидает подтверждения
          </span>
        );
      case 'confirmed':
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
            <CheckCircleIcon className="h-4 w-4 mr-1" />
            Подтверждено
          </span>
        );
      case 'cancelled':
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-800">
            <XCircleIcon className="h-4 w-4 mr-1" />
            Отменено
          </span>
        );
      case 'completed':
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-800">
            <CheckCircleIcon className="h-4 w-4 mr-1" />
            Завершено
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-800">
            {status}
          </span>
        );
    }
  };

  const formatDateTime = (date: string, time: string) => {
    if (!date || !time) return '';
    
    try {
      const dateObj = new Date(`${date}T${time}`);
      return format(dateObj, 'dd.MM.yyyy HH:mm');
    } catch (error) {
      console.error('Ошибка форматирования даты:', error);
      return `${date} ${time}`;
    }
  };

  if (isLoading) {
    return (
      <Layout title="Загрузка бронирования">
        <div className="container mx-auto px-4 py-8">
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
          </div>
        </div>
      </Layout>
    );
  }

  if (error) {
    return (
      <Layout title="Ошибка">
        <div className="container mx-auto px-4 py-8">
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
          <Link href="/reservations" className="text-primary hover:underline flex items-center">
            <ChevronLeftIcon className="h-5 w-5 mr-1" />
            Вернуться к бронированиям
          </Link>
        </div>
      </Layout>
    );
  }

  if (!reservation) {
    return (
      <Layout title="Бронирование не найдено">
        <div className="container mx-auto px-4 py-8">
          <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded mb-4">
            Бронирование не найдено или у вас нет прав доступа к нему
          </div>
          <Link href="/reservations" className="text-primary hover:underline flex items-center">
            <ChevronLeftIcon className="h-5 w-5 mr-1" />
            Вернуться к бронированиям
          </Link>
        </div>
      </Layout>
    );
  }

  return (
    <Layout title={`Бронирование №${reservation.id}`}>
      <div className="container mx-auto px-4 py-8">
        <Link href="/reservations" className="text-primary hover:underline flex items-center mb-6">
          <ChevronLeftIcon className="h-5 w-5 mr-1" />
          Вернуться к бронированиям
        </Link>

        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          <div className="px-6 py-4 bg-gradient-to-r from-primary to-primary-dark text-white">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center">
              <h1 className="text-xl font-bold">Бронирование #{reservation.id}</h1>
              <div className="mt-2 md:mt-0">{getStatusBadge(reservation.status)}</div>
            </div>
          </div>

          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div className="bg-gray-50 p-4 rounded-lg">
                <h2 className="text-lg font-semibold mb-4 flex items-center">
                  <CalendarIcon className="h-5 w-5 text-primary mr-2" />
                  Детали бронирования
                </h2>
                <ul className="space-y-3">
                  <li className="flex items-start">
                    <ClockIcon className="h-5 w-5 text-gray-500 mr-2 mt-0.5" />
                    <div>
                      <span className="text-sm text-gray-500 block">Дата и время</span>
                      <span className="font-medium">
                        {formatDateTime(reservation.reservation_date, reservation.reservation_time)}
                      </span>
                    </div>
                  </li>
                  <li className="flex items-start">
                    <UserGroupIcon className="h-5 w-5 text-gray-500 mr-2 mt-0.5" />
                    <div>
                      <span className="text-sm text-gray-500 block">Количество гостей</span>
                      <span className="font-medium">{reservation.guests_count} чел.</span>
                    </div>
                  </li>
                  <li className="flex items-start">
                    <LocationMarkerIcon className="h-5 w-5 text-gray-500 mr-2 mt-0.5" />
                    <div>
                      <span className="text-sm text-gray-500 block">Стол</span>
                      <span className="font-medium">
                        {reservation.table ? reservation.table.name : (reservation.table_number ? `Столик №${reservation.table_number}` : 'Любой подходящий')}
                      </span>
                    </div>
                  </li>
                </ul>
              </div>

              <div className="bg-gray-50 p-4 rounded-lg">
                <h2 className="text-lg font-semibold mb-4 flex items-center">
                  <UserGroupIcon className="h-5 w-5 text-primary mr-2" />
                  Контактная информация
                </h2>
                <ul className="space-y-3">
                  <li className="flex items-start">
                    <UserGroupIcon className="h-5 w-5 text-gray-500 mr-2 mt-0.5" />
                    <div>
                      <span className="text-sm text-gray-500 block">Имя</span>
                      <span className="font-medium">{reservation.guest_name}</span>
                    </div>
                  </li>
                  <li className="flex items-start">
                    <PhoneIcon className="h-5 w-5 text-gray-500 mr-2 mt-0.5" />
                    <div>
                      <span className="text-sm text-gray-500 block">Телефон</span>
                      <span className="font-medium">{reservation.guest_phone}</span>
                    </div>
                  </li>
                  {reservation.guest_email && (
                    <li className="flex items-start">
                      <MailIcon className="h-5 w-5 text-gray-500 mr-2 mt-0.5" />
                      <div>
                        <span className="text-sm text-gray-500 block">Email</span>
                        <span className="font-medium">{reservation.guest_email}</span>
                      </div>
                    </li>
                  )}
                </ul>
              </div>
            </div>

            {reservationCode && reservation.status === 'confirmed' && (
              <div className="mb-6 p-5 bg-green-50 rounded-lg border border-green-200">
                <h2 className="text-lg font-semibold mb-3 text-green-800 flex items-center">
                  <KeyIcon className="h-5 w-5 mr-2" />
                  Код бронирования
                </h2>
                <div className="flex items-center justify-between mb-3 bg-white p-3 rounded-md border border-green-300">
                  <span className="font-mono text-xl font-bold tracking-wider text-green-800">{reservationCode}</span>
                  <button 
                    onClick={() => {
                      navigator.clipboard.writeText(reservationCode);
                      alert('Код бронирования скопирован в буфер обмена');
                    }}
                    className="px-3 py-1 bg-green-100 hover:bg-green-200 text-green-800 text-sm rounded"
                  >
                    Копировать
                  </button>
                </div>
                <p className="text-sm text-green-700">
                  Используйте этот код при оформлении заказа на странице корзины, 
                  если хотите заказать блюда заранее до вашего визита в ресторан.
                </p>
                <div className="mt-3">
                  <Link href="/cart" className="text-sm text-primary font-medium hover:underline flex items-center">
                    Перейти к оформлению заказа
                    <svg className="h-4 w-4 ml-1" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                    </svg>
                  </Link>
                </div>
              </div>
            )}

            {reservation.comments && (
              <div className="mb-6 bg-gray-50 p-4 rounded-lg">
                <h2 className="text-lg font-semibold mb-2">Комментарий</h2>
                <p className="text-gray-700">{reservation.comments}</p>
              </div>
            )}

            {reservation.status === 'pending' && (
              <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200 mb-6">
                <div className="flex items-start">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-yellow-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-yellow-800">Ожидает подтверждения</h3>
                    <div className="mt-2 text-sm text-yellow-700">
                      <p>
                        Ваше бронирование ожидает подтверждения администратором ресторана. 
                        После подтверждения вам будет доступен код бронирования для заказа блюд.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="flex justify-between items-center">
              <Link href="/reservations" className="text-primary hover:underline flex items-center">
                <ChevronLeftIcon className="h-5 w-5 mr-1" />
                Вернуться к бронированиям
              </Link>
              
              {reservation.status === 'pending' && (
                <button 
                  className="px-4 py-2 bg-red-100 hover:bg-red-200 text-red-700 rounded-md text-sm font-medium transition"
                >
                  Отменить бронирование
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default ReservationDetailPage; 