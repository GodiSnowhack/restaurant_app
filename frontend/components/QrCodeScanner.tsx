import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { toast } from 'react-hot-toast';
import { ordersApi } from '../lib/api';

// Динамический импорт компонента сканера QR-кода
// Он должен быть загружен только на клиенте, потому что использует браузерные API
const QrReader = dynamic(() => import('react-qr-scanner'), { ssr: false });

interface QrCodeScannerProps {
  onSuccess?: (orderId: number, orderCode: string) => void;
  onError?: (error: string) => void;
}

const QrCodeScanner: React.FC<QrCodeScannerProps> = ({ onSuccess, onError }) => {
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cameraPermission, setCameraPermission] = useState<boolean | null>(null);

  // Запрос разрешения на доступ к камере при монтировании компонента
  useEffect(() => {
    if (typeof window !== 'undefined') {
      navigator.mediaDevices.getUserMedia({ video: true })
        .then(() => {
          setCameraPermission(true);
          setScanning(true);
        })
        .catch((err) => {
          console.error('Ошибка доступа к камере:', err);
          setCameraPermission(false);
          setError('Не удалось получить доступ к камере. Пожалуйста, разрешите доступ в настройках браузера.');
          if (onError) onError('Не удалось получить доступ к камере');
        });
    }

    // Очистка при размонтировании
    return () => {
      setScanning(false);
    };
  }, [onError]);

  const handleScan = async (data: { text: string } | null) => {
    if (data && data.text) {
      try {
        setScanning(false);
        setResult(data.text);
        
        // Пытаемся распарсить данные QR-кода
        const qrData = JSON.parse(data.text);
        
        // Проверяем, что это QR-код заказа из нашего приложения
        if (qrData.type === 'restaurant_order' && qrData.order_id && qrData.order_code) {
          console.log('Отсканирован QR-код заказа:', qrData);
          
          // Вызываем колбэк успешного сканирования
          if (onSuccess) {
            onSuccess(qrData.order_id, qrData.order_code);
          } else {
            // Если колбэк не предоставлен, сами обрабатываем привязку заказа
            try {
              await ordersApi.assignOrderToWaiter(qrData.order_id, qrData.order_code);
              toast.success('Заказ успешно привязан к вашему аккаунту');
            } catch (err: any) {
              console.error('Ошибка при привязке заказа:', err);
              toast.error(err.message || 'Не удалось привязать заказ');
              setError('Ошибка при привязке заказа. Пожалуйста, попробуйте снова.');
              // Возобновляем сканирование
              setScanning(true);
            }
          }
        } else {
          const errorMsg = 'Некорректный QR-код заказа';
          setError(errorMsg);
          if (onError) onError(errorMsg);
          // Возобновляем сканирование через 2 секунды
          setTimeout(() => {
            setScanning(true);
            setError(null);
          }, 2000);
        }
      } catch (err) {
        const errorMsg = 'Не удалось обработать QR-код';
        console.error(errorMsg, err);
        setError(errorMsg);
        if (onError) onError(errorMsg);
        // Возобновляем сканирование через 2 секунды
        setTimeout(() => {
          setScanning(true);
          setError(null);
        }, 2000);
      }
    }
  };

  const handleError = (err: any) => {
    console.error('Ошибка сканирования QR-кода:', err);
    setError('Ошибка сканирования QR-кода');
    if (onError) onError('Ошибка сканирования QR-кода');
  };

  const restartScanning = () => {
    setScanning(true);
    setResult(null);
    setError(null);
  };

  // Стили для компонента
  const styles = {
    container: {
      display: 'flex',
      flexDirection: 'column' as 'column',
      alignItems: 'center',
      width: '100%',
      maxWidth: '400px',
      margin: '0 auto',
    },
    preview: {
      width: '100%',
      height: 'auto',
      border: '1px solid #ddd',
      borderRadius: '8px',
      overflow: 'hidden',
    },
    button: {
      marginTop: '16px',
      padding: '8px 16px',
      backgroundColor: '#4f46e5',
      color: 'white',
      border: 'none',
      borderRadius: '4px',
      cursor: 'pointer',
    },
    error: {
      color: '#ef4444',
      marginTop: '12px',
      textAlign: 'center' as 'center',
    },
    success: {
      color: '#10b981',
      marginTop: '12px',
      textAlign: 'center' as 'center',
    },
    info: {
      marginTop: '12px',
      textAlign: 'center' as 'center',
    }
  };

  if (cameraPermission === false) {
    return (
      <div style={styles.container}>
        <div style={styles.error}>
          <p>{error}</p>
          <button style={styles.button} onClick={() => window.location.reload()}>
            Попробовать снова
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {scanning ? (
        <>
          <div style={styles.preview}>
            <QrReader
              delay={300}
              onError={handleError}
              onScan={handleScan}
              constraints={{
                video: { facingMode: 'environment' }
              }}
              style={{ width: '100%' }}
            />
          </div>
          <p style={styles.info}>Наведите камеру на QR-код заказа</p>
        </>
      ) : result ? (
        <div style={styles.success}>
          <p>QR-код успешно отсканирован!</p>
          <button style={styles.button} onClick={restartScanning}>
            Сканировать ещё
          </button>
        </div>
      ) : null}

      {error && <p style={styles.error}>{error}</p>}
    </div>
  );
};

export default QrCodeScanner; 