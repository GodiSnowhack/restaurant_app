import React, { useState } from 'react';
import { waiterApi } from '../lib/api/waiter-api';
import { toast } from 'react-hot-toast';
import { ArrowPathIcon, ArrowRightIcon } from '@heroicons/react/24/outline';

interface WaiterAssignOrderByCodeProps {
  className?: string;
  onOrderAssigned?: (orderInfo: any) => void;
}

/**
 * Компонент для привязки заказа к официанту через код заказа
 */
const WaiterAssignOrderByCode: React.FC<WaiterAssignOrderByCodeProps> = ({ 
  className = '',
  onOrderAssigned 
}) => {
  const [orderCode, setOrderCode] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Функция привязки заказа по коду
  const handleAssignOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!orderCode.trim()) {
      setError('Введите код заказа');
      return;
    }
    
    setIsLoading(true);
    setError(null);
    setSuccess(null);
    
    try {
      // Вызываем метод API для привязки заказа по коду
      const result = await waiterApi.assignOrderByCode(orderCode);
      
      console.log('Результат привязки заказа по коду:', result);
      
      // Считаем операцию успешной при любом успешном ответе от сервера
      // или если получены какие-либо данные о заказе (даже с ошибкой API)
      if (result && (result.success || result.order_id)) {
        const successMessage = `Заказ ${result.order_id || `с кодом ${orderCode}`} успешно привязан к вам`;
        
        setSuccess(successMessage);
        toast.success(successMessage);
        setOrderCode('');
        
        // Вызываем callback с информацией о заказе
        if (onOrderAssigned) {
          onOrderAssigned(result);
        }
      } else {
        setError(result?.message || 'Не удалось привязать заказ. Проверьте код и попробуйте снова.');
        toast.error(result?.message || 'Ошибка при привязке заказа');
      }
    } catch (err: any) {
      console.error('Ошибка при привязке заказа по коду:', err);
      
      // Проверяем, не произошла ли ошибка после успешного обновления БД
      if (err.message && (
          err.message.includes('неудачно') || 
          err.message.includes('обновления') ||
          err.message.includes('завершились')
        )) {
        // Пытаемся получить список активных заказов для проверки
        try {
          // Используем getWaiterOrders вместо getActiveOrders
          const waiterOrders = await waiterApi.getWaiterOrders();
          
          // Добавляем тип для order
          const foundOrder = waiterOrders.find((order: any) => 
            order.order_code === orderCode || order.display_code === orderCode
          );
          
          if (foundOrder) {
            // Заказ был успешно привязан, несмотря на ошибку API
            const successMessage = `Заказ #${foundOrder.id} был привязан, перезагрузите страницу`;
            setSuccess(successMessage);
            toast.success(successMessage);
            setOrderCode('');
            
            // Вызываем callback
            if (onOrderAssigned) {
              onOrderAssigned({
                success: true,
                order_id: foundOrder.id,
                message: successMessage
              });
            }
            
            return;
          }
        } catch (checkError) {
          console.error('Ошибка при проверке списка заказов:', checkError);
        }
      }
      
      setError(err.message || 'Произошла ошибка при привязке заказа');
      toast.error(err.message || 'Произошла ошибка при привязке заказа');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={`bg-white rounded-lg shadow-md p-6 ${className}`}>
      <h2 className="text-lg font-semibold mb-4">Привязать заказ по коду</h2>
      
      <p className="text-sm text-gray-600 mb-4">
        Введите код заказа, чтобы привязать его к вам. Клиент может предоставить этот код со своего мобильного устройства.
      </p>
      
      <form onSubmit={handleAssignOrder} className="space-y-4">
        <div>
          <label htmlFor="orderCode" className="block text-sm font-medium text-gray-700 mb-1">
            Код заказа
          </label>
          <div className="flex">
            <input
              type="text"
              id="orderCode"
              value={orderCode}
              onChange={(e) => setOrderCode(e.target.value.toUpperCase())}
              className="flex-1 block w-full rounded-l-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-lg font-mono text-center tracking-wider"
              placeholder="ABCDEF"
              maxLength={6}
              disabled={isLoading}
            />
            <button
              type="submit"
              disabled={isLoading || !orderCode.trim()}
              className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-r-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
            >
              {isLoading ? (
                <ArrowPathIcon className="h-5 w-5 animate-spin" />
              ) : (
                <ArrowRightIcon className="h-5 w-5" />
              )}
            </button>
          </div>
        </div>
        
        {error && (
          <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            </div>
          </div>
        )}
        
        {success && (
          <div className="bg-green-50 border-l-4 border-green-500 p-4 rounded">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-green-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-green-700">{success}</p>
              </div>
            </div>
          </div>
        )}
      </form>
      
      <div className="mt-4 pt-4 border-t border-gray-200">
        <h3 className="text-sm font-medium text-gray-700 mb-2">Как это работает:</h3>
        <ol className="text-sm text-gray-600 list-decimal pl-5 space-y-1">
          <li>Попросите клиента показать код заказа с его устройства</li>
          <li>Введите код в поле выше и нажмите кнопку привязки</li>
          <li>После привязки заказ появится в вашем списке активных заказов</li>
        </ol>
      </div>
    </div>
  );
};

export default WaiterAssignOrderByCode; 