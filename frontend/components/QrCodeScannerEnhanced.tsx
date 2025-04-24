import React, { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import { toast } from 'react-hot-toast';
import { ordersApi } from '../lib/api';

// Динамический импорт компонента сканера QR-кода
const QrReader = dynamic(() => import('react-qr-scanner'), { ssr: false });

interface QrCodeScannerProps {
  onSuccess?: (orderId: number, orderCode: string) => void;
  onError?: (error: string) => void;
  showControls?: boolean;
  autoStart?: boolean;
}

const QrCodeScannerEnhanced: React.FC<QrCodeScannerProps> = ({ 
  onSuccess, 
  onError,
  showControls = true,
  autoStart = true
}) => {
  const [scanning, setScanning] = useState(autoStart);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cameraPermission, setCameraPermission] = useState<boolean | null>(null);
  const [facingMode, setFacingMode] = useState<string>('environment');
  const scanAttempts = useRef<number>(0);
  const maxScanAttempts = 5;
  
  // Запрос разрешения на доступ к камере при монтировании компонента
  useEffect(() => {
    if (typeof window !== 'undefined' && autoStart) {
      checkCameraPermission();
    }

    // Очистка при размонтировании
    return () => {
      setScanning(false);
    };
  }, [autoStart]);

  const checkCameraPermission = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      
      // Закрываем стрим после проверки разрешений
      stream.getTracks().forEach(track => track.stop());
      
      setCameraPermission(true);
      setScanning(true);
    } catch (err) {
      console.error('Ошибка доступа к камере:', err);
      setCameraPermission(false);
      setError('Не удалось получить доступ к камере. Пожалуйста, разрешите доступ в настройках браузера.');
      if (onError) onError('Не удалось получить доступ к камере');
    }
  };

  const toggleCamera = () => {
    setFacingMode(facingMode === 'environment' ? 'user' : 'environment');
    toast.success(facingMode === 'environment' 
      ? 'Переключено на фронтальную камеру' 
      : 'Переключено на основную камеру'
    );
  };

  const handleScan = async (data: { text: string } | null) => {
    if (data && data.text) {
      try {
        setScanning(false);
        setResult(data.text);
        scanAttempts.current = 0;
        
        // Пытаемся распарсить данные QR-кода
        const qrData = JSON.parse(data.text);
        
        // Проверяем, что это QR-код заказа из нашего приложения
        if (qrData.type === 'restaurant_order' && qrData.order_id && qrData.order_code) {
          console.log('Отсканирован QR-код заказа:', qrData);
          
          // Вибрация при успешном сканировании (если поддерживается)
          if (navigator.vibrate) {
            navigator.vibrate(200);
          }
          
          // Звуковое уведомление
          playSuccessSound();
          
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
          playErrorSound();
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
        playErrorSound();
        if (onError) onError(errorMsg);
        // Возобновляем сканирование через 2 секунды
        setTimeout(() => {
          setScanning(true);
          setError(null);
        }, 2000);
      }
    } else {
      // Если данные не получены, увеличиваем счетчик попыток
      scanAttempts.current++;
      
      // Если много неудачных попыток, выводим подсказку
      if (scanAttempts.current > maxScanAttempts && scanAttempts.current % maxScanAttempts === 0) {
        toast.success('Наведите камеру ближе к QR-коду и убедитесь, что он хорошо освещен');
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
    scanAttempts.current = 0;
  };
  
  const handleOpenSettings = () => {
    if (navigator.permissions) {
      navigator.permissions.query({ name: 'camera' as PermissionName })
        .then(permissionStatus => {
          if (permissionStatus.state === 'denied') {
            toast.error('Доступ к камере заблокирован. Откройте настройки браузера, чтобы разрешить доступ');
          } else {
            checkCameraPermission();
          }
        });
    } else {
      checkCameraPermission();
    }
  };
  
  // Звуковые эффекты
  const playSuccessSound = () => {
    try {
      const audio = new Audio('/sounds/success-scan.mp3');
      audio.volume = 0.5;
      audio.play().catch(() => {
        // На некоторых мобильных браузерах автопроигрывание звуков блокируется
        console.log('Автопроигрывание звука заблокировано браузером');
      });
    } catch (e) {
      console.error('Ошибка воспроизведения звука:', e);
    }
  };
  
  const playErrorSound = () => {
    try {
      const audio = new Audio('/sounds/error-scan.mp3');
      audio.volume = 0.3;
      audio.play().catch(() => console.log('Автопроигрывание звука заблокировано браузером'));
    } catch (e) {
      console.error('Ошибка воспроизведения звука:', e);
    }
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
      position: 'relative' as 'relative',
      width: '100%',
      height: 'auto',
      aspectRatio: '4/3',
      border: '1px solid #ddd',
      borderRadius: '8px',
      overflow: 'hidden',
    },
    scanFrame: {
      position: 'absolute' as 'absolute',
      top: '50%',
      left: '50%',
      width: '70%',
      height: '70%',
      transform: 'translate(-50%, -50%)',
      border: '2px solid #4f46e5',
      borderRadius: '8px',
      boxShadow: '0 0 0 99999px rgba(0, 0, 0, 0.5)',
      zIndex: 2,
    },
    scanLine: {
      position: 'absolute' as 'absolute',
      top: '0',
      left: '10%',
      width: '80%',
      height: '2px',
      backgroundColor: '#4f46e5',
      boxShadow: '0 0 10px #4f46e5',
      animation: 'scan 2s linear infinite',
    },
    controls: {
      display: 'flex',
      justifyContent: 'center',
      gap: '8px',
      marginTop: '12px',
    },
    button: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '8px 16px',
      backgroundColor: '#4f46e5',
      color: 'white',
      border: 'none',
      borderRadius: '4px',
      cursor: 'pointer',
      fontSize: '14px',
    },
    iconButton: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: '40px',
      height: '40px',
      borderRadius: '50%',
      backgroundColor: '#4f46e5',
      color: 'white',
      border: 'none',
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
      fontSize: '14px',
      color: '#6b7280',
    }
  };

  if (cameraPermission === false) {
    return (
      <div style={styles.container}>
        <div style={styles.error}>
          <p>{error}</p>
          <button style={styles.button} onClick={handleOpenSettings}>
            Разрешить доступ к камере
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
                video: { 
                  facingMode,
                  width: { ideal: 1280 },
                  height: { ideal: 720 }
                }
              }}
              style={{ width: '100%' }}
              className="qr-reader"
            />
            <div style={styles.scanFrame}>
              <div style={styles.scanLine}></div>
            </div>
          </div>
          
          {showControls && (
            <div style={styles.controls}>
              <button 
                style={styles.iconButton} 
                onClick={toggleCamera}
                title="Переключить камеру"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </button>
            </div>
          )}
          
          <p style={styles.info}>Наведите камеру на QR-код заказа</p>
        </>
      ) : result ? (
        <div style={styles.success}>
          <p>QR-код успешно отсканирован!</p>
          <button style={styles.button} onClick={restartScanning}>
            Сканировать ещё
          </button>
        </div>
      ) : (
        <div style={styles.container}>
          <button style={styles.button} onClick={restartScanning}>
            Начать сканирование
          </button>
        </div>
      )}

      {error && <p style={styles.error}>{error}</p>}
      
      {/* CSS для анимации */}
      <style jsx global>{`
        @keyframes scan {
          0% {
            top: 0;
          }
          50% {
            top: 100%;
          }
          100% {
            top: 0;
          }
        }
        .qr-reader video {
          object-fit: cover;
          width: 100%;
          height: 100%;
        }
      `}</style>
    </div>
  );
};

export default QrCodeScannerEnhanced; 