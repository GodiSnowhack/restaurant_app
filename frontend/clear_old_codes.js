// Скрипт для полной очистки устаревших данных в localStorage
// Для решения проблем авторизации, бронирования и CORS

(function clearAllStorageData() {
  console.log('🧹 Начинаем полную очистку данных авторизации и бронирования...');
  
  // Список всех удаленных ключей
  const removedKeys = [];
  
  try {
    // Запрашиваем IP-адрес бэкенда или используем текущий адрес
    const currentIp = window.location.hostname;
    
    // Автоматически определяем, работаем ли с IP-адресом
    const isIpAddress = /^\d+\.\d+\.\d+\.\d+$/.test(currentIp);
    
    console.log(`🔄 Текущий хост: ${currentIp} (${isIpAddress ? 'IP-адрес' : 'домен'})`);
    
    // Если текущий хост - 192.168.0.16, автоматически настраиваем бэкенд на этот же IP
    if (currentIp === '192.168.0.16') {
      localStorage.setItem('backend_host', '192.168.0.16:8000');
      console.log(`✅ Автоматически настроен адрес бэкенда: 192.168.0.16:8000`);
    } else {
      // Иначе предлагаем выбрать
      const askBackendIp = confirm("Хотите указать IP-адрес бэкенда? (Отмена = использовать localhost)");
      
      if (askBackendIp) {
        // По умолчанию предлагаем текущий IP, если это IP-адрес
        const defaultIp = isIpAddress ? currentIp : (localStorage.getItem('backend_host')?.split(':')[0] || '192.168.0.16');
        const backendIp = prompt(`Введите IP-адрес бэкенда:`, defaultIp);
        
        if (backendIp && backendIp.trim()) {
          localStorage.setItem('backend_host', `${backendIp.trim()}:8000`);
          console.log(`✅ Установлен адрес бэкенда: ${backendIp.trim()}:8000`);
        }
      } else {
        // При отказе сбрасываем адрес бэкенда на localhost
        localStorage.setItem('backend_host', 'localhost:8000');
        console.log(`✅ Установлен адрес бэкенда: localhost:8000`);
      }
    }
    
    // Очищаем все данные авторизации
    const authKeys = [
      'token',                 // Основной токен авторизации
      'auth_token',            // Альтернативное название токена
      'user_profile',          // Профиль пользователя
      'user_id',               // ID пользователя
      'auth_state',            // Состояние авторизации
      'refresh_token',         // Токен обновления (если используется)
      'userData',              // Еще один возможный ключ с данными пользователя
      'user',                  // Данные пользователя
      'auth_timestamp',        // Временная метка авторизации
      'auth_method',           // Метод авторизации
      'api_last_errors',       // Ошибки API
      'network_diagnostics',   // Диагностика сети
      'last_auth_error',       // Последняя ошибка авторизации
      'last_profile_request',  // Последний запрос профиля
      'fetch_error_info',      // Информация об ошибках fetch
      'last_connection_error', // Последняя ошибка соединения
      'mobile_auth_error',     // Ошибка авторизации на мобильном
      'api_url_error',         // Ошибка URL API
    ];
    
    // Очищаем все ключи авторизации
    authKeys.forEach(key => {
      if (localStorage.getItem(key)) {
        localStorage.removeItem(key);
        removedKeys.push(key);
        console.log(`✅ Удален ключ авторизации: ${key}`);
      }
      
      // Также проверяем sessionStorage
      if (sessionStorage.getItem(key)) {
        sessionStorage.removeItem(key);
        console.log(`✅ Удален ключ из sessionStorage: ${key}`);
      }
    });
    
    // Очищаем все данные бронирований
    
    // 1. Удаляем основные хранилища кодов бронирования
    const reservationStores = [
      'reservationCodes',          // Основное хранилище кодов
      'user_reservations',         // Хранилище данных бронирований
      'last_reservation_code',     // Последний код бронирования
      'reservation_table',         // Информация о столике
    ];
    
    reservationStores.forEach(key => {
      if (localStorage.getItem(key)) {
        localStorage.removeItem(key);
        removedKeys.push(key);
        console.log(`✅ Удалено хранилище бронирований: ${key}`);
      }
    });
    
    // 2. Ищем и удаляем все ключи со специфическими паттернами
    const keysToRemove = [];
    
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      
      if (key && (
        // Ключи бронирований и их кодов
        key.includes('reservation') || 
        key.includes('booking') ||
        key.includes('reservCode') ||
        key.includes('table_') ||
        key.includes('order_') ||
        // Форматы кодов бронирования (например: ABC-123)
        (key.match(/[A-Z]{3}-[A-Z0-9]{3}/) !== null) ||
        // Ключи с информацией о столиках
        key.includes('reservation_table_') ||
        // Потенциальные токены (long strings)
        (key.length > 30 && key.match(/[A-Za-z0-9_-]{30,}/) !== null) ||
        // Кэши API
        key.includes('cached_') ||
        key.includes('cache_') ||
        key.includes('api_') ||
        // Любой кэш ошибок
        key.includes('error') ||
        key.includes('Error') ||
        // Диагностика
        key.includes('diagnostics') ||
        key.includes('diagnostic') ||
        // Настройки
        key.includes('settings')
      )) {
        keysToRemove.push(key);
      }
    }
    
    // Удаляем найденные ключи
    keysToRemove.forEach(key => {
      localStorage.removeItem(key);
      removedKeys.push(key);
      console.log(`✅ Удален специфический ключ: ${key}`);
    });
    
    // Удаляем все cookie
    console.log('🍪 Удаляем все cookies...');
    const cookies = document.cookie.split(';');
    
    cookies.forEach(cookie => {
      const cookieName = cookie.split('=')[0].trim();
      document.cookie = `${cookieName}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax`;
      console.log(`✅ Удален cookie: ${cookieName}`);
    });
    
    console.log('✅ Удалены все cookie авторизации');
    
    // Проверяем соединение с сервером
    console.log('🔄 Проверяем соединение с сервером...');
    
    // Пингуем сервер перед перезагрузкой для проверки соединения
    fetch('/api/v1', { 
      method: 'HEAD',
      cache: 'no-store',
      headers: { 
        'Cache-Control': 'no-cache',
        'X-Requested-With': 'XMLHttpRequest',
        'Access-Control-Allow-Origin': '*',
      }
    })
    .then(response => {
      if (response.ok) {
        console.log('✅ Соединение с сервером установлено');
      } else {
        console.warn(`⚠️ Сервер вернул статус ${response.status}`);
        // При ошибке 404, пробуем другой endpoint
        if (response.status === 404) {
          console.log('🔄 Пробуем другой endpoint...');
          return fetch('/api', { 
            method: 'HEAD',
            cache: 'no-store',
            headers: { 'Cache-Control': 'no-cache' }
          });
        }
      }
      return response;
    })
    .then(response => {
      if (response && response.ok) {
        console.log('✅ Соединение с сервером установлено через альтернативный endpoint');
      } else if (response) {
        console.warn(`⚠️ Альтернативный endpoint вернул статус ${response.status}`);
      }
    })
    .catch(err => {
      console.error('❌ Ошибка соединения с сервером:', err);
      console.log('⚠️ Возможно, вам потребуется проверить настройки подключения к серверу');
    })
    .finally(() => {
      console.log(`🎉 Очистка завершена! Удалено ${removedKeys.length} ключей и ${cookies.length} cookies.`);
      console.log('⚠️ ОБЯЗАТЕЛЬНО перезагрузите страницу для применения изменений!');
      
      // Пытаемся очистить кэш браузера (сработает только в некоторых случаях)
      try {
        if (window.caches) {
          console.log('🧹 Пытаемся очистить кэш браузера...');
          caches.keys().then(cacheNames => {
            cacheNames.forEach(cacheName => {
              caches.delete(cacheName);
              console.log(`✅ Удален кэш браузера: ${cacheName}`);
            });
          });
        }
        
        // Очищаем кэш через различные API браузера
        if (navigator.serviceWorker) {
          navigator.serviceWorker.getRegistrations().then(registrations => {
            registrations.forEach(registration => {
              registration.unregister();
              console.log('✅ Service Worker удален');
            });
          });
        }
      } catch (e) {
        console.warn('⚠️ Не удалось очистить кэш браузера:', e);
      }
      
      // Показываем уведомление пользователю
      if (confirm('Очистка данных завершена. Перезагрузить страницу сейчас?')) {
        // Жесткая перезагрузка без кэша
        window.location.reload(true);
      }
    });
    
    console.log('[ФРОНТ] Очистка старых кодов бронирования...');
    console.log(`[ФРОНТ] Найдено ${reservationKeys.length} кодов бронирования`);
    
    // Проверяем наличие refresh_token и создаем его при необходимости
    let hasRefreshToken = localStorage.getItem('refresh_token');
    if (!hasRefreshToken) {
      const newRefreshToken = `cleanup_refresh_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      localStorage.setItem('refresh_token', newRefreshToken);
      console.log('[ФРОНТ] Создан новый refresh_token при очистке кодов');
    }
    
    return {
      success: true,
      removedKeys: removedKeys,
      message: 'Очистка завершена! Пожалуйста, перезагрузите страницу.'
    };
  } catch (error) {
    console.error('❌ Ошибка при очистке данных:', error);
    return {
      success: false,
      error: error.message,
      removedKeys: removedKeys
    };
  }
})(); 