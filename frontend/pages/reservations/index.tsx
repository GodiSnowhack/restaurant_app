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
  KeyIcon,
  ExclamationCircleIcon
} from '@heroicons/react/24/outline';
import { format } from 'date-fns';
import FloorPlan from '../../components/FloorPlan';
import { RestaurantTable } from '../../types';
import { useTheme } from '@/lib/theme-context';

// Генерируем время для выбора в выпадающем списке: от 11:00 до 22:00 с шагом 30 минут
const timeOptions = Array.from({ length: 23 }, (_, i) => {
  const hour = Math.floor(i / 2) + 11;
  const minute = (i % 2) * 30;
  return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
});

const ReservationsPage: NextPage = () => {
  const { isDark } = useTheme();
  const router = useRouter();
  const { isAuthenticated, user } = useAuthStore();
  const { createReservation, getReservations, reservations, isLoading, clearStore } = useReservationsStore();
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
    
    // Очистка старых кодов бронирования в localStorage
    const clearOldReservationCodes = () => {
      try {
        // Собираем ключи, связанные с бронированием
        const reservationKeys = Object.keys(localStorage).filter(key => 
          key.includes('reservation_code') || 
          key.includes('reservation-code') || 
          key.includes('reservCode') || 
          key.includes('booking_code') ||
          (key.match(/[A-Z]{3}-[A-Z0-9]{3}/) !== null) // Формат RGZ-DBM
        );
        
        console.log('[ФРОНТ] Очистка старых кодов бронирования...');
        console.log(`[ФРОНТ] Найдено ${reservationKeys.length} кодов бронирования`);
        
        // Проверяем каждый ключ на срок действия
        reservationKeys.forEach(key => {
          const value = localStorage.getItem(key);
          let shouldRemove = false;
          
          // Проверяем формат данных
          try {
            // Если значение содержит поле expiresAt, проверяем срок действия
            if (value && value.includes('expiresAt')) {
              const data = JSON.parse(value);
              if (data.expiresAt) {
                const expires = new Date(data.expiresAt).getTime();
                const now = Date.now();
                // Если срок действия истек, удаляем код
                if (now > expires) {
                  shouldRemove = true;
                  console.log(`[ФРОНТ] Удален просроченный код: ${key}`);
                }
              }
            }
          } catch (e) {
            // Если не удалось распарсить JSON, пропускаем
          }
          
          if (shouldRemove) {
            localStorage.removeItem(key);
          }
        });
        
        console.log('[ФРОНТ] Очистка завершена');
      } catch (error) {
        console.error('[ФРОНТ] Ошибка при очистке кодов бронирования:', error);
      }
    };
    
    // Выполняем очистку при загрузке страницы
    clearOldReservationCodes();
    
    // Если пользователь авторизован, загружаем его бронирования и данные профиля
    if (isAuthenticated) {
      const fetchReservations = async () => {
        try {
          // Всегда запрашиваем бронирования при загрузке страницы
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

    // Очищаем хранилище при размонтировании компонента
    return () => {
      clearStore();
      setShowFloorPlan(false);
    };
  }, [isAuthenticated, getReservations, user, loadSettings, clearStore]);

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
        table.status !== 'occupied' && 
        table.capacity >= formData.guests
      )
      .sort((a, b) => a.capacity - b.capacity);
  };

  // Получение доступных столов в правильном формате
  const getFloorPlanTables = () => {
    const tables = settings.tables || [];
    return tables.map(table => ({
      ...table,
      name: table.name || `Стол ${table.number}`,
      is_active: true
    })) as RestaurantTable[];
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
  const floorPlanTables = getFloorPlanTables();

  // Функция для выбора стола на схеме зала
  const handleTableSelect = (table: RestaurantTable) => {
    setSelectedTable(table.id);
    setFormData(prev => ({
      ...prev,
      tableId: table.id
    }));
    setShowFloorPlan(false);
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
      <div className="container mx-auto px-4 md:px-6 lg:px-8 max-w-[1400px] py-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <h1 className={`
            text-2xl sm:text-3xl font-bold
            ${isDark ? 'text-gray-100' : 'text-gray-900'}
          `}>
            Бронирование столиков
          </h1>
          <button
            onClick={() => setShowForm(!showForm)}
            className={`${
              !showForm && !canCreateNewReservation() 
                ? isDark 
                  ? 'bg-gray-700 text-gray-400 cursor-not-allowed' 
                  : 'bg-gray-300 cursor-not-allowed'
                : showForm 
                  ? isDark
                    ? 'bg-gray-700 text-gray-100 hover:bg-gray-600'
                    : 'btn btn-secondary'
                  : isDark
                    ? 'bg-primary text-white hover:bg-primary-dark'
                    : 'btn btn-primary'
            } flex items-center whitespace-nowrap px-4 py-2 rounded-md transition-colors duration-200`}
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
          <div className={`
            mb-8 rounded-lg shadow-md overflow-hidden
            ${isDark ? 'bg-gray-800 border border-gray-700' : 'bg-white'}
          `}>
            <form onSubmit={handleSubmit} className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Дата и время */}
                <div>
                  <label htmlFor="date" className={`
                    block text-sm font-medium mb-1
                    ${isDark ? 'text-gray-300' : 'text-gray-700'}
                  `}>
                    Дата бронирования
                  </label>
                  <input
                    type="date"
                    id="date"
                    name="date"
                    value={formData.date}
                    onChange={handleInputChange}
                    min={new Date().toISOString().split('T')[0]}
                    required
                    className={`
                      block w-full rounded-md shadow-sm sm:text-sm
                      ${isDark 
                        ? 'bg-gray-700 border-gray-600 text-gray-100 focus:ring-primary-400 focus:border-primary-400' 
                        : 'border-gray-300 focus:ring-primary focus:border-primary'
                      }
                    `}
                  />
                </div>

                <div>
                  <label htmlFor="time" className={`
                    block text-sm font-medium mb-1
                    ${isDark ? 'text-gray-300' : 'text-gray-700'}
                  `}>
                    Время
                  </label>
                  <select
                    id="time"
                    name="time"
                    value={formData.time}
                    onChange={handleInputChange}
                    required
                    className={`
                      block w-full rounded-md shadow-sm sm:text-sm
                      ${isDark 
                        ? 'bg-gray-700 border-gray-600 text-gray-100 focus:ring-primary-400 focus:border-primary-400' 
                        : 'border-gray-300 focus:ring-primary focus:border-primary'
                      }
                    `}
                  >
                    <option value="">Выберите время</option>
                    {timeOptions.map((time) => (
                      <option key={time} value={time}>{time}</option>
                    ))}
                  </select>
                </div>

                {/* Количество гостей */}
                <div>
                  <label htmlFor="guests" className={`
                    block text-sm font-medium mb-1
                    ${isDark ? 'text-gray-300' : 'text-gray-700'}
                  `}>
                    Количество гостей
                  </label>
                  <input
                    type="number"
                    id="guests"
                    name="guests"
                    value={formData.guests}
                    onChange={handleInputChange}
                    min="1"
                    max="20"
                    required
                    className={`
                      block w-full rounded-md shadow-sm sm:text-sm
                      ${isDark 
                        ? 'bg-gray-700 border-gray-600 text-gray-100 focus:ring-primary-400 focus:border-primary-400' 
                        : 'border-gray-300 focus:ring-primary focus:border-primary'
                      }
                    `}
                  />
                </div>
                
                {/* Выбор стола */}
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label htmlFor="tableId" className={`
                      block text-sm font-medium
                      ${isDark ? 'text-gray-300' : 'text-gray-700'}
                    `}>
                      Выберите стол
                    </label>
                    {formData.tableId > 0 && (
                      <span className={`
                        text-xs px-2 py-1 rounded
                        ${isDark ? 'bg-blue-900/50 text-blue-300' : 'bg-blue-100 text-blue-800'}
                      `}>
                        Стол выбран
                      </span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <select
                      id="tableId"
                      name="tableId"
                      value={formData.tableId}
                      onChange={handleInputChange}
                      required
                      className={`
                        block w-full rounded-md shadow-sm sm:text-sm
                        ${isDark 
                          ? 'bg-gray-700 border-gray-600 text-gray-100 focus:ring-primary-400 focus:border-primary-400' 
                          : 'border-gray-300 focus:ring-primary focus:border-primary'
                        }
                      `}
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
                      className={`
                        inline-flex items-center px-4 py-2 rounded-md text-sm font-medium transition-colors duration-200 whitespace-nowrap
                        ${isDark 
                          ? showFloorPlan 
                            ? 'bg-gray-700 text-gray-100 hover:bg-gray-600'
                            : 'bg-primary text-white hover:bg-primary-dark'
                          : showFloorPlan
                            ? 'btn btn-secondary'
                            : 'btn btn-primary'
                        }
                      `}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                      </svg>
                      {showFloorPlan ? 'Скрыть схему зала' : 'Показать схему зала'}
                    </button>
                  </div>
                </div>

                {/* Контактная информация */}
                <div>
                  <label htmlFor="name" className={`
                    block text-sm font-medium mb-1
                    ${isDark ? 'text-gray-300' : 'text-gray-700'}
                  `}>
                    Ваше имя
                  </label>
                  <input
                    type="text"
                    id="name"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    required
                    className={`
                      block w-full rounded-md shadow-sm sm:text-sm
                      ${isDark 
                        ? 'bg-gray-700 border-gray-600 text-gray-100 focus:ring-primary-400 focus:border-primary-400' 
                        : 'border-gray-300 focus:ring-primary focus:border-primary'
                      }
                    `}
                  />
                </div>

                <div>
                  <label htmlFor="phone" className={`
                    block text-sm font-medium mb-1
                    ${isDark ? 'text-gray-300' : 'text-gray-700'}
                  `}>
                    Телефон
                  </label>
                  <input
                    type="tel"
                    id="phone"
                    name="phone"
                    value={formData.phone}
                    onChange={handleInputChange}
                    required
                    className={`
                      block w-full rounded-md shadow-sm sm:text-sm
                      ${isDark 
                        ? 'bg-gray-700 border-gray-600 text-gray-100 focus:ring-primary-400 focus:border-primary-400' 
                        : 'border-gray-300 focus:ring-primary focus:border-primary'
                      }
                    `}
                  />
                </div>

                {/* Комментарий */}
                <div className="md:col-span-2">
                  <label htmlFor="comment" className={`
                    block text-sm font-medium mb-1
                    ${isDark ? 'text-gray-300' : 'text-gray-700'}
                  `}>
                    Комментарий к бронированию
                  </label>
                  <textarea
                    id="comment"
                    name="comment"
                    value={formData.comments}
                    onChange={handleInputChange}
                    rows={3}
                    className={`
                      block w-full rounded-md shadow-sm sm:text-sm
                      ${isDark 
                        ? 'bg-gray-700 border-gray-600 text-gray-100 focus:ring-primary-400 focus:border-primary-400' 
                        : 'border-gray-300 focus:ring-primary focus:border-primary'
                      }
                    `}
                  />
                </div>

                {error && (
                  <div className="md:col-span-2">
                    <div className={`
                      p-4 rounded-md
                      ${isDark ? 'bg-red-900/50 text-red-200' : 'bg-red-50 text-red-800'}
                    `}>
                      <div className="flex">
                        <ExclamationCircleIcon className="h-5 w-5 text-red-400 mr-2" />
                        <span>{error}</span>
                      </div>
                    </div>
                  </div>
                )}

                {successMessage && (
                  <div className="md:col-span-2">
                    <div className={`
                      p-4 rounded-md
                      ${isDark ? 'bg-green-900/50 text-green-200' : 'bg-green-50 text-green-800'}
                    `}>
                      <div className="flex">
                        <CheckCircleIcon className="h-5 w-5 text-green-400 mr-2" />
                        <span>{successMessage}</span>
                      </div>
                    </div>
                  </div>
                )}

                <div className="md:col-span-2 flex justify-end">
                  <button
                    type="submit"
                    disabled={isSubmitting || availableTables.length === 0}
                    className={`
                      inline-flex justify-center items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white
                      transition-all duration-200
                      ${isSubmitting || availableTables.length === 0
                        ? isDark ? 'bg-gray-600 cursor-not-allowed' : 'bg-gray-400 cursor-not-allowed'
                        : isDark
                          ? 'bg-primary-500 hover:bg-primary-400 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-primary-400'
                          : 'bg-primary hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary'
                      }
                    `}
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
              </div>
            </form>
          </div>
        )}

        {/* Схема зала */}
        {showFloorPlan && (
          <div className="mb-8">
            <div className={`
              border rounded-lg shadow-md p-4
              ${isDark ? 'bg-gray-800/80 border-gray-700' : 'bg-white border-gray-300'}
            `}>
              <h3 className={`
                text-lg font-medium mb-4 flex items-center
                ${isDark ? 'text-gray-100' : 'text-gray-900'}
              `}>
                <svg xmlns="http://www.w3.org/2000/svg" className={`
                  h-5 w-5 mr-2
                  ${isDark ? 'text-primary-400' : 'text-primary'}
                `} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                Схема зала
                {showForm && (
                  <span className={`
                    ml-2 text-sm font-normal
                    ${isDark ? 'text-gray-400' : 'text-gray-500'}
                  `}>
                    (кликните на стол, чтобы выбрать его для бронирования)
                  </span>
                )}
              </h3>
              <div className={`
                flex justify-center rounded-lg overflow-hidden
                ${isDark ? 'bg-gray-900' : 'bg-gray-50'}
              `}>
                <FloorPlan 
                  tables={floorPlanTables}
                  selectedTableId={showForm ? formData.tableId : null}
                  onTableSelect={showForm ? handleTableSelect : undefined}
                  minGuestCount={showForm ? formData.guests : 0}
                  height="h-[600px]"
                  containerClassName={`
                    w-full max-w-6xl mx-auto p-4
                    ${isDark ? 'bg-gray-900' : 'bg-white'}
                  `}
                  showBarCounter={true}
                  showLegend={true}
                  showEntrance={true}
                  isPixelPosition={false}
                  tableScaleFactor={1}
                  maxWidth={800}
                  maxHeight={600}
                  isDark={isDark}
                />
              </div>
            </div>
          </div>
        )}

        {/* Список моих бронирований */}
        <div className={`
          rounded-lg shadow-md overflow-hidden
          ${isDark ? 'bg-gray-800 border border-gray-700' : 'bg-white'}
        `}>
          <h2 className={`
            text-xl font-semibold p-6 border-b
            ${isDark ? 'bg-gray-800/50 border-gray-700 text-gray-100' : 'bg-gray-50 border-gray-200 text-gray-900'}
          `}>
            Мои бронирования
          </h2>
          
          {isAuthenticated ? (
            isLoading ? (
              <div className="flex justify-center items-center p-12">
                <div className={`animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 ${isDark ? 'border-primary-400' : 'border-primary'}`}></div>
              </div>
            ) : reservations.length === 0 ? (
              <div className={`text-center p-12 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                У вас нет бронирований. Создайте новое бронирование.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className={`min-w-full divide-y ${isDark ? 'divide-gray-700' : 'divide-gray-200'}`}>
                  <thead className={isDark ? 'bg-gray-800/50' : 'bg-gray-50'}>
                    <tr>
                      <th scope="col" className={`
                        px-6 py-3 text-left text-xs font-medium uppercase tracking-wider
                        ${isDark ? 'text-gray-400' : 'text-gray-500'}
                      `}>
                        № брони
                      </th>
                      <th scope="col" className={`
                        px-6 py-3 text-left text-xs font-medium uppercase tracking-wider
                        ${isDark ? 'text-gray-400' : 'text-gray-500'}
                      `}>
                        Дата и время
                      </th>
                      <th scope="col" className={`
                        px-6 py-3 text-left text-xs font-medium uppercase tracking-wider
                        ${isDark ? 'text-gray-400' : 'text-gray-500'}
                      `}>
                        Гости
                      </th>
                      <th scope="col" className={`
                        px-6 py-3 text-left text-xs font-medium uppercase tracking-wider
                        ${isDark ? 'text-gray-400' : 'text-gray-500'}
                      `}>
                        Статус
                      </th>
                      <th scope="col" className={`
                        px-6 py-3 text-left text-xs font-medium uppercase tracking-wider
                        ${isDark ? 'text-gray-400' : 'text-gray-500'}
                      `}>
                        Действия
                      </th>
                    </tr>
                  </thead>
                  <tbody className={`
                    divide-y
                    ${isDark ? 'divide-gray-700' : 'divide-gray-200'}
                  `}>
                    {reservations.map((reservation) => (
                      <tr key={reservation.id} className={isDark ? 'bg-gray-800 hover:bg-gray-700/50' : 'bg-white hover:bg-gray-50'}>
                        <td className={`
                          px-6 py-4 whitespace-nowrap text-sm font-medium
                          ${isDark ? 'text-gray-100' : 'text-gray-900'}
                        `}>
                          <div className="flex items-center space-x-2">
                            <KeyIcon className="h-4 w-4 text-primary" />
                            <span>{reservation.reservation_code}</span>
                          </div>
                        </td>
                        <td className={`
                          px-6 py-4 whitespace-nowrap text-sm
                          ${isDark ? 'text-gray-300' : 'text-gray-500'}
                        `}>
                          {reservation.reservation_date && reservation.reservation_time 
                            ? `${reservation.reservation_date}, ${reservation.reservation_time}` 
                            : formatDateTime(reservation.reservation_time)
                          }
                        </td>
                        <td className={`
                          px-6 py-4 whitespace-nowrap text-sm
                          ${isDark ? 'text-gray-300' : 'text-gray-500'}
                        `}>
                          {reservation.guests_count}
                        </td>
                        <td className={`
                          px-6 py-4 whitespace-nowrap text-sm
                          ${isDark ? 'text-gray-300' : 'text-gray-500'}
                        `}>
                          {getStatusBadge(reservation.status)}
                        </td>
                        <td className={`
                          px-6 py-4 whitespace-nowrap text-right text-sm font-medium
                          ${isDark ? 'text-gray-300' : 'text-gray-500'}
                        `}>
                          <Link href={`/reservations/${reservation.id}`} className="text-primary hover:underline">
                            Подробнее
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          ) : (
            <div className={`text-center p-12 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
              Для просмотра ваших бронирований необходимо авторизоваться.
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default ReservationsPage;