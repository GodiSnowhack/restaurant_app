/**
 * Улучшенные функции для работы с авторизацией на мобильных устройствах
 * Предоставляет более надежные методы для авторизации на мобильных устройствах
 */

/**
 * Проверка на мобильное устройство
 */
export const isMobileDevice = (): boolean => {
  if (typeof navigator === 'undefined') return false;
  
  // Проверка на мобильное устройство по User-Agent
  const mobileRegex = /Mobile|Android|iPhone|iPad|iPod|Windows Phone/i;
  return mobileRegex.test(navigator.userAgent);
};

/**
 * Попытка прямой авторизации с различными форматами данных
 */
export const directLogin = async (
  username: string, 
  password: string
): Promise<{ success: boolean; token?: string; error?: string }> => {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';
  const loginUrl = `${apiUrl}/auth/login`;
  const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown';
  
  console.log('MobileAuth: Попытка прямой авторизации');
  
  // Определяем различные форматы данных для попыток авторизации
  const attempts = [
    // JSON формат с полями username и password
    {
      contentType: 'application/json',
      body: JSON.stringify({ username, password }),
      description: 'JSON с username/password'
    },
    // JSON формат с полями email и password
    {
      contentType: 'application/json',
      body: JSON.stringify({ email: username, password }),
      description: 'JSON с email/password'
    },
    // Form URL Encoded формат с полями username и password
    {
      contentType: 'application/x-www-form-urlencoded',
      body: new URLSearchParams({ username, password }).toString(),
      description: 'URL-encoded с username/password'
    },
    // Form URL Encoded формат с полями email и password
    {
      contentType: 'application/x-www-form-urlencoded',
      body: new URLSearchParams({ email: username, password }).toString(),
      description: 'URL-encoded с email/password'
    },
    // OAuth2 формат
    {
      contentType: 'application/x-www-form-urlencoded',
      body: new URLSearchParams({ 
        grant_type: 'password',
        username, 
        password 
      }).toString(),
      description: 'OAuth2 format'
    }
  ];
  
  // Пробуем все форматы по очереди
  for (let i = 0; i < attempts.length; i++) {
    const attempt = attempts[i];
    console.log(`MobileAuth: Попытка #${i + 1} - ${attempt.description}`);
    
    try {
      const response = await fetch(loginUrl, {
        method: 'POST',
        headers: {
          'Content-Type': attempt.contentType,
          'Accept': 'application/json',
          'User-Agent': userAgent,
          'X-User-Agent': userAgent,
          'X-Mobile-Client': 'true',
          'X-Client-Type': 'mobile'
        },
        body: attempt.body,
        mode: 'cors',
        cache: 'no-cache',
        credentials: 'omit'
      });
      
      console.log(`MobileAuth: Статус ответа для попытки #${i + 1}:`, response.status);
      
      if (response.ok) {
        // Пытаемся извлечь токен из ответа
        const responseText = await response.text();
        let data;
        
        try {
          data = JSON.parse(responseText);
        } catch (e) {
          console.warn('MobileAuth: Не удалось распарсить ответ как JSON:', responseText);
          continue;
        }
        
        // Проверяем наличие токена в ответе
        if (data && data.access_token) {
          console.log(`MobileAuth: Успешная авторизация с попыткой #${i + 1}`);
          
          // Сохраняем токен в хранилище
          try {
            localStorage.setItem('token', data.access_token);
            sessionStorage.setItem('token', data.access_token);
            localStorage.setItem('auth_timestamp', Date.now().toString());
            localStorage.setItem('auth_method', `direct_${i + 1}`);
          } catch (e) {
            console.error('MobileAuth: Ошибка при сохранении токена:', e);
          }
          
          return { success: true, token: data.access_token };
        } else {
          console.warn(`MobileAuth: Ответ не содержит токен для попытки #${i + 1}`);
        }
      }
    } catch (error: any) {
      console.error(`MobileAuth: Ошибка при попытке #${i + 1}:`, error.message);
    }
  }
  
  // Пробуем через Next.js API proxy
  try {
    console.log('MobileAuth: Попытка через Next.js API прокси');
    
    const proxyResponse = await fetch('/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({ 
        username, 
        password,
        email: username // Дублируем в поле email для совместимости
      }),
      cache: 'no-cache'
    });
    
    console.log('MobileAuth: Статус ответа от прокси:', proxyResponse.status);
    
    if (proxyResponse.ok) {
      const proxyData = await proxyResponse.json();
      
      if (proxyData.access_token) {
        console.log('MobileAuth: Успешная авторизация через API-прокси');
        
        // Сохраняем токен
        try {
          localStorage.setItem('token', proxyData.access_token);
          sessionStorage.setItem('token', proxyData.access_token);
          localStorage.setItem('auth_timestamp', Date.now().toString());
          localStorage.setItem('auth_method', 'proxy');
        } catch (e) {
          console.error('MobileAuth: Ошибка при сохранении токена от прокси:', e);
        }
        
        return { success: true, token: proxyData.access_token };
      } else {
        console.warn('MobileAuth: Ответ прокси не содержит токен');
      }
    } else {
      const errorText = await proxyResponse.text();
      console.error('MobileAuth: Ошибка от прокси:', errorText);
    }
  } catch (proxyError: any) {
    console.error('MobileAuth: Ошибка при вызове API-прокси:', proxyError.message);
  }
  
  // Если все попытки не удались
  return { 
    success: false, 
    error: 'Не удалось авторизоваться. Проверьте подключение к интернету и правильность данных.' 
  };
};

/**
 * Проверка соединения с сервером
 */
export const checkServerAvailability = async (): Promise<boolean> => {
  const pingUrl = `/api/ping?_=${Date.now()}`;
  console.log('MobileAuth: Проверка доступности сервера:', pingUrl);
  
  try {
    const response = await fetch(pingUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
        'Cache-Control': 'no-cache, no-store'
      },
      cache: 'no-store'
    });
    
    if (!response.ok) {
      console.warn('MobileAuth: Сервер недоступен, статус:', response.status);
      return false;
    }
    
    const data = await response.json();
    console.log('MobileAuth: Результат проверки сервера:', data.success);
    
    return !!data.success;
  } catch (error) {
    console.error('MobileAuth: Ошибка при проверке доступности сервера:', error);
    return false;
  }
};

/**
 * Получение профиля пользователя напрямую
 */
export const fetchUserProfileDirect = async (token: string): Promise<any> => {
  if (!token) {
    throw new Error('Отсутствует токен для получения профиля');
  }
  
  console.log('MobileAuth: Запрос профиля пользователя напрямую');
  
  try {
    // Сначала пробуем через Next.js API-прокси
    const proxyResponse = await fetch('/api/auth/profile', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      cache: 'no-store'
    });
    
    if (proxyResponse.ok) {
      const profileData = await proxyResponse.json();
      console.log('MobileAuth: Успешно получен профиль через прокси');
      
      // Кэшируем профиль
      try {
        localStorage.setItem('user_profile', JSON.stringify(profileData));
        localStorage.setItem('profile_timestamp', Date.now().toString());
      } catch (e) {
        console.error('MobileAuth: Ошибка при кэшировании профиля:', e);
      }
      
      return profileData;
    }
    
    // Если прокси не сработал, пробуем напрямую
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';
    const directResponse = await fetch(`${apiUrl}/users/me`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      cache: 'no-store',
      mode: 'cors'
    });
    
    if (directResponse.ok) {
      const directData = await directResponse.json();
      console.log('MobileAuth: Успешно получен профиль напрямую');
      
      // Кэшируем профиль
      try {
        localStorage.setItem('user_profile', JSON.stringify(directData));
        localStorage.setItem('profile_timestamp', Date.now().toString());
      } catch (e) {
        console.error('MobileAuth: Ошибка при кэшировании профиля:', e);
      }
      
      return directData;
    }
    
    // Если оба метода не сработали
    throw new Error(`Не удалось получить профиль. Ошибка: ${directResponse.status}`);
  } catch (error: any) {
    console.error('MobileAuth: Ошибка при получении профиля:', error.message);
    
    // В случае ошибки пробуем использовать кэшированный профиль
    try {
      const cachedProfile = localStorage.getItem('user_profile');
      if (cachedProfile) {
        console.log('MobileAuth: Используем кэшированный профиль');
        return JSON.parse(cachedProfile);
      }
    } catch (e) {
      console.error('MobileAuth: Ошибка при получении кэшированного профиля:', e);
    }
    
    throw error;
  }
}; 