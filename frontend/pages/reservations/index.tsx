'use client';

import { useState, useEffect } from 'react';
import { NextPage } from 'next';
import { useRouter } from 'next/router';
import Link from 'next/link';
import Layout from '../../components/Layout';
import useAuthStore from '../../lib/auth-store';
import useReservationsStore from '../../lib/reservations-store';
import useSettingsStore from '../../lib/settings-store';
import AuthModal from '../../components/AuthModal';
import { Reservation } from '../../types';
import { 
  CalendarIcon, 
  ClockIcon, 
  UserGroupIcon, 
  PlusCircleIcon,
  CheckCircleIcon,
  XCircleIcon,
  KeyIcon
} from '@heroicons/react/24/outline';
import { format } from 'date-fns';
import FloorPlan, { RestaurantTable } from '../../components/FloorPlan';

// Генерируем время для выбора в выпадающем списке: от 11:00 до 22:00 с шагом 30 минут
const timeOptions = Array.from({ length: 23 }, (_, i) => {
  const hour = Math.floor(i / 2) + 11;
  const minute = (i % 2) * 30;
  return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
});

const ReservationsPage: NextPage = () => {
  const router = useRouter();
  const { isAuthenticated, user } = useAuthStore();
  const { createReservation, getReservations, reservations, isLoading } = useReservationsStore();
  const { settings, loadSettings, isLoading: isSettingsLoading } = useSettingsStore();
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    date: format(new Date(), 'yyyy-MM-dd'),
    time: '18:00',
    guests: 2,
    name: '',
    phone: '',
    email: '',
    tableId: 0,
    comments: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [error, setError] = useState('');
  const [reservationCode, setReservationCode] = useState<string | null>(null);
  const [showFloorPlan, setShowFloorPlan] = useState(false);
  const [selectedTable, setSelectedTable] = useState<number | null>(null);
  const [guestInfo, setGuestInfo] = useState({
    name: '',
    phone: '',
    email: ''
  });
  const [showAuthModal, setShowAuthModal] = useState(false);

  useEffect(() => {
    // Загружаем настройки ресторана, включая данные о столах
    loadSettings();
    
    // Если пользователь авторизован, загружаем его бронирования и данные профиля
    if (isAuthenticated) {
      const fetchReservations = async () => {
        try {
          // Загружаем бронирования через стор
          await getReservations();
          // Устанавливаем имя, телефон и email из профиля пользователя
          setFormData(prev => ({
            ...prev,
            name: user?.full_name || '',
            phone: user?.phone || '',
            email: user?.email || ''
          }));
          
          setGuestInfo({
            name: user?.full_name || '',
            phone: user?.phone || '',
            email: user?.email || ''
          });
          
          setSuccessMessage('');
          setError('');
        } catch (error: any) {
          console.error('Ошибка при загрузке бронирований:', error);
          setError(`Не удалось загрузить список бронирований: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`);
        }
      };

      fetchReservations();
    }
  }, [isAuthenticated, getReservations, user, loadSettings]);

  // Функция для проверки, может ли пользователь сделать новую бронь
  const canCreateNewReservation = () => {
    if (!isAuthenticated || !user || !reservations.length) return true;
    
    // Проверяем наличие неподтвержденных броней (со статусом 'pending')
    const pendingReservations = reservations.filter(res => res.status === 'pending');
    if (pendingReservations.length > 0) {
      return false;
    }
    
    // Проверяем время последней попытки бронирования
    // Сортируем бронирования по убыванию даты создания и берем самое новое
    const sortedReservations = [...reservations].sort((a, b) => {
      const dateA = new Date(a.created_at || 0);
      const dateB = new Date(b.created_at || 0);
      return dateB.getTime() - dateA.getTime();
    });
    
    if (sortedReservations.length > 0) {
      const lastReservation = sortedReservations[0];
      const lastReservationTime = new Date(lastReservation.created_at || 0);
      const currentTime = new Date();
      
      // Проверяем, прошло ли 10 минут (600000 миллисекунд) с момента последней брони
      const timeDifference = currentTime.getTime() - lastReservationTime.getTime();
      if (timeDifference < 600000) {
        return false;
      }
    }
    
    return true;
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    // Также обновляем гостевую информацию, если это соответствующие поля
    if (['name', 'phone', 'email'].includes(name)) {
      setGuestInfo(prev => ({
        ...prev,
        [name]: value
      }));
    }
  };

  const getAvailableTables = () => {
    const tables = settings.tables || [];
    return tables
      .filter(table => 
        table.is_active && 
        table.status !== 'occupied' && 
        table.capacity >= formData.guests
      )
      .sort((a, b) => a.capacity - b.capacity);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Проверяем авторизацию пользователя
    if (!isAuthenticated) {
      setShowAuthModal(true);
      return;
    }
    
    // Проверяем ограничения на создание брони
    if (!canCreateNewReservation()) {
      // Определяем тип ограничения и выводим соответствующее сообщение
      const pendingReservations = reservations.filter(res => res.status === 'pending');
      if (pendingReservations.length > 0) {
        setError('У вас уже есть ожидающая подтверждения бронь. Пожалуйста, дождитесь её подтверждения администратором прежде чем создавать новую.');
        return;
      } else {
        // Если нет ожидающих броней, значит не прошло 10 минут
        setError('Вы не можете создать новую бронь. Пожалуйста, подождите 10 минут с момента последней попытки бронирования.');
        return;
      }
    }
    
    if (!validateForm()) {
      return;
    }
    
    setIsSubmitting(true);
    
    if (!user || !user.id) {
      setError('Необходимо авторизоваться для создания бронирования');
      setIsSubmitting(false);
      return;
    }
    
    // Проверяем формат даты и времени
    if (!/^\d{4}-\d{2}-\d{2}$/.test(formData.date)) {
      setError('Дата должна быть в формате YYYY-MM-DD');
      setIsSubmitting(false);
      return;
    }
    
    if (!/^([0-1][0-9]|2[0-3]):([0-5][0-9])$/.test(formData.time)) {
      setError('Время должно быть в формате HH:MM');
      setIsSubmitting(false);
      return;
    }
    
    const reservationData = {
      reservation_date: formData.date,
      reservation_time: formData.time,
      guests_count: formData.guests,
      guest_name: guestInfo.name,
      guest_phone: guestInfo.phone,
      table_number: selectedTable || formData.tableId || null,
      comment: formData.comments,
      user_id: user.id,
      status: 'pending'
    };
    
    console.log("Отправляемые данные:", JSON.stringify(reservationData, null, 2));
    
    try {
      const result = await createReservation(reservationData);
      
      // Получаем код бронирования из результата
      if (result && result.reservation_code) {
        setReservationCode(result.reservation_code);
      }
      
      await getReservations();
      
      setFormData({
        date: format(new Date(), 'yyyy-MM-dd'),
        time: '18:00',
        guests: 2,
        name: user?.full_name || '',
        phone: user?.phone || '',
        email: user?.email || '',
        tableId: 0,
        comments: ''
      });
      
      setSuccessMessage('Ваша заявка на бронирование успешно отправлена! Мы свяжемся с вами для подтверждения.');
      setError('');
      setSelectedTable(null);
    } catch (err: any) {
      console.error('Ошибка при создании бронирования:', err);
      setError(`Не удалось создать бронирование: ${err.message || 'Неизвестная ошибка'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const validateForm = () => {
    let isValid = true;
    let errorMessage = '';
    
    // Проверка на заполнение обязательных полей
    if (!formData.date) {
      errorMessage = 'Пожалуйста, выберите дату бронирования';
      isValid = false;
    } else if (!formData.time) {
      errorMessage = 'Пожалуйста, выберите время бронирования';
      isValid = false;
    } else if (!formData.guests || formData.guests < 1) {
      errorMessage = 'Пожалуйста, укажите количество гостей';
      isValid = false;
    } else if (!formData.name) {
      errorMessage = 'Пожалуйста, укажите ваше имя';
      isValid = false;
    } else if (!formData.phone) {
      errorMessage = 'Пожалуйста, укажите номер телефона для связи';
      isValid = false;
    } else if (formData.guests > 0 && getAvailableTables().length === 0) {
      errorMessage = 'К сожалению, нет доступных столов для выбранного количества гостей';
      isValid = false;
    }
    
    // Проверка на будущую дату и время
    const reservationDate = new Date(`${formData.date}T${formData.time}:00`);
    const now = new Date();
    
    if (reservationDate <= now) {
      errorMessage = 'Пожалуйста, выберите дату и время в будущем';
      isValid = false;
    }
    
    // Проверка формата телефона (простая проверка)
    const phoneRegex = /^\+?[0-9\s\-\(\)]{10,20}$/;
    if (formData.phone && !phoneRegex.test(formData.phone)) {
      errorMessage = 'Пожалуйста, введите корректный номер телефона';
      isValid = false;
    }
    
    // Если есть ошибка, устанавливаем ее и возвращаем результат
    if (!isValid) {
      setError(errorMessage);
    } else {
      setError('');
    }
    
    return isValid;
  };

  const formatDateTime = (dateTimeString: string) => {
    const date = new Date(dateTimeString);
    return new Intl.DateTimeFormat('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

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
      case 'cancelled':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
            <XCircleIcon className="h-3 w-3 mr-1" />
            Отменено
          </span>
        );
      case 'completed':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
            <CheckCircleIcon className="h-3 w-3 mr-1" />
            Завершено
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

  const availableTables = getAvailableTables();

  // Функция для выбора стола на схеме зала
  const handleTableSelect = (tableId: number) => {
    setSelectedTable(tableId);
    // Также обновляем FormData
    setFormData(prev => ({
      ...prev,
      tableId
    }));
  };

  // Проверяем наличие таблиц и их инициализацию
  const tables = settings?.tables || [];

  if (isLoading || isSettingsLoading) {
    return (
      <Layout title="Бронирование столиков">
        <div className="container mx-auto px-4 py-8">
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="Бронирование столиков">
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">Бронирование столиков</h1>
          <button
            onClick={() => setShowForm(!showForm)}
            className={`${
              !showForm && !canCreateNewReservation() ? 'bg-gray-300 cursor-not-allowed' : showForm ? 'btn btn-secondary' : 'btn btn-primary'
            } flex items-center`}
            disabled={!showForm && !canCreateNewReservation()}
            title={!showForm && !canCreateNewReservation() ? 'Вы не можете создать новую бронь сейчас. Возможно, у вас уже есть ожидающая подтверждения бронь или вы недавно делали попытку бронирования.' : ''}
          >
            {showForm ? 'Отменить' : (
              <>
                <PlusCircleIcon className="h-5 w-5 mr-2" />
                Забронировать столик
              </>
            )}
          </button>
        </div>

        {!showForm && !canCreateNewReservation() && isAuthenticated && (
          <div className="rounded-md bg-red-50 p-4 mb-4">
            <div className="flex">
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">Ограничение на бронирование</h3>
                <div className="mt-2 text-sm text-red-700">
                  {reservations.filter(res => res.status === 'pending').length > 0 
                    ? 'У вас уже есть ожидающая подтверждения бронь. Пожалуйста, дождитесь её подтверждения администратором прежде чем создавать новую.'
                    : 'Пожалуйста, подождите 10 минут с момента последней попытки бронирования.'
                  }
                </div>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="rounded-md bg-red-50 p-4 mb-4">
            <div className="flex">
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">Ошибка</h3>
                <div className="mt-2 text-sm text-red-700 whitespace-pre-wrap">
                  {typeof error === 'string' ? error : JSON.stringify(error)}
                </div>
              </div>
            </div>
          </div>
        )}

        {showForm && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-8">
            <h2 className="text-xl font-semibold mb-4">Новое бронирование</h2>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label htmlFor="date" className="block text-sm font-medium text-gray-700">
                    Дата
                  </label>
                  <input
                    type="date"
                    id="date"
                    name="date"
                    min={format(new Date(), 'yyyy-MM-dd')}
                    value={formData.date}
                    onChange={handleInputChange}
                    required
                    className="mt-1 focus:ring-primary focus:border-primary block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
                  />
                </div>

                <div>
                  <label htmlFor="time" className="block text-sm font-medium text-gray-700">
                    Время
                  </label>
                  <select
                    id="time"
                    name="time"
                    value={formData.time}
                    onChange={handleInputChange}
                    required
                    className="mt-1 block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary sm:text-sm"
                  >
                    {timeOptions.map((time) => (
                      <option key={time} value={time}>
                        {time}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="guests" className="block text-sm font-medium text-gray-700">
                    Количество гостей
                  </label>
                  <select
                    id="guests"
                    name="guests"
                    value={formData.guests}
                    onChange={handleInputChange}
                    required
                    className="mt-1 block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary sm:text-sm"
                  >
                    {Array.from({ length: 20 }, (_, i) => i + 1).map((num) => (
                      <option key={num} value={num}>
                        {num} {num === 1 ? 'человек' : num < 5 ? 'человека' : 'человек'}
                      </option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label htmlFor="tableId" className="block text-sm font-medium text-gray-700 flex items-center justify-between">
                    <span>Выберите стол</span>
                    {formData.tableId > 0 && (
                      <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                        Стол выбран
                      </span>
                    )}
                  </label>
                  <div className="mt-1 flex space-x-2">
                    <select
                      id="tableId"
                      name="tableId"
                      value={formData.tableId}
                      onChange={handleInputChange}
                      required
                      className="block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary sm:text-sm"
                    >
                      <option value={0}>Любой подходящий стол</option>
                      {availableTables.map((table) => (
                        <option key={table.id} value={table.id}>
                          {table.name} - {table.capacity} {table.capacity === 1 ? 'место' : table.capacity < 5 ? 'места' : 'мест'}
                        </option>
                      ))}
                    </select>
                    <button 
                      type="button"
                      onClick={() => setShowFloorPlan(!showFloorPlan)}
                      className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-md flex items-center justify-center"
                    >
                      {showFloorPlan ? 'Скрыть' : 'Показать'} схему зала
                    </button>
                  </div>
                  {availableTables.length === 0 && formData.guests > 0 && (
                    <p className="mt-1 text-sm text-red-600">
                      Нет доступных столов для выбранного количества гостей. Пожалуйста, выберите другую дату или уменьшите количество гостей.
                    </p>
                  )}
                </div>

                {/* Схема расположения столов в ресторане */}
                {showFloorPlan && (
                  <div className="md:col-span-2 my-4">
                    <div className="border border-gray-300 rounded-lg shadow-md p-4 bg-white">
                      <h3 className="text-lg font-medium mb-2 text-primary flex items-center">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                        </svg>
                        Интерактивная схема зала
                      </h3>
                      
                      <div className="flex justify-center">
                        <FloorPlan 
                          tables={tables}
                          selectedTableId={formData.tableId}
                          onTableSelect={handleTableSelect}
                          minGuestCount={formData.guests}
                          height="h-96"
                          containerClassName="w-full max-w-4xl mx-auto"
                          showBarCounter={true}
                          showLegend={true}
                          showEntrance={true}
                          isPixelPosition={false}
                          tableScaleFactor={0.9}
                          maxWidth={500}
                          maxHeight={350}
                          percentMultiplier={2.5}
                        />
                      </div>
                      
                      <p className="text-sm text-gray-500 mt-3 bg-gray-50 p-2 rounded border border-gray-200">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 inline-block mr-1 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Кликните на доступный стол (зеленый), чтобы выбрать его для бронирования.
                      </p>
                    </div>
                  </div>
                )}

                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                    Ваше имя
                  </label>
                  <input
                    type="text"
                    id="name"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    required
                    className="mt-1 focus:ring-primary focus:border-primary block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
                  />
                </div>

                <div>
                  <label htmlFor="phone" className="block text-sm font-medium text-gray-700">
                    Телефон
                  </label>
                  <input
                    type="tel"
                    id="phone"
                    name="phone"
                    value={formData.phone}
                    onChange={handleInputChange}
                    required
                    placeholder="+7 (___) ___-__-__"
                    className="mt-1 focus:ring-primary focus:border-primary block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
                  />
                </div>

                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                    Email
                  </label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    className="mt-1 focus:ring-primary focus:border-primary block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
                  />
                </div>

                <div className="md:col-span-2">
                  <label htmlFor="comments" className="block text-sm font-medium text-gray-700">
                    Комментарий (по желанию)
                  </label>
                  <textarea
                    id="comments"
                    name="comments"
                    rows={3}
                    value={formData.comments}
                    onChange={handleInputChange}
                    className="mt-1 focus:ring-primary focus:border-primary block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
                    placeholder="Укажите дополнительные пожелания, например, особые требования или повод для визита"
                  />
                </div>
              </div>

              {error && (
                <div className="rounded-md bg-red-50 p-4">
                  <div className="flex">
                    <div className="ml-3">
                      <h3 className="text-sm font-medium text-red-800">Ошибка</h3>
                      <div className="mt-2 text-sm text-red-700 whitespace-pre-wrap break-words">
                        <p>{error}</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {successMessage && (
                <div className="rounded-md bg-green-50 p-4">
                  <div className="flex">
                    <div className="ml-3">
                      <h3 className="text-sm font-medium text-green-800">Успех</h3>
                      <div className="mt-2 text-sm text-green-700">
                        <p>{successMessage}</p>
                      </div>
                      
                      {reservationCode && (
                        <div className="mt-4 p-4 border border-green-300 rounded-md bg-green-50">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center">
                              <KeyIcon className="h-5 w-5 text-green-600 mr-2" />
                              <span className="text-sm font-medium text-green-800">Ваш код бронирования:</span>
                            </div>
                            <span className="text-lg font-bold tracking-wider text-green-800">{reservationCode}</span>
                          </div>
                          <p className="mt-2 text-xs text-green-700">
                            Запишите или запомните этот код! Он понадобится вам для оформления заказа до посещения ресторана. 
                            После подтверждения бронирования вы сможете использовать этот код для предзаказа блюд.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => {
                    console.log('Текущие данные формы:', formData);
                    console.log('Данные для отправки:', {
                      reservation_date: formData.date,
                      reservation_time: formData.time,
                      guests_count: formData.guests,
                      guest_name: guestInfo.name,
                      guest_phone: guestInfo.phone,
                      guest_email: guestInfo.email,
                      table_id: selectedTable || formData.tableId || null,
                      comments: formData.comments,
                      user_id: user?.id,
                      status: 'pending'
                    });
                    console.log('Текущие столы:', tables);
                    console.log('Доступные столы:', availableTables);
                  }}
                  className="inline-flex justify-center py-2 px-4 mr-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
                >
                  Отладка
                </button>

                <button
                  type="submit"
                  disabled={isSubmitting || availableTables.length === 0}
                  className={`inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary ${
                    isSubmitting || availableTables.length === 0
                      ? 'bg-gray-400'
                      : 'bg-primary hover:bg-primary-dark'
                  }`}
                >
                  {isSubmitting ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Обработка...
                    </>
                  ) : (
                    'Забронировать'
                  )}
                </button>
              </div>
            </form>
          </div>
        )}

        {reservations.length === 0 ? (
          <div className="bg-white rounded-lg shadow-md p-8 text-center">
            <div className="flex justify-center mb-4">
              <CalendarIcon className="h-16 w-16 text-gray-400" />
            </div>
            <h2 className="text-2xl font-medium mb-4">У вас пока нет бронирований</h2>
            <p className="text-gray-600 mb-6">
              Забронируйте столик, чтобы насладиться изысканными блюдами в атмосфере уюта и комфорта
            </p>
            <button
              onClick={() => setShowForm(true)}
              className={`btn ${canCreateNewReservation() ? 'btn-primary' : 'btn-disabled bg-gray-300 cursor-not-allowed'} inline-flex items-center`}
              disabled={!canCreateNewReservation()}
              title={!canCreateNewReservation() ? 'Вы не можете создать новую бронь сейчас. Возможно, у вас уже есть ожидающая подтверждения бронь или вы недавно делали попытку бронирования.' : ''}
            >
              <PlusCircleIcon className="h-5 w-5 mr-2" />
              Забронировать столик
            </button>
            {!canCreateNewReservation() && (
              <div className="mt-4 text-sm text-red-600 bg-red-50 p-3 rounded-md">
                {reservations.filter(res => res.status === 'pending').length > 0 
                  ? 'У вас уже есть ожидающая подтверждения бронь. Пожалуйста, дождитесь её подтверждения администратором.'
                  : 'Пожалуйста, подождите 10 минут с момента последней попытки бронирования.'
                }
              </div>
            )}
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            <div className="px-6 py-4 border-b flex justify-between items-center">
              <h2 className="text-xl font-semibold">Мои бронирования</h2>
              <button
                onClick={() => setShowForm(true)}
                className={`btn ${canCreateNewReservation() ? 'btn-primary' : 'btn-disabled bg-gray-300 cursor-not-allowed'} inline-flex items-center text-sm py-2`}
                disabled={!canCreateNewReservation()}
                title={!canCreateNewReservation() ? 'Вы не можете создать новую бронь сейчас. Возможно, у вас уже есть ожидающая подтверждения бронь или вы недавно делали попытку бронирования.' : ''}
              >
                <PlusCircleIcon className="h-4 w-4 mr-1" />
                Новая бронь
              </button>
            </div>

            {!canCreateNewReservation() && (
              <div className="px-6 py-3 bg-red-50 text-sm text-red-600 border-b">
                {reservations.filter(res => res.status === 'pending').length > 0 
                  ? 'У вас уже есть ожидающая подтверждения бронь. Пожалуйста, дождитесь её подтверждения администратором.'
                  : 'Пожалуйста, подождите 10 минут с момента последней попытки бронирования.'
                }
              </div>
            )}

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
                      Гости
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Статус
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Комментарий
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Действия
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {reservations.map((reservation) => (
                    <tr key={reservation.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">#{reservation.id}</div>
                        {reservation.reservation_code && (
                          <div className="text-xs inline-flex items-center px-2.5 py-1 rounded-full bg-blue-100 text-blue-800 mt-1">
                            <KeyIcon className="h-3 w-3 mr-1" />
                            <span className="font-mono tracking-wide">{reservation.reservation_code}</span>
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {reservation.reservation_date && reservation.reservation_time 
                            ? `${reservation.reservation_date}, ${reservation.reservation_time}` 
                            : formatDateTime(reservation.reservation_time)
                          }
                        </div>
                        {reservation.table && (
                          <div className="text-xs text-gray-500 mt-1 bg-blue-50 text-blue-700 px-2 py-1 rounded inline-block">
                            Стол: {reservation.table.name}
                          </div>
                        )}
                        {!reservation.table && reservation.table_number && (
                          <div className="text-xs text-gray-500 mt-1 bg-blue-50 text-blue-700 px-2 py-1 rounded inline-block">
                            Столик №{reservation.table_number}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900 font-medium">{reservation.guests_count} {reservation.guests_count === 1 ? 'человек' : reservation.guests_count < 5 ? 'человека' : 'человек'}</div>
                        {reservation.guest_name && (
                          <div className="text-xs text-gray-600 mt-1">
                            {reservation.guest_name}
                          </div>
                        )}
                        {reservation.guest_phone && (
                          <div className="text-xs text-gray-600">
                            {reservation.guest_phone}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {getStatusBadge(reservation.status)}
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-900 truncate max-w-xs">
                          {reservation.comments || '—'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        {reservation.status === 'pending' && (
                          <button className="text-red-600 hover:text-red-800 mr-4">
                            Отменить
                          </button>
                        )}
                        <Link 
                          href={`/reservations/${reservation.id}`} 
                          className="text-primary hover:text-primary-dark"
                        >
                          Подробнее
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Информация о кодах бронирования */}
        <div className="mt-8 bg-blue-50 rounded-lg shadow-md p-6 border border-blue-100">
          <h2 className="text-xl font-semibold mb-4 text-blue-800 flex items-center">
            <KeyIcon className="h-5 w-5 mr-2" />
            Заказ блюд с бронированием столика
          </h2>
          <p className="text-blue-700 mb-4">
            Вы можете заранее заказать блюда перед посещением ресторана. Для этого:
          </p>
          <ol className="list-decimal list-inside space-y-2 text-blue-700 ml-4">
            <li>Создайте бронирование столика и дождитесь его подтверждения</li>
            <li>Используйте полученный код бронирования при оформлении заказа</li>
            <li>Ваш заказ будет приготовлен к указанному в бронировании времени</li>
          </ol>
          <p className="text-blue-700 mt-4">
            <strong>Обратите внимание:</strong> Предзаказ блюд возможен только при подтвержденном бронировании.
          </p>
        </div>

        <AuthModal 
          isOpen={showAuthModal} 
          onClose={() => setShowAuthModal(false)} 
          actionType="reservation" 
        />
      </div>
    </Layout>
  );
};

export default ReservationsPage; 