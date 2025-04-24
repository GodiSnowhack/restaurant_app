import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Order, OrderItem } from '../types';
import { formatPrice } from '../utils/priceFormatter';

interface TestOrdersListProps {
  showDebug?: boolean;
}

const TestOrdersList = ({ showDebug = false }: TestOrdersListProps) => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadTestOrders();
  }, []);

  const loadTestOrders = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch('/api/orders/test');
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('Получены тестовые заказы:', data);
      setOrders(data);
    } catch (error: any) {
      console.error('Ошибка при загрузке тестовых заказов:', error);
      setError(error.message || 'Произошла ошибка при загрузке заказов');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="p-4 bg-gray-100 rounded">Загрузка тестовых заказов...</div>;
  }

  if (error) {
    return (
      <div className="p-4 bg-red-100 text-red-800 rounded">
        <h3 className="font-bold">Ошибка загрузки</h3>
        <p>{error}</p>
        <button 
          onClick={loadTestOrders}
          className="mt-2 bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded text-sm"
        >
          Попробовать снова
        </button>
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="p-4 bg-yellow-100 text-yellow-800 rounded">
        <p>Нет доступных тестовых заказов.</p>
        <button 
          onClick={loadTestOrders}
          className="mt-2 bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded text-sm"
        >
          Обновить
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      <div className="px-4 py-3 bg-gray-50 border-b flex justify-between items-center">
        <h3 className="font-semibold">Тестовые заказы</h3>
        <button 
          onClick={loadTestOrders}
          className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded text-sm"
        >
          Обновить
        </button>
      </div>
      
      {showDebug && (
        <div className="p-3 bg-gray-100 border-b text-xs">
          <p>Количество заказов: {orders.length}</p>
          <pre className="mt-1 bg-gray-200 p-2 rounded overflow-auto max-h-32">
            {JSON.stringify(orders[0], null, 2)}
          </pre>
        </div>
      )}
      
      <div className="divide-y divide-gray-200">
        {orders.map(order => (
          <div key={order.id} className="p-4 hover:bg-gray-50">
            <div className="flex justify-between mb-2">
              <div>
                <span className="font-medium">Заказ #{order.id}</span>
                <span className="ml-2 text-sm text-gray-500">
                  {new Date(order.created_at).toLocaleDateString('ru-RU')}
                </span>
              </div>
              <div>
                <StatusBadge status={order.status} />
              </div>
            </div>
            
            <div className="text-sm text-gray-600 mb-2">
              {order.customer_name || 'Гость'} • {order.customer_phone || 'Нет телефона'}
            </div>
            
            <div className="text-sm mb-2">
              <span className="font-medium">{formatPrice(order.total_amount)} ₸</span>
              {order.payment_method && (
                <>
                  <span className="mx-2">•</span>
                  <span>{getPaymentMethodName(order.payment_method)}</span>
                </>
              )}
              {order.payment_status && (
                <PaymentStatusBadge status={order.payment_status} />
              )}
            </div>
            
            {order.items && order.items.length > 0 && (
              <div className="text-sm text-gray-500">
                {order.items.length} {getItemsText(order.items.length)}:
                {' '}
                {order.items.map(item => `${item.dish?.name || `Блюдо #${item.dish_id}`} (${item.quantity})`).join(', ')}
              </div>
            )}
            
            <div className="mt-2 text-right">
              <Link href={`/orders/${order.id}`} className="text-primary hover:underline text-sm">
                Подробнее
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// Вспомогательные функции
const StatusBadge = ({ status }: { status: string }) => {
  let bgColor = 'bg-gray-100 text-gray-800';
  let text = 'Неизвестно';
  
  switch (status) {
    case 'pending':
      bgColor = 'bg-yellow-100 text-yellow-800';
      text = 'Новый';
      break;
    case 'confirmed':
      bgColor = 'bg-blue-100 text-blue-800';
      text = 'Подтвержден';
      break;
    case 'preparing':
      bgColor = 'bg-indigo-100 text-indigo-800';
      text = 'Готовится';
      break;
    case 'ready':
      bgColor = 'bg-green-100 text-green-800';
      text = 'Готов';
      break;
    case 'delivered':
      bgColor = 'bg-purple-100 text-purple-800';
      text = 'Доставлен';
      break;
    case 'completed':
      bgColor = 'bg-green-100 text-green-800';
      text = 'Завершен';
      break;
    case 'cancelled':
      bgColor = 'bg-red-100 text-red-800';
      text = 'Отменен';
      break;
  }
  
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${bgColor}`}>
      {text}
    </span>
  );
};

const PaymentStatusBadge = ({ status }: { status: string }) => {
  if (status === 'paid') {
    return (
      <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
        Оплачен
      </span>
    );
  }
  
  if (status === 'failed') {
    return (
      <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
        Ошибка
      </span>
    );
  }
  
  return null;
};

const getItemsText = (count: number): string => {
  if (count === 1) return 'позиция';
  if (count > 1 && count < 5) return 'позиции';
  return 'позиций';
};

const getPaymentMethodName = (method: string): string => {
  switch (method) {
    case 'card': return 'Картой';
    case 'cash': return 'Наличными';
    case 'online': return 'Онлайн';
    default: return method;
  }
};

export default TestOrdersList; 