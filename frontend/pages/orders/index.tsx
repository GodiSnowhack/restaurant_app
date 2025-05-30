import { useState, useEffect } from 'react';
import { NextPage } from 'next';
import { useRouter } from 'next/router';
import Link from 'next/link';
import Layout from '../../components/Layout';
import useAuthStore from '../../lib/auth-store';
import { Order } from '../../types';
import { ordersApi } from '../../lib/api/orders';
import { 
  ClockIcon, 
  CheckCircleIcon, 
  XCircleIcon, 
  BanknotesIcon as CashIcon,
  CreditCardIcon,
  ChevronRightIcon
} from '@heroicons/react/24/outline';
import { format } from 'date-fns';
import { Alert, Button, Paper, Typography, Box } from '@mui/material';

const OrdersPage: NextPage = () => {
  const router = useRouter();
  const { user, isAuthenticated } = useAuthStore();
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>('');
  const [dateRange, setDateRange] = useState({
    startDate: new Date(),
    endDate: new Date()
  });
  const [selectedStatus, setSelectedStatus] = useState('');

  useEffect(() => {
    // Загружаем данные даже если пользователь не авторизован, 
    // чтобы показать демо-данные
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    setIsLoading(true);
    setError(null);
    
    // Формируем параметры запроса для фильтрации
    const params: any = {};
    if (selectedStatus) params.status = selectedStatus;
    if (dateRange.startDate) params.start_date = format(dateRange.startDate, 'yyyy-MM-dd');
    if (dateRange.endDate) params.end_date = format(dateRange.endDate, 'yyyy-MM-dd');
    
    console.log('Запрашиваем заказы с параметрами:', params);
    
    try {
      // Проверяем токен авторизации для вывода информации в интерфейсе
      const isAuthorized = !!localStorage.getItem('token');
      
      // Получаем заказы с сервера
      const ordersData = await ordersApi.getAllOrders(params);
      console.log('Получены заказы:', ordersData);
      
      if (!Array.isArray(ordersData)) {
        console.error('Ошибка: данные заказов не являются массивом', ordersData);
        setError('Данные получены в неверном формате. Пожалуйста, обновите страницу.');
        setOrders([]);
      } else if (ordersData.length === 0) {
        console.log('Получен пустой список заказов');
        setOrders([]);
        
        // Показываем разные сообщения в зависимости от авторизации
        if (!isAuthorized) {
          setError('Для просмотра ваших заказов необходимо авторизоваться');
        }
      } else {
        // Сортируем заказы по дате (новые в начале)
        const sortedOrders = [...ordersData].sort((a, b) => {
          // Используем created_at или любое другое поле с датой
          const dateA = new Date(a.created_at || 0).getTime();
          const dateB = new Date(b.created_at || 0).getTime();
          return dateB - dateA;
        });
        
        setOrders(sortedOrders);
        
        // Если заказы загружены, но пользователь не авторизован,
        // показываем уведомление, что это демо-данные
        if (!isAuthorized && sortedOrders.length > 0) {
          setError('Вы видите демонстрационные данные. Для просмотра ваших заказов необходимо авторизоваться');
        }
      }
    } catch (error) {
      console.error('Ошибка при получении заказов:', error);
      setError('Не удалось загрузить данные заказов. Пожалуйста, проверьте соединение и повторите попытку.');
      setOrders([]);
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">Новый</span>;
      case 'confirmed':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">Подтвержден</span>;
      case 'preparing':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">Готовится</span>;
      case 'ready':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">Готов</span>;
      case 'delivered':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">Доставлен</span>;
      case 'completed':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">Завершен</span>;
      case 'cancelled':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">Отменен</span>;
      default:
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">{status || "Неизвестно"}</span>;
    }
  };

  const getPaymentStatusIcon = (paymentStatus: string | undefined) => {
    switch (paymentStatus) {
      case 'paid':
        return <CheckCircleIcon className="h-5 w-5 text-green-500" aria-label="Оплачен" />;
      case 'pending':
        return <ClockIcon className="h-5 w-5 text-yellow-500" aria-label="Ожидает оплаты" />;
      case 'failed':
        return <XCircleIcon className="h-5 w-5 text-red-500" aria-label="Ошибка оплаты" />;
      default:
        return <ClockIcon className="h-5 w-5 text-gray-400" aria-label="Неизвестный статус" />;
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

  if (isLoading) {
    return (
      <Layout title="Мои заказы">
        <div className="container mx-auto px-4 py-8">
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="Мои заказы">
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-6">Мои заказы</h1>

        {error && (
          <Alert 
            severity="error"
            sx={{ mt: 2, mb: 2 }}
            action={
              <Button color="inherit" size="small" onClick={fetchOrders}>
                Повторить
              </Button>
            }
          >
            {error}
          </Alert>
        )}

        {!isLoading && orders.length === 0 && !error && (
          <Paper sx={{ p: 4, textAlign: 'center', mt: 4 }}>
            <Typography variant="h6" gutterBottom>
              Заказы не найдены
            </Typography>
            <Typography variant="body1" color="textSecondary">
              {selectedStatus || dateRange.startDate 
                ? 'Попробуйте изменить параметры фильтрации'
                : 'В системе пока нет заказов'}
            </Typography>
            <Box sx={{ mt: 2, display: 'flex', justifyContent: 'center', gap: 2 }}>
              <Button 
                variant="outlined" 
                color="primary" 
                onClick={fetchOrders}
              >
                Обновить
              </Button>
              {!localStorage.getItem('token') && (
                <Button 
                  variant="contained" 
                  color="primary" 
                  onClick={() => router.push('/auth/login')}
                >
                  Войти в систему
                </Button>
              )}
            </Box>
          </Paper>
        )}

        {orders.length === 0 ? (
          <div className="bg-white rounded-lg shadow-md p-8 text-center">
            <div className="flex justify-center mb-4">
              <svg className="h-16 w-16 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <h2 className="text-2xl font-medium mb-4">У вас пока нет заказов</h2>
            <p className="text-gray-600 mb-6">
              Выберите блюда из нашего меню, чтобы оформить ваш первый заказ
            </p>
            <Link href="/menu" className="btn btn-primary inline-flex items-center">
              Перейти в меню
              <ChevronRightIcon className="h-5 w-5 ml-1" />
            </Link>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            <div className="px-6 py-4 border-b">
              <h2 className="text-xl font-semibold">История заказов</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Номер заказа
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Дата
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Клиент
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Телефон
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
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Действия
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {orders.map((order) => (
                    <tr key={order.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">#{order.id}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{formatDate(order.created_at)}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{order.customer_name || "—"}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{order.customer_phone || "—"}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {(order.total_amount !== undefined && order.total_amount !== null 
                            ? Number(order.total_amount).toFixed(2) 
                            : '0.00')} ₸
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {getStatusBadge(order.status)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          {order.payment_method === 'card' || order.payment_status === 'paid' ? (
                            <CreditCardIcon className="h-5 w-5 text-gray-400 mr-1" />
                          ) : (
                            <CashIcon className="h-5 w-5 text-gray-400 mr-1" />
                          )}
                          {getPaymentStatusIcon(order.payment_status)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <Link href={`/orders/${order.id}`} className="text-primary hover:text-primary-dark">
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
      </div>
    </Layout>
  );
};

export default OrdersPage; 