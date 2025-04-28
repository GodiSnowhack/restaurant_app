import { useState, useEffect, useCallback } from 'react';
import { NextPage } from 'next';
import { useRouter } from 'next/router';
import Link from 'next/link';
import Head from 'next/head';
import Layout from '../../../components/Layout';
import useAuthStore from '../../../lib/auth-store';
import { waiterApi } from '../../../lib/api';
import { formatPrice } from '../../../utils/priceFormatter';
import { 
  ClockIcon, 
  CheckCircleIcon, 
  XCircleIcon,
  ChevronRightIcon,
  ExclamationTriangleIcon,
  ListBulletIcon, 
  UserIcon,
  CalendarIcon,
  HomeIcon,
  ArrowPathIcon as RefreshIcon
} from '@heroicons/react/24/outline';

// Создаем локальные компоненты для Material UI
const Box = ({ sx, children }: { sx?: any, children: React.ReactNode }) => (
  <div style={sx} className="flex justify-center">{children}</div>
);

const CircularProgress = () => (
  <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-primary"></div>
);

const Alert = ({ severity, sx, children }: { severity: 'error' | 'info', sx?: any, children: React.ReactNode }) => (
  <div style={sx} className={`p-4 mb-4 rounded ${severity === 'error' ? 'bg-red-50 border-l-4 border-red-500 text-red-700' : 'bg-blue-50 border-l-4 border-blue-500 text-blue-700'}`}>
    {children}
  </div>
);

const Button = ({ variant, size, sx, onClick, startIcon, children }: { variant?: string, size?: string, sx?: any, onClick?: () => void, startIcon?: React.ReactNode, children: React.ReactNode }) => (
  <button 
    onClick={onClick} 
    style={sx}
    className={`${variant === 'contained' ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'border border-blue-600 hover:bg-blue-50 text-blue-600'} ${size === 'small' ? 'px-2 py-1 text-sm' : 'px-4 py-2'} rounded-md flex items-center transition-colors`}
  >
    {startIcon && <span className="mr-2">{startIcon}</span>}
    {children}
  </button>
);

const Grid = ({ container, spacing, children }: { container?: boolean, spacing?: number, children: React.ReactNode }) => (
  <div className={`${container ? 'grid' : ''} gap-${spacing || 4}`}>{children}</div>
);

const PageTitle = ({ children }: { children: React.ReactNode }) => (
  <h1 className="text-2xl font-bold mb-4">{children}</h1>
);

const MainContainer = ({ children }: { children: React.ReactNode }) => (
  <div className="container mx-auto px-4 py-8">{children}</div>
);

// Определение типа UserRole
enum UserRole {
  CLIENT = "client",
  WAITER = "waiter",
  ADMIN = "admin"
}

// Локальный интерфейс для работы с заказами на странице
interface WaiterOrder {
  id: number;
  status: string;
  payment_status: string;
  payment_method: string;
  total_amount: number;
  created_at: string;
  table_number?: number;
  customer_name?: string;
  items: OrderItem[];
  statusUpdating?: boolean;
}

interface OrderItem {
  dish_id: number;
  quantity: number;
  price: number;
  name: string;
  special_instructions?: string;
}

const statusColors = {
  new: 'bg-blue-100 text-blue-800',
  preparing: 'bg-yellow-100 text-yellow-800',
  ready: 'bg-green-100 text-green-800',
  delivered: 'bg-purple-100 text-purple-800',
  completed: 'bg-gray-100 text-gray-800',
  cancelled: 'bg-red-100 text-red-800',
};

const statusLabels = {
  new: 'Новый',
  preparing: 'Готовится',
  ready: 'Готов',
  delivered: 'Доставлен',
  completed: 'Завершен',
  cancelled: 'Отменен',
};

const statusIcons = {
  new: <ClockIcon className="h-5 w-5" />,
  preparing: <ClockIcon className="h-5 w-5" />,
  ready: <ClockIcon className="h-5 w-5" />,
  delivered: <CheckCircleIcon className="h-5 w-5" />,
  completed: <CheckCircleIcon className="h-5 w-5" />,
  cancelled: <XCircleIcon className="h-5 w-5" />,
};

const WaiterOrdersPage: NextPage = () => {
  const router = useRouter();
  const { isAuthenticated, user } = useAuthStore();
  const [orders, setOrders] = useState<WaiterOrder[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState<number>(0);
  
  const refreshOrders = useCallback(() => {
    setRefreshTrigger(prev => prev + 1);
  }, []);

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/auth/login?redirect=/waiter/orders');
    }
  }, [isAuthenticated, router]);

  useEffect(() => {
    const fetchOrders = async () => {
      setLoading(true);
      setError(null);
      try {
        console.log('WaiterOrders - Начало загрузки списка заказов');
        const data = await waiterApi.getWaiterOrders();
        console.log('WaiterOrders - Получены данные заказов:', data);
        
        if (!data || data.length === 0) {
          console.log('WaiterOrders - Список заказов пуст');
          setOrders([]);
        } else {
          // Проверяем корректность полученных данных и конвертируем их в нужный формат
          const validOrders: WaiterOrder[] = data
            .filter(order => order && typeof order === 'object' && order.id)
            .map(order => ({
              id: order.id || 0, // Убеждаемся, что id всегда существует
              status: order.status || 'new',
              payment_status: order.payment_status || 'not_paid',
              payment_method: order.payment_method || 'cash',
              total_amount: order.total_amount || 0,
              created_at: order.created_at || new Date().toISOString(),
              table_number: order.table_number,
              customer_name: order.customer_name,
              items: Array.isArray(order.items) ? order.items : [],
              statusUpdating: false
            }));
          
          if (validOrders.length < data.length) {
            console.warn(`WaiterOrders - Отфильтровано ${data.length - validOrders.length} некорректных заказов`);
          }
          
          setOrders(validOrders);
          console.log(`WaiterOrders - Установлено ${validOrders.length} заказов`);
        }
      } catch (err: any) {
        console.error('WaiterOrders - Ошибка при загрузке заказов:', err);
        setError(`Ошибка загрузки заказов: ${err.message || 'Неизвестная ошибка'}`);
        setOrders([]);
      } finally {
        setLoading(false);
      }
    };

    fetchOrders();
    
    // Устанавливаем интервал для периодического обновления
    const intervalId = setInterval(() => {
      console.log('WaiterOrders - Автоматическое обновление списка заказов');
      fetchOrders();
    }, 30000); // Обновляем каждые 30 секунд
    
    return () => {
      clearInterval(intervalId);
    };
  }, [refreshTrigger]);

  const handleStatusChange = async (orderId: number, newStatus: string) => {
    // Проверяем, не обновляется ли уже заказ
    const orderBeingUpdated = orders.find(o => o.id === orderId);
    if (orderBeingUpdated?.statusUpdating) {
      return;
    }
    
    // Получаем текущий статус для возможного отката
    const currentOrder = orders.find(o => o.id === orderId);
    const oldStatus = currentOrder?.status || '';
    
    // Немедленно обновляем UI (оптимистичное обновление)
    setOrders(prev => prev.map(order => 
      order.id === orderId ? { ...order, statusUpdating: true, status: newStatus } : order
    ));
    
    const displayStatus = statusLabels[newStatus as keyof typeof statusLabels] || newStatus;
    console.log(`Изменение статуса заказа #${orderId} на ${newStatus} (${displayStatus})`);
    
    try {
      // Получаем токен
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('Необходима авторизация');
      }
      
      // Пробуем все возможные способы обновления статуса заказа
      let updateSuccessful = false;
      
      // ВАРИАНТ 1: API-маршрут update-status
      try {
        console.log(`Пробуем обновить статус через основной API-маршрут`);
        const response = await fetch(`/api/orders/${orderId}/update-status`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ status: newStatus })
        });
        
        if (response.ok) {
          const data = await response.json();
          console.log('Результат обновления через основной маршрут:', data);
          updateSuccessful = true;
        } else {
          console.warn(`Основной API-маршрут вернул код ${response.status}`);
        }
      } catch (error) {
        console.error('Ошибка при использовании основного API-маршрута:', error);
      }
      
      // ВАРИАНТ 2: Запасной API-маршрут
      if (!updateSuccessful) {
        try {
          console.log(`Пробуем обновить статус через запасной API-маршрут`);
          const response = await fetch(`/api/waiter/update-order/${orderId}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ status: newStatus })
          });
          
          if (response.ok) {
            const data = await response.json();
            console.log('Результат обновления через запасной маршрут:', data);
            updateSuccessful = true;
          } else {
            console.warn(`Запасной API-маршрут вернул код ${response.status}`);
          }
        } catch (error) {
          console.error('Ошибка при использовании запасного API-маршрута:', error);
        }
      }
      
      // Обновляем UI, показывая, что загрузка завершена
      setOrders(prev => prev.map(order => 
        order.id === orderId ? { ...order, statusUpdating: false, status: newStatus } : order
      ));
      
      // Показываем сообщение об успехе
      if (updateSuccessful) {
        alert(`Статус заказа #${orderId} успешно изменен на "${displayStatus}"`);
        // Обновляем список заказов через 1 секунду
        setTimeout(() => refreshOrders(), 1000);
      } else {
        alert(`Статус заказа #${orderId} изменен на "${displayStatus}" (только в интерфейсе)`);
        // Пробуем обновить список заказов через 2 секунды
        setTimeout(() => refreshOrders(), 2000);
      }
    } catch (error: any) {
      console.error('Критическая ошибка при обновлении статуса заказа:', error);
      
      // Если произошла критическая ошибка, возвращаем старый статус
      if (oldStatus) {
        setOrders(prev => prev.map(order => 
          order.id === orderId ? { ...order, statusUpdating: false, status: oldStatus } : order
        ));
        alert(`Ошибка: ${error.message || 'Не удалось обновить статус заказа'}`);
      } else {
        // Если не можем восстановить старый статус, оставляем новый, но показываем сообщение
        setOrders(prev => prev.map(order => 
          order.id === orderId ? { ...order, statusUpdating: false } : order
        ));
        alert(`Предупреждение: ${error.message || 'Возникла ошибка при обновлении статуса заказа, но интерфейс был обновлен'}`);
      }
    }
  };

  if (!isAuthenticated || !user) {
    return (
      <Layout title="Загрузка...">
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-primary"></div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="Заказы">
      <Head>
        <title>Заказы официанта</title>
      </Head>
      <MainContainer>
        <PageTitle>Список ваших заказов</PageTitle>
        
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', my: 4 }}>
            <CircularProgress />
          </Box>
        ) : error ? (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
            <Button 
              variant="outlined" 
              size="small" 
              sx={{ ml: 2 }} 
              onClick={refreshOrders}
            >
              Попробовать снова
            </Button>
          </Alert>
        ) : orders.length === 0 ? (
          <Alert severity="info" sx={{ mb: 2 }}>
            У вас пока нет активных заказов. 
            <Button 
              variant="outlined" 
              size="small" 
              sx={{ ml: 2 }} 
              onClick={refreshOrders}
            >
              Обновить
            </Button>
          </Alert>
        ) : (
          <>
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
              <Button 
                variant="contained" 
                startIcon={<RefreshIcon className="h-5 w-5" />} 
                onClick={refreshOrders}
              >
                Обновить
              </Button>
            </Box>
            
            <Grid container spacing={2}>
              {orders.map((order) => (
                <div className="w-full mb-4" key={order.id}>
                  <div className="bg-white rounded-lg shadow-md p-4">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h3 className="text-lg font-medium">
                          Заказ #{order.id}
                          {order.table_number && <span className="ml-2">• Стол {order.table_number}</span>}
                        </h3>
                        <p className="text-gray-500 text-sm">
                          {new Date(order.created_at).toLocaleString('ru-RU')}
                          {order.customer_name && <span className="ml-2">• {order.customer_name}</span>}
                        </p>
                      </div>
                      
                      <div className="flex items-center">
                        <span className={`px-2 py-1 rounded-full text-xs flex items-center ${statusColors[order.status as keyof typeof statusColors] || 'bg-gray-100'}`}>
                          <span className="mr-1">{statusIcons[order.status as keyof typeof statusIcons]}</span>
                          {statusLabels[order.status as keyof typeof statusLabels] || order.status}
                        </span>
                      </div>
                    </div>

                    <div className="mt-3 border-t border-gray-100 pt-3">
                      <div className="text-sm font-medium mb-2">Блюда:</div>
                      <ul className="space-y-1">
                        {order.items && order.items.map((item, index) => (
                          <li key={index} className="text-sm flex justify-between">
                            <span>{item.quantity} × {item.name}</span>
                            <span className="text-gray-600">{item.price.toFixed(2)} ₸</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="flex justify-between items-center mt-4 border-t border-gray-100 pt-4">
                      <div className="font-medium">Итого: {order.total_amount.toFixed(2)} ₸</div>
                      
                      <div className="flex space-x-2">
                        <Link href={`/waiter/orders/${order.id}`} className="px-3 py-1 bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200 transition-colors text-sm">
                          Подробнее
                        </Link>
                        
                        {order.statusUpdating ? (
                          <div className="px-3 py-1 bg-gray-100 rounded-md flex items-center">
                            <svg className="animate-spin h-4 w-4 text-primary mr-1" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            <span className="text-sm">Обновление...</span>
                          </div>
                        ) : (
                          <>
                            {order.status === 'new' && (
                              <button
                                onClick={() => handleStatusChange(order.id, 'preparing')}
                                className="px-3 py-1 bg-yellow-100 text-yellow-700 rounded-md hover:bg-yellow-200 transition-colors text-sm"
                              >
                                Принять
                              </button>
                            )}
                            
                            {order.status === 'preparing' && (
                              <button
                                onClick={() => handleStatusChange(order.id, 'ready')}
                                className="px-3 py-1 bg-green-100 text-green-700 rounded-md hover:bg-green-200 transition-colors text-sm"
                              >
                                Готов
                              </button>
                            )}
                            
                            {order.status === 'ready' && (
                              <button
                                onClick={() => handleStatusChange(order.id, 'delivered')}
                                className="px-3 py-1 bg-purple-100 text-purple-700 rounded-md hover:bg-purple-200 transition-colors text-sm"
                              >
                                Доставлен
                              </button>
                            )}
                            
                            {order.status === 'delivered' && (
                              <button
                                onClick={() => handleStatusChange(order.id, 'completed')}
                                className="px-3 py-1 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors text-sm"
                              >
                                Завершить
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </Grid>
          </>
        )}
      </MainContainer>
    </Layout>
  );
};

export default WaiterOrdersPage; 