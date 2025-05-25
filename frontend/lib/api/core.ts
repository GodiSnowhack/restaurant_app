import axios, { InternalAxiosRequestConfig, AxiosError, AxiosResponse, AxiosHeaders } from 'axios';

// Функция для определения правильного baseURL для API
const getApiBaseUrl = (): string => {
  // В production используем Railway URL для бэкенда
  if (process.env.NODE_ENV === 'production') {
    return 'https://backend-production-1a78.up.railway.app/api/v1';
  }
  
  // В development используем локальный сервер
  return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';
};

// Создаем экземпляр axios с базовой конфигурацией
export const api = axios.create({  baseURL: process.env.NEXT_PUBLIC_API_URL?.replace('http://', 'https://') || 'https://backend-production-1a78.up.railway.app/api/v1',  timeout: 30000, // Увеличиваем таймаут до 30 секунд
  headers: {
    'Accept': 'application/json',
    'Content-Type': 'application/json'
  },
  withCredentials: true
});

// Функция повторных попыток для критически важных API-вызовов
export const retryRequest = async <T>(apiCall: () => Promise<T>, maxRetries = 3, delay = 1000): Promise<T> => {
  let lastError;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await apiCall();
    } catch (error) {
      console.log(`Попытка ${i + 1} из ${maxRetries} не удалась:`, error);
      lastError = error;
      
      // Ожидаем перед следующей попыткой с увеличением времени ожидания (экспоненциальная выдержка)
      if (i < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, i)));
      }
    }
  }
  
  throw lastError;
};

// Проверка, не истёк ли токен
export const isTokenExpired = (token: string): boolean => {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
      return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));

    const { exp } = JSON.parse(jsonPayload);
    const expired = Date.now() >= exp * 1000;
    
    return expired;
  } catch (e) {
    return false; // Если ошибка при декодировании, считаем что токен не истёк
  }
};

// Функция получения токена из любого доступного хранилища
export const getAuthToken = (): string | null => {
  if (typeof window === 'undefined') return null;
  
  try {
    const localToken = localStorage.getItem('token');
    const sessionToken = sessionStorage.getItem('token');
    
    // Если есть токен в localStorage, используем его, иначе из sessionStorage
    if (localToken) {
      return localToken;
    } else if (sessionToken) {
      // Если токен есть только в sessionStorage, копируем его в localStorage
      try {
        localStorage.setItem('token', sessionToken);
      } catch (e) {
        console.error('Не удалось скопировать токен из sessionStorage в localStorage:', e);
      }
      return sessionToken;
    }
  } catch (e) {
    console.error('Ошибка при получении токена:', e);
  }
  
  return null;
};

// Обновление функции logout для очистки обоих хранилищ
export const clearAuthTokens = () => {
  if (typeof window === 'undefined') return;
  
  try {
    localStorage.removeItem('token');
    sessionStorage.removeItem('token');
    localStorage.removeItem('auth_timestamp');
    localStorage.removeItem('auth_method');
    localStorage.removeItem('user_profile');
  } catch (e) {
    console.error('Ошибка при очистке токенов:', e);
  }
};

// Перехватчик для добавления токена авторизации
api.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    // Получаем токен из localStorage
    const token = localStorage.getItem('token');
    
    if (token) {
      console.log('API Interceptor: Добавляем токен в заголовки');
      if (!config.headers) {
        config.headers = new AxiosHeaders();
      }
      config.headers.Authorization = `Bearer ${token}`;
      
      // Добавляем дополнительные заголовки для авторизации
      try {
        const userProfile = localStorage.getItem('user_profile');
        if (userProfile) {
          const { id, role } = JSON.parse(userProfile);
          config.headers['X-User-ID'] = id;
          config.headers['X-User-Role'] = role;
        }
      } catch (e) {
        console.error('API Interceptor: Ошибка при добавлении пользовательских заголовков:', e);
      }
    } else {
      console.warn('API Interceptor: Токен не найден');
      // Пробуем получить данные пользователя без токена
      const userProfile = localStorage.getItem('user_profile');
      if (userProfile) {
        try {
          const { id } = JSON.parse(userProfile);
          if (!config.headers) {
            config.headers = new AxiosHeaders();
          }
          config.headers['X-User-ID'] = id;
        } catch (e) {
          console.error('API Interceptor: Ошибка при добавлении X-User-ID:', e);
        }
      }
    }
    
    // Логируем заголовки запроса
    console.log('API Interceptor: Заголовки запроса:', config.headers);
    
    return config;
  },
  (error: AxiosError) => {
    console.error('API Interceptor: Ошибка в перехватчике запроса:', error);
    return Promise.reject(error);
  }
);

// Перехватчик для обработки ответов
api.interceptors.response.use(
  (response: AxiosResponse) => {
    // Проверяем, нужно ли обновить токен
    if (response.data?.user?.needs_token_refresh) {
      console.log('API Interceptor: Требуется обновление токена');
      const user = response.data.user;
      // Создаем новый токен с правильной ролью
      const newToken = createAccessToken({
        sub: user.id,
        role: user.role,
        email: user.email
      });
      // Сохраняем новый токен
      localStorage.setItem('token', newToken);
      // Обновляем информацию о пользователе
      localStorage.setItem('user_profile', JSON.stringify(user));
    }
    
    console.log(`API Interceptor: Успешный ответ от ${response.config.url}:`, response.status);
    return response;
  },
  async (error: AxiosError) => {
    console.error('API Interceptor: Ошибка в ответе:', {
      status: error.response?.status,
      url: error.config?.url,
      message: error.message
    });
    
    // Если ошибка 401, пробуем обновить токен
    if (error.response?.status === 401) {
      console.log('API Interceptor: Получена ошибка 401, пробуем обновить токен');
      
      try {
        // Получаем текущий токен
        const currentToken = localStorage.getItem('token');
        if (!currentToken) {
          console.error('API Interceptor: Токен отсутствует');
          throw new Error('Токен не найден');
        }
        
        // Пробуем получить новый токен
        const response = await fetch('/api/v1/auth/refresh', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${currentToken}`
          }
        });
        
        if (!response.ok) {
          // Если не удалось обновить токен, пробуем повторно авторизоваться
          const userProfile = localStorage.getItem('user_profile');
          if (userProfile) {
            const { email } = JSON.parse(userProfile);
            const loginResponse = await fetch('/api/v1/auth/login', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                email: email,
                password: localStorage.getItem('password') // Временное решение
              })
            });
            
            if (loginResponse.ok) {
              const data = await loginResponse.json();
              if (data.access_token) {
                localStorage.setItem('token', data.access_token);
                if (error.config) {
                  const newConfig = { ...error.config };
                  newConfig.headers = new AxiosHeaders({
                    ...newConfig.headers,
                    'Authorization': `Bearer ${data.access_token}`
                  });
                  return api(newConfig);
                }
              }
            }
          }
          throw new Error('Не удалось обновить токен');
        }
        
        const data = await response.json();
        if (data.access_token) {
          // Сохраняем новый токен
          localStorage.setItem('token', data.access_token);
          
          // Повторяем исходный запрос с новым токеном
          if (error.config) {
            const newConfig = { ...error.config };
            newConfig.headers = new AxiosHeaders({
              ...newConfig.headers,
              'Authorization': `Bearer ${data.access_token}`
            });
            return api(newConfig);
          }
        }
      } catch (refreshError) {
        console.error('API Interceptor: Ошибка при обновлении токена:', refreshError);
        // Если не удалось обновить токен, очищаем данные авторизации
        localStorage.removeItem('token');
        localStorage.removeItem('user_profile');
        // Перенаправляем на страницу входа
        if (typeof window !== 'undefined') {
          window.location.href = '/auth/login';
        }
      }
    }
    
    return Promise.reject(error);
  }
);

// Функция для создания нового токена
function createAccessToken(data: { sub: string | number, role: string, email: string }): string {
  const header = {
    alg: 'HS256',
    typ: 'JWT'
  };
  
  const payload = {
    ...data,
    exp: Math.floor(Date.now() / 1000) + (60 * 60 * 24) // 24 часа
  };
  
  const encodedHeader = btoa(JSON.stringify(header));
  const encodedPayload = btoa(JSON.stringify(payload));
  
  // В реальном приложении здесь должен быть правильный алгоритм подписи
  const signature = btoa(JSON.stringify({ signed: true }));
  
  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

// Функция для проверки, является ли текущий маршрут публичным
// Импортируем позже для избежания циклических зависимостей
let PUBLIC_ROUTES: string[] = [];
try {
  // Динамический импорт, если файл существует
  if (typeof window !== 'undefined') {
    PUBLIC_ROUTES = ['/auth/login', '/auth/register', '/menu', '/'];
  }
} catch (e) {
  PUBLIC_ROUTES = ['/auth/login', '/auth/register', '/menu', '/'];
}

export const checkIfPublicRoute = (): boolean => {
  if (typeof window === 'undefined') return false;
  
  const path = window.location.pathname;
  
  // Проверяем прямое совпадение
  if (PUBLIC_ROUTES.includes(path)) {
    return true;
  }
  
  // Проверяем начало пути (для маршрутов с параметрами)
  if (path.startsWith('/menu/')) {
    return true;
  }
  
  return false;
};

// Универсальная функция для выполнения fetch с таймаутом
export const fetchWithTimeout = async (url: string, options: RequestInit, timeout = 30000) => {
  const controller = new AbortController();
  const { signal } = controller;
  
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(url, { ...options, signal });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
};

// Функция для получения токена авторизации из всех возможных источников
export const getAuthTokenFromAllSources = (): string | null => {
  if (typeof window === 'undefined') return null;
  
  try {
    // Проверяем несколько мест хранения
    // 1. Сначала localStorage
    const localToken = localStorage.getItem('token');
    if (localToken) {
      return localToken;
    }
    
    // 2. Затем sessionStorage
    const sessionToken = sessionStorage.getItem('token');
    if (sessionToken) {
      return sessionToken;
    }
    
    // 3. Наконец cookie
    const cookies = document.cookie.split(';');
    for (const cookie of cookies) {
      const [name, value] = cookie.trim().split('=');
      if (name === 'auth_token' && value) {
        return value;
      }
    }
  } catch (e) {
    console.error('Ошибка при получении токена:', e);
  }
  
  return null;
};

/**
 * Получение заголовков авторизации
 */
export const getAuthHeaders = () => {
  const token = getAuthTokenFromAllSources();
  
  if (!token) {
    return {};
  }
  
  return {
    'Authorization': `Bearer ${token}`,
    'X-User-ID': localStorage.getItem('user_id') || '1',
    'X-User-Role': localStorage.getItem('user_role') || 'admin'
  };
};

// Улучшенная функция для определения мобильного устройства
export const isMobileDevice = (): boolean => {
  if (typeof navigator === 'undefined') return false;
  
  // Проверка на мобильное устройство по User-Agent
  const mobileRegex = /Mobile|Android|iPhone|iPad|iPod|Windows Phone/i;
  const userAgent = navigator.userAgent || '';
  
  // Дополнительная проверка через mediaQuery для лучшего определения
  const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  const isSmallScreen = window.innerWidth < 768;
  
  console.log('Проверка устройства:', {
    userAgent,
    isMobileByUA: mobileRegex.test(userAgent),
    isTouchDevice,
    isSmallScreen,
    innerWidth: window.innerWidth
  });
  
  return mobileRegex.test(userAgent) || (isTouchDevice && isSmallScreen);
};

// Улучшенная функция для проверки соединения
export const checkConnection = async (
  options?: { silent?: boolean; url?: string }
): Promise<{ isOnline: boolean; pingTime?: number; error?: string }> => {
  const url = options?.url || '/api/ping';  // Используем /api/ping вместо /api/v1
  const startTime = Date.now();
  
  try {
    // Сначала проверяем базовое соединение
    const response = await fetch(url, {
      method: 'GET',
      headers: { 
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      cache: 'no-store'
    });
    
    if (!response.ok) {
      // Если основной пинг не прошел, пробуем альтернативные эндпоинты
      const alternativeUrls = ['/api/categories', '/api/dishes'];
      
      for (const altUrl of alternativeUrls) {
        try {
          const altResponse = await fetch(altUrl, {
            method: 'GET',
            headers: { 
              'Content-Type': 'application/json',
              'Accept': 'application/json'
            },
            cache: 'no-store'
          });
          
          if (altResponse.ok) {
            const pingTime = Date.now() - startTime;
            return { isOnline: true, pingTime };
          }
        } catch (e) {
          // Игнорируем ошибки альтернативных проверок
          console.log(`Альтернативная проверка ${altUrl} не удалась`);
        }
      }
      
      return { 
        isOnline: false,
        error: `Ошибка соединения: ${response.status} ${response.statusText}`,
      };
    }
    
    const data = await response.json();
    const pingTime = Date.now() - startTime;
    
    if (data?.status === 'ok' || data?.length >= 0) {
      return { isOnline: true, pingTime };
    } else {
      return {
        isOnline: false,
        error: 'Неверный ответ от сервера',
      };
    }
  } catch (error: any) {
    if (!options?.silent) {
      console.error('Ошибка при проверке соединения:', error);
    }
    
    // Пробуем альтернативные эндпоинты при ошибке
    try {
      const altResponse = await fetch('/api/categories', {
        method: 'GET',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        cache: 'no-store'
      });
      
      if (altResponse.ok) {
        const pingTime = Date.now() - startTime;
        return { isOnline: true, pingTime };
      }
    } catch (e) {
      // Игнорируем ошибку альтернативной проверки
    }
    
    return { 
      isOnline: false, 
      error: error.message || 'Не удалось подключиться к серверу',
    };
  }
}; 