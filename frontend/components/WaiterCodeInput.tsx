import React, { useState } from 'react';
import { waiterApi } from '../lib/api/waiter-api';
import { toast } from 'react-hot-toast';

interface WaiterCodeInputProps {
  orderId: number;
  onSuccess?: (waiterId: string) => void;
  className?: string;
}

/**
 * Компонент для ввода кода официанта клиентом
 */
const WaiterCodeInput: React.FC<WaiterCodeInputProps> = ({ 
  orderId, 
  onSuccess, 
  className = '' 
}) => {
  const [waiterCode, setWaiterCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Обработчик отправки формы
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!waiterCode.trim()) {
      setError('Пожалуйста, введите код официанта');
      return;
    }
    
    setIsLoading(true);
    setError(null);
    setSuccess(null);
    
    try {
      const result = await waiterApi.assignWaiterToOrder(orderId, waiterCode);
      
      if (result.success) {
        setSuccess(result.message);
        toast.success(result.message);
        if (onSuccess && result.waiterId) {
          onSuccess(result.waiterId);
        }
      } else {
        setError(result.message);
        toast.error(result.message);
      }
    } catch (error: any) {
      const errorMessage = error.message || 'Произошла ошибка при привязке официанта';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={`bg-white rounded-lg shadow-md p-4 ${className}`}>
      <h2 className="font-semibold text-lg mb-2">Привязка к официанту</h2>
      
      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 text-red-700 p-3 mb-4 rounded">
          <p>{error}</p>
        </div>
      )}
      
      {success && (
        <div className="bg-green-50 border-l-4 border-green-500 text-green-700 p-3 mb-4 rounded">
          <p>{success}</p>
        </div>
      )}
      
      <p className="text-gray-600 text-sm mb-3">
        Введите код официанта, чтобы привязать его к вашему заказу. Код можно получить у официанта.
      </p>
      
      <form onSubmit={handleSubmit}>
        <div className="mb-4">
          <label htmlFor="waiterCode" className="block text-sm font-medium text-gray-700 mb-1">
            Код официанта
          </label>
          <input
            type="text"
            id="waiterCode"
            value={waiterCode}
            onChange={(e) => setWaiterCode(e.target.value.toUpperCase())}
            placeholder="Введите код"
            disabled={isLoading}
            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            maxLength={6}
          />
        </div>
        
        <button
          type="submit"
          disabled={isLoading}
          className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2 px-4 rounded-md transition-colors disabled:opacity-50"
        >
          {isLoading ? 'Привязка...' : 'Привязать официанта'}
        </button>
      </form>
    </div>
  );
};

export default WaiterCodeInput; 