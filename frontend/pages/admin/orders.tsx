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
import { FormControlLabel, Switch, Button, Paper, Box, Typography, Divider } from '@mui/material';

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
  const [showDemoDataControls, setShowDemoDataControls] = useState(false);
  const [useDemoData, setUseDemoData] = useState(false);

  // Эффект для отслеживания и установки настроек демо-данных
  useEffect(() => {
    const useDemoForErrors = localStorage.getItem('use_demo_for_errors') === 'true';
    const forceDemoData = localStorage.getItem('force_demo_data') === 'true';
    setUseDemoData(useDemoForErrors || forceDemoData);
  }, []);

  // Переключение режима демо-данных
  const handleToggleDemoData = (event: React.ChangeEvent<HTMLInputElement>) => {
    const isChecked = event.target.checked;
    setUseDemoData(isChecked);
    localStorage.setItem('use_demo_for_errors', isChecked ? 'true' : 'false');
    localStorage.setItem('use_demo_for_empty', isChecked ? 'true' : 'false');
    
    if (isChecked) {
      localStorage.setItem('force_demo_data', 'true');
    } else {
      localStorage.removeItem('force_demo_data');
    }
    
    fetchOrders(); // Перезапрос данных с новыми настройками
  };

  // Показать/скрыть панель управления демо-данными (по тройному клику на заголовок)
  const handleTripleClick = () => {
    setShowDemoDataControls(!showDemoDataControls);
  };

  useEffect(() => {
      fetchOrders();
  }, [activeTab, dateRange]);

  const fetchOrders = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      // Подготавливаем даты для API запроса
      let startDate = dateRange.start;
      let endDate = dateRange.end;
      
      // Проверяем валидность дат
      try {
        // Преобразуем в объекты Date
        const startDateObj = new Date(dateRange.start);
        const endDateObj = new Date(dateRange.end);
        
        // Проверяем, что даты валидны и не в будущем
        const now = new Date();
        
        // Если end дата в будущем, используем текущую дату
        if (endDateObj > now) {
          endDateObj.setTime(now.getTime());
          endDate = endDateObj.toISOString().split('T')[0];
        }
        
        // Проверяем, что start дата не после end даты
        if (startDateObj > endDateObj) {
          // Если начальная дата после конечной, устанавливаем её на 7 дней до конечной
          startDateObj.setTime(endDateObj.getTime() - 7 * 24 * 60 * 60 * 1000);
          startDate = startDateObj.toISOString().split('T')[0];
        }
        
        console.log('Даты для запроса:', { startDate, endDate });
      } catch (dateError) {
        console.error('Ошибка при обработке дат:', dateError);
      }
      
      // Получаем заказы через API
      console.log('Запрос заказов с параметрами:', { start_date: startDate, end_date: endDate });
      const ordersData = await ordersApi.getAllOrders({
        start_date: startDate,
        end_date: endDate
      });
      
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
        setError('Полученные данные имеют неверный формат. Возможны проблемы с подключением к базе данных.');
        setOrders([]);
      }
    } catch (error: any) {
      console.error('Ошибка при загрузке заказов:', error);
      
      // Проверяем на ошибки SQL, связанные с неправильной структурой БД
      if (error.message && (
        error.message.includes('no such column') || 
        error.message.includes('SQL error')
      )) {
        console.log('Обнаружена ошибка SQL в базе данных, включаем демо-режим');
        localStorage.setItem('use_demo_for_errors', 'true');
        localStorage.setItem('use_demo_for_empty', 'true');
        setUseDemoData(true);
        // Повторно вызываем fetchOrders, чтобы получить демо-данные
        setTimeout(() => fetchOrders(), 100);
        return;
      }
      
      setError(error.message || 'Не удалось загрузить заказы. Возможна ошибка в структуре базы данных.');
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
          <h1 className="text-3xl font-bold" onClick={handleTripleClick}>Управление заказами</h1>
          <button 
            onClick={() => router.back()}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            <ArrowLeftIcon className="h-4 w-4 mr-2" />
            Назад
          </button>
        </div>

        {showDemoDataControls && (
          <Paper sx={{ p: 2, mb: 3 }} elevation={3}>
            <Typography variant="subtitle1" gutterBottom>
              Панель отладки
            </Typography>
            <Divider sx={{ mb: 2 }} />
            <FormControlLabel 
              control={
                <Switch 
                  checked={useDemoData} 
                  onChange={handleToggleDemoData}
                  color="primary"
                />
              } 
              label="Использовать демо-данные при ошибках" 
            />
            <Box sx={{ mt: 1 }}>
              <Button 
                variant="outlined" 
                size="small" 
                onClick={() => {
                  localStorage.setItem('force_demo_data', 'true');
                  fetchOrders();
                }}
                sx={{ mr: 1 }}
              >
                Показать только демо
              </Button>
              <Button 
                variant="outlined" 
                size="small"
                color="secondary" 
                onClick={() => {
                  localStorage.removeItem('force_demo_data');
                  fetchOrders();
                }}
              >
                Сбросить
              </Button>
            </Box>
          </Paper>
        )}

        {error && (
          <div className="bg-red-50 border-l-4 border-red-400 p-4 mb-6">
            <div className="flex">
              <div className="flex-shrink-0">
                <ExclamationIcon className="h-5 w-5 text-red-400" />
              </div>
              <div className="ml-3">
                <p className="text-sm text-red-700">
                  {error}
                </p>
                <div className="mt-2">
                  <button 
                    className="text-sm font-medium text-red-700 hover:text-red-600 focus:outline-none"
                    onClick={fetchOrders}
                  >
                    Повторить загрузку
                  </button>
                  {error.includes('базы данных') && (
                    <button 
                      className="ml-4 text-sm font-medium text-indigo-700 hover:text-indigo-600 focus:outline-none"
                      onClick={() => {
                        localStorage.setItem('use_demo_for_errors', 'true');
                        localStorage.setItem('use_demo_for_empty', 'true');
                        setUseDemoData(true);
                        fetchOrders();
                      }}
                    >
                      Использовать демо-данные
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
        
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
                        {formatPrice(order.total_amount || 0)}
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