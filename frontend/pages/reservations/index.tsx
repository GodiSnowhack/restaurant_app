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
          // Проверяем наличие user.id для фильтрации только собственных бронирований
          if (user && user.id) {
            console.log(`Запрос бронирований для пользователя ID=${user.id}`);
            // Передаем userId для фильтрации бронирований
            await getReservations();
          } else {
            console.log('Пользователь не определен, загрузка бронирований отменена');
          }
          
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
      guests_count: Number(formData.guests),
      guest_name: guestInfo.name,
      guest_phone: guestInfo.phone,
      table_number: selectedTable ? Number(selectedTable) : (formData.tableId ? Number(formData.tableId) : null),
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
      
      // Принудительно запрашиваем обновленный список бронирований
      console.log('Запрашиваем обновленный список бронирований после создания...');
      if (user && user.id) {
        console.log(`Запрос бронирований для пользователя ID=${user.id} после создания нового`);
        const freshData = await getReservations();
        console.log(`Получено ${freshData.length} бронирований после создания`);
      } else {
        console.log('Пользователь не определен, загрузка бронирований отменена');
      }
      
      // Сбрасываем форму
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
      
      // Принудительное обновление интерфейса через небольшую задержку
      setTimeout(async () => {
        console.log('Дополнительное обновление списка бронирований...');
        if (user && user.id) {
          console.log(`Запрос бронирований для пользователя ID=${user.id} (отложенное обновление)`);
          await getReservations();
        } else {
          console.log('Пользователь не определен, отложенная загрузка бронирований отменена');
        }
      }, 1000);
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
    try {
      // Проверяем, что dateTimeString существует и валиден
      if (!dateTimeString) {
        return 'Дата не указана';
      }
      
      const date = new Date(dateTimeString);
      
      // Проверяем, что дата валидна
      if (isNaN(date.getTime())) {
        return 'Некорректная дата';
      }
      
      return new Intl.DateTimeFormat('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }).format(date);
    } catch (error) {
      console.error('Ошибка при форматировании даты:', error);
      return 'Ошибка формата даты';
    }
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

  // Функция для форматирования кода бронирования
  const formatReservationCode = (code: string | undefined) => {
    // Если код не определен, возвращаем пустую строку
    if (!code) return '';
    
    // Проверяем, соответствует ли код новому формату XXX-XXX
    if (code.includes('-') && code.length === 7) {
      return code;
    }
    
    // Для старых кодов в формате RES... возвращаем только последние 7 символов
    if (code.startsWith('RES')) {
      const cleanCode = code.replace('RES', '');
      if (cleanCode.length >= 6) {
        // Преобразуем в формат XXX-XXX
        const part1 = cleanCode.substring(0, 3);
        const part2 = cleanCode.substring(3, 6);
        return `${part1}-${part2}`;
      }
    }
    
    // Для всех остальных случаев возвращаем код как есть
    return code;
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
      <div className="container mx-auto px-4 py-8 bg-white dark:bg-gray-900 min-h-screen">
        <h1 className="text-3xl font-bold mb-8 text-gray-900 dark:text-white">Управление бронированиями</h1>
        <div className="mb-4">
          <div className="bg-blue-50 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-4 py-2 rounded-md">
            Загружено {reservations.length} бронирований
          </div>
        </div>
        <div className="flex gap-4 mb-6">
          <button className="px-4 py-2 rounded-md text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700">Все</button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {reservations.map((reservation) => (
            <div key={reservation.id} className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
              <h3 className="text-lg font-semibold mb-2 text-gray-900 dark:text-white">Стол #{reservation.table_number}</h3>
              <div className="text-gray-600 dark:text-gray-300">{reservation.guest_name}</div>
            </div>
          ))}
        </div>
      </div>
    </Layout>
  );
};

export default ReservationsPage;
