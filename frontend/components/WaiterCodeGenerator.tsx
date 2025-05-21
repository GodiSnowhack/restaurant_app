import React, { useState, useEffect } from 'react';
import { waiterApi } from '../lib/api/waiter-api';
import { toast } from 'react-hot-toast';
import { ClipboardIcon, CheckIcon, TrashIcon } from '@heroicons/react/24/outline';
import useWaiterCodesStore, { WaiterCode } from '../lib/waiter-codes-store';

interface WaiterCodeGeneratorProps {
  className?: string;
}

/**
 * Компонент для генерации и отображения кода официанта
 */
const WaiterCodeGenerator: React.FC<WaiterCodeGeneratorProps> = ({ className = '' }) => {
  const { codes, addCode, removeCode, clearExpiredCodes, getValidCodes } = useWaiterCodesStore();
  const [waiterCode, setWaiterCode] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<Date | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [validCodes, setValidCodes] = useState<WaiterCode[]>([]);

  // При монтировании компонента очищаем просроченные коды
  useEffect(() => {
    clearExpiredCodes();
    updateValidCodes();
  }, [clearExpiredCodes]);

  // Обновляем список действительных кодов
  const updateValidCodes = () => {
    setValidCodes(getValidCodes());
  };

  // Функция генерации нового кода
  const handleGenerateCode = async () => {
    setIsLoading(true);
    try {
      const result = await waiterApi.generateWaiterCode();
      
      if (result.success && result.code) {
        setWaiterCode(result.code);
        setExpiresAt(result.expiresAt || null);
        
        // Сохраняем код в хранилище
        if (result.expiresAt) {
          addCode(result.code, result.expiresAt);
          updateValidCodes();
        }
        
        toast.success('Код успешно сгенерирован');
      } else {
        toast.error(result.message || 'Не удалось сгенерировать код');
      }
    } catch (error: any) {
      console.error('Ошибка при генерации кода:', error);
      toast.error(error.message || 'Произошла ошибка при генерации кода');
    } finally {
      setIsLoading(false);
    }
  };

  // Функция копирования кода в буфер обмена
  const copyToClipboard = (code: string) => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      toast.success('Код скопирован в буфер обмена');
      setTimeout(() => setCopied(false), 2000);
    });
  };

  // Удаление кода из истории
  const handleRemoveCode = (code: string) => {
    removeCode(code);
    updateValidCodes();
    toast.success('Код удален из истории');
  };

  // Форматирование времени истечения срока действия
  const formatExpiryTime = (date: Date) => {
    if (!date) return '';
    
    return new Intl.DateTimeFormat('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date(date));
  };

  return (
    <div className={`bg-white rounded-lg shadow-md p-6 ${className}`}>
      <h2 className="text-lg font-semibold mb-4">Код официанта</h2>
      
      <p className="text-sm text-gray-600 mb-4">
        Сгенерируйте код, который клиенты могут использовать при оформлении заказа для привязки к вам как к официанту.
      </p>
      
      {waiterCode ? (
        <div className="space-y-4">
          <div className="flex items-center">
            <div className="flex-1 bg-gray-50 p-3 rounded-l-md border border-gray-200 font-mono text-xl text-center">
              {waiterCode}
            </div>
            <button
              onClick={() => copyToClipboard(waiterCode)}
              className="bg-indigo-600 hover:bg-indigo-700 text-white p-3 rounded-r-md transition-colors"
              title="Копировать код"
            >
              {copied ? (
                <CheckIcon className="h-6 w-6" />
              ) : (
                <ClipboardIcon className="h-6 w-6" />
              )}
            </button>
          </div>
          
          {expiresAt && (
            <p className="text-sm text-gray-500">
              Действителен до: {formatExpiryTime(expiresAt)}
            </p>
          )}
          
          <button
            onClick={handleGenerateCode}
            disabled={isLoading}
            className="mt-2 w-full py-2 px-4 bg-indigo-100 text-indigo-700 rounded-md hover:bg-indigo-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50"
          >
            {isLoading ? 'Генерация...' : 'Сгенерировать новый код'}
          </button>
        </div>
      ) : (
        <button
          onClick={handleGenerateCode}
          disabled={isLoading}
          className="w-full py-2 px-4 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50"
        >
          {isLoading ? 'Генерация...' : 'Сгенерировать код'}
        </button>
      )}
      
      {/* История кодов */}
      <div className="mt-6">
        <button
          onClick={() => setShowHistory(!showHistory)}
          className="text-sm text-indigo-600 hover:text-indigo-800 flex items-center"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          {showHistory ? 'Скрыть историю кодов' : 'Показать историю кодов'}
        </button>
        
        {showHistory && validCodes.length > 0 && (
          <div className="mt-3 border border-gray-200 rounded-md overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Код</th>
                  <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Статус</th>
                  <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Истекает</th>
                  <th scope="col" className="px-3 py-2 text-xs font-medium text-gray-500 uppercase">Действия</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {validCodes.map((codeItem) => (
                  <tr key={codeItem.code}>
                    <td className="px-3 py-2 whitespace-nowrap text-sm font-medium text-gray-900 font-mono">
                      {codeItem.code}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500">
                      {codeItem.used ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                          Использован
                          {codeItem.orderId && <span className="ml-1">#{codeItem.orderId}</span>}
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                          Активен
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500">
                      {formatExpiryTime(codeItem.expiresAt)}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500 text-center">
                      <div className="flex space-x-2 justify-center">
                        <button
                          onClick={() => copyToClipboard(codeItem.code)}
                          className="text-indigo-600 hover:text-indigo-900"
                          title="Копировать код"
                        >
                          <ClipboardIcon className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleRemoveCode(codeItem.code)}
                          className="text-red-600 hover:text-red-900"
                          title="Удалить код"
                        >
                          <TrashIcon className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        
        {showHistory && validCodes.length === 0 && (
          <div className="mt-3 bg-gray-50 p-4 text-center text-sm text-gray-500 rounded-md border border-gray-200">
            У вас пока нет сгенерированных кодов
          </div>
        )}
      </div>
    </div>
  );
};

export default WaiterCodeGenerator; 