import { useState, useEffect } from 'react';
import { NextPage } from 'next';
import { useRouter } from 'next/router';
import Link from 'next/link';
import Layout from '../../components/Layout';
import useAuthStore from '../../lib/auth-store';
import { Order, OrderItem } from '@/lib/api/types';
import { ordersApi } from '../../lib/api/orders';
import { waiterApi } from '../../lib/api/waiter-api';
import { formatPrice } from '../../utils/priceFormatter';
import OrderCode from '../../components/OrderCode';
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
  XMarkIcon as XIcon,
  BugAntIcon
} from '@heroicons/react/24/outline';
import { 
  ExclamationTriangleIcon as ExclamationIcon
} from '@heroicons/react/24/solid';
import ReviewForm from '../../components/orders/ReviewForm';
import { updateOrderPaymentStatus } from "../../lib/api/order-payment";
import { toast } from 'react-hot-toast';

// Расширяем тип Order с полем comment и special_instructions
interface ExtendedOrder extends Omit<Order, 'waiter_id'> {
  comment?: string;
  special_instructions?: string;
  waiter_id?: number | null;
}

const OrderDetailPage: NextPage = () => {
  const router = useRouter();
  const { id, success } = router.query;
  const { isAuthenticated, user } = useAuthStore();
  const [order, setOrder] = useState<ExtendedOrder | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [isCancelling, setIsCancelling] = useState(false);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [debugData, setDebugData] = useState<any>(null);
  const [isLoadingDebug, setIsLoadingDebug] = useState(false);
  const [showDebug, setShowDebug] = useState(false);
  const [waiterCode, setWaiterCode] = useState<string | null>(null);

  // Устанавливаем флаг монтирования компонента после рендера на клиенте
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Показываем уведомление об успешном создании заказа
  useEffect(() => {
    if (success === 'true' && isMounted) {
      toast.success('Заказ успешно создан!', {
        duration: 3000,
        position: 'top-center',
      });
      // Удаляем параметр success из URL
      router.replace(`/orders/${id}`, undefined, { shallow: true });
    }
  }, [success, isMounted, id, router]);

  // Загружаем данные заказа
  useEffect(() => {
    if (!id || typeof id !== 'string') return;
    
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

    fetchOrder();
  }, [id]);

  // Определяем функцию загрузки заказа
  const fetchOrderData = async () => {
    try {
      setIsLoading(true);
      setError('');
      console.log(`Запрос данных заказа ID: ${id}`);
      
      // Максимальное количество попыток загрузки
      const maxRetries = 2; // Уменьшаем до 2 попыток
      let attempt = 0;
      let fetchedOrder = null;
      
      while (attempt < maxRetries && !fetchedOrder) {
        attempt++;
        try {
          // Проверяем наличие токена перед запросом
          const token = localStorage.getItem('token');
          if (!token) {
            console.error('Отсутствует токен авторизации. Перенаправление на страницу входа...');
            router.push('/auth/login');
            return;
          }
          
          fetchedOrder = await ordersApi.getOrderById(Number(id));
        } catch (apiError: any) {
          console.error(`Попытка ${attempt}/${maxRetries} получения заказа не удалась:`, apiError);
          
          // Если ошибка связана с авторизацией
          if (apiError.message && apiError.message.includes('401')) {
            if (attempt === maxRetries) {
              console.warn('Максимальное количество попыток авторизации исчерпано. Перенаправление на страницу входа...');
              router.push('/auth/login');
              return;
            }
          }
          
          // Если это последняя попытка, бросаем ошибку дальше
          if (attempt === maxRetries) {
            throw apiError;
          }
          
          // Увеличиваем задержку с каждой попыткой
          const delay = 2000 * attempt; // 2 секунды, затем 4 секунды
          console.log(`Ожидание ${delay}мс перед следующей попыткой...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
      
      // Подробное логирование полученных данных для отладки
      console.log('Получены данные заказа:', fetchedOrder);
      
      if (!fetchedOrder || typeof fetchedOrder !== 'object') {
        throw new Error('Получены некорректные данные заказа');
      }
      
      // Проверка и нормализация полученных данных
      const normalizedOrder: ExtendedOrder = {
        ...fetchedOrder,
        id: fetchedOrder.id || 0,
        status: fetchedOrder.status || 'pending',
        payment_status: fetchedOrder.payment_status || 'pending',
        payment_method: fetchedOrder.payment_method || '',
        total_amount: fetchedOrder.total_amount || 0,
        items: Array.isArray(fetchedOrder.items) ? fetchedOrder.items.map((item: any) => ({
          ...item,
          dish_id: item.dish_id,
          name: item.dish_name || item.name,
          quantity: item.quantity || 1,
          price: item.price || 0,
          special_instructions: item.special_instructions || ''
        })) : [],
        order_code: fetchedOrder.order_code || '',
        // Обработка ситуации, когда поле user отсутствует или имеет неверную структуру
        user: fetchedOrder.user && typeof fetchedOrder.user === 'object' ? {
          id: fetchedOrder.user.id || 0,
          full_name: fetchedOrder.user.full_name || '',
          email: fetchedOrder.user.email || '',
          phone: fetchedOrder.user.phone || ''
        } : undefined
      };
      
      console.log('Нормализованные данные заказа:', normalizedOrder);
      setOrder(normalizedOrder);
    } catch (err: any) {
      console.error('Ошибка при загрузке данных заказа:', err);
      
      // Проверяем тип ошибки и предоставляем понятное объяснение
      if (err.message) {
        // Ошибка 401 - проблема авторизации
        if (err.message.includes('401') || err.message.includes('Unauthorized')) {
          setError('Ошибка авторизации. Возможно, ваша сессия истекла. Попробуйте обновить страницу или войти снова.');
        }
        // Ошибка 500 - внутренняя ошибка сервера
        else if (err.message.includes('500') || err.message.includes('Internal Server Error')) {
          setError('Произошла внутренняя ошибка на сервере. Администратор уведомлен, пожалуйста, повторите попытку позже.');
        }
        // Ошибка 404 - заказ не найден
        else if (err.message.includes('404')) {
          setError(`Заказ №${id} не найден. Возможно, он был удален или у вас нет прав для его просмотра.`);
        }
        // Другие типы ошибок
        else {
          setError(`Не удалось загрузить данные заказа. ${err.message}`);
        }
      } else {
        setError('Не удалось загрузить данные заказа. Пожалуйста, попробуйте позже.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Функция для загрузки отладочных данных заказа
  const fetchDebugData = async () => {
    try {
      setIsLoadingDebug(true);
      setError('');
      console.log(`Запрос отладочных данных заказа ID: ${id}`);
      const debugData = await ordersApi.getOrderById(Number(id));
      
      console.log('Получены отладочные данные заказа:', debugData);
      setDebugData(debugData);
      setShowDebug(true);
    } catch (err: any) {
      console.error('Ошибка при загрузке отладочных данных заказа:', err);
      
      let errorMessage = 'Не удалось загрузить отладочные данные заказа.';
      if (err.message) {
        errorMessage += ` ${err.message}`;
      }
      
      alert(errorMessage);
    } finally {
      setIsLoadingDebug(false);
    }
  };

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/auth/login');
      return;
    }

    if (!id) return;

    fetchOrderData();
  }, [id, isAuthenticated, router]);

  useEffect(() => {
    if (order?.id) {
      try {
        const storedCode = localStorage.getItem(`order_${order.id}_waiter_code`);
        if (storedCode) {
          console.log('Найден код официанта для заказа в localStorage:', storedCode);
          setWaiterCode(storedCode);
          
          // Если код заказа не задан или не совпадает с кодом официанта,
          // устанавливаем код официанта как код заказа для отображения
          if (!order.order_code || order.order_code !== storedCode) {
            console.log('Код заказа и код официанта различаются:', 
              { orderCode: order.order_code, waiterCode: storedCode });
            
            const updatedOrder = {...order, order_code: storedCode};
            setOrder(updatedOrder);
            console.log('Код официанта установлен как код заказа:', storedCode);
          }
        }
      } catch (e) {
        console.error('Ошибка при получении кода официанта из localStorage', e);
      }
    }
  }, [order?.id]);

  const handleCancelOrder = async () => {
    if (!order || isCancelling) return;
    
    if (!confirm('Вы уверены, что хотите отменить заказ? Это действие нельзя отменить.')) {
      return;
    }
    
    setIsCancelling(true);
    setError('');
    
    try {
      const success = await waiterApi.updateOrderStatus(order.id, 'cancelled');
      
      if (!success) {
        throw new Error('Не удалось отменить заказ');
      }
      
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
    setError('');
    
    try {
      await updateOrderPaymentStatus(order.id || 0, 'paid');
      
      // Обновляем данные заказа после оплаты
      const updatedOrder = await ordersApi.getOrderById(Number(id));
      setOrder(updatedOrder);
      
      alert('Заказ успешно оплачен');
    } catch (err) {
      console.error('Ошибка при обработке оплаты:', err);
      alert('Не удалось обработить оплату. Пожалуйста, попробуйте позже.');
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

  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return "Недоступно";
    try {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
    } catch (error) {
      console.error('Ошибка форматирования даты:', error);
      return 'Недоступно';
    }
  };

  // Отображаем заглушку до полного монтирования компонента на клиенте
  if (!isMounted) {
    return (
      <Layout title="Загрузка...">
        <div className="container mx-auto px-4 py-8">
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-primary"></div>
          </div>
        </div>
      </Layout>
    );
  }

  if (isLoading) {
    return (
      <Layout title="Детали заказа">
        <div className="container mx-auto px-4 py-8">
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-primary"></div>
          </div>
        </div>
      </Layout>
    );
  }

  if (error) {
    return (
      <Layout title="Ошибка">
        <div className="container mx-auto px-4 py-8">
          <div className="bg-white rounded-lg shadow-md p-8">
            <div className="flex justify-center mb-4">
              <XIcon className="h-16 w-16 text-red-500" />
            </div>
            <h2 className="text-2xl font-medium mb-4 text-center">{error}</h2>
            <p className="text-gray-600 mb-6 text-center">
              Вернитесь к списку заказов или попробуйте обновить страницу
            </p>
            <div className="flex justify-center space-x-4">
              <Link href="/orders" className="btn btn-primary inline-flex items-center">
                <ArrowLeftIcon className="h-5 w-5 mr-1" />
                Вернуться к списку заказов
              </Link>
              <button 
                onClick={() => fetchOrderData()}
                className="btn btn-secondary inline-flex items-center">
                <svg className="h-5 w-5 mr-1" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Попробовать снова
              </button>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  if (!order) {
    return (
      <Layout title="Заказ не найден">
        <div className="container mx-auto px-4 py-8">
          <div className="bg-white rounded-lg shadow-md p-8">
            <div className="flex justify-center mb-4">
              <XIcon className="h-16 w-16 text-red-500" />
            </div>
            <h2 className="text-2xl font-medium mb-4 text-center">Заказ не найден</h2>
            <p className="text-gray-600 mb-6 text-center">
              Запрашиваемый заказ не найден или недоступен
            </p>
            <div className="flex justify-center">
              <Link href="/orders" className="btn btn-primary inline-flex items-center">
                <ArrowLeftIcon className="h-5 w-5 mr-1" />
                Вернуться к списку заказов
              </Link>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout title={`Заказ №${id}`}>
      <div className="container mx-auto px-4 py-8 dark:bg-gray-900 min-h-screen">
        <h1 className="text-3xl font-bold mb-8 dark:text-white">Детали заказа</h1>
        <div className="mb-6">
          <Link href="/orders" className="inline-flex items-center text-blue-500 hover:text-blue-700">
            <ArrowLeftIcon className="h-4 w-4 mr-1" />
            Вернуться к списку заказов
          </Link>
        </div>

        {!isMounted ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-primary"></div>
          </div>
        ) : isLoading ? (
          <div className="flex flex-col items-center justify-center p-8">
            <div className="w-12 h-12 border-t-2 border-blue-500 rounded-full animate-spin"></div>
            <p className="mt-4 text-gray-600">Загрузка данных заказа...</p>
        </div>
        ) : error ? (
          <div className="bg-red-50 border-l-4 border-red-500 text-red-700 p-4 mb-4 rounded">
            <div className="flex items-start">
              <ExclamationIcon className="h-5 w-5 mr-2 mt-0.5" />
              <p>{error}</p>
            </div>
          </div>
        ) : order ? (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">Информация о заказе</h2>
            <div className="p-6 border-b border-gray-200 flex flex-col md:flex-row justify-between items-start md:items-center">
                    <div>
                <div className="flex items-center mb-2">
                  <h1 className="text-2xl font-bold mr-3">Заказ №{order.id}</h1>
                  {getStatusBadge(order.status)}
                </div>
                <p className="text-gray-600">
                  {formatDate(order.created_at)}
                </p>
              </div>
              <div className="flex mt-4 md:mt-0 space-x-2">
                {order.status === 'pending' && (
                  <button 
                    className="px-4 py-2 bg-red-500 text-white rounded-md flex items-center hover:bg-red-600 disabled:bg-red-300 disabled:cursor-not-allowed"
                    onClick={handleCancelOrder}
                    disabled={isCancelling}
                  >
                    {isCancelling ? (
                      <>
                        <div className="w-4 h-4 border-t-2 border-white rounded-full animate-spin mr-2"></div>
                        Отмена...
                      </>
                    ) : (
                      <>
                        <XCircleIcon className="h-5 w-5 mr-1" />
                        Отменить заказ
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
            
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h2 className="text-xl font-semibold mb-4">Блюда в заказе</h2>
                
                {order.items && order.items.length > 0 ? (
                  <div className="space-y-3">
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
                  </div>
                ) : (
                  <p className="text-gray-500 italic">Нет данных о блюдах в заказе</p>
                )}

                {order && order.order_code && (
                  <div className="mt-4">
                    <OrderCode code={order.order_code} />
                  </div>
                )}

                {!order.order_code && waiterCode && (
                  <div className="mt-4 bg-blue-50 rounded-lg p-4 border border-blue-200">
                    <h3 className="font-semibold text-blue-800 mb-2 flex items-center">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                      Код официанта
                    </h3>
                    <div className="flex items-center">
                      <span className="font-mono font-semibold bg-white px-3 py-1 rounded border border-blue-100">{waiterCode}</span>
                    </div>
                    <p className="text-sm text-blue-600 mt-2">
                      Ваш заказ привязан к этому официанту
                    </p>
                  </div>
                )}
              </div>
              
              <div>
                <h2 className="text-xl font-semibold mb-4">Детали заказа</h2>
                
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <p className="text-gray-600">Статус оплаты:</p>
                    <div>{getPaymentStatusBadge(order.payment_status || 'pending')}</div>
                  </div>
                  
                  <div className="flex justify-between">
                    <p className="text-gray-600">Способ оплаты:</p>
                    <p>{order.payment_method === 'cash' ? 'Наличными при получении' : 'Картой'}</p>
                  </div>
                  
                  {order.user && (
                    <>
                      <div className="flex justify-between">
                        <p className="text-gray-600">Заказчик:</p>
                        <p>{order.user.full_name || 'Не указано'}</p>
                      </div>
                      
                      {order.user.phone && (
                        <div className="flex justify-between">
                          <p className="text-gray-600">Телефон:</p>
                          <p className="flex items-center">
                            <PhoneIcon className="h-4 w-4 mr-1 text-gray-500" />
                            {order.user.phone}
                          </p>
                        </div>
                      )}
                      
                      {order.user.email && (
                        <div className="flex justify-between">
                          <p className="text-gray-600">Email:</p>
                          <p className="flex items-center">
                            <MailIcon className="h-4 w-4 mr-1 text-gray-500" />
                            {order.user.email}
                          </p>
                        </div>
                      )}
                    </>
                  )}
                  
                  {order.table_number && (
                    <div className="flex justify-between">
                      <p className="text-gray-600">Номер стола:</p>
                      <p>{order.table_number}</p>
                    </div>
                  )}
                  
                  {order?.delivery_address && (
                    <div className="flex justify-between">
                      <p className="text-gray-600">Адрес доставки:</p>
                      <p className="flex items-center text-right">
                        <LocationMarkerIcon className="h-4 w-4 mr-1 text-gray-500 flex-shrink-0" />
                        {order.delivery_address}
                      </p>
                    </div>
                  )}
                  
                  {order?.comment && (
                    <div className="flex justify-between">
                      <p className="text-gray-600">Примечания:</p>
                      <p className="text-right">{order.comment}</p>
                    </div>
                  )}
                </div>
                
                {order.payment_status === 'pending' && order.status !== 'cancelled' && (
                  <div className="mt-6">
                    <button
                      className="w-full py-2 bg-green-500 text-white rounded-md flex items-center justify-center hover:bg-green-600 disabled:bg-green-300 disabled:cursor-not-allowed"
                      onClick={handlePayOrder}
                      disabled={isProcessingPayment}
                    >
                      {isProcessingPayment ? (
                        <>
                          <div className="w-4 h-4 border-t-2 border-white rounded-full animate-spin mr-2"></div>
                          Обработка...
                        </>
                      ) : (
                        <>
                          <CreditCardIcon className="h-5 w-5 mr-1" />
                          Оплатить заказ
                        </>
                      )}
                    </button>
                  </div>
                )}

                {order?.comment && (
                  <div className="mt-4 bg-yellow-50 p-4 rounded-lg border border-yellow-200">
                    <h3 className="font-semibold text-yellow-800 mb-2 flex items-center">
                      <ExclamationIcon className="h-5 w-5 mr-2 text-yellow-600" />
                      Особые инструкции
                    </h3>
                    <p className="text-gray-800">{order.comment}</p>
                  </div>
                )}
              </div>
            </div>
            
            {order && order.id && (
              <div className="p-6 border-t border-gray-200">
                <h2 className="text-xl font-semibold mb-4">Оценить заказ</h2>
                <ReviewForm 
                  orderId={order.id} 
                  waiterId={order.waiter_id || null} 
                  onReviewSubmitted={() => fetchOrderData()}
                />
              </div>
            )}
            
            {showDebug && debugData && (
              <div className="p-6 border-t border-gray-200">
                <h2 className="text-xl font-semibold mb-4">Отладочная информация</h2>
                <div className="bg-gray-100 p-4 rounded-lg overflow-auto max-h-96">
                  <pre className="text-xs">{JSON.stringify(debugData, null, 2)}</pre>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-gray-50 p-8 rounded-lg text-center">
            <p className="text-gray-500">Не удалось найти информацию о заказе.</p>
        </div>
        )}
      </div>
    </Layout>
  );
};

export default OrderDetailPage; 