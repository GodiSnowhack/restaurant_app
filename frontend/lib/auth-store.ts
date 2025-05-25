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
  
  login: (email: string, password: string) => Promise<void>;
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
      login: async (email: string, password: string) => {
        try {
          console.log('Login Page - Попытка входа', { email, hasPassword: !!password });
          
          const response = await fetch('/api/login', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ email, password }),
            credentials: 'include'
          });

          const data = await response.json();
          console.log('AuthStore - Ответ от сервера:', {
            status: response.status,
            hasData: !!data,
            hasToken: !!data.access_token,
            role: data.user?.role
          });

          if (!response.ok) {
            throw new Error(data.detail || 'Ошибка авторизации');
          }

          if (!data.access_token) {
            throw new Error('Не получен токен доступа');
          }

          // Сохраняем токен
          saveAuthToken(data.access_token);
          
          // Если в ответе есть данные пользователя, сохраняем их
          if (data.user) {
            const userProfile = {
              id: data.user.id,
              email: data.user.email,
              role: data.user.role,
              full_name: data.user.full_name,
              is_active: data.user.is_active,
              phone: data.user.phone
            };

            set({ 
              isAuthenticated: true, 
              token: data.access_token,
              user: userProfile,
              error: null 
            });
            
            // Сохраняем данные пользователя в localStorage
            localStorage.setItem('user_profile', JSON.stringify(userProfile));
            localStorage.setItem('user_role', userProfile.role);
            localStorage.setItem('user', JSON.stringify(userProfile));
            
            console.log('AuthStore - Авторизация успешна, сохранен профиль:', {
              role: userProfile.role,
              id: userProfile.id
            });
          } else {
            // Если данных пользователя нет, получаем профиль отдельным запросом
            set({ 
              isAuthenticated: true, 
              token: data.access_token,
              error: null 
            });
            
            // Получаем профиль пользователя
            await get().fetchUserProfile();
          }
        } catch (error: any) {
          console.error('AuthStore: Ошибка авторизации:', error);
          set({ 
            isAuthenticated: false,
            token: null,
            user: null,
            error: error.message || 'Ошибка авторизации'
          });
          throw error;
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
            set({ user: null, isAuthenticated: false });
            return;
          }
          
          console.log('AuthStore: Начало запроса профиля пользователя');
          
          // Выполняем запрос с таймаутом
          const response = await fetch('/api/profile', {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`,
              'Accept': 'application/json'
            },
            credentials: 'include'
          });
          
          if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'Ошибка получения профиля');
          }

          const data = await response.json();
          
          // Проверяем, нужно ли обновить токен
          if (data.needs_token_refresh) {
            console.log('AuthStore: Требуется обновление токена');
            try {
              // Запрашиваем новый токен
              const refreshResponse = await fetch('/api/auth/refresh', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${token}`
                }
              });
              
              if (refreshResponse.ok) {
                const refreshData = await refreshResponse.json();
                if (refreshData.access_token) {
                  // Сохраняем новый токен
                  localStorage.setItem('token', refreshData.access_token);
                  console.log('AuthStore: Токен успешно обновлен');
                }
              }
            } catch (e) {
              console.error('AuthStore: Ошибка при обновлении токена:', e);
            }
          }
          
          set({ user: data, isAuthenticated: true });
          
          // Кэшируем профиль для офлайн-доступа
          try {
            localStorage.setItem('user_profile', JSON.stringify(data));
            localStorage.setItem('user_profile_timestamp', Date.now().toString());
            localStorage.setItem('user_role', data.role);
            localStorage.setItem('user', JSON.stringify(data));
            
            console.log('AuthStore: Профиль успешно получен и сохранен в кэше, роль:', data.role);
          } catch (e) {
            console.error('AuthStore: Ошибка при кэшировании профиля:', e);
          }
        } catch (error) {
          console.error('AuthStore: Ошибка при получении профиля:', error);
          set({ user: null, isAuthenticated: false });
        }
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
          
          const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://backend-production-1a78.up.railway.app/api/v1';
          const response = await fetch(`${apiUrl}/auth/register`, {
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