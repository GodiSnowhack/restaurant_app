import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { useSession } from 'next-auth/react';
import { toast } from 'react-hot-toast';
import { ordersApi } from '../../lib/api/orders';
import LoadingSpinner from '../../components/LoadingSpinner';
import OrderCodeInput from '../../components/OrderCodeInput';

export default function BindOrderPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [orderCode, setOrderCode] = useState('');
  const [error, setError] = useState('');

  // Проверяем авторизацию
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push(`/auth/login?redirect=${encodeURIComponent('/waiter/bind')}`);
    }
  }, [status, router]);

  // Обработчик ввода кода
  const handleCodeChange = (value: string) => {
    setOrderCode(value);
    setError('');
  };

  // Обработчик привязки заказа
  const handleBindOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!orderCode.trim()) {
      setError('Пожалуйста, введите код заказа');
      return;
    }

    try {
      setIsLoading(true);
      setError('');
      
      console.log('Отправка запроса на привязку заказа с кодом:', orderCode);
      const result = await ordersApi.assignOrderByCode(orderCode);
      
      if (result.success) {
        toast.success(`Заказ #${result.orderNumber} успешно привязан!`);
        router.push(`/waiter/orders/${result.orderId}`);
      } else {
        setError(result.message || 'Не удалось привязать заказ');
        toast.error(result.message || 'Не удалось привязать заказ');
      }
    } catch (err: any) {
      console.error('Ошибка при привязке заказа:', err);
      const errorMessage = err.message || 'Произошла ошибка при привязке заказа';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  // Если загружается сессия, показываем спиннер
  if (status === 'loading') {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <LoadingSpinner size="large" />
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>Привязка заказа | Система управления рестораном</title>
        <meta name="description" content="Привязка заказа к официанту по коду" />
      </Head>

      <div className="container mx-auto px-4 py-8 max-w-md">
        <h1 className="text-2xl font-bold mb-6 text-center">Привязка заказа</h1>
        
        <div className="bg-white rounded-lg shadow-md p-6">
          <p className="mb-4 text-gray-700">
            Введите код заказа, полученный от клиента или указанный в QR-коде
          </p>

          <form onSubmit={handleBindOrder} className="space-y-4">
            <div>
              <label htmlFor="orderCode" className="block text-sm font-medium text-gray-700 mb-1">
                Код заказа
              </label>
              <OrderCodeInput 
                value={orderCode}
                onChange={handleCodeChange}
                disabled={isLoading}
                error={error}
              />
              {error && (
                <p className="mt-2 text-sm text-red-600">{error}</p>
              )}
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
              >
                {isLoading ? (
                  <>
                    <LoadingSpinner size="small" className="mr-2" />
                    Привязка...
                  </>
                ) : (
                  'Привязать заказ'
                )}
              </button>
            </div>
          </form>
        </div>

        <div className="mt-4 text-center">
          <button
            onClick={() => router.back()}
            className="text-indigo-600 hover:text-indigo-800"
          >
            Вернуться назад
          </button>
        </div>
      </div>
    </>
  );
} 