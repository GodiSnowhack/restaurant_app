import { useState, useEffect } from 'react';
import { NextPage } from 'next';
import { useRouter } from 'next/router';
import dynamic from 'next/dynamic';
import Layout from '../../components/Layout';
import WaiterDashboard from '../../components/WaiterDashboard';
import useAuthStore from '../../lib/auth-store';
import { toast } from 'react-hot-toast';
import { ordersApi } from '../../lib/api';
import { QrCodeIcon } from '@heroicons/react/24/outline';

// Динамический импорт улучшенного компонента сканера
const QrCodeScannerEnhanced = dynamic(() => import('../../components/QrCodeScannerEnhanced'), {
  ssr: false,
  loading: () => <div className="flex justify-center py-8">Загрузка сканера...</div>
});

const ScanOrderPage: NextPage = () => {
  const router = useRouter();
  const { isAuthenticated, user } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState<{orderId: number, message: string} | null>(null);

  useEffect(() => {
    // Проверяем авторизацию
    if (!isAuthenticated) {
      router.push('/auth/login');
      return;
    }

    // Проверяем роль пользователя
    if (user?.role !== 'waiter' && user?.role !== 'admin') {
      router.push('/');
      toast.error('Доступ запрещен. Эта страница только для официантов и администраторов.');
      return;
    }
  }, [isAuthenticated, router, user]);

  const handleQrSuccess = async (orderId: number, orderCode: string) => {
    try {
      setLoading(true);
      setError('');
      
      console.log(`QR-код успешно отсканирован: заказ №${orderId}, код ${orderCode}`);
      
      // Отправляем запрос на привязку заказа к официанту
      const result = await ordersApi.assignOrderToWaiter(orderId, orderCode);
      
      // Отображаем сообщение об успехе
      setSuccess({
        orderId,
        message: `Заказ №${orderId} успешно привязан к вашему аккаунту`
      });
      
      toast.success(`Заказ №${orderId} успешно привязан`);
      
      // Перенаправляем на детали заказа через 2 секунды
      setTimeout(() => {
        router.push(`/waiter/orders/${orderId}`);
      }, 2000);
      
    } catch (err: any) {
      console.error('Ошибка при привязке заказа:', err);
      setError(err.message || 'Не удалось привязать заказ');
      toast.error(err.message || 'Не удалось привязать заказ');
    } finally {
      setLoading(false);
    }
  };

  const handleQrError = (errorMsg: string) => {
    setError(errorMsg);
    toast.error(errorMsg);
  };

  return (
    <Layout title="Сканирование заказа">
      <WaiterDashboard>
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-2xl mx-auto">
            <h1 className="text-2xl font-bold mb-6 text-center">Сканирование QR-кода заказа</h1>
            
            {error && (
              <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-6">
                <p>{error}</p>
              </div>
            )}
            
            {success ? (
              <div className="bg-green-100 border-l-4 border-green-500 text-green-700 p-4 mb-6">
                <p>{success.message}</p>
                <p className="mt-2 text-sm">Переход к заказу...</p>
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow-md p-6">
                <div className="flex justify-center mb-4">
                  <QrCodeIcon className="h-12 w-12 text-primary" />
                </div>
                
                <p className="text-gray-600 mb-4 text-center">
                  Отсканируйте QR-код заказа клиента, чтобы привязать его к вашему аккаунту и начать обслуживание
                </p>
                
                <div className="mb-4">
                  <QrCodeScannerEnhanced 
                    onSuccess={handleQrSuccess} 
                    onError={handleQrError}
                    showControls={true}
                    autoStart={true}
                  />
                </div>
                
                <div className="mt-6">
                  <h3 className="font-medium text-lg text-gray-700 mb-2">Инструкция</h3>
                  <ul className="list-disc pl-5 space-y-1 text-sm text-gray-600">
                    <li>Попросите клиента показать QR-код заказа</li>
                    <li>Наведите камеру телефона на QR-код</li>
                    <li>Держите камеру ровно и на расстоянии 15-30 см от кода</li>
                    <li>При необходимости используйте переключатель камеры</li>
                    <li>После успешного сканирования вы будете автоматически перенаправлены на страницу заказа</li>
                  </ul>
                </div>
              </div>
            )}
          </div>
        </div>
      </WaiterDashboard>
    </Layout>
  );
};

export default ScanOrderPage; 