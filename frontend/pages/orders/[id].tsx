import { useState, useEffect } from 'react';
import { NextPage } from 'next';
import { useRouter } from 'next/router';
import Link from 'next/link';
import Layout from '../../components/Layout';
import useAuthStore from '../../lib/auth-store';
import { Order, OrderItem } from '../../types';
import { ordersApi } from '../../lib/api';
import { formatPrice } from '../../utils/priceFormatter';
import { 
  ClockIcon, 
  CheckCircleIcon, 
  XCircleIcon, 
  BanknotesIcon as CashIcon,
  CreditCardIcon,
  ArrowLeftIcon,
  PhoneIcon,
  EnvelopeIcon as MailIcon,
  MapPinIcon as LocationMarkerIcon,
  CheckIcon,
  XMarkIcon as XIcon
} from '@heroicons/react/24/outline';
import { 
  ExclamationTriangleIcon as ExclamationIcon
} from '@heroicons/react/24/solid';

const OrderDetailPage: NextPage = () => {
  const router = useRouter();
  const { id, success } = router.query;
  const { isAuthenticated } = useAuthStore();
  const [order, setOrder] = useState<Order | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [isCancelling, setIsCancelling] = useState(false);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/auth/login');
      return;
    }

    if (!id) return;

    const fetchOrder = async () => {
      try {
        setIsLoading(true);
        const fetchedOrder = await ordersApi.getOrderById(Number(id));
        setOrder(fetchedOrder);
      } catch (err) {
        console.error('Ошибка при загрузке данных заказа:', err);
        setError('Не удалось загрузить данные заказа. Пожалуйста, попробуйте позже.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchOrder();
  }, [id, isAuthenticated, router]);

  const handleCancelOrder = async () => {
    if (!order || isCancelling) return;
    
    if (!confirm('Вы уверены, что хотите отменить заказ? Это действие нельзя отменить.')) {
      return;
    }
    
    setIsCancelling(true);
    setError(null);
    
    try {
      await ordersApi.cancelOrder(order.id);
      
      // Обновляем данные заказа после отмены
      const updatedOrder = await ordersApi.getOrderById(Number(id));
      setOrder(updatedOrder);
      
      alert('Заказ успешно отменен');
    } catch (err) {
      console.error('Ошибка при отмене заказа:', err);
      alert('Не удалось отменить заказ. Пожалуйста, попробуйте позже.');
    } finally {
      setIsCancelling(false);
    }
  };

  const handlePayOrder = async () => {
    if (!order || isProcessingPayment) return;
    
    setIsProcessingPayment(true);
    setError(null);
    
    try {
      await ordersApi.updateOrderPaymentStatus(order.id, 'paid');
      
      // Обновляем данные заказа после оплаты
      const updatedOrder = await ordersApi.getOrderById(Number(id));
      setOrder(updatedOrder);
      
      alert('Заказ успешно оплачен');
    } catch (err) {
      console.error('Ошибка при обработке оплаты:', err);
      alert('Не удалось обработать оплату. Пожалуйста, попробуйте позже.');
    } finally {
      setIsProcessingPayment(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'created':
        return (
          <div className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
            <ClockIcon className="h-4 w-4 mr-1" />
            Создан
          </div>
        );
      case 'processing':
        return (
          <div className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-yellow-100 text-yellow-800">
            <ClockIcon className="h-4 w-4 mr-1" />
            В обработке
          </div>
        );
      case 'cooking':
        return (
          <div className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-orange-100 text-orange-800">
            <ClockIcon className="h-4 w-4 mr-1" />
            Готовится
          </div>
        );
      case 'ready':
        return (
          <div className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
            <CheckIcon className="h-4 w-4 mr-1" />
            Готов
          </div>
        );
      case 'delivered':
        return (
          <div className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
            <CheckCircleIcon className="h-4 w-4 mr-1" />
            Доставлен
          </div>
        );
      case 'cancelled':
        return (
          <div className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-800">
            <XCircleIcon className="h-4 w-4 mr-1" />
            Отменен
          </div>
        );
      default:
        return (
          <div className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-800">
            {status}
          </div>
        );
    }
  };

  const getPaymentStatusBadge = (status: string) => {
    switch (status) {
      case 'paid':
        return (
          <div className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
            <CheckCircleIcon className="h-4 w-4 mr-1" />
            Оплачен
          </div>
        );
      case 'pending':
        return (
          <div className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-yellow-100 text-yellow-800">
            <ClockIcon className="h-4 w-4 mr-1" />
            Ожидает оплаты
          </div>
        );
      case 'failed':
        return (
          <div className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-800">
            <XCircleIcon className="h-4 w-4 mr-1" />
            Ошибка оплаты
          </div>
        );
      default:
        return (
          <div className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-800">
            {status}
          </div>
        );
    }
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
      <Layout title="Загрузка заказа...">
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
        </div>
      </Layout>
    );
  }

  if (error) {
    return (
      <Layout title="Ошибка">
        <div className="container mx-auto px-4 py-8">
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            <p className="flex items-center font-medium">
              <ExclamationIcon className="h-5 w-5 mr-2" />
              {error}
            </p>
            <p className="mt-2">
              <Link href="/orders" className="text-red-700 underline">
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
      <Layout title="Заказ не найден">
        <div className="container mx-auto px-4 py-8">
          <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded mb-4">
            <p className="flex items-center font-medium">
              <ExclamationIcon className="h-5 w-5 mr-2" />
              Заказ не найден
            </p>
            <p className="mt-2">
              <Link href="/orders" className="text-yellow-700 underline">
                Вернуться к списку заказов
              </Link>
            </p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout title={`Заказ #${order.id}`}>
      <div className="container mx-auto px-4 py-8">
        {/* Успешное оформление заказа */}
        {success === 'true' && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-6 mb-8 shadow-sm">
            <div className="flex items-center mb-4">
              <div className="flex-shrink-0 bg-green-100 rounded-full p-2">
                <CheckIcon className="h-8 w-8 text-green-600" />
              </div>
              <div className="ml-4">
                <h2 className="text-2xl font-bold text-green-800">Заказ успешно оформлен!</h2>
                <p className="text-green-700">Ваш заказ принят и скоро будет обработан</p>
              </div>
            </div>
            <div className="pl-14 text-green-700">
              <p className="mb-2">Номер вашего заказа: <span className="font-bold">#{order.id}</span></p>
              <p>Спасибо за заказ! Вы можете отслеживать его статус на этой странице.</p>
            </div>
          </div>
        )}

        {/* Навигация */}
        <div className="mb-6">
          <Link href="/orders" className="text-primary hover:text-primary-dark inline-flex items-center">
            <ArrowLeftIcon className="h-4 w-4 mr-1" />
            Вернуться к списку заказов
          </Link>
        </div>

        {/* Заголовок и статус */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6">
          <h1 className="text-3xl font-bold mb-4 md:mb-0">Заказ #{order.id}</h1>
          <div className="flex flex-col sm:flex-row gap-2">
            {getStatusBadge(order.status)}
            {getPaymentStatusBadge(order.payment_status)}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Информация о заказе */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow-md overflow-hidden mb-6">
              <div className="px-6 py-4 border-b">
                <h2 className="text-xl font-semibold">Информация о заказе</h2>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Дата заказа</p>
                    <p className="font-medium">{formatDate(order.created_at)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Способ оплаты</p>
                    <p className="font-medium flex items-center">
                      {order.payment_status === 'paid' ? (
                        <CreditCardIcon className="h-5 w-5 text-gray-500 mr-1" />
                      ) : (
                        <CashIcon className="h-5 w-5 text-gray-500 mr-1" />
                      )}
                      {order.payment_status === 'paid' ? 'Картой' : 'Наличными при получении'}
                    </p>
                  </div>
                  {order.table_number && (
                    <div>
                      <p className="text-sm text-gray-600 mb-1">Столик</p>
                      <p className="font-medium">№{order.table_number}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Срочный заказ</p>
                    <p className="font-medium">{order.is_urgent ? 'Да' : 'Нет'}</p>
                  </div>
                </div>

                {order.comment && (
                  <div className="mb-6">
                    <p className="text-sm text-gray-600 mb-1">Комментарий к заказу</p>
                    <p className="bg-gray-50 p-3 rounded border border-gray-200 text-gray-800">{order.comment}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Список позиций заказа */}
            <div className="bg-white rounded-lg shadow-md overflow-hidden">
              <div className="px-6 py-4 border-b">
                <h2 className="text-xl font-semibold">Состав заказа</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Блюдо
                      </th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Количество
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Цена
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Сумма
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {order.items.map((item: OrderItem) => (
                      <tr key={item.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">{item.dish?.name || `Блюдо #${item.dish_id}`}</div>
                          {item.comment && (
                            <div className="text-xs text-gray-500 mt-1 italic">{item.comment}</div>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <div className="text-sm text-gray-900">{item.quantity}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          <div className="text-sm text-gray-900">{formatPrice(item.price)}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          <div className="text-sm font-medium text-gray-900">{formatPrice(item.price * item.quantity)}</div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-gray-50">
                    <tr>
                      <td colSpan={3} className="px-6 py-4 text-right text-sm font-medium text-gray-900">
                        Итого:
                      </td>
                      <td className="px-6 py-4 text-right text-base font-bold text-primary">
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
            {/* Информация о ресторане */}
            <div className="bg-white rounded-lg shadow-md overflow-hidden mb-6">
              <div className="px-6 py-4 border-b">
                <h2 className="text-xl font-semibold">Контактная информация</h2>
              </div>
              <div className="p-6">
                <div className="space-y-4">
                  <div className="flex items-start">
                    <LocationMarkerIcon className="h-5 w-5 text-gray-500 mt-0.5 mr-3" />
                    <div>
                      <p className="text-sm font-medium">Адрес ресторана</p>
                      <p className="text-sm text-gray-600">ул. Пушкина, д. 10, Москва</p>
                    </div>
                  </div>
                  <div className="flex items-start">
                    <PhoneIcon className="h-5 w-5 text-gray-500 mt-0.5 mr-3" />
                    <div>
                      <p className="text-sm font-medium">Телефон</p>
                      <a href="tel:+79991234567" className="text-sm text-primary hover:underline">+7 (999) 123-45-67</a>
                    </div>
                  </div>
                  <div className="flex items-start">
                    <MailIcon className="h-5 w-5 text-gray-500 mt-0.5 mr-3" />
                    <div>
                      <p className="text-sm font-medium">Email</p>
                      <a href="mailto:info@restaurant.ru" className="text-sm text-primary hover:underline">info@restaurant.ru</a>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Кнопки действий */}
            <div className="bg-white rounded-lg shadow-md overflow-hidden">
              <div className="px-6 py-4 border-b">
                <h2 className="text-xl font-semibold">Действия</h2>
              </div>
              <div className="p-6 space-y-3">
                <Link href="/menu" className="block w-full bg-primary text-white text-center py-3 px-4 rounded-md font-medium hover:bg-primary-dark transition">
                  Перейти в меню
                </Link>
                
                {order.payment_status === 'pending' && (
                  <button 
                    className="block w-full bg-green-600 text-white text-center py-3 px-4 rounded-md font-medium hover:bg-green-700 transition flex items-center justify-center"
                    onClick={handlePayOrder}
                    disabled={isProcessingPayment}
                  >
                    {isProcessingPayment ? (
                      <>
                        <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Обработка...
                      </>
                    ) : (
                      <>
                        <CreditCardIcon className="h-5 w-5 mr-2" />
                        Оплатить заказ
                      </>
                    )}
                  </button>
                )}
                
                {['created', 'processing'].includes(order.status) && (
                  <button 
                    className="block w-full bg-red-600 text-white text-center py-3 px-4 rounded-md font-medium hover:bg-red-700 transition flex items-center justify-center"
                    onClick={handleCancelOrder}
                    disabled={isCancelling}
                  >
                    {isCancelling ? (
                      <>
                        <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Отмена...
                      </>
                    ) : (
                      <>
                        <XIcon className="h-5 w-5 mr-2" />
                        Отменить заказ
                      </>
                    )}
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

export default OrderDetailPage; 