import React, { useState } from 'react';
import { ordersApi } from '../lib/api';
import { useRouter } from 'next/router';
import { toast } from 'react-hot-toast';

interface OrderCodeInputProps {
  value?: string;
  onChange?: (value: string) => void;
  disabled?: boolean;
  error?: string;
  onSubmit?: (code: string) => void;
  className?: string;
}

const OrderCodeInput: React.FC<OrderCodeInputProps> = ({
  value,
  onChange,
  disabled = false,
  error,
  onSubmit,
  className = ''
}) => {
  // Если не переданы внешние пропсы, используем внутреннее состояние
  const [orderCode, setOrderCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [internalError, setInternalError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const router = useRouter();

  // Используем либо внешний обработчик, либо внутренний
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const codeToSubmit = value !== undefined ? value : orderCode;
    if (!codeToSubmit.trim()) {
      const errorMessage = 'Пожалуйста, введите код заказа';
      if (onChange) {
        // Если есть внешний обработчик, пробрасываем ошибку наверх
      } else {
        setInternalError(errorMessage);
      }
      return;
    }
    
    if (onSubmit) {
      // Если есть внешний обработчик, вызываем его
      onSubmit(codeToSubmit);
      return;
    }
    
    // Иначе используем внутреннюю логику
    setLoading(true);
    setInternalError(null);
    
    try {
      const result = await ordersApi.assignOrderByCode(codeToSubmit);
      
      if (result.success) {
        setSuccess(`Заказ #${result.orderNumber} успешно привязан к вам!`);
        if (value === undefined) setOrderCode(''); // Очищаем только внутреннее состояние
        
        // Перенаправляем на страницу заказа через 2 секунды
        setTimeout(() => {
          router.push(`/waiter/orders/${result.orderId}`);
        }, 2000);
      } else {
        setInternalError(result.message || 'Не удалось привязать заказ');
      }
    } catch (err: any) {
      setInternalError(err.message || 'Произошла ошибка при привязке заказа');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`${className}`}>
      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 text-red-700 p-3 mb-4 rounded">
          <p>{error}</p>
        </div>
      )}
      
      {!error && internalError && (
        <div className="bg-red-50 border-l-4 border-red-500 text-red-700 p-3 mb-4 rounded">
          <p>{internalError}</p>
        </div>
      )}
      
      {success && (
        <div className="bg-green-50 border-l-4 border-green-500 text-green-700 p-3 mb-4 rounded">
          <p>{success}</p>
        </div>
      )}
      
      <form onSubmit={handleSubmit}>
        <div className="flex items-center">
          <input
            type="text"
            value={value !== undefined ? value : orderCode}
            onChange={(e) => {
              const newValue = e.target.value.toUpperCase();
              if (onChange) {
                onChange(newValue);
              } else {
                setOrderCode(newValue);
              }
            }}
            placeholder="Введите код заказа"
            className="flex-1 px-4 py-2 border border-gray-300 rounded-l-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            disabled={disabled || loading}
            maxLength={8}
          />
          
          <button
            type="submit"
            disabled={disabled || loading}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-r-md transition-colors disabled:opacity-50"
          >
            {loading ? (
              <span className="flex items-center">
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Привязка...
              </span>
            ) : (
              'Привязать'
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default OrderCodeInput; 