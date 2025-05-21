import React, { useEffect, useState } from 'react';
import { isMobileDevice } from '@/lib/api/core';
import { Spinner } from '@/components/ui/spinner';

interface MobileDetectorProps {
  children: React.ReactNode;
}

/**
 * Компонент для определения мобильного устройства и проверки подключения к серверу
 * Отображает индикатор загрузки и ошибки для мобильных устройств
 */
export const MobileDetector: React.FC<MobileDetectorProps> = ({ children }) => {
  const [isMobile, setIsMobile] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [serverAvailable, setServerAvailable] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeoutError, setTimeoutError] = useState(false);

  useEffect(() => {
    // Определяем, является ли устройство мобильным
    const mobile = isMobileDevice();
    setIsMobile(mobile);
    
    if (!mobile) {
      setIsLoading(false);
      return;
    }
    
    // Устанавливаем таймер для определения зависания загрузки
    const loadingTimeout = setTimeout(() => {
      if (isLoading) {
        setTimeoutError(true);
      }
    }, 15000);
    
    // Проверяем подключение к серверу
    const checkServer = async () => {
      try {
        // Используем собственный API-proxy для проверки подключения
        const pingUrl = `/api/ping?_=${Date.now()}`;
        console.log('MobileDetector - Проверка доступности сервера:', pingUrl);
        
        const response = await fetch(pingUrl, {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
            'X-Mobile-Check': 'true'
          },
          cache: 'no-store'
        });
        
        const data = await response.json();
        console.log('MobileDetector - Ответ сервера:', data);
        
        // Проверяем успешность ответа
        if (!data.success) {
          setServerAvailable(false);
          setError(data.message || 'Сервер временно недоступен');
        }
        
        // В любом случае завершаем загрузку
        setIsLoading(false);
      } catch (error) {
        console.error('MobileDetector - Ошибка при проверке сервера:', error);
        setServerAvailable(false);
        setError('Не удалось проверить доступность сервера');
        setIsLoading(false);
      }
    };
    
    // Запускаем проверку
    checkServer();
    
    // Очищаем таймер при размонтировании
    return () => {
      clearTimeout(loadingTimeout);
    };
  }, []);
  
  // Если это не мобильное устройство, просто отображаем дочерние компоненты
  if (!isMobile) {
    return <>{children}</>;
  }
  
  // Отображаем индикатор загрузки для мобильных устройств
  if (isLoading) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center bg-white z-50">
        <Spinner size="lg" />
        <p className="mt-4 text-gray-600 text-center px-4">
          Загрузка приложения...
          {timeoutError && (
            <span className="block text-red-500 mt-2">
              Загрузка занимает больше времени, чем обычно.
              Проверьте подключение к интернету.
            </span>
          )}
        </p>
      </div>
    );
  }
  
  // Отображаем ошибку, если сервер недоступен
  if (!serverAvailable) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center bg-white z-50 p-4">
        <div className="text-center">
          <svg className="w-16 h-16 mx-auto text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <h2 className="mt-4 text-xl font-semibold text-gray-800">Проблема с подключением</h2>
          <p className="mt-2 text-gray-600">{error || 'Не удалось подключиться к серверу'}</p>
          <button
            className="mt-6 px-4 py-2 bg-primary text-white rounded-md shadow hover:bg-primary-dark"
            onClick={() => window.location.reload()}
          >
            Обновить страницу
          </button>
        </div>
      </div>
    );
  }
  
  // Если все проверки пройдены, отображаем дочерние компоненты
  return <>{children}</>;
};

/**
 * Версия детектора для использования без children
 * Используется в _app.tsx для отображения состояния подключения мобильных устройств
 */
export const MobileDetectorIndicator: React.FC = () => {
  const [isActive, setIsActive] = useState(false);
  const [isConnected, setIsConnected] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState<string | null>(null);

  useEffect(() => {
    // Проверяем только на мобильных устройствах
    if (!isMobileDevice()) {
      return;
    }

    setIsActive(true);

    // Проверяем соединение с сервером
    const checkConnection = async () => {
      try {
        const response = await fetch('/api/ping?type=indicator', {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
            'X-Mobile-Check': 'true'
          },
          cache: 'no-store'
        });
        
        if (response.ok) {
          setIsConnected(true);
          setConnectionStatus('Подключено');
        } else {
          setIsConnected(false);
          setConnectionStatus('Ошибка соединения');
        }
      } catch (error) {
        setIsConnected(false);
        setConnectionStatus('Нет соединения');
      }
    };
    
    checkConnection();
    
    // Периодическая проверка соединения
    const interval = setInterval(checkConnection, 30000);
    
    return () => {
      clearInterval(interval);
    };
  }, []);
  
  // Если не активно, или не мобильное устройство, ничего не показываем
  if (!isActive) {
    return null;
  }
  
  // Индикатор состояния подключения
  return (
    <div className="fixed bottom-4 right-4 z-50">
      <div className={`flex items-center px-3 py-1 rounded-full text-xs ${
        isConnected ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
      }`}>
        <div className={`w-2 h-2 rounded-full mr-1 ${
          isConnected ? 'bg-green-500' : 'bg-red-500'
        }`}></div>
        {connectionStatus || (isConnected ? 'Онлайн' : 'Офлайн')}
      </div>
    </div>
  );
}; 