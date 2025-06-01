import { useState, useEffect } from 'react';
import { NextPage } from 'next';
import { useRouter } from 'next/router';
import Link from 'next/link';
import WaiterLayout from '../../../components/WaiterLayout';
import useAuthStore from '../../../lib/auth-store';
import { Order as OrderType, OrderItem } from '../../../types';
import { ordersApi } from '../../../lib/api/orders';
import { formatPrice } from '../../../utils/priceFormatter';
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
  DocumentTextIcon,
  UserIcon 
} from '@heroicons/react/24/outline';
import { ExclamationTriangleIcon as ExclamationIcon, CheckIcon } from '@heroicons/react/24/solid';

// Обновляем определение статусов для соответствия с бэкендом
type OrderStatus = 'pending' | 'confirmed' | 'preparing' | 'ready' | 'completed' | 'cancelled';
type PaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded';

type Payment = {
  method?: string;
  status?: PaymentStatus;
  amount?: number;
  transaction_id?: string;
  payment_date?: string;
}

// Расширяем импортированный тип Order
type Order = OrderType & {
  payment?: Payment;
  special_requests?: string;
  customer_age_group?: string;
  items?: OrderItem[]; // Связь с order_dish
};

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

// Добавляем типы для возрастных групп
type AgeGroup = 'teen' | 'young' | 'adult' | 'elderly';

const WaiterOrderDetailPage: NextPage = () => {
  const router = useRouter();
  const { id } = router.query;
  const { user, isAuthenticated } = useAuthStore();
  const [order, setOrder] = useState<Order | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [updatingStatus, setUpdatingStatus] = useState(false);

  // Обновляем порядок статусов для соответствия бизнес-процессу
  const statusOrder = ['pending', 'confirmed', 'preparing', 'ready', 'completed', 'cancelled'];

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/auth/login');
      return;
    }
    
    if (!id) return;
    fetchOrder();
  }, [id, isAuthenticated]);

  const fetchOrder = async () => {
    try {
      setIsLoading(true);
      setError('');
      console.log(`Запрашиваем заказ с ID ${id}...`);
      
      // Добавляем дополнительную обработку ошибок
      let fetchedOrder = null;
      try {
        fetchedOrder = await ordersApi.getOrderById(Number(id));
      } catch (apiError) {
        console.error(`Ошибка API при получении заказа ${id}:`, apiError);
        
        // Создаем минимальную структуру заказа при ошибке
        fetchedOrder = {
          id: Number(id),
          status: "pending",
          payment_status: "pending",
          payment_method: "cash",
          created_at: new Date().toISOString(),
          total_amount: 0,
          customer_name: "",
          customer_phone: "",
          items: []
        };
      }
      
      // Проверка на null или undefined
      if (!fetchedOrder) {
        throw new Error(`Не удалось получить заказ с ID ${id}`);
      }
      
      // Проверяем и нормализуем данные заказа
      const normalizedOrder = {
        ...fetchedOrder,
        // Обязательные поля - устанавливаем значения по умолчанию
        id: fetchedOrder.id || Number(id),
        status: fetchedOrder.status || "pending",
        // Нормализуем платежные данные
        payment_method: fetchedOrder.payment_method || 
                         fetchedOrder.payment_details?.method || 
                         fetchedOrder.payment?.method || 
                         'cash',
        payment_status: fetchedOrder.payment_status || 
                        fetchedOrder.payment_details?.status || 
                        fetchedOrder.payment?.status || 
                        'pending',
        // Устанавливаем другие значения по умолчанию
        total_amount: fetchedOrder.total_amount || 0,
        customer_name: fetchedOrder.customer_name || "",
        customer_phone: fetchedOrder.customer_phone || "",
        items: Array.isArray(fetchedOrder.items) ? fetchedOrder.items : [],
        // Обрабатываем customer_age_group
        customer_age_group: fetchedOrder.customer_age_group || undefined
      };
      
      console.log('Нормализованный заказ:', normalizedOrder);
      setOrder(normalizedOrder);
    } catch (err) {
      console.error('Ошибка при загрузке данных заказа:', err);
      setError('Не удалось загрузить данные заказа. Пожалуйста, попробуйте позже.');
      
      // Устанавливаем пустой заказ вместо null
      setOrder({
        id: Number(id),
        status: "pending",
        payment_status: "pending",
        payment_method: "cash",
        created_at: new Date().toISOString(),
        total_amount: 0,
        customer_name: "",
        customer_phone: "",
        items: []
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateStatus = async (newStatus: string) => {
    console.log(`Обновление статуса заказа на: ${newStatus}`);
    
    if (!order || updatingStatus) {
      console.log("Невозможно обновить статус: заказ не найден или уже идет обновление");
      return;
    }
    
    // Сохраняем исходные данные заказа
    const originalOrder = { ...order };
    
    // Переводим статус в нижний регистр
    const normalizedStatus = newStatus.toLowerCase();
    
    // Устанавливаем индикатор загрузки
    setUpdatingStatus(true);
    setError('');
    
    try {
      // Сначала обновляем UI оптимистично
      setOrder({
        ...order,
        status: normalizedStatus,
        updated_at: new Date().toISOString()
      });
      
      // Получаем токен
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('Необходима авторизация');
      }
      
      // Делаем запрос к альтернативному прокси (более надежному)
      const response = await fetch('/api/v1/orders/status_update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          order_id: order.id,
          status: normalizedStatus
        })
      });
      
      if (!response.ok) {
        // Если ответ не успешный, восстанавливаем исходные данные
        throw new Error(`Ошибка сервера: ${response.status}`);
      }
      
      // Получаем данные ответа
      const result = await response.json();
      console.log('Результат обновления статуса:', result);
      
      if (!result.success) {
        throw new Error(result.message || 'Не удалось обновить статус заказа');
      }
      
      // Обновляем заказ только с актуальным статусом, сохраняя остальные данные
      setOrder({
        ...originalOrder,
        status: normalizedStatus,
        updated_at: new Date().toISOString()
      });
      
      // Показываем сообщение об успехе
      alert(`Статус заказа #${order.id} обновлен на "${getStatusLabel(normalizedStatus)}"`);
      
      // Принудительное обновление данных заказа с сервера после успешного обновления статуса
      setTimeout(() => {
        fetchOrder().catch(error => {
          console.error('Ошибка при обновлении данных заказа:', error);
        });
      }, 1000);
      
    } catch (error) {
      console.error('Ошибка при обновлении статуса заказа:', error);
      
      // Восстанавливаем исходные данные
      setOrder(originalOrder);
      setError('Не удалось обновить статус заказа. Попробуйте еще раз.');
    } finally {
      // Снимаем индикатор загрузки
      setUpdatingStatus(false);
    }
  };

  // Выводим данные о заказе для отладки
  useEffect(() => {
    if (order) {
      console.log('Детали заказа:', order);
      console.log('Способ оплаты:', order.payment_method);
      console.log('Статус оплаты:', order.payment_status);
    }
  }, [order]);

  const isStatusChangeAllowed = (status: string) => {
    if (!order) return false;
    
    // Нормализуем статусы в нижний регистр для сравнения
    const normalizedCurrentStatus = order.status.toLowerCase();
    const normalizedNewStatus = status.toLowerCase();
    
    // Определим правильную последовательность статусов
    const statusOrder = ['pending', 'confirmed', 'preparing', 'ready', 'completed'];
    
    // Получаем индексы статусов в массиве
    const currentIndex = statusOrder.indexOf(normalizedCurrentStatus);
    const newIndex = statusOrder.indexOf(normalizedNewStatus);
    
    // Если текущий или новый статус не найдены в списке, проверяем специальные случаи
    if (currentIndex === -1 || newIndex === -1) {
      // Позволяем официанту установить любой статус, если текущий статус неизвестен
      if (currentIndex === -1) return true;
      
      // Разрешаем только специальные переходы для известных статусов, если новый статус неизвестен
      return false;
    }
    
    // Особый случай для отмены заказа
    if (normalizedNewStatus === 'cancelled') {
      // Заказ можно отменить только если он не выполнен и не отменён
      return !['completed', 'cancelled'].includes(normalizedCurrentStatus);
    }
    
    // Для обычного порядка статусов:
    // Можно изменить статус только на следующий в порядке или оставить текущий
    return newIndex === currentIndex || newIndex === currentIndex + 1;
  };

  const getStatusLabel = (status: string | undefined) => {
    if (!status) return 'Не указано';
    
    // Нормализуем статус в нижний регистр для корректного отображения
    const normalizedStatus = status.toLowerCase();
    
    const statusLabels: Record<string, string> = {
      'pending': 'Новый',
      'confirmed': 'Подтвержден',
      'preparing': 'Готовится',
      'ready': 'Готов',
      'completed': 'Завершен',
      'cancelled': 'Отменен'
    };
    
    return statusLabels[normalizedStatus] || status;
  };
  
  const getPaymentStatusLabel = (status: string | undefined) => {
    if (!status) return 'Не указано';
    
    // Нормализуем статус в нижний регистр для корректного отображения
    const normalizedStatus = status.toLowerCase();
    
    const statusLabels: Record<string, string> = {
      'pending': 'Ожидает оплаты',
      'paid': 'Оплачен',
      'refunded': 'Возврат средств',
      'failed': 'Отказ оплаты'
    };
    
    return statusLabels[normalizedStatus] || status;
  };

  const getStatusColor = (status: string | undefined) => {
    if (!status) return 'bg-gray-100 text-gray-800';
    
    // Нормализуем статус в нижний регистр для корректного отображения
    const normalizedStatus = status.toLowerCase();
    
    const statusColors: Record<string, string> = {
      'pending': 'bg-yellow-100 text-yellow-800',
      'confirmed': 'bg-blue-100 text-blue-800',
      'preparing': 'bg-orange-100 text-orange-800',
      'ready': 'bg-green-100 text-green-800',
      'completed': 'bg-gray-100 text-gray-800',
      'cancelled': 'bg-red-100 text-red-800'
    };
    
    return statusColors[normalizedStatus] || 'bg-gray-100 text-gray-800';
  };
  
  const getPaymentStatusColor = (status: string | undefined) => {
    if (!status) return 'bg-gray-100 text-gray-800';
    
    // Нормализуем статус в нижний регистр для корректного отображения
    const normalizedStatus = status.toLowerCase();
    
    const statusColors: Record<string, string> = {
      'pending': 'bg-yellow-100 text-yellow-800',
      'paid': 'bg-green-100 text-green-800',
      'refunded': 'bg-blue-100 text-blue-800',
      'failed': 'bg-red-100 text-red-800'
    };
    
    return statusColors[normalizedStatus] || 'bg-gray-100 text-gray-800';
  };

  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return 'Не указано';
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  const getPaymentMethodLabel = (method?: string): string => {
    if (!method || method === 'unknown' || method === '' || method === null) return 'Не указано';
    
    const normalizedMethod = method.toLowerCase().trim();
    
    if (['card', 'карта', 'картой', 'кредитка', 'кредитной картой', 'credit_card', 'кредитная_карта', 'credit', 'debit', 'дебетовая карта', 'visa', 'mastercard', 'mir', 'мир'].includes(normalizedMethod)) {
      return 'Картой';
    } else if (['cash', 'наличные', 'наличными', 'кэш', 'налик', 'нал'].includes(normalizedMethod)) {
      return 'Наличными';
    } else if (['online', 'онлайн', 'online_payment', 'web', 'веб', 'электронный платеж', 'electronic', 'электронно'].includes(normalizedMethod)) {
      return 'Онлайн-оплата';
    } else if (['transfer', 'перевод', 'bank_transfer', 'банковский_перевод', 'wire', 'банк'].includes(normalizedMethod)) {
      return 'Банковский перевод';
    } else if (['qr', 'qr_code', 'qr код', 'киукод', 'код', 'qrcode', 'sberbank_qr', 'сбп', 'sbp'].includes(normalizedMethod)) {
      return 'QR-код (СБП)';
    } else if (['app', 'приложение', 'mobile_app', 'мобильное_приложение'].includes(normalizedMethod)) {
      return 'Через приложение';
    } else if (['terminal', 'терминал', 'pos', 'pos_terminal', 'эквайринг'].includes(normalizedMethod)) {
      return 'Через терминал';
    }
    
    return method; // Возвращаем исходное значение, если не распознано
  };

  const handleUpdatePaymentStatus = async (newStatus: PaymentStatus) => {
    console.log(`Обновление статуса оплаты на: ${newStatus}`);
    
    if (!order || updatingStatus) {
      console.log("Невозможно обновить статус оплаты: заказ не найден или уже идет обновление");
      return;
    }
    
    // Проверяем, не тот же ли это статус
    const currentStatus = order.payment_status?.toLowerCase() || '';
    if (currentStatus === newStatus.toLowerCase()) {
      console.log(`Статус оплаты уже установлен как ${newStatus}`);
      return;
    }
    
    // Сохраняем исходные данные заказа
    const originalOrder = { ...order };
    
    // Устанавливаем индикатор загрузки
    setUpdatingStatus(true);
    setError('');
    
    try {
      // Сначала обновляем UI оптимистично
      setOrder({
        ...order,
        payment_status: newStatus,
        updated_at: new Date().toISOString()
      });
      
      // Получаем токен
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('Необходима авторизация');
      }
      
      // Делаем запрос к альтернативному прокси (более надежному)
      const response = await fetch('/api/v1/orders/payment_update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          orderId: order.id,
          payment_status: newStatus
        })
      });
      
      if (!response.ok) {
        // Если ответ не успешный, восстанавливаем исходные данные
        throw new Error(`Ошибка сервера: ${response.status}`);
      }
      
      // Получаем данные ответа
      const result = await response.json();
      console.log('Результат обновления статуса оплаты:', result);
      
      if (!result.success) {
        throw new Error(result.message || 'Не удалось обновить статус оплаты');
      }
      
      // Получаем данные заказа из ответа
      const returnedOrder = result.order;
      
      // Проверяем, не вернулись ли демо-данные
      const isDemoData = 
        returnedOrder?.customer_name !== originalOrder.customer_name || 
        returnedOrder?.total_amount !== originalOrder.total_amount;
      
      // Если вернулись демо-данные или не вернулись данные вообще,
      // обновляем только статус оплаты
      if (isDemoData || !returnedOrder) {
        setOrder({
          ...originalOrder,
          payment_status: newStatus,
          updated_at: new Date().toISOString()
        });
      } else {
        // Иначе используем данные из ответа
        setOrder({
          ...returnedOrder,
          payment_status: newStatus
        });
      }
      
      // Показываем сообщение об успехе
      alert(`Статус оплаты заказа #${order.id} обновлен на "${getPaymentStatusLabel(newStatus)}"`);
      
      // Принудительное обновление данных заказа с сервера после успешного обновления статуса оплаты
      setTimeout(() => {
        fetchOrder().catch(error => {
          console.error('Ошибка при обновлении данных заказа:', error);
        });
      }, 1000);
      
    } catch (error) {
      console.error('Ошибка при обновлении статуса оплаты:', error);
      
      // Восстанавливаем исходные данные
      setOrder(originalOrder);
      setError('Не удалось обновить статус оплаты. Попробуйте еще раз.');
    } finally {
      // Снимаем индикатор загрузки
      setUpdatingStatus(false);
    }
  };

  // Добавляем функции для получения текстовых значений
  const getAgeGroupLabel = (group: AgeGroup): string => {
    const labels: Record<AgeGroup, string> = {
      'teen': 'Подросток (13-17)',
      'young': 'Молодой (18-30)',
      'adult': 'Взрослый (31-60)',
      'elderly': 'Пожилой (60+)'
    };
    return labels[group] || group;
  };

  if (isLoading) {
    return (
      <WaiterLayout title="Детали заказа" activeTab="orders">
        <div className="container mx-auto px-4 py-8">
        <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
          </div>
        </div>
      </WaiterLayout>
    );
  }

  if (error) {
    return (
      <WaiterLayout title="Ошибка" activeTab="orders">
        <div className="container mx-auto px-4 py-8">
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            <p className="flex items-center font-medium">
              <ExclamationIcon className="h-5 w-5 mr-2" />
              {error}
            </p>
            <p className="mt-2">
              <Link href="/waiter/orders" className="text-red-700 underline">
                Вернуться к списку заказов
              </Link>
            </p>
          </div>
        </div>
      </WaiterLayout>
    );
  }

  if (!order) {
    return (
      <WaiterLayout title="Заказ не найден" activeTab="orders">
        <div className="container mx-auto px-4 py-8">
          <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded mb-4">
            <p className="flex items-center font-medium">
              <ExclamationIcon className="h-5 w-5 mr-2" />
              Заказ не найден
            </p>
            <p className="mt-2">
              <Link href="/waiter/orders" className="text-yellow-700 underline">
                Вернуться к списку заказов
              </Link>
            </p>
          </div>
        </div>
      </WaiterLayout>
    );
  }

  return (
    <WaiterLayout title={`Заказ #${order.id}`} activeTab="orders">
      <div className="container mx-auto px-4 py-8">
        {/* Навигация */}
        <div className="mb-6">
          <Link href="/waiter/orders" className="text-primary hover:text-primary-dark inline-flex items-center">
            <ArrowLeftIcon className="h-4 w-4 mr-1" />
            Вернуться к списку заказов
          </Link>
          </div>

        {/* Заголовок и статус */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6">
          <h1 className="text-3xl font-bold mb-4 md:mb-0">Заказ #{order.id}</h1>
          <div className="flex flex-col sm:flex-row gap-2">
            <span className={`${getStatusColor(order.status)} px-3 py-1 rounded-full text-xs font-medium inline-flex items-center`}>
              {getStatusLabel(order.status)}
            </span>
            <span className={`${getPaymentStatusColor(order.payment_status)} px-3 py-1 rounded-full text-xs font-medium inline-flex items-center`}>
              {getPaymentStatusLabel(order.payment_status)}
            </span>
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
                      {getPaymentMethodLabel(order.payment_method)}
                    </p>
                    <details className="text-xs text-gray-500 mt-1">
                      <summary>Детали платежа</summary>
                      <p>Способ: "{order.payment_method || 'не задано'}"</p>
                      <p>Статус: "{order.payment_status || 'не задано'}"</p>
                      {order.payment && (
                        <pre className="text-xs mt-1 bg-gray-50 p-1 rounded overflow-auto max-h-24">
                          {JSON.stringify(order.payment, null, 2)}
                        </pre>
                      )}
                    </details>
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
                
                {/* Информация о клиенте */}
                <div className="border-t pt-4 mt-4">
                  <h3 className="text-lg font-medium mb-3">Информация о клиенте</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-600 mb-1">Имя клиента</p>
                      <p className="font-medium">
                        {order.customer_name || 'Не указано'}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600 mb-1">Телефон</p>
                      <p className="font-medium">
                        {order.customer_phone || 'Не указано'}
                      </p>
                    </div>
                    {order.customer_age_group && (
                      <div>
                        <p className="text-sm text-gray-600 mb-1">Возрастная группа</p>
                        <p className="font-medium">
                          {getAgeGroupLabel(order.customer_age_group as AgeGroup)}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
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
                    {order.items && order.items.map((item: OrderItem, index) => (
                      <tr key={item.dish_id || index} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">{item.dish_name || item.name || `Блюдо #${item.dish_id}`}</div>
                          {item.special_instructions && (
                            <div className="text-xs text-gray-500 mt-1 italic">{item.special_instructions}</div>
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
            {/* Управление статусом заказа */}
            <div className="bg-white rounded-lg shadow-md overflow-hidden mb-6">
              <div className="px-6 py-4 border-b">
                <h2 className="text-xl font-semibold">Управление статусом</h2>
              </div>
              <div className="p-6 space-y-4">
                <div className="flex flex-col space-y-2">
                  <label htmlFor="orderStatus" className="block text-sm font-medium text-gray-700 mb-1">
                    Статус заказа
                  </label>
                  <div className="flex items-center">
                    <select
                      id="orderStatus"
                      value={order.status}
                      onChange={(e) => handleUpdateStatus(e.target.value)}
                      disabled={updatingStatus}
                      className="block w-full bg-white border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary focus:border-primary sm:text-sm"
                    >
                      {/* Добавляем текущий статус в список, если он не входит в стандартные */}
                      {!statusOrder.includes(order.status.toLowerCase()) && (
                        <option value={order.status}>
                          {getStatusLabel(order.status)}
                        </option>
                      )}
                      {/* Отображаем все доступные статусы, кроме "pending" (Новый) */}
                      {statusOrder
                        .filter(status => status !== 'pending') 
                        .map((status) => (
                          <option 
                            key={status} 
                            value={status}
                          >
                            {getStatusLabel(status)}
                          </option>
                        ))
                      }
                    </select>
                    {updatingStatus && (
                      <div className="ml-3">
                        <svg className="animate-spin h-5 w-5 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                      </div>
                    )}
                  </div>
                  <p className="text-sm text-gray-500 mt-1">
                    Текущий статус: <span className={`${getStatusColor(order.status)} px-2 py-0.5 rounded-full text-xs font-medium`}>{getStatusLabel(order.status)}</span>
                  </p>
                </div>

                {/* Управление статусом оплаты */}
                <div className="mt-6 pt-6 border-t border-gray-200">
                  <h3 className="text-lg font-medium mb-3">Статус оплаты</h3>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      className={`px-3 py-2 text-sm text-center rounded-md font-medium transition ${order.payment_status === 'pending' ? 'bg-yellow-100 text-yellow-800 border border-yellow-300' : 'bg-gray-100 text-gray-800 hover:bg-gray-200'}`}
                      onClick={() => handleUpdatePaymentStatus('pending')}
                      disabled={updatingStatus || order.payment_status === 'pending'}
                    >
                      Ожидает оплаты
                    </button>
                    <button
                      className={`px-3 py-2 text-sm text-center rounded-md font-medium transition ${order.payment_status === 'paid' ? 'bg-green-100 text-green-800 border border-green-300' : 'bg-gray-100 text-gray-800 hover:bg-gray-200'}`}
                      onClick={() => handleUpdatePaymentStatus('paid')}
                      disabled={updatingStatus || order.payment_status === 'paid'}
                    >
                      Оплачен
                    </button>
                    <button
                      className={`px-3 py-2 text-sm text-center rounded-md font-medium transition ${order.payment_status === 'refunded' ? 'bg-blue-100 text-blue-800 border border-blue-300' : 'bg-gray-100 text-gray-800 hover:bg-gray-200'}`}
                      onClick={() => handleUpdatePaymentStatus('refunded')}
                      disabled={updatingStatus || order.payment_status === 'refunded'}
                    >
                      Возврат
                    </button>
                    <button
                      className={`px-3 py-2 text-sm text-center rounded-md font-medium transition ${order.payment_status === 'failed' ? 'bg-red-100 text-red-800 border border-red-300' : 'bg-gray-100 text-gray-800 hover:bg-gray-200'}`}
                      onClick={() => handleUpdatePaymentStatus('failed')}
                      disabled={updatingStatus || order.payment_status === 'failed'}
                    >
                      Отказ оплаты
                    </button>
                  </div>
                  {updatingStatus && (
                    <div className="flex justify-center mt-2">
                      <svg className="animate-spin h-5 w-5 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                    </div>
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
                    {(() => {
                      if (order && 'completed_at' in order && order.completed_at) {
                        return (
                          <div className="flex items-start">
                            <div className="flex-shrink-0 h-4 w-4 rounded-full bg-green-600 mt-1"></div>
                            <div className="ml-3">
                              <p className="text-sm font-medium">Завершен</p>
                              <p className="text-xs text-gray-500">{formatDate(order.completed_at as string)}</p>
                            </div>
                          </div>
                        );
                      }
                      return null;
                    })()}
                  </div>
            </div>
          </div>
        </div>

            {/* Действия */}
            <div className="bg-white rounded-lg shadow-md overflow-hidden">
              <div className="px-6 py-4 border-b">
                <h2 className="text-xl font-semibold">Действия</h2>
              </div>
              <div className="p-6 space-y-3">
                <Link href={`/waiter/orders`} className="bg-gray-100 text-gray-800 text-center py-3 px-4 rounded-md font-medium hover:bg-gray-200 transition flex items-center justify-center">
                  <DocumentTextIcon className="h-5 w-5 mr-2" />
                  Вернуться к списку заказов
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </WaiterLayout>
  );
};

export default WaiterOrderDetailPage; 