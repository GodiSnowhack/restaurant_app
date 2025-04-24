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
import { 
  ClockIcon, 
  CheckCircleIcon, 
  XCircleIcon,
  ChevronRightIcon,
  QrCodeIcon
} from '@heroicons/react/24/outline';

const WaiterOrdersPage: NextPage = () => {
  const router = useRouter();
  const { isAuthenticated, user } = useAuthStore();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    // Проверка авторизации
    if (!isAuthenticated) {
      router.push('/auth/login');
      return;
    }

    // Проверка роли пользователя
    if (user?.role !== 'waiter' && user?.role !== 'admin') {
      router.push('/');
      return;
    }

    // Загрузка заказов, привязанных к официанту
    const fetchOrders = async () => {
      try {
        setLoading(true);
        const fetchedOrders = await ordersApi.getWaiterOrders();
        console.log('Заказы официанта:', fetchedOrders);
        setOrders(fetchedOrders);
      } catch (err: any) {
        console.error('Ошибка при загрузке заказов:', err);
        setError(err.message || 'Не удалось загрузить заказы');
      } finally {
        setLoading(false);
      }
    };

    fetchOrders();
  }, [isAuthenticated, router, user]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
            <ClockIcon className="h-3 w-3 mr-1" />
            Ожидает
          </span>
        );
      case 'confirmed':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
            <ClockIcon className="h-3 w-3 mr-1" />
            Подтвержден
          </span>
        );
      case 'preparing':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
            <ClockIcon className="h-3 w-3 mr-1" />
            Готовится
          </span>
        );
      case 'ready':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
            <CheckCircleIcon className="h-3 w-3 mr-1" />
            Готов
          </span>
        );
      case 'delivered':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
            <CheckCircleIcon className="h-3 w-3 mr-1" />
            Доставлен
          </span>
        );
      case 'completed':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
            <CheckCircleIcon className="h-3 w-3 mr-1" />
            Завершен
          </span>
        );
      case 'cancelled':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
            <XCircleIcon className="h-3 w-3 mr-1" />
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

  return (
    <Layout title="Заказы официанта">
      <WaiterDashboard>
        <div className="p-4">
          <div className="mb-4 flex justify-between items-center">
            <h1 className="text-xl font-bold">Мои заказы</h1>
            <Link href="/waiter/scan" className="btn btn-primary inline-flex items-center text-sm">
              <QrCodeIcon className="h-4 w-4 mr-1" />
              Сканировать QR
            </Link>
          </div>
          
          {error && (
            <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-4">
              <p>{error}</p>
            </div>
          )}
          
          {loading ? (
            <div className="flex justify-center items-center p-8">
              <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-primary"></div>
            </div>
          ) : orders.length > 0 ? (
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <ul className="divide-y divide-gray-200">
                {orders.map((order) => (
                  <li key={order.id} className="p-4">
                    <Link href={`/waiter/orders/${order.id}`}>
                      <div className="flex justify-between items-center">
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="font-medium">№{order.id}</span>
                            {getStatusBadge(order.status)}
                            {order.table_number && (
                              <span className="text-sm text-gray-500">
                                Стол №{order.table_number}
                              </span>
                            )}
                          </div>
                          <div className="text-sm text-gray-500 mt-1">
                            {formatDate(order.created_at)}
                          </div>
                          <div className="mt-1">
                            {order.items && order.items.length > 0 ? (
                              <span className="text-sm text-gray-700">{order.items.length} блюд</span>
                            ) : (
                              <span className="text-sm text-gray-500">Нет данных о блюдах</span>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-col items-end">
                          <span className="font-medium">{formatPrice(order.total_amount)}</span>
                          <ChevronRightIcon className="h-5 w-5 text-gray-400 mt-2" />
                        </div>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow-md p-8 text-center">
              <QrCodeIcon className="h-12 w-12 mx-auto text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">У вас пока нет заказов</h3>
              <p className="text-gray-500 mb-4">
                Отсканируйте QR-код заказа, чтобы начать обслуживание
              </p>
              <Link href="/waiter/scan" className="btn btn-primary inline-flex items-center">
                <QrCodeIcon className="h-5 w-5 mr-1" />
                Сканировать QR-код
              </Link>
            </div>
          )}
        </div>
      </WaiterDashboard>
    </Layout>
  );
};

export default WaiterOrdersPage; 