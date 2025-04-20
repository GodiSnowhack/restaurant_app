import { useState, useEffect } from 'react';
import { NextPage } from 'next';
import { useRouter } from 'next/router';
import Link from 'next/link';
import Layout from '../../components/Layout';
import useAuthStore from '../../lib/auth-store';
import { ordersApi } from '../../lib/api';
import { Order } from '../../types';
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
  const [dateRange, setDateRange] = useState({
    start: new Date(new Date().setDate(new Date().getDate() - 7)).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  });
  const [error, setError] = useState<string | null>(null);
  const [updatingOrderId, setUpdatingOrderId] = useState<number | null>(null);

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

      fetchOrders();
    };

    checkAdmin();
  }, [isAuthenticated, user, router, activeTab, dateRange]);

  const fetchOrders = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      // Подготавливаем параметры для API запроса с корректными названиями полей
      const params: any = {};
      
      // Добавляем даты с учетом времени для корректного диапазона
      if (dateRange.start && dateRange.end) {
        // Дата начала - начало дня (00:00:00)
        const startDate = new Date(dateRange.start);
        startDate.setHours(0, 0, 0, 0);
        
        // Дата окончания - конец дня (23:59:59)
        const endDate = new Date(dateRange.end);
        endDate.setHours(23, 59, 59, 999);
        
        params.start_date = startDate.toISOString();
        params.end_date = endDate.toISOString();
      }
      
      // Добавляем статус в параметры, если выбран конкретный статус
      if (activeTab !== 'all') {
        params.status = activeTab;
      }
      
      console.log('Запрос заказов с параметрами:', params);
      
      // Получаем заказы через API
      const data = await ordersApi.getOrders(params);
      console.log('Полученные заказы:', data);
      
      if (Array.isArray(data)) {
        setOrders(data);
      } else {
        console.error('API вернул неверный формат данных:', data);
        setError('Полученные данные имеют неверный формат. Ожидался массив заказов.');
        setOrders([]);
      }
    } catch (error) {
      console.error('Ошибка при загрузке заказов:', error);
      setError('Не удалось загрузить заказы. Пожалуйста, попробуйте позже.');
      // Если нет данных, устанавливаем пустой массив
      setOrders([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Функция для получения статуса заказа
  const getStatusBadge = (status: string | undefined) => {
    if (!status) {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
          Неизвестен
        </span>
      );
    }
    
    switch (status as OrderStatus) {
      case 'pending':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
            <ClockIcon className="h-3 w-3 mr-1" />
            Новый
          </span>
        );
      case 'confirmed':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
            <CheckIcon className="h-3 w-3 mr-1" />
            Подтвержден
          </span>
        );
      case 'preparing':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
            <ClockIcon className="h-3 w-3 mr-1" />
            Готовится
          </span>
        );
      case 'ready':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
            <CheckIcon className="h-3 w-3 mr-1" />
            Готов
          </span>
        );
      case 'completed':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
            <CheckIcon className="h-3 w-3 mr-1" />
            Завершен
          </span>
        );
      case 'cancelled':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
            <XIcon className="h-3 w-3 mr-1" />
            Отменен
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

  // Функция для получения статуса оплаты
  const getPaymentStatusIcon = (status: string | undefined) => {
    if (!status) {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
          Неизвестен
        </span>
      );
    }
    
    switch (status as PaymentStatus) {
      case 'paid':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
            <CheckIcon className="h-3 w-3 mr-1" />
            Оплачен
          </span>
        );
      case 'pending':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
            <ClockIcon className="h-3 w-3 mr-1" />
            Ожидает оплаты
          </span>
        );
      case 'failed':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
            <ExclamationIcon className="h-3 w-3 mr-1" />
            Ошибка оплаты
          </span>
        );
      case 'refunded':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
            <ArrowLeftIcon className="h-3 w-3 mr-1" />
            Возврат
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

  const formatDate = (dateString: string) => {
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
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center mb-6">
          <Link href="/admin" className="text-gray-600 hover:text-primary mr-4">
            <ArrowLeftIcon className="h-5 w-5" />
          </Link>
          <h1 className="text-3xl font-bold">Управление заказами</h1>
        </div>

        {/* Сообщение об ошибке */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-6">
            <p>{error}</p>
          </div>
        )}

        {/* Фильтры */}
        <div className="mb-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white p-4 rounded-lg shadow-md">
            {/* Статус заказа */}
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setActiveTab('all')}
                className={`px-4 py-2 rounded-md text-sm font-medium ${
                  activeTab === 'all' 
                    ? 'bg-primary text-white' 
                    : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                }`}
              >
                Все
              </button>
              <button
                onClick={() => setActiveTab('pending')}
                className={`px-4 py-2 rounded-md text-sm font-medium ${
                  activeTab === 'pending' 
                    ? 'bg-primary text-white' 
                    : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                }`}
              >
                Новые
              </button>
              <button
                onClick={() => setActiveTab('confirmed')}
                className={`px-4 py-2 rounded-md text-sm font-medium ${
                  activeTab === 'confirmed' 
                    ? 'bg-primary text-white' 
                    : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                }`}
              >
                Подтвержденные
              </button>
              <button
                onClick={() => setActiveTab('preparing')}
                className={`px-4 py-2 rounded-md text-sm font-medium ${
                  activeTab === 'preparing' 
                    ? 'bg-primary text-white' 
                    : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                }`}
              >
                Готовятся
              </button>
              <button
                onClick={() => setActiveTab('ready')}
                className={`px-4 py-2 rounded-md text-sm font-medium ${
                  activeTab === 'ready' 
                    ? 'bg-primary text-white' 
                    : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                }`}
              >
                Готовые
              </button>
              <button
                onClick={() => setActiveTab('completed')}
                className={`px-4 py-2 rounded-md text-sm font-medium ${
                  activeTab === 'completed' 
                    ? 'bg-primary text-white' 
                    : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                }`}
              >
                Завершенные
              </button>
              <button
                onClick={() => setActiveTab('cancelled')}
                className={`px-4 py-2 rounded-md text-sm font-medium ${
                  activeTab === 'cancelled' 
                    ? 'bg-primary text-white' 
                    : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                }`}
              >
                Отмененные
              </button>
            </div>

            {/* Выбор диапазона дат */}
            <div className="flex items-center space-x-4">
              <div>
                <label htmlFor="start" className="block text-sm font-medium text-gray-700">От</label>
                <div className="mt-1 relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <CalendarIcon className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type="date"
                    id="start"
                    name="start"
                    value={dateRange.start}
                    onChange={handleDateRangeChange}
                    className="focus:ring-primary focus:border-primary block w-full pl-10 sm:text-sm border-gray-300 rounded-md"
                  />
                </div>
              </div>
              <div>
                <label htmlFor="end" className="block text-sm font-medium text-gray-700">До</label>
                <div className="mt-1 relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <CalendarIcon className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type="date"
                    id="end"
                    name="end"
                    value={dateRange.end}
                    onChange={handleDateRangeChange}
                    className="focus:ring-primary focus:border-primary block w-full pl-10 sm:text-sm border-gray-300 rounded-md"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Кнопка обновления данных */}
        <div className="mb-4 flex justify-end">
          <button 
            onClick={fetchOrders}
            className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary-dark flex items-center"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
            </svg>
            Обновить
          </button>
        </div>

        {/* Список заказов */}
        {filteredOrders.length === 0 ? (
          <div className="bg-white rounded-lg shadow-md p-8 text-center">
            <div className="flex justify-center mb-4">
              <ClockIcon className="h-16 w-16 text-gray-400" />
            </div>
            <h2 className="text-2xl font-medium mb-4">Нет заказов</h2>
            <p className="text-gray-600 mb-6">
              По выбранным фильтрам не найдено ни одного заказа
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      № заказа
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Дата и время
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Клиент
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Столик
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Сумма
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Статус
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Оплата
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Действия
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredOrders.map((order) => (
                    <tr key={order.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">#{order.id}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{formatDate(order.created_at)}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm font-medium text-gray-900">
                          {order.user_id ? `${order.user?.full_name || 'Клиент #' + order.user_id}` : 'Анонимный клиент'}
                        </div>
                        <div className="text-sm text-gray-500">
                          {order.user?.phone || 'Телефон не указан'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {order.table_number ? `№${order.table_number}` : '-'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900">
                              {formatPrice(order.total_amount)}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {getStatusBadge(order.status as string | undefined)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {order.payment_status ? getPaymentStatusIcon(order.payment_status as string | undefined) : 
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                            Не указано
                          </span>
                        }
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex space-x-2">
                          <button
                            onClick={() => router.push(`/admin/orders/${order.id}`)}
                            className="px-3 py-1 bg-gray-200 text-gray-700 text-xs rounded hover:bg-gray-300"
                          >
                            <EyeIcon className="h-4 w-4" />
                          </button>
                          {order.status === 'pending' && (
                            <button 
                              onClick={() => handleUpdateStatus(order.id, 'confirmed')}
                              className="px-3 py-1 bg-blue-500 text-white text-xs rounded hover:bg-blue-600 flex items-center"
                              disabled={updatingOrderId === order.id}
                            >
                              {updatingOrderId === order.id ? (
                                <>
                                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                  </svg>
                                  Подтверждение...
                                </>
                              ) : 'Подтвердить'}
                            </button>
                          )}
                          {order.status === 'confirmed' && (
                            <button 
                              onClick={() => handleUpdateStatus(order.id, 'preparing')}
                              className="px-3 py-1 bg-indigo-500 text-white text-xs rounded hover:bg-indigo-600 flex items-center"
                              disabled={updatingOrderId === order.id}
                            >
                              {updatingOrderId === order.id ? (
                                <>
                                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                  </svg>
                                  Обновление...
                                </>
                              ) : 'Готовится'}
                            </button>
                          )}
                          {order.status === 'preparing' && (
                            <button 
                              onClick={() => handleUpdateStatus(order.id, 'ready')}
                              className="px-3 py-1 bg-green-500 text-white text-xs rounded hover:bg-green-600 flex items-center"
                              disabled={updatingOrderId === order.id}
                            >
                              {updatingOrderId === order.id ? (
                                <>
                                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                  </svg>
                                  Обновление...
                                </>
                              ) : 'Готов'}
                            </button>
                          )}
                          {order.status === 'ready' && (
                            <button 
                              onClick={() => handleUpdateStatus(order.id, 'completed')}
                              className="px-3 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700 flex items-center"
                              disabled={updatingOrderId === order.id}
                            >
                              {updatingOrderId === order.id ? (
                                <>
                                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                  </svg>
                                  Завершение...
                                </>
                              ) : 'Завершить'}
                            </button>
                          )}
                          {['pending', 'confirmed', 'preparing'].includes(order.status) && (
                            <button 
                              onClick={() => handleUpdateStatus(order.id, 'cancelled')}
                              className="px-3 py-1 bg-red-500 text-white text-xs rounded hover:bg-red-600 flex items-center"
                              disabled={updatingOrderId === order.id}
                            >
                              {updatingOrderId === order.id ? (
                                <>
                                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                  </svg>
                                  Отмена...
                                </>
                              ) : 'Отменить'}
                            </button>
                          )}
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

export default AdminOrdersPage; 