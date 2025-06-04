import {useState, useEffect} from 'react';
import {NextPage} from 'next';
import {useRouter} from 'next/router';
import Link from 'next/link';
import Layout from '../../../components/Layout';
import useAuthStore from '../../../lib/auth-store';
import {Order, OrderItem} from '../../../lib/api/types';
import {ordersApi} from '../../../lib/api/orders';
import {formatPrice} from '../../../utils/priceFormatter';
import {ClockIcon, CheckCircleIcon, XCircleIcon, BanknotesIcon as CashIcon, CreditCardIcon, ArrowLeftIcon, PhoneIcon, EnvelopeIcon as MailIcon, MapPinIcon as LocationMarkerIcon, DocumentTextIcon, CurrencyDollarIcon} from '@heroicons/react/24/outline';
import {ExclamationTriangleIcon as ExclamationIcon, CheckIcon} from '@heroicons/react/24/solid';

type OrderStatus = 'pending' | 'confirmed' | 'preparing' | 'ready' | 'completed' | 'cancelled';
type PaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded';

type StatusButtonProps = {
  status: string;
  currentStatus: string;
  onClick: () => void;
  disabled?: boolean;
};

const StatusButton = ({ status, currentStatus, onClick, disabled = false }: StatusButtonProps) => {
  const getStatusColor = () => {
    if (status === currentStatus) {
      return 'bg-primary text-white';
    }
    return 'bg-white text-gray-700 hover:bg-gray-50';
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`${getStatusColor()} inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
      {status}
    </button>
  );
};

const PaymentStatusButton = ({ status, currentStatus, onClick, disabled = false }: StatusButtonProps) => {
  const getStatusColor = () => {
    if (status === currentStatus) {
      return 'bg-primary text-white';
    }
    return 'bg-white text-gray-700 hover:bg-gray-50';
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`${getStatusColor()} inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
      {status}
    </button>
  );
};

const AdminOrderDetailPage: NextPage = () => {
  const router = useRouter();
  const { id } = router.query;
  const { user, isAuthenticated } = useAuthStore();
  const [order, setOrder] = useState<Order | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [updatingPayment, setUpdatingPayment] = useState(false);

  const statusOrder = ['new', 'confirmed', 'preparing', 'ready', 'completed', 'cancelled'];
  
  const paymentStatusOrder = ['pending', 'paid', 'refunded', 'failed'];

  useEffect(() => {
    if (!id || typeof id !== 'string') return;
    fetchOrder();
  }, [id]);

  const fetchOrder = async () => {
    try {
      setIsLoading(true);
      setError('');
      const fetchedOrder = await ordersApi.getOrderById(Number(id));
      if (!fetchedOrder) {
        throw new Error('Заказ не найден');
      }
      setOrder(fetchedOrder);
    } catch (err: any) {
      console.error('Ошибка при загрузке данных заказа:', err);
      setError(err.message || 'Не удалось загрузить данные заказа. Пожалуйста, попробуйте позже.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateStatus = async (newStatus: string) => {
    if (!order || updatingStatus) return;
    
    setUpdatingStatus(true);
    setError('');

    try {
      await ordersApi.updateOrderStatus(order.id, newStatus);
      await fetchOrder();
      alert(`Статус заказа #${order.id} успешно изменен на "${newStatus}"`);
    } catch (error: any) {
      console.error('Ошибка при обновлении статуса заказа:', error);
      setError(error.message || 'Произошла ошибка при обновлении статуса заказа');
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleUpdatePaymentStatus = async (newStatus: string) => {
    if (!order || updatingPayment) return;
    
    setUpdatingPayment(true);
    setError('');

    try {
      await ordersApi.updateOrderStatus(order.id, newStatus);
      await fetchOrder();
      alert(`Статус оплаты заказа #${order.id} успешно изменен на "${newStatus}"`);
    } catch (error: any) {
      console.error('Ошибка при обновлении статуса оплаты:', error);
      setError(error.message || 'Произошла ошибка при обновлении статуса оплаты');
    } finally {
      setUpdatingPayment(false);
    }
  };

  const isStatusChangeAllowed = (status: string) => {
    if (!order) return false;
    
    const currentIndex = statusOrder.indexOf(order.status);
    const newIndex = statusOrder.indexOf(status);
    
    // Особый случай для отмены заказа
    if (status === 'cancelled') {
      // Заказ можно отменить только если он не выполнен и не отменён
      return !['completed', 'cancelled'].includes(order.status);
    }
    
    // Для обычного порядка статусов
    // Можно изменить статус только на следующий в порядке или оставить текущий
    return newIndex === currentIndex || newIndex === currentIndex + 1;
  };

  const getStatusLabel = (status: string) => {
    const statusLabels: Record<string, string> = {
      'new': 'Новый',
      'confirmed': 'Подтвержден',
      'preparing': 'Готовится',
      'ready': 'Готов',
      'completed': 'Выполнен',
      'cancelled': 'Отменен'
    };
    
    return statusLabels[status] || status;
  };
  
  const getPaymentStatusLabel = (status: string) => {
    const statusLabels: Record<string, string> = {
      'pending': 'Ожидает оплаты',
      'paid': 'Оплачен',
      'refunded': 'Возврат средств',
      'failed': 'Ошибка оплаты'
    };
    
    return statusLabels[status] || status;
  };

  const getStatusColor = (status: string) => {
    const statusColors: Record<string, string> = {
      'new': 'bg-blue-100 text-blue-800',
      'confirmed': 'bg-yellow-100 text-yellow-800',
      'preparing': 'bg-orange-100 text-orange-800',
      'ready': 'bg-purple-100 text-purple-800',
      'completed': 'bg-green-100 text-green-800',
      'cancelled': 'bg-red-100 text-red-800'
    };
    
    return statusColors[status] || 'bg-gray-100 text-gray-800';
  };
  
  const getPaymentStatusColor = (status: string) => {
    const statusColors: Record<string, string> = {
      'pending': 'bg-yellow-100 text-yellow-800',
      'paid': 'bg-green-100 text-green-800',
      'refunded': 'bg-blue-100 text-blue-800',
      'failed': 'bg-red-100 text-red-800'
    };
    
    return statusColors[status] || 'bg-gray-100 text-gray-800';
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  if (isLoading) {
    return (
      <Layout title="Детали заказа | Админ-панель">
        <div className="container mx-auto px-4 py-8">
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
          </div>
        </div>
      </Layout>
    );
  }

  if (error) {
    return (
      <Layout title="Ошибка | Админ-панель">
        <div className="container mx-auto px-4 py-8">
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            <p className="flex items-center font-medium">
              <ExclamationIcon className="h-5 w-5 mr-2" />
              {error}
            </p>
            <p className="mt-2">
              <Link href="/admin/orders" className="text-red-700 underline">
                Вернуться к списку заказов
              </Link>
            </p>
          </div>
        </div>
      </Layout>
    );
  }

  if (!order) {
    return (
      <Layout title="Заказ не найден | Админ-панель">
        <div className="container mx-auto px-4 py-8">
          <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded mb-4">
            <p className="flex items-center font-medium">
              <ExclamationIcon className="h-5 w-5 mr-2" />
              Заказ не найден
            </p>
            <p className="mt-2">
              <Link href="/admin/orders" className="text-yellow-700 underline">
                Вернуться к списку заказов
              </Link>
            </p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout title={`Заказ #${order.id} | Админ-панель`}>
      <div className="container mx-auto px-4 py-8 dark:bg-gray-900 dark:text-white">
        {/* Навигация */}
        <div className="mb-6">
          <Link href="/admin/orders" className="text-primary hover:text-primary-dark inline-flex items-center">
            <ArrowLeftIcon className="h-4 w-4 mr-1 dark:text-white" />
            Вернуться к списку заказов
          </Link>
        </div>

        {/* Заголовок и статус */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6">
          <h1 className="text-3xl font-bold mb-4 md:mb-0 dark:text-white">Заказ #{order.id}</h1>
          <div className="flex flex-col sm:flex-row gap-2">
            <span className={`${getStatusColor(order.status)} px-3 py-1 rounded-full text-xs font-medium inline-flex items-center`}>
              {getStatusLabel(order.status)}
            </span>
            <span className={`${getPaymentStatusColor(order.payment_status)} px-3 py-1 rounded-full text-xs font-medium inline-flex items-center`}>
              {getPaymentStatusLabel(order.payment_status)}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 dark:bg-gray-800 dark:text-white">
          {/* Информация о заказе */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow-md overflow-hidden mb-6 dark:bg-gray-800 dark:text-white">
              <div className="px-6 py-4 border-b">
                <h2 className="text-xl font-semibold dark:text-white dark:bg-gray-800">Информация о заказе</h2>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                  <div>
                    <p className="text-sm text-gray-600 mb-1 dark:text-white dark:bg-gray-800">Дата заказа</p>
                    <p className="font-medium">{formatDate(order.created_at)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 mb-1 dark:text-white dark:bg-gray-800">Способ оплаты</p>
                    <p className="font-medium flex items-center">
                      {order.payment_status === 'paid' ? (
                        <CreditCardIcon className="h-5 w-5 text-gray-500 mr-1" />
                      ) : (
                        <CashIcon className="h-5 w-5 text-gray-500 mr-1" />
                      )}
                      {order.payment_method === 'card' ? 'Картой' : order.payment_method === 'cash' ? 'Наличными' : 'Не указано'}
                    </p>
                  </div>
                  {order.table_number && (
                    <div>
                      <p className="text-sm text-gray-600 mb-1 dark:text-white dark:bg-gray-800">Столик</p>
                      <p className="font-medium">№{order.table_number}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-sm text-gray-600 mb-1 dark:text-white dark:bg-gray-800">Срочный заказ</p>
                    <p className="font-medium">{order.is_urgent ? 'Да' : 'Нет'}</p>
                  </div>
                </div>

                {order.comment && (
                  <div className="mb-6">
                    <p className="text-sm text-gray-600 mb-1 dark:text-white dark:bg-gray-800">Комментарий к заказу</p>
                    <p className="bg-gray-50 p-3 rounded border border-gray-200 text-gray-800 dark:bg-gray-800 dark:text-white">{order.comment}</p>
                  </div>
                )}
                
                {/* Информация о клиенте */}
                <div className="border-t pt-4 mt-4">
                  <h3 className="text-lg font-medium mb-3">Информация о клиенте</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-600 mb-1 dark:text-white dark:bg-gray-800">Имя клиента</p>
                      <p className="font-medium">
                        {order.customer_name || order.user?.full_name || 'Не указано'}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600 mb-1 dark:text-white dark:bg-gray-800">Телефон</p>
                      <p className="font-medium">
                        {order.customer_phone || order.user?.phone || 'Не указано'}
                      </p>
                    </div>
                    {order.user && (
                      <div>
                        <p className="text-sm text-gray-600 mb-1 dark:text-white dark:bg-gray-800">Email</p>
                        <p className="font-medium">{order.user.email || 'Не указано'}</p>
                      </div>
                    )}
                    {order.user_id && (
                      <div>
                        <p className="text-sm text-gray-600 mb-1 dark:text-white dark:bg-gray-800">ID пользователя</p>
                        <p className="font-medium">{order.user_id}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Список позиций заказа */}
            <div className="bg-white rounded-lg shadow-md overflow-hidden dark:bg-gray-800 dark:text-white">
              <div className="px-6 py-4 border-b">
                <h2 className="text-xl font-semibold dark:text-white dark:bg-gray-800">Состав заказа</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50 dark:bg-gray-800">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-white dark:bg-gray-800">
                        Блюдо
                      </th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-white dark:bg-gray-800">
                        Количество
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-white dark:bg-gray-800">
                        Цена
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-white dark:bg-gray-800">
                        Сумма
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200 dark:bg-gray-800 dark:text-white">
                    {order.items && order.items.map((item: OrderItem, index) => (
                      <tr key={item.dish_id || index} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900 dark:text-white">
                            {item.dish_name || item.name || `Блюдо #${item.dish_id}`}
                          </div>
                          {item.special_instructions && (
                            <div className="text-xs text-gray-500 mt-1 italic dark:text-white">{item.special_instructions}</div>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <div className="text-sm text-gray-900 dark:text-white">{item.quantity}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          <div className="text-sm text-gray-900 dark:text-white">{formatPrice(item.price)}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          <div className="text-sm font-medium text-gray-900 dark:text-white">{formatPrice(item.price * item.quantity)}</div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-gray-50 dark:bg-gray-800">
                    <tr>
                      <td colSpan={3} className="px-6 py-4 text-right text-sm font-medium text-gray-900 dark:text-white">
                        Итого:
                      </td>
                      <td className="px-6 py-4 text-right text-base font-bold text-primary dark:text-white">
                        {formatPrice(order.total_amount)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </div>

          {/* Сайдбар */}
          <div className="lg:col-span-1">
            {/* Управление статусом заказа */}
            <div className="bg-white rounded-lg shadow-md overflow-hidden mb-6 dark:bg-gray-800 dark:text-white">
              <div className="px-6 py-4 border-b">
                <h2 className="text-xl font-semibold dark:text-white dark:bg-gray-800">Управление статусом</h2>
              </div>
              <div className="p-6 space-y-4">
                <div className="flex flex-col space-y-2">
                  {order.status === 'pending' && (
                    <button 
                      onClick={() => handleUpdateStatus('confirmed')}
                      className="bg-blue-500 text-white text-center py-3 px-4 rounded-md font-medium hover:bg-blue-600 transition flex items-center justify-center"
                      disabled={updatingStatus || !isStatusChangeAllowed('confirmed')}
                    >
                      {updatingStatus ? (
                        <>
                          <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Подтверждение...
                        </>
                      ) : (
                        <>
                          <CheckIcon className="h-5 w-5 mr-2" />
                          Подтвердить заказ
                        </>
                      )}
                    </button>
                  )}

                  {order.status === 'confirmed' && (
                    <button 
                      onClick={() => handleUpdateStatus('preparing')}
                      className="bg-indigo-500 text-white text-center py-3 px-4 rounded-md font-medium hover:bg-indigo-600 transition flex items-center justify-center"
                      disabled={updatingStatus || !isStatusChangeAllowed('preparing')}
                    >
                      {updatingStatus ? (
                        <>
                          <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Обновление...
                        </>
                      ) : (
                        <>
                          <ClockIcon className="h-5 w-5 mr-2" />
                          Передать на кухню
                        </>
                      )}
                    </button>
                  )}

                  {order.status === 'preparing' && (
                    <button 
                      onClick={() => handleUpdateStatus('ready')}
                      className="bg-green-500 text-white text-center py-3 px-4 rounded-md font-medium hover:bg-green-600 transition flex items-center justify-center"
                      disabled={updatingStatus || !isStatusChangeAllowed('ready')}
                    >
                      {updatingStatus ? (
                        <>
                          <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Обновление...
                        </>
                      ) : (
                        <>
                          <CheckIcon className="h-5 w-5 mr-2" />
                          Отметить как готовый
                        </>
                      )}
                    </button>
                  )}

                  {order.status === 'ready' && (
                    <button 
                      onClick={() => handleUpdateStatus('completed')}
                      className="bg-green-600 text-white text-center py-3 px-4 rounded-md font-medium hover:bg-green-700 transition flex items-center justify-center"
                      disabled={updatingStatus || !isStatusChangeAllowed('completed')}
                    >
                      {updatingStatus ? (
                        <>
                          <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Завершение...
                        </>
                      ) : (
                        <>
                          <CheckCircleIcon className="h-5 w-5 mr-2" />
                          Заказ доставлен
                        </>
                      )}
                    </button>
                  )}

                  {['pending', 'confirmed', 'preparing'].includes(order.status) && (
                    <button 
                      onClick={() => handleUpdateStatus('cancelled')}
                      className="bg-red-500 text-white text-center py-3 px-4 rounded-md font-medium hover:bg-red-600 transition flex items-center justify-center mt-2"
                      disabled={updatingStatus || !isStatusChangeAllowed('cancelled')}
                    >
                      {updatingStatus ? (
                        <>
                          <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Отмена...
                        </>
                      ) : (
                        <>
                          <XCircleIcon className="h-5 w-5 mr-2" />
                          Отменить заказ
                        </>
                      )}
                    </button>
                  )}
                </div>

                <div className="border-t mt-4 pt-4">
                  <p className="text-sm text-gray-600 mb-4">История изменений статуса</p>
                  <div className="space-y-2">
                    <div className="flex items-start">
                      <div className="flex-shrink-0 h-4 w-4 rounded-full bg-green-500 mt-1"></div>
                      <div className="ml-3">
                        <p className="text-sm font-medium">Создан</p>
                        <p className="text-xs text-gray-500">{formatDate(order.created_at)}</p>
                      </div>
                    </div>
                    {order.updated_at && order.updated_at !== order.created_at && (
                      <div className="flex items-start">
                        <div className="flex-shrink-0 h-4 w-4 rounded-full bg-blue-500 mt-1"></div>
                        <div className="ml-3">
                          <p className="text-sm font-medium">Обновлен</p>
                          <p className="text-xs text-gray-500">{formatDate(order.updated_at)}</p>
                        </div>
                      </div>
                    )}
                    {order.completed_at && (
                      <div className="flex items-start">
                        <div className="flex-shrink-0 h-4 w-4 rounded-full bg-green-600 mt-1"></div>
                        <div className="ml-3">
                          <p className="text-sm font-medium">Завершен</p>
                          <p className="text-xs text-gray-500">{formatDate(order.completed_at)}</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Действия */}
            <div className="bg-white rounded-lg shadow-md overflow-hidden dark:bg-gray-800 dark:text-white">
              <div className="px-6 py-4 border-b">
                <h2 className="text-xl font-semibold dark:text-white dark:bg-gray-800">Действия</h2>
              </div>
              <div className="p-6 space-y-3">
                <Link href={`/admin/orders`} className="bg-gray-100 text-gray-800 text-center py-3 px-4 rounded-md font-medium hover:bg-gray-200 transition flex items-center justify-center dark:bg-gray-800 dark:text-white dark:hover:bg-gray-700 dark:hover:text-white">
                  <DocumentTextIcon className="h-5 w-5 mr-2" />
                  Вернуться к списку заказов
                </Link>
                
                {order.payment_status === 'pending' && (
                  <button 
                    className="bg-green-500 text-white text-center py-3 px-4 rounded-md font-medium hover:bg-green-600 transition flex items-center justify-center"
                    onClick={() => alert('Функция приема оплаты временно недоступна')}
                  >
                    <CashIcon className="h-5 w-5 mr-2" />
                    Отметить как оплаченный
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default AdminOrderDetailPage; 