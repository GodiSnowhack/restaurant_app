import { useState, useEffect } from 'react';
import { NextPage } from 'next';
import { useRouter } from 'next/router';
import Link from 'next/link';
import Layout from '../../components/Layout';
import useAuthStore from '../../lib/auth-store';
import { ordersApi } from '../../lib/api/orders';
import { Order } from '../../lib/api/types';
import { 
  ArrowLeftIcon,
  CalendarIcon,
  CheckIcon,
  ClockIcon,
  CurrencyDollarIcon,
  ExclamationTriangleIcon as ExclamationIcon,
  EyeIcon,
  XMarkIcon as XIcon
} from '@heroicons/react/24/outline';
import { formatPrice } from '../../utils/priceFormatter';

type OrderStatus = 'pending' | 'confirmed' | 'preparing' | 'ready' | 'completed' | 'cancelled';
type PaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded';

const AdminOrdersPage: NextPage = () => {
  const router = useRouter();
  const { user, isAuthenticated } = useAuthStore();
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<OrderStatus | 'all'>('all');
  const [dateRange, setDateRange] = useState(() => {
    // Получаем текущую дату
    const today = new Date();
    
    // Вычисляем дату 7 дней назад
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(today.getDate() - 7);
    
    // Форматируем даты в формате YYYY-MM-DD
    const formatDate = (date: Date) => {
      return date.toISOString().split('T')[0];
    };
    
    return {
      start: formatDate(sevenDaysAgo),
      end: formatDate(today)
    };
  });
  const [error, setError] = useState<string | null>(null);
  const [updatingOrderId, setUpdatingOrderId] = useState<number | null>(null);
  // State для отслеживания режима демо-данных
  const [useDemoData, setUseDemoData] = useState<boolean>(false);
  
  // Эффект для загрузки настройки demo-режима из localStorage
  useEffect(() => {
    const demoSetting = localStorage?.getItem('admin_use_demo_data') === 'true';
    setUseDemoData(demoSetting);
  }, []);

  useEffect(() => {
      fetchOrders();
  }, [activeTab, dateRange]);

  const fetchOrders = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      // Обрабатываем режим демо-данных
      if (useDemoData) {
        try {
          localStorage.setItem('force_demo_data', 'true');
          console.log('Включен режим демо-данных');
        } catch (e) {
          console.error('Ошибка при включении режима демо-данных:', e);
        }
      } else {
        try {
          localStorage.removeItem('force_demo_data');
          console.log('Режим демо-данных отключен');
        } catch (e) {
          console.error('Ошибка при отключении режима демо-данных:', e);
        }
      }
      
      // Подготавливаем параметры для API запроса с корректными названиями полей
      const params: any = {};
      
      // Добавляем даты с учетом времени для корректного диапазона
      if (dateRange.start && dateRange.end) {
        try {
          // Дата начала - начало дня (00:00:00)
          const startDate = new Date(dateRange.start);
          startDate.setHours(0, 0, 0, 0);
          
          // Дата окончания - конец дня (23:59:59)
          const endDate = new Date(dateRange.end);
          endDate.setHours(23, 59, 59, 999);
          
          // Проверяем, что даты валидны и не в будущем
          const now = new Date();
          
          // Если end дата в будущем, используем текущую дату
          if (endDate > now) {
            endDate.setTime(now.getTime());
          }
          
          // Проверяем, что start дата не после end даты
          if (startDate > endDate) {
            // Если начальная дата после конечной, устанавливаем её на 7 дней до конечной
            startDate.setTime(endDate.getTime() - 7 * 24 * 60 * 60 * 1000);
          }
          
          console.log('Даты для запроса:', {
            startDate: startDate.toISOString(),
            endDate: endDate.toISOString(),
            now: now.toISOString()
          });
          
          params.start_date = startDate.toISOString();
          params.end_date = endDate.toISOString();
        } catch (dateError) {
          console.error('Ошибка при обработке дат:', dateError);
          // В случае ошибки используем текущую дату и 7 дней назад
          const now = new Date();
          const sevenDaysAgo = new Date(now);
          sevenDaysAgo.setDate(now.getDate() - 7);
          
          params.start_date = sevenDaysAgo.toISOString();
          params.end_date = now.toISOString();
        }
      }
      
      // Добавляем статус в параметры, если выбран конкретный статус
      if (activeTab !== 'all') {
        params.status = activeTab;
      }
      
      console.log('Запрос заказов с параметрами:', params);
      
      // Получаем заказы через API с учетом потенциальных проблем с сетью
      let ordersData;
      
      try {
        // Первая попытка: основной метод получения заказов
        ordersData = await ordersApi.getOrders(
          params.start_date,
          params.end_date
        );
      } catch (apiError) {
        console.error('Первая попытка получения заказов не удалась:', apiError);
        
        // Вторая попытка: пробуем получить данные с другими настройками
        try {
          // Делаем явный запрос через fetch с большим таймаутом
          const token = localStorage.getItem('token');
          
          if (!token) {
            throw new Error('Отсутствует токен авторизации');
          }
          
          const response = await fetch(`/api/orders?start_date=${encodeURIComponent(params.start_date)}&end_date=${encodeURIComponent(params.end_date)}`, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json',
              'Authorization': `Bearer ${token}`
            }
          });
          
          if (!response.ok) {
            throw new Error(`Ошибка HTTP: ${response.status}`);
          }
          
          ordersData = await response.json();
          console.log('Данные получены через альтернативный метод');
        } catch (fetchError) {
          console.error('Вторая попытка тоже не удалась:', fetchError);
          
          // Если обе попытки не удались, используем демо-данные
          if (useDemoData) {
            console.log('Использование демо-данных согласно настройкам');
            
            // Здесь мы не генерируем данные, а рассчитываем на то, что API-прокси вернет демо-данные
            throw new Error('Не удалось получить данные. Используются демо-данные.');
          } else {
            throw new Error('Не удалось получить данные заказов. Пожалуйста, проверьте подключение к интернету и повторите попытку.');
          }
        }
      }
      
      console.log('Полученные заказы:', ordersData);
      
      if (Array.isArray(ordersData)) {
        // Фильтруем заказы по статусу, если выбран конкретный статус
        let filteredOrders = ordersData;
        if (activeTab !== 'all') {
          // Учитываем возможное разное написание статусов (верхний/нижний регистр)
          const statusLower = activeTab.toLowerCase();
          filteredOrders = ordersData.filter(order => 
            order.status?.toLowerCase() === statusLower
          );
          
          console.log(`Отфильтровано ${filteredOrders.length} заказов со статусом ${activeTab}`);
        }
        
        // Нормализуем данные заказов
        const normalizedOrders = filteredOrders.map(order => ({
          ...order,
          // Убеждаемся, что важные поля имеют значения по умолчанию
          id: order.id || 0,
          status: order.status || 'pending',
          payment_status: order.payment_status || 'pending',
          payment_method: order.payment_method || 'card',
          total_amount: typeof order.total_amount === 'number' ? order.total_amount : 
                       (typeof order.total_amount === 'string' ? parseFloat(order.total_amount) : 0),
          // Преобразуем строку в объект Date только если она существует
          created_at: order.created_at || new Date().toISOString(),
          updated_at: order.updated_at,
          completed_at: order.completed_at,
          customer_name: order.customer_name || '',
          customer_phone: order.customer_phone || '',
          // Нормализуем массив товаров
          items: Array.isArray(order.items) ? order.items.map((item: any) => ({
            ...item,
            dish_id: item.dish_id || 0,
            quantity: item.quantity || 1,
            price: typeof item.price === 'number' ? item.price : 
                  (typeof item.price === 'string' ? parseFloat(item.price) : 0),
            name: item.name || item.dish_name || 'Неизвестное блюдо',
            // Вычисляем полную стоимость позиции
            total: (item.quantity || 1) * (typeof item.price === 'number' ? item.price : 
                  (typeof item.price === 'string' ? parseFloat(item.price) : 0))
          })) : []
        }));
        
        console.log('Нормализованные заказы:', normalizedOrders);
        setOrders(normalizedOrders);
      } else {
        console.error('API вернул неверный формат данных:', ordersData);
        setError('Полученные данные имеют неверный формат. Ожидался массив заказов.');
        setOrders([]);
      }
    } catch (error: any) {
      console.error('Ошибка при загрузке заказов:', error);
      setError(error.message || 'Не удалось загрузить заказы');
      // Если нет данных, устанавливаем пустой массив
      setOrders([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Функция для получения русского названия статуса заказа
  const getStatusText = (status: string | undefined): string => {
    if (!status) return 'Неизвестен';
    
    const statusMap: Record<string, string> = {
      'pending': 'Новый',
      'confirmed': 'Подтвержден',
      'preparing': 'Готовится',
      'ready': 'Готов',
      'completed': 'Завершен',
      'cancelled': 'Отменен',
      // Добавляем статусы из API на всякий случай
      'PENDING': 'Новый',
      'CONFIRMED': 'Подтвержден',
      'PREPARING': 'Готовится',
      'READY': 'Готов',
      'COMPLETED': 'Завершен',
      'CANCELLED': 'Отменен',
    };
    
    return statusMap[status] || status;
  };

  // Функция для получения русского названия статуса оплаты
  const getPaymentStatusText = (status: string | undefined): string => {
    if (!status) return 'Неизвестен';
    
    const statusMap: Record<string, string> = {
      'pending': 'Ожидает оплаты',
      'paid': 'Оплачен',
      'failed': 'Ошибка оплаты',
      'refunded': 'Возврат средств',
      // Добавляем статусы из API на всякий случай
      'PENDING': 'Ожидает оплаты',
      'PAID': 'Оплачен',
      'FAILED': 'Ошибка оплаты',
      'REFUNDED': 'Возврат средств',
      'unpaid': 'Ожидает оплаты',
      'UNPAID': 'Ожидает оплаты',
    };
    
    return statusMap[status] || status;
  };

  // Обновляем функцию получения бейджа статуса заказа
  const getStatusBadge = (status: string | undefined) => {
    if (!status) {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 border border-gray-300">
          Неизвестен
        </span>
      );
    }
    
    const statusLower = status.toLowerCase();
    
    switch (statusLower) {
      case 'pending':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 border border-yellow-300">
            <ClockIcon className="h-3 w-3 mr-1" />
            {getStatusText(status)}
          </span>
        );
      case 'confirmed':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 border border-blue-300">
            <CheckIcon className="h-3 w-3 mr-1" />
            {getStatusText(status)}
          </span>
        );
      case 'preparing':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800 border border-purple-300">
            <ClockIcon className="h-3 w-3 mr-1" />
            {getStatusText(status)}
          </span>
        );
      case 'ready':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-teal-100 text-teal-800 border border-teal-300">
            <CheckIcon className="h-3 w-3 mr-1" />
            {getStatusText(status)}
          </span>
        );
      case 'completed':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 border border-green-300">
            <CheckIcon className="h-3 w-3 mr-1" />
            {getStatusText(status)}
          </span>
        );
      case 'cancelled':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 border border-red-300">
            <XIcon className="h-3 w-3 mr-1" />
            {getStatusText(status)}
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 border border-gray-300">
            {getStatusText(status)}
          </span>
        );
    }
  };

  // Функция для получения статуса оплаты
  const getPaymentStatusIcon = (status: string | undefined) => {
    if (!status) {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 border border-gray-300">
          Неизвестен
        </span>
      );
    }
    
    const statusLower = status.toLowerCase();
    
    switch (statusLower) {
      case 'paid':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 border border-green-300">
            <CheckIcon className="h-3 w-3 mr-1" />
            {getPaymentStatusText(status)}
          </span>
        );
      case 'pending':
      case 'unpaid':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 border border-amber-300">
            <ClockIcon className="h-3 w-3 mr-1" />
            {getPaymentStatusText(status)}
          </span>
        );
      case 'failed':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 border border-red-300">
            <ExclamationIcon className="h-3 w-3 mr-1" />
            {getPaymentStatusText(status)}
          </span>
        );
      case 'refunded':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 border border-blue-300">
            <ArrowLeftIcon className="h-3 w-3 mr-1" />
            {getPaymentStatusText(status)}
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 border border-gray-300">
            {getPaymentStatusText(status)}
          </span>
        );
    }
  };

  const formatDate = (dateString: string | undefined) => {
    try {
      // Проверяем, что dateString существует и является строкой
      if (!dateString || typeof dateString !== 'string') {
        return 'Недоступно';
      }
      
      // Пытаемся создать объект даты
      const date = new Date(dateString);
      
      // Проверяем валидность даты
      if (isNaN(date.getTime())) {
        return 'Недоступно';
      }
      
      // Форматируем дату
      return new Intl.DateTimeFormat('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }).format(date);
    } catch (error) {
      console.error('Ошибка при форматировании даты:', error);
      return 'Недоступно';
    }
  };

  const handleDateRangeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setDateRange(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleUpdateStatus = async (id: number, newStatus: OrderStatus) => {
    try {
      setUpdatingOrderId(id);
      
      console.log(`Обновление статуса заказа #${id} на ${newStatus}`);
      
      await ordersApi.updateOrderStatus(id, newStatus);
      
      await fetchOrders();
      
      alert(`Статус заказа #${id} успешно изменен на "${newStatus}"`);
    } catch (error) {
      console.error('Ошибка при обновлении статуса заказа:', error);
      alert('Произошла ошибка при обновлении статуса заказа');
    } finally {
      setUpdatingOrderId(null);
    }
  };

  const filteredOrders = activeTab === 'all' 
    ? orders 
    : orders.filter(order => order.status === activeTab);

  if (isLoading) {
    return (
      <Layout title="Управление заказами | Админ-панель">
        <div className="container mx-auto px-4 py-8">
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="Управление заказами | Админ-панель">
      <div className="max-w-[1400px] w-full mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold dark:text-white">Управление заказами</h1>
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                const newValue = !useDemoData;
                localStorage.setItem('admin_use_demo_data', newValue ? 'true' : 'false');
                setUseDemoData(newValue);
                alert(`Режим демо-данных ${newValue ? 'включен' : 'выключен'}`);
                fetchOrders();
              }}
              className="text-xs px-2 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-md flex items-center"
            >
              {useDemoData ? 
                'Использовать реальные данные' : 
                'Использовать демо-данные'}
            </button>
            <Link
              href="/admin"
              className="flex items-center text-gray-600 dark:text-gray-300 hover:text-primary"
            >
              <ArrowLeftIcon className="w-5 h-5 mr-1" />
              Назад к панели управления
            </Link>
          </div>
        </div>
        
        {/* Фильтры */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white dark:bg-gray-800 p-4 rounded-lg shadow-md mb-6">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setActiveTab('all')}
              className={`px-3 py-1.5 text-sm rounded-full ${
                activeTab === 'all'
                  ? 'bg-primary text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              Все
            </button>
            <button
              onClick={() => setActiveTab('pending')}
              className={`px-3 py-1.5 text-sm rounded-full ${
                activeTab === 'pending'
                  ? 'bg-primary text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              Новые
            </button>
            <button
              onClick={() => setActiveTab('confirmed')}
              className={`px-3 py-1.5 text-sm rounded-full ${
                activeTab === 'confirmed'
                  ? 'bg-primary text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              Подтвержденные
            </button>
            <button
              onClick={() => setActiveTab('preparing')}
              className={`px-3 py-1.5 text-sm rounded-full ${
                activeTab === 'preparing'
                  ? 'bg-primary text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              В процессе
            </button>
            <button
              onClick={() => setActiveTab('completed')}
              className={`px-3 py-1.5 text-sm rounded-full ${
                activeTab === 'completed'
                  ? 'bg-primary text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              Завершенные
            </button>
            <button
              onClick={() => setActiveTab('cancelled')}
              className={`px-3 py-1.5 text-sm rounded-full ${
                activeTab === 'cancelled'
                  ? 'bg-primary text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              Отмененные
            </button>
          </div>
          
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center">
              <span className="text-sm text-gray-600 dark:text-gray-300 mr-2">С:</span>
              <input
                type="date"
                value={dateRange.start}
                onChange={(e) => handleDateRangeChange(e)}
                name="start"
                className="border border-gray-300 dark:border-gray-600 rounded text-sm p-1 dark:bg-gray-700 dark:text-gray-300"
              />
            </div>
            <div className="flex items-center">
              <span className="text-sm text-gray-600 dark:text-gray-300 mr-2">По:</span>
              <input
                type="date"
                value={dateRange.end}
                onChange={(e) => handleDateRangeChange(e)}
                name="end"
                className="border border-gray-300 dark:border-gray-600 rounded text-sm p-1 dark:bg-gray-700 dark:text-gray-300"
              />
            </div>
            <button
              onClick={() => fetchOrders()}
              className="px-3 py-1 bg-primary text-white text-sm rounded hover:bg-primary-dark"
            >
              Применить
            </button>
          </div>
        </div>
        
        {/* Таблица заказов */}
        {isLoading ? (
          <div className="flex justify-center items-center p-12">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
          </div>
        ) : error ? (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-8 text-center">
            <ExclamationIcon className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Ошибка загрузки данных</h3>
            <p className="text-gray-500 dark:text-gray-400 mb-4">{error}</p>
            <button
              onClick={() => fetchOrders()}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary hover:bg-primary-dark"
            >
              Попробовать снова
            </button>
          </div>
        ) : orders.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-8 text-center">
            <p className="text-gray-500 dark:text-gray-400 mb-4">Заказы не найдены</p>
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      ID
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Дата
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Клиент
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Сумма
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Статус заказа
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Статус оплаты
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Действия
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {orders.map((order) => (
                    <tr key={order.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-300">
                        {order.id}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-300">
                        {formatDate(order.created_at)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-300">
                        {order.customer_name || 'Гость'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-300">
                        {formatPrice(order.total_amount || order.total_price || 0)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {getStatusBadge(order.status)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {getPaymentStatusIcon(order.payment_status)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <Link href={`/admin/orders/${order.id}`} className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300 mr-4">
                          <EyeIcon className="h-5 w-5 inline" /> Просмотр
                        </Link>
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

export default AdminOrdersPage; 