import { useState, useEffect } from 'react';
import { NextPage } from 'next';
import { useRouter } from 'next/router';
import Link from 'next/link';
import Layout from '../../components/Layout';
import useAuthStore from '../../lib/auth-store';
import { Order, OrderItem } from '../../types';
import { ordersApi } from '../../lib/api';
import { formatPrice } from '../../utils/priceFormatter';
import QRCode from 'react-qr-code';
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
  BugAntIcon,
  QrCodeIcon
} from '@heroicons/react/24/outline';
import { 
  ExclamationTriangleIcon as ExclamationIcon
} from '@heroicons/react/24/solid';

const OrderDetailPage: NextPage = () => {
  const router = useRouter();
  const { id, success } = router.query;
  const { isAuthenticated, user } = useAuthStore();
  const [order, setOrder] = useState<Order | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [isCancelling, setIsCancelling] = useState(false);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [debugData, setDebugData] = useState<any>(null);
  const [isLoadingDebug, setIsLoadingDebug] = useState(false);
  const [showDebug, setShowDebug] = useState(false);
  const [showQrCode, setShowQrCode] = useState(false);

  // Устанавливаем флаг монтирования компонента после рендера на клиенте
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Определяем функцию загрузки заказа
  const fetchOrderData = async () => {
    try {
      setIsLoading(true);
      setError('');
      console.log(`Запрос данных заказа ID: ${id}`);
      const fetchedOrder = await ordersApi.getOrderById(Number(id));
      
      // Подробное логирование полученных данных для отладки
      console.log('Получены данные заказа:', fetchedOrder);
      
      if (!fetchedOrder || typeof fetchedOrder !== 'object') {
        throw new Error('Получены некорректные данные заказа');
      }
      
      // Проверка и нормализация полученных данных
      const normalizedOrder: Order = {
        ...fetchedOrder,
        id: fetchedOrder.id || 0,
        status: fetchedOrder.status || 'pending',
        payment_status: fetchedOrder.payment_status || 'pending',
        payment_method: fetchedOrder.payment_method || '',
        total_amount: fetchedOrder.total_amount || 0,
        items: Array.isArray(fetchedOrder.items) ? fetchedOrder.items : [],
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
        // Ошибка 500 - внутренняя ошибка сервера
        if (err.message.includes('500') || err.message.includes('Internal Server Error')) {
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
      const debugData = await ordersApi.getOrderByIdDebug(Number(id));
      
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

  const handleCancelOrder = async () => {
    if (!order || isCancelling) return;
    
    if (!confirm('Вы уверены, что хотите отменить заказ? Это действие нельзя отменить.')) {
      return;
    }
    
    setIsCancelling(true);
    setError('');
    
    try {
      await ordersApi.cancelOrder(order.id || 0);
      
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
      await ordersApi.updateOrderPaymentStatus(order.id || 0, 'paid');
      
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

  const toggleQrCode = () => {
    setShowQrCode(!showQrCode);
  };

  // Формируем данные для QR-кода
  const getQrCodeData = () => {
    if (!order || !order.order_code) return '';
    
    // Создаем URL с данными заказа для сканирования официантом
    const qrData = {
      type: 'restaurant_order',
      order_id: order.id,
      order_code: order.order_code,
      timestamp: new Date().getTime()
    };
    
    return JSON.stringify(qrData);
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
    <Layout title={`Заказ ${order?.id || ''}`}>
      <div className="container mx-auto px-4 py-8">
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
          <div className="bg-white shadow-md rounded-lg overflow-hidden">
            {/* Header с номером заказа и статусом */}
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
                
                {order.order_code && (
                  <button
                    className="px-4 py-2 bg-blue-500 text-white rounded-md flex items-center hover:bg-blue-600"
                    onClick={toggleQrCode}
                  >
                    <QrCodeIcon className="h-5 w-5 mr-1" />
                    {showQrCode ? 'Скрыть QR-код' : 'Показать QR-код'}
                  </button>
                )}
                
                {user?.role === 'admin' && (
                  <button 
                    className="px-4 py-2 bg-purple-500 text-white rounded-md flex items-center hover:bg-purple-600 disabled:bg-purple-300 disabled:cursor-not-allowed"
                    onClick={fetchDebugData}
                    disabled={isLoadingDebug}
                  >
                    {isLoadingDebug ? (
                      <>
                        <div className="w-4 h-4 border-t-2 border-white rounded-full animate-spin mr-2"></div>
                        Загрузка...
                      </>
                    ) : (
                      <>
                        <BugAntIcon className="h-5 w-5 mr-1" />
                        Отладка
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
            
            {/* QR-код заказа (если есть) */}
            {showQrCode && order.order_code && (
              <div className="p-6 border-b border-gray-200">
                <div className="bg-white p-4 rounded-lg shadow-inner mx-auto max-w-xs text-center">
                  <h3 className="text-lg font-semibold mb-3">QR-код заказа</h3>
                  <div className="bg-white p-2 inline-block mb-2">
                    <QRCode 
                      value={getQrCodeData()}
                      size={200}
                      level="H"
                    />
                  </div>
                  <p className="text-sm text-gray-600 mt-2">Код заказа: <span className="font-bold">{order.order_code}</span></p>
                  <p className="text-xs text-gray-500 mt-1">Покажите этот код официанту</p>
                </div>
              </div>
            )}

            {/* Информация о заказе */}
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Колонка с блюдами */}
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
              </div>
              
              {/* Колонка с деталями заказа */}
              <div>
                <h2 className="text-xl font-semibold mb-4">Детали заказа</h2>
                
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <p className="text-gray-600">Статус оплаты:</p>
                    <div>{getPaymentStatusBadge(order.payment_status)}</div>
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
                  
                  {order.delivery_address && (
                    <div className="flex justify-between">
                      <p className="text-gray-600">Адрес доставки:</p>
                      <p className="flex items-center text-right">
                        <LocationMarkerIcon className="h-4 w-4 mr-1 text-gray-500 flex-shrink-0" />
                        {order.delivery_address}
                      </p>
                    </div>
                  )}
                  
                  {order.special_instructions && (
                    <div className="flex justify-between">
                      <p className="text-gray-600">Примечания:</p>
                      <p className="text-right">{order.special_instructions}</p>
                    </div>
                  )}
                </div>
                
                {/* Кнопка оплаты заказа */}
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
              </div>
            </div>
            
            {/* Отладочная информация для администратора */}
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