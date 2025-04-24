import { useState, useEffect } from 'react';
import { NextPage } from 'next';
import { useRouter } from 'next/router';
import Link from 'next/link';
import Layout from '../../../components/Layout';
import WaiterDashboard from '../../../components/WaiterDashboard';
import useAuthStore from '../../../lib/auth-store';
import { ordersApi } from '../../../lib/api';
import { Order } from '../../../types';
import { formatPrice } from '../../../utils/priceFormatter';
import { toast } from 'react-hot-toast';
import { 
  ClockIcon, 
  CheckCircleIcon, 
  XCircleIcon,
  ArrowLeftIcon,
  BuildingStorefrontIcon,
  TruckIcon,
  SparklesIcon,
  CheckIcon,
  UserIcon,
  PhoneIcon,
  MapPinIcon,
  CurrencyDollarIcon
} from '@heroicons/react/24/outline';

type OrderStatus = 'pending' | 'confirmed' | 'preparing' | 'ready' | 'delivered' | 'completed' | 'cancelled';

const statusTranslations: Record<string, string> = {
  'pending': 'Ожидает',
  'confirmed': 'Подтвержден',
  'preparing': 'Готовится',
  'ready': 'Готов',
  'delivered': 'Доставлен',
  'completed': 'Завершен',
  'cancelled': 'Отменен'
};

const OrderDetailPage: NextPage = () => {
  const router = useRouter();
  const { id } = router.query;
  const { isAuthenticated, user } = useAuthStore();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<OrderStatus | ''>('');

  useEffect(() => {
    // Проверка авторизации
    if (!isAuthenticated) {
      router.push('/auth/login');
      return;
    }

    // Проверка роли пользователя
    if (user?.role !== 'waiter' && user?.role !== 'admin') {
      router.push('/');
      toast.error('Доступ запрещен. Эта страница только для официантов и администраторов.');
      return;
    }

    if (!id) return;

    // Загрузка данных заказа
    const fetchOrder = async () => {
      try {
        setLoading(true);
        const fetchedOrder = await ordersApi.getOrderById(Number(id));
        setOrder(fetchedOrder);
        setSelectedStatus(fetchedOrder.status || '');
      } catch (err: any) {
        console.error('Ошибка при загрузке заказа:', err);
        setError(err.message || 'Не удалось загрузить данные заказа');
      } finally {
        setLoading(false);
      }
    };

    fetchOrder();
  }, [id, isAuthenticated, router, user]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-yellow-100 text-yellow-800">
            <ClockIcon className="h-4 w-4 mr-1" />
            Ожидает
          </span>
        );
      case 'confirmed':
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
            <CheckCircleIcon className="h-4 w-4 mr-1" />
            Подтвержден
          </span>
        );
      case 'preparing':
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-orange-100 text-orange-800">
            <SparklesIcon className="h-4 w-4 mr-1" />
            Готовится
          </span>
        );
      case 'ready':
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
            <CheckIcon className="h-4 w-4 mr-1" />
            Готов
          </span>
        );
      case 'delivered':
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
            <TruckIcon className="h-4 w-4 mr-1" />
            Доставлен
          </span>
        );
      case 'completed':
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
            <CheckCircleIcon className="h-4 w-4 mr-1" />
            Завершен
          </span>
        );
      case 'cancelled':
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-800">
            <XCircleIcon className="h-4 w-4 mr-1" />
            Отменен
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

  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return "Н/Д";
    
    try {
      const date = new Date(dateString);
      return new Intl.DateTimeFormat('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      }).format(date);
    } catch (error) {
      console.error('Ошибка форматирования даты:', error);
      return 'Недоступно';
    }
  };

  const handleStatusUpdate = async () => {
    if (!order || !selectedStatus) return;
    
    if (selectedStatus === order.status) {
      toast.error('Выберите другой статус для обновления');
      return;
    }
    
    try {
      setUpdatingStatus(true);
      await ordersApi.updateOrderStatus(order.id || 0, selectedStatus);
      
      // Обновляем данные заказа
      const updatedOrder = await ordersApi.getOrderById(Number(id));
      setOrder(updatedOrder);
      
      toast.success(`Статус заказа изменен на "${statusTranslations[selectedStatus]}"`);
    } catch (err: any) {
      console.error('Ошибка при обновлении статуса:', err);
      toast.error('Не удалось обновить статус заказа');
    } finally {
      setUpdatingStatus(false);
    }
  };

  // Проверяем доступные переходы статуса на основе текущего статуса
  const getAvailableStatuses = (currentStatus: string): OrderStatus[] => {
    switch (currentStatus) {
      case 'pending':
        return ['confirmed', 'cancelled'];
      case 'confirmed':
        return ['preparing', 'cancelled'];
      case 'preparing':
        return ['ready', 'cancelled'];
      case 'ready':
        return ['delivered', 'cancelled'];
      case 'delivered':
        return ['completed', 'cancelled'];
      default:
        return [];
    }
  };

  if (loading) {
    return (
      <Layout title="Загрузка...">
        <WaiterDashboard>
          <div className="p-4 flex justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
          </div>
        </WaiterDashboard>
      </Layout>
    );
  }

  if (error) {
    return (
      <Layout title="Ошибка">
        <WaiterDashboard>
          <div className="p-4">
            <div className="bg-red-50 border-l-4 border-red-500 text-red-700 p-4">
              <p>{error}</p>
            </div>
            <div className="mt-4">
              <Link href="/waiter/orders" className="inline-flex items-center text-blue-500">
                <ArrowLeftIcon className="h-4 w-4 mr-1" />
                Вернуться к списку заказов
              </Link>
            </div>
          </div>
        </WaiterDashboard>
      </Layout>
    );
  }

  if (!order) {
    return (
      <Layout title="Заказ не найден">
        <WaiterDashboard>
          <div className="p-4">
            <div className="bg-white rounded-lg shadow-md p-6 text-center">
              <h3 className="text-lg font-medium text-gray-900 mb-2">Заказ не найден</h3>
              <p className="text-gray-500 mb-4">
                Запрашиваемый заказ не найден или был удален
              </p>
              <Link href="/waiter/orders" className="btn btn-primary inline-flex items-center">
                <ArrowLeftIcon className="h-5 w-5 mr-1" />
                Вернуться к списку заказов
              </Link>
            </div>
          </div>
        </WaiterDashboard>
      </Layout>
    );
  }

  const availableStatuses = getAvailableStatuses(order.status);

  return (
    <Layout title={`Заказ №${order.id}`}>
      <WaiterDashboard>
        <div className="p-4">
          <div className="mb-4 flex items-center justify-between">
            <Link href="/waiter/orders" className="inline-flex items-center text-blue-500">
              <ArrowLeftIcon className="h-4 w-4 mr-1" />
              Назад к заказам
            </Link>
            <div>
              {getStatusBadge(order.status)}
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            {/* Заголовок заказа */}
            <div className="p-4 border-b border-gray-200 bg-gray-50">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold">Заказ №{order.id}</h2>
                <div className="text-sm text-gray-500">
                  {formatDate(order.created_at)}
                </div>
              </div>
            </div>
            
            {/* Секция для обновления статуса */}
            {availableStatuses.length > 0 && (
              <div className="p-4 border-b border-gray-200 bg-indigo-50">
                <h3 className="text-sm font-semibold mb-2">Обновить статус заказа</h3>
                <div className="flex flex-wrap gap-3">
                  {availableStatuses.map((status) => (
                    <button
                      key={status}
                      className={`px-3 py-1.5 rounded text-sm font-medium ${
                        selectedStatus === status 
                          ? 'bg-indigo-600 text-white' 
                          : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                      }`}
                      onClick={() => setSelectedStatus(status)}
                    >
                      {statusTranslations[status]}
                    </button>
                  ))}
                  
                  <button
                    className="ml-auto px-4 py-1.5 rounded bg-primary text-white text-sm font-medium disabled:bg-gray-300 disabled:cursor-not-allowed"
                    onClick={handleStatusUpdate}
                    disabled={updatingStatus || selectedStatus === order.status || !selectedStatus}
                  >
                    {updatingStatus ? 'Обновление...' : 'Обновить статус'}
                  </button>
                </div>
              </div>
            )}
            
            {/* Содержимое заказа */}
            <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Левая колонка - блюда */}
              <div>
                <h3 className="text-lg font-medium mb-3">Блюда в заказе</h3>
                <div className="space-y-3">
                  {order.items && order.items.length > 0 ? (
                    <>
                      {order.items.map((item, index) => (
                        <div key={index} className="flex justify-between border-b border-gray-100 pb-3">
                          <div>
                            <p className="font-medium">{item.name}</p>
                            <p className="text-sm text-gray-600">Количество: {item.quantity}</p>
                            {item.special_instructions && (
                              <p className="text-sm text-gray-500 italic">"{item.special_instructions}"</p>
                            )}
                          </div>
                          <div className="text-right">
                            <p className="font-medium">{formatPrice(item.price * item.quantity)}</p>
                            <p className="text-sm text-gray-600">{formatPrice(item.price)} за шт.</p>
                          </div>
                        </div>
                      ))}
                      <div className="pt-3 flex justify-between font-bold">
                        <p>Итого:</p>
                        <p>{formatPrice(order.total_amount)}</p>
                      </div>
                    </>
                  ) : (
                    <p className="text-gray-500 italic">Нет данных о блюдах в заказе</p>
                  )}
                </div>
              </div>
              
              {/* Правая колонка - информация о заказе */}
              <div>
                <h3 className="text-lg font-medium mb-3">Информация о заказе</h3>
                <div className="space-y-3">
                  {order.table_number && (
                    <div className="flex items-start">
                      <BuildingStorefrontIcon className="h-5 w-5 text-gray-400 mr-2 mt-0.5" />
                      <div>
                        <p className="font-medium">Стол №{order.table_number}</p>
                      </div>
                    </div>
                  )}
                  
                  {order.user && (
                    <div className="flex items-start">
                      <UserIcon className="h-5 w-5 text-gray-400 mr-2 mt-0.5" />
                      <div>
                        <p className="font-medium">{order.user.full_name || 'Гость'}</p>
                        {order.user.phone && <p className="text-sm text-gray-600">{order.user.phone}</p>}
                        {order.user.email && <p className="text-sm text-gray-600">{order.user.email}</p>}
                      </div>
                    </div>
                  )}
                  
                  {!order.user && order.customer_name && (
                    <div className="flex items-start">
                      <UserIcon className="h-5 w-5 text-gray-400 mr-2 mt-0.5" />
                      <div>
                        <p className="font-medium">{order.customer_name}</p>
                        {order.customer_phone && <p className="text-sm text-gray-600">{order.customer_phone}</p>}
                      </div>
                    </div>
                  )}
                  
                  {order.payment_status && (
                    <div className="flex items-start">
                      <CurrencyDollarIcon className="h-5 w-5 text-gray-400 mr-2 mt-0.5" />
                      <div>
                        <p className="font-medium">
                          Статус оплаты: 
                          <span className={`ml-1 ${
                            order.payment_status === 'paid' 
                              ? 'text-green-600' 
                              : order.payment_status === 'pending' 
                                ? 'text-yellow-600' 
                                : 'text-red-600'
                          }`}>
                            {order.payment_status === 'paid' 
                              ? 'Оплачен' 
                              : order.payment_status === 'pending' 
                                ? 'Ожидает оплаты' 
                                : 'Ошибка оплаты'}
                          </span>
                        </p>
                        {order.payment_method && (
                          <p className="text-sm text-gray-600">
                            Способ оплаты: {
                              order.payment_method === 'cash' 
                                ? 'Наличные' 
                                : order.payment_method === 'card' 
                                  ? 'Карта' 
                                  : order.payment_method
                            }
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                  
                  {order.delivery_address && (
                    <div className="flex items-start">
                      <MapPinIcon className="h-5 w-5 text-gray-400 mr-2 mt-0.5" />
                      <div>
                        <p className="font-medium">Адрес доставки:</p>
                        <p className="text-sm text-gray-600">{order.delivery_address}</p>
                      </div>
                    </div>
                  )}
                  
                  {order.comment && (
                    <div className="mt-4 p-3 bg-gray-50 rounded-md">
                      <p className="text-sm font-medium mb-1">Комментарий к заказу:</p>
                      <p className="text-sm text-gray-600">{order.comment}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </WaiterDashboard>
    </Layout>
  );
};

export default OrderDetailPage; 