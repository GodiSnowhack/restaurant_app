import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { authApi, api } from './api';
import axios from 'axios';

// Функция определения мобильного устройства
const isMobileDevice = (): boolean => {
  return typeof navigator !== 'undefined' && /Mobile|Android|iPhone|iPad|iPod|Windows Phone/i.test(navigator.userAgent);
};

// Улучшенные функции для работы с токенами, включая поддержку мобильных устройств
const getAuthToken = (): string | null => {
  if (typeof window === 'undefined') return null;
  
  try {
    // Проверяем несколько мест хранения
    const sources = [
      { source: 'localStorage', token: localStorage.getItem('token') },
      { source: 'sessionStorage', token: sessionStorage.getItem('token') },
      { source: 'cookie', token: getCookieToken() }
    ];
    
    // Ищем первый действительный токен
    for (const { source, token } of sources) {
      if (token) {
        console.log(`AuthStore: Получен токен из ${source}`);
        
        // Синхронизируем токен между хранилищами
        try {
          localStorage.setItem('token', token);
          sessionStorage.setItem('token', token);
          document.cookie = `auth_token=${token}; path=/; max-age=86400; SameSite=Lax`;
        } catch (e) {
          console.error('AuthStore: Ошибка при синхронизации токена между хранилищами:', e);
        }
        
        return token;
      }
    }
  } catch (e) {
    console.error('AuthStore: Ошибка при получении токена:', e);
  }
  
  return null;
};

// Функция для получения токена из cookie
const getCookieToken = (): string | null => {
  if (typeof document === 'undefined') return null;
  
  const cookies = document.cookie.split(';');
  for (const cookie of cookies) {
    const [name, value] = cookie.trim().split('=');
    if (name === 'auth_token' && value) {
      return value;
    }
  }
  
  return null;
};

// Функция сохранения токена во все доступные хранилища
const saveAuthToken = (token: string): void => {
  if (typeof window === 'undefined') return;
  
  try {
    // Сохраняем в localStorage
    localStorage.setItem('token', token);
    
    // Сохраняем в sessionStorage
    sessionStorage.setItem('token', token);
    
    // Сохраняем в cookie с настройками для мобильных устройств
    document.cookie = `auth_token=${token}; path=/; max-age=86400; SameSite=Lax`;
    
    console.log('AuthStore: Токен сохранен во все хранилища');
  } catch (e) {
    console.error('AuthStore: Ошибка при сохранении токена:', e);
  }
};

// Функция очистки токена из всех хранилищ
const clearAuthToken = (): void => {
  if (typeof window === 'undefined') return;
  
  try {
    // Удаляем из localStorage
    localStorage.removeItem('token');
    
    // Удаляем из sessionStorage
    sessionStorage.removeItem('token');
    
    // Удаляем cookie
    document.cookie = 'auth_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax';
    
    console.log('AuthStore: Токен удален из всех хранилищ');
  } catch (e) {
    console.error('AuthStore: Ошибка при удалении токена:', e);
  }
};

// Функция для определения низкого качества сети
const hasLowQualityConnection = (): boolean => {
  if (typeof navigator === 'undefined') return false;
  
  // Проверяем navigator.connection (Network Information API)
  const conn = (navigator as any).connection;
  if (conn) {
    // Низкое качество сети: 2G, медленный 3G или saveData режим
    if (conn.saveData || 
        conn.effectiveType === '2g' || 
        conn.effectiveType === 'slow-2g') {
      return true;
    }
    
    // Если скорость соединения очень низкая
    if (typeof conn.downlink === 'number' && conn.downlink < 0.5) {
      return true;
    }
  }
  
  return false;
};

// Проверка на мобильное устройство
const isMobileDeviceFn = (): boolean => {
  if (typeof navigator === 'undefined') return false;
  
  // Проверка на мобильное устройство по User-Agent
  const mobileRegex = /Mobile|Android|iPhone|iPad|iPod|Windows Phone/i;
  return mobileRegex.test(navigator.userAgent);
};

// Функция для отправки логов об ошибках авторизации
const sendAuthErrorLog = async (error: any, endpoint: string, diagnosticInfo?: any) => {
  if (typeof window === 'undefined') return;
  
  try {
    // Используем относительный URL вместо полного пути
    const logUrl = '/api/auth/_log';
    
    const networkInfo = {
      online: typeof navigator !== 'undefined' ? navigator.onLine : 'unknown',
      connection: (navigator as any).connection 
        ? {
            effectiveType: (navigator as any).connection.effectiveType,
            downlink: (navigator as any).connection.downlink,
            rtt: (navigator as any).connection.rtt,
            saveData: (navigator as any).connection.saveData
          }
        : null
    };

    // Преобразуем объект ошибки в строку
    let errorMessage = 'Неизвестная ошибка';
    if (error) {
      if (typeof error === 'string') {
        errorMessage = error;
      } else if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === 'object') {
        try {
          errorMessage = JSON.stringify(error);
        } catch (e) {
          errorMessage = 'Ошибка объект: ' + Object.keys(error).join(', ');
        }
      }
    }
    
    await fetch(logUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        error: errorMessage,
        endpoint,
        timestamp: new Date().toISOString(),
        diagnosticInfo,
        networkInfo
      }),
      // Используем AbortController для предотвращения блокировки
      signal: AbortSignal.timeout(5000) // 5 секунд таймаут
    });
    
    console.log('AuthStore: Отправлен лог об ошибке авторизации');
  } catch (e) {
    // Просто логируем ошибку, но не прерываем выполнение
    console.warn('AuthStore: Не удалось отправить лог об ошибке:', e);
  }
};

export interface AuthState {
  isAuthenticated: boolean;
  token: string | null;
  user: any | null;
  error: string | null;
  isLoading: boolean;
  isMobileDevice: boolean;
  networkDiagnostics: any[];
  refreshToken: string | null;
  
  login: (username: string, password: string) => Promise<void>;
  register: (email: string, password: string, fullName: string, phone?: string) => Promise<void>;
  logout: () => void;
  fetchUserProfile: () => Promise<void>;
  setInitialAuthState: (isAuth: boolean, token: string | null) => void;
  clearError: () => void;
  refreshProfile: () => Promise<void>;
}

// Имя для хранения состояния в localStorage
const STORE_NAME = 'auth-store';

// Создаем хранилище с поддержкой персистентности
const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      isAuthenticated: typeof window !== 'undefined' && !!localStorage.getItem('token'),
      token: typeof window !== 'undefined' ? localStorage.getItem('token') : null,
      refreshToken: typeof window !== 'undefined' ? localStorage.getItem('refresh_token') : null,
      user: null,
      error: null,
      isLoading: false,
      isMobileDevice: typeof window !== 'undefined' ? isMobileDeviceFn() : false,
      networkDiagnostics: [],
      
      // Устанавливаем начальное состояние авторизации
      setInitialAuthState: (isAuth: boolean, token: string | null) => {
        console.log('AuthStore: Установка начального состояния авторизации', { isAuth, token: !!token });
        set({ isAuthenticated: isAuth, token });
        
        // Не вызываем fetchUserProfile здесь, эта функция будет вызвана из App компонента
      },
      
      // Авторизация пользователя
      login: async (username: string, password: string) => {
        const startTime = Date.now();
        set({ isLoading: true, error: null });
        
        // Проверяем подключение к сети
        if (typeof navigator !== 'undefined' && !navigator.onLine) {
          console.warn('AuthStore: Нет подключения к сети, проверяем кэшированные данные');
          
          try {
            // Проверяем кэшированный токен и профиль
            const cachedToken = getAuthToken();
            const cachedProfile = localStorage.getItem('user_profile');
            
            if (cachedToken && cachedProfile) {
              console.log('AuthStore: Используем кэшированные данные в офлайн-режиме');
              const profile = JSON.parse(cachedProfile);
              
              set({
                isAuthenticated: true,
                token: cachedToken,
                user: profile,
                error: 'Работа в офлайн-режиме. Некоторые функции могут быть недоступны.',
                isLoading: false
              });
              
              return;
            }
          } catch (e) {
            console.error('AuthStore: Ошибка при проверке кэшированных данных:', e);
          }
          
          set({
            isLoading: false,
            error: 'Отсутствует подключение к интернету. Пожалуйста, проверьте соединение и попробуйте снова.'
          });
          
          return;
        }
        
        // Создаем объект для сбора диагностической информации
        const diagnosticInfo: any = {
          startTime,
          steps: [],
          retries: 0,
          maxRetries: 3,
          success: false,
          isMobile: isMobileDeviceFn(),
          error: null
        };

        try {
          // Проверяем тип устройства для выбора метода авторизации
          if (isMobileDeviceFn()) {
            diagnosticInfo.steps.push({ timestamp: Date.now(), step: 'мобильная авторизация' });
            
            // Проверяем качество сети для мобильных устройств
            const lowQuality = hasLowQualityConnection();
            if (lowQuality) {
              diagnosticInfo.steps.push({ 
                timestamp: Date.now(), 
                step: 'обнаружено низкое качество сети',
                connectionInfo: (navigator as any).connection ? {
                  effectiveType: (navigator as any).connection.effectiveType,
                  downlink: (navigator as any).connection.downlink,
                  saveData: (navigator as any).connection.saveData
                } : null
              });
              console.log('AuthStore: Обнаружено низкое качество сети, оптимизируем запросы');
            }
            
            // Авторизация на мобильном устройстве
            const attemptMobileLogin = async (attemptNumber: number): Promise<any> => {
              const startAttemptTime = Date.now();
              diagnosticInfo.steps.push({ 
                timestamp: startAttemptTime, 
                step: `начало попытки ${attemptNumber}` 
              });
              
              // Формируем данные для отправки
              const formData = new URLSearchParams();
              formData.append('username', username);
              formData.append('password', password);
              
              // Используем обычный fetch вместо axios для улучшения совместимости с мобильными устройствами
              const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/x-www-form-urlencoded',
                  'Accept': 'application/json'
                },
                body: formData.toString()
              });
              
              if (!response.ok) {
                const error = await response.json().catch(() => ({ detail: 'Ошибка авторизации' }));
                throw new Error(error.detail || 'Не удалось авторизоваться');
              }
              
              const result = await response.json();
              
              // Если успешно получили токен
              if (result && result.access_token) {
                return result;
              }
              
              throw new Error('Не удалось получить токен доступа');
            };
            
            // Пробуем авторизоваться несколько раз с экспоненциальной задержкой
            for (let attempt = 1; attempt <= 3; attempt++) {
              try {
                diagnosticInfo.retries = attempt - 1;
                const result = await attemptMobileLogin(attempt);
                
                // Сохраняем токен и данные авторизации
                if (result) {
                  try {
                    const { access_token, refresh_token } = result;
                    
                    if (access_token) {
                      saveAuthToken(access_token);
                      
                      // Сохраняем refresh_token, если он есть
                      if (refresh_token) {
                        localStorage.setItem('refresh_token', refresh_token);
                        console.log('AuthStore: Сохранен refresh_token');
                      }
                      
                      set({ 
                        isAuthenticated: true, 
                        token: access_token,
                        error: null,
                        isLoading: false
                      });
                      
                      // Загружаем профиль пользователя
                      get().fetchUserProfile();
                      return;
                    }
                  } catch (tokenError) {
                    console.error('AuthStore: Ошибка при обработке токена:', tokenError);
                  }
                }
              } catch (error: any) {
                // Если это последняя попытка или получили 401 (неверные учетные данные),
                // прекращаем повторные попытки
                if (attempt === 3 || error?.response?.status === 401) {
                  diagnosticInfo.error = error.message;
                  
                  set({ 
                    isLoading: false, 
                    error: error.message || 'Ошибка авторизации. Проверьте логин и пароль.' 
                  });
                  
                  return;
                }
                
                // Ждем перед следующей попыткой
                const delay = Math.pow(2, attempt) * 1000; // 2, 4, 8 секунд
                await new Promise(resolve => setTimeout(resolve, delay));
              }
            }
          } else {
            // Для десктопных устройств используем прокси
            diagnosticInfo.steps.push({ timestamp: Date.now(), step: 'запрос через прокси для десктопа' });
            
            // URL для запроса
            const url = '/api/auth/login';
            
            diagnosticInfo.steps.push({ timestamp: Date.now(), step: 'отправка запроса к прокси', url });
            
            // Формируем данные для отправки
            const formData = new URLSearchParams();
            formData.append('username', username);
            formData.append('password', password);
            
            // Отправляем запрос
            const response = await fetch(url, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Accept': 'application/json'
              },
              body: formData.toString(),
              cache: 'no-store'
            });
            
            diagnosticInfo.steps.push({ 
              timestamp: Date.now(), 
              step: 'получен ответ от прокси', 
              status: response.status 
            });
            
            // Проверяем статус ответа
            if (!response.ok) {
              const errorData = await response.json();
              throw new Error(JSON.stringify(errorData));
            }
            
            const data = await response.json();
            diagnosticInfo.steps.push({ timestamp: Date.now(), step: 'разбор ответа' });
            
            // Сохраняем токен и данные авторизации
            if (data) {
              try {
                const { access_token, refresh_token } = data;
                
                if (access_token) {
                  saveAuthToken(access_token);
                  
                  // Сохраняем refresh_token, если он есть
                  if (refresh_token) {
                    localStorage.setItem('refresh_token', refresh_token);
                    console.log('AuthStore: Сохранен refresh_token');
                  }
                  
                  set({ 
                    isAuthenticated: true, 
                    token: access_token,
                    error: null,
                    isLoading: false
                  });
                  
                  // Загружаем профиль пользователя
                  get().fetchUserProfile();
                  return;
                }
              } catch (tokenError) {
                console.error('AuthStore: Ошибка при обработке токена:', tokenError);
              }
            }
          }
        } catch (error: any) {
          console.error('Общая ошибка авторизации:', error);
          diagnosticInfo.steps.push({ 
            timestamp: Date.now(), 
            step: 'общая ошибка авторизации', 
            error: error.message 
          });
          
          set({ 
            isLoading: false, 
            error: `${error.message}` 
          });
          diagnosticInfo.error = error.message;
        } finally {
          diagnosticInfo.endTime = Date.now();
          diagnosticInfo.duration = diagnosticInfo.endTime - startTime;
          
          // Сохраняем информацию о запросе для анализа
          const networkDiagnostics = [...get().networkDiagnostics];
          networkDiagnostics.unshift(diagnosticInfo);
          
          // Ограничиваем размер истории диагностики
          if (networkDiagnostics.length > 10) {
            networkDiagnostics.pop();
          }
          
          set({ networkDiagnostics });
          
          // Сохраняем диагностику в localStorage
          try {
            localStorage.setItem('auth_diagnostics', JSON.stringify(networkDiagnostics));
          } catch (e) {
            console.error('Ошибка при сохранении диагностики:', e);
          }
        }
      },
      
      // Получение профиля пользователя
      fetchUserProfile: async () => {
        try {
          // Предотвращаем циклические запросы на получение профиля
          const profileFetchKey = 'profile_fetch_attempt_timestamp';
          const now = Date.now();
          const lastFetchAttempt = localStorage.getItem(profileFetchKey);
          
          if (lastFetchAttempt) {
            const timeSinceLastFetch = now - parseInt(lastFetchAttempt);
            // Если запрос был менее 3 секунд назад, используем кэшированный профиль
            if (timeSinceLastFetch < 3000) {
              console.log(`AuthStore: Предотвращение цикла запросов профиля (прошло ${Math.round(timeSinceLastFetch/1000)}с)`);
              
              // Проверяем наличие кэшированного профиля
              const cachedProfile = localStorage.getItem('user_profile');
              if (cachedProfile) {
                try {
                  console.log('AuthStore: Используем кэшированный профиль из-за предотвращения цикла запросов');
                  const profile = JSON.parse(cachedProfile);
                  set({ user: profile, isAuthenticated: true });
                  
                  // Убедимся, что роль пользователя сохранена под общим ключом
                  localStorage.setItem('user_role', profile.role);
                  localStorage.setItem('user', JSON.stringify(profile));
                  
                  return;
                } catch (e) {
                  console.error('AuthStore: Ошибка при использовании кэшированного профиля:', e);
                }
              }
            }
          }
          
          // Сохраняем временную метку запроса
          localStorage.setItem(profileFetchKey, now.toString());
          
          const token = getAuthToken();
          
          if (!token) {
            console.log('AuthStore: Токен отсутствует, сохраняем состояние неаутентифицированного пользователя');
            // Не сбрасываем состояние при отсутствии токена, если есть закэшированный профиль
            const cachedProfile = localStorage.getItem('user_profile');
            if (cachedProfile) {
              try {
                console.log('AuthStore: Используем кэшированный профиль при отсутствии токена');
                const profile = JSON.parse(cachedProfile);
                set({ user: profile, isAuthenticated: true });
                
                // Убедимся, что роль пользователя сохранена под общим ключом
                localStorage.setItem('user_role', profile.role);
                localStorage.setItem('user', JSON.stringify(profile));
                
                return;
              } catch (e) {
                console.error('AuthStore: Ошибка при использовании кэшированного профиля:', e);
              }
            }
            
            set({ user: null, isAuthenticated: false });
            return;
          }
          
          console.log('AuthStore: Начало запроса профиля пользователя');
          
          // Используем кэшированный профиль при отсутствии соединения
          if (typeof navigator !== 'undefined' && !navigator.onLine) {
            console.log('AuthStore: Нет подключения к сети, проверяем кэшированный профиль');
            
            try {
              const cachedProfile = localStorage.getItem('user_profile');
              if (cachedProfile) {
                const profile = JSON.parse(cachedProfile);
                set({ user: profile, isAuthenticated: true });
                
                // Убедимся, что роль пользователя сохранена под общим ключом
                localStorage.setItem('user_role', profile.role);
                localStorage.setItem('user', JSON.stringify(profile));
                
                return;
              }
            } catch (e) {
              console.error('AuthStore: Ошибка при получении кэшированного профиля:', e);
            }
          }
          
          // Создаем AbortController для таймаута
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 15000);
          
          try {
            // Выполняем запрос с таймаутом
            const response = await fetch('/api/auth/me', {
              method: 'GET',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/json',
                'X-Client-Type': isMobileDeviceFn() ? 'mobile' : 'desktop',
                'X-Requested-With': 'XMLHttpRequest'
              },
              signal: controller.signal,
              cache: 'no-store'
            });
            
            clearTimeout(timeoutId);
            
            if (response.ok) {
              const data = await response.json();
              set({ user: data, isAuthenticated: true });
              
              // Кэшируем профиль для офлайн-доступа
              try {
                localStorage.setItem('user_profile', JSON.stringify(data));
                // Сохраняем временную метку получения профиля
                localStorage.setItem('user_profile_timestamp', Date.now().toString());
                // Явно сохраняем роль пользователя
                localStorage.setItem('user_role', data.role);
                // Сохраняем данные пользователя под ключом 'user'
                localStorage.setItem('user', JSON.stringify(data));
                
                console.log('AuthStore: Профиль успешно получен и сохранен в кэше, роль:', data.role);
              } catch (e) {
                console.error('AuthStore: Ошибка при кэшировании профиля:', e);
              }
              return;
            } else {
              // Если токен недействителен, пробуем обновить его
              if (response.status === 401) {
                console.log('AuthStore: Ошибка авторизации (401), пробуем обновить токен');
                
                // Проверяем, не было ли недавних попыток обновления токена
                const tokenRefreshKey = 'token_refresh_attempt_timestamp';
                const lastRefreshAttempt = localStorage.getItem(tokenRefreshKey);
                
                if (lastRefreshAttempt) {
                  const timeSinceLastRefresh = Date.now() - parseInt(lastRefreshAttempt);
                  // Если последняя попытка обновления была менее 5 секунд назад
                  if (timeSinceLastRefresh < 5000) {
                    console.log(`AuthStore: Предотвращение цикла обновления токена (прошло ${Math.round(timeSinceLastRefresh/1000)}с)`);
                    
                    // Используем кэшированный профиль вместо нового запроса
                    const cachedProfile = localStorage.getItem('user_profile');
                    if (cachedProfile) {
                      try {
                        console.log('AuthStore: Используем кэшированный профиль после предотвращения цикла обновления токена');
                        const profile = JSON.parse(cachedProfile);
                        set({ user: profile, isAuthenticated: true });
                        
                        // Убедимся, что роль пользователя сохранена под общим ключом
                        localStorage.setItem('user_role', profile.role);
                        localStorage.setItem('user', JSON.stringify(profile));
                        
                        return;
                      } catch (e) {
                        console.error('AuthStore: Ошибка при использовании кэшированного профиля:', e);
                      }
                    }
                    
                    // Если нет кэшированного профиля, выходим из системы
                    console.log('AuthStore: Нет кэшированного профиля, выходим из системы');
                    get().logout();
                    return;
                  }
                }
                
                // Сохраняем временную метку попытки обновления токена
                localStorage.setItem(tokenRefreshKey, Date.now().toString());
                
                // Пробуем обновить токен
                try {
                  const refreshToken = localStorage.getItem('refresh_token');
                  if (refreshToken) {
                    const refreshResponse = await fetch('/api/auth/refresh', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ refresh_token: refreshToken })
                    });
                    
                    if (refreshResponse.ok) {
                      const tokenData = await refreshResponse.json();
                      
                      if (tokenData.access_token) {
                        console.log('AuthStore: Токен успешно обновлен, повторяем запрос профиля');
                        
                        // Сохраняем новый токен
                        saveAuthToken(tokenData.access_token);
                        if (tokenData.refresh_token) {
                          localStorage.setItem('refresh_token', tokenData.refresh_token);
                        }
                        
                        // Сохраняем временную метку успешного обновления токена
                        localStorage.setItem('token_refresh_success_timestamp', Date.now().toString());
                        
                        // Повторяем запрос профиля с новым токеном
                        const newProfileResponse = await fetch('/api/auth/me', {
                          method: 'GET',
                          headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${tokenData.access_token}`,
                            'Accept': 'application/json'
                          }
                        });
                        
                        if (newProfileResponse.ok) {
                          const profileData = await newProfileResponse.json();
                          set({ user: profileData, isAuthenticated: true });
                          
                          // Кэшируем обновленный профиль
                          localStorage.setItem('user_profile', JSON.stringify(profileData));
                          localStorage.setItem('user_profile_timestamp', Date.now().toString());
                          // Явно сохраняем роль пользователя
                          localStorage.setItem('user_role', profileData.role);
                          localStorage.setItem('user', JSON.stringify(profileData));
                          console.log('AuthStore: Профиль успешно получен после обновления токена, роль:', profileData.role);
                          return;
                        }
                      }
                    }
                  }
                } catch (refreshError) {
                  console.error('AuthStore: Ошибка при обновлении токена:', refreshError);
                }
                
                // Если обновление токена не помогло, пробуем использовать кэшированный профиль
                const cachedProfile = localStorage.getItem('user_profile');
                if (cachedProfile) {
                  console.log('AuthStore: Используем кэшированный профиль после неудачного обновления токена');
                  try {
                    const profile = JSON.parse(cachedProfile);
                    set({ user: profile, isAuthenticated: true });
                    
                    // Убедимся, что роль пользователя сохранена под общим ключом
                    localStorage.setItem('user_role', profile.role);
                    localStorage.setItem('user', JSON.stringify(profile));
                    
                    return;
                  } catch (e) {
                    console.error('AuthStore: Ошибка при использовании кэшированного профиля:', e);
                  }
                }
                
                // Если все методы не сработали, только тогда выходим из системы
                console.log('AuthStore: Все методы восстановления сессии не сработали, выходим из системы');
                get().logout();
                return;
              }
              
              // Если сервер недоступен, используем кэшированный профиль
              if (response.status >= 500) {
                console.log('AuthStore: Сервер недоступен, пробуем использовать кэшированный профиль');
                const cachedProfile = localStorage.getItem('user_profile');
                if (cachedProfile) {
                  const profile = JSON.parse(cachedProfile);
                  set({ user: profile, isAuthenticated: true });
                  
                  // Убедимся, что роль пользователя сохранена под общим ключом
                  localStorage.setItem('user_role', profile.role);
                  localStorage.setItem('user', JSON.stringify(profile));
                  
                  return;
                }
              }
            }
          } catch (fetchError) {
            clearTimeout(timeoutId);
            console.error('AuthStore: Ошибка при запросе профиля:', fetchError);
            
            // При ошибке сети используем кэшированный профиль
            const cachedProfile = localStorage.getItem('user_profile');
            if (cachedProfile) {
              try {
                console.log('AuthStore: Используем кэшированный профиль из-за ошибки сети');
                const profile = JSON.parse(cachedProfile);
                set({ user: profile, isAuthenticated: true });
                
                // Убедимся, что роль пользователя сохранена под общим ключом
                localStorage.setItem('user_role', profile.role);
                localStorage.setItem('user', JSON.stringify(profile));
                
                return;
              } catch (e) {
                console.error('AuthStore: Ошибка при чтении кэшированного профиля:', e);
              }
            }
          }
        } catch (error) {
          console.error('AuthStore: Общая ошибка при получении профиля:', error);
          
          // При ошибке сети, пробуем использовать кэшированный профиль
          try {
            const cachedProfile = localStorage.getItem('user_profile');
            if (cachedProfile) {
              console.log('AuthStore: Используем кэшированный профиль из-за общей ошибки');
              const profile = JSON.parse(cachedProfile);
              set({ user: profile, isAuthenticated: true });
              
              // Убедимся, что роль пользователя сохранена под общим ключом
              localStorage.setItem('user_role', profile.role);
              localStorage.setItem('user', JSON.stringify(profile));
              
              return;
            }
          } catch (e) {
            console.error('AuthStore: Ошибка при получении кэшированного профиля:', e);
          }
        }
        
        // Если ничего не сработало, выходим из системы
        console.log('AuthStore: Не удалось получить профиль никакими способами');
        get().logout();
      },
      
      // Регистрация пользователя
      register: async (email, password, fullName, phone) => {
        try {
          set({ isLoading: true, error: null });
          
          // Правильно формируем данные для API
          const credentials = {
            email,
            password,
            full_name: fullName,
            phone: phone || undefined
          };
          
          const response = await fetch('/api/auth/register', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(credentials)
          });
          
          if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'Ошибка регистрации');
          }
          
          const data = await response.json();
          
          // Сохраняем токен, если он есть в ответе
          if (data.access_token) {
            saveAuthToken(data.access_token);
            
            set({ 
              isAuthenticated: true, 
              token: data.access_token, 
              error: null, 
              isLoading: false 
            });
            
            // Получаем профиль пользователя
            await get().fetchUserProfile();
          } else {
            // Если токена нет, просто заканчиваем регистрацию
            set({ 
              isLoading: false,
              error: null
            });
          }
        } catch (error: any) {
          console.error('Ошибка регистрации:', error);
          set({ 
            isLoading: false, 
            error: `Ошибка регистрации: ${error.message}` 
          });
        }
      },
      
      // Выход пользователя из системы
      logout: () => {
        console.log('AuthStore: Начало процесса выхода из системы');
        
        // Сохраняем копии важных данных перед удалением (для возможного восстановления)
        try {
          const profile = localStorage.getItem('user_profile');
          const token = localStorage.getItem('token');
          const refreshToken = localStorage.getItem('refresh_token');
          
          if (profile || token || refreshToken) {
            localStorage.setItem('user_profile_backup', profile || '');
            localStorage.setItem('token_backup', token || '');
            localStorage.setItem('refresh_token_backup', refreshToken || '');
            localStorage.setItem('logout_timestamp', Date.now().toString());
            console.log('AuthStore: Сохранены резервные копии данных авторизации');
          }
        } catch (e) {
          console.error('AuthStore: Ошибка при сохранении резервных копий:', e);
        }
        
        try {
          // Отправляем запрос на выход, если есть активный токен
          const token = getAuthToken();
          if (token) {
            console.log('AuthStore: Отправка запроса выхода из системы с токеном');
            // Используем fetch вместо axios для более надежного выполнения
            fetch('/api/auth/logout', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
              }
            }).catch(e => {
              console.warn('AuthStore: Ошибка при выходе из системы на сервере:', e);
            });
          }
        } catch (e) {
          console.error('AuthStore: Ошибка при отправке запроса выхода:', e);
        }
        
        // Очищаем состояние авторизации
        set({ 
          isAuthenticated: false,
          token: null,
          user: null 
        });
        
        console.log('AuthStore: Токен удален из всех хранилищ');
        
        // Удаляем токены из localStorage и sessionStorage
        try {
          localStorage.removeItem('token');
          sessionStorage.removeItem('token');
          localStorage.removeItem('refresh_token');
        } catch (e) {
          console.error('AuthStore: Ошибка при удалении токенов:', e);
        }
      },
      
      // Очистка ошибки
      clearError: () => set({ error: null }),
      
      refreshProfile: async () => {
        try {
          const response = await api.get('/users/me');
          const userProfile = response.data;
          
          // Обновляем профиль в хранилище
          set({ user: userProfile });
          
          // Также обновляем в localStorage для сохранения между сессиями
          if (typeof window !== 'undefined') {
            localStorage.setItem('user_profile', JSON.stringify(userProfile));
            localStorage.setItem('user_role', userProfile.role);
            localStorage.setItem('user', JSON.stringify(userProfile));
            console.log('AuthStore: Профиль обновлен, роль:', userProfile.role);
          }
        } catch (error) {
          console.error('Ошибка при обновлении профиля пользователя:', error);
        }
      }
    }),
    {
      name: STORE_NAME,
      // Исключаем из персистентности некоторые поля
      partialize: (state) => ({
        token: state.token,
        refreshToken: state.refreshToken,
        user: state.user,
        isAuthenticated: state.isAuthenticated
      })
    }
  )
);

export default useAuthStore; 