import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { authApi } from './api';
import axios from 'axios';
import { AuthState, LoginCredentials, RegisterCredentials, LoginResponse, User } from './types/auth';
import { saveToken, saveUser, getToken, getUser, clearAuth } from './utils/auth';

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

// Начальное состояние
const initialState: AuthState = {
  isAuthenticated: false,
  user: null,
  token: null,
  error: null,
  isLoading: false
};

// Имя для хранения состояния в localStorage
const STORE_NAME = 'auth-store';

// Определяем тип для store с методами
interface AuthStore extends AuthState {
  login: (credentials: LoginCredentials) => Promise<LoginResponse>;
  register: (credentials: RegisterCredentials) => Promise<void>;
  logout: () => Promise<void>;
  initialize: () => Promise<void>;
  fetchUserProfile: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  isMobileDevice: () => boolean;
  setInitialAuthState: () => void;
}

// Создаем хранилище с поддержкой персистентности
const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      ...initialState,

      setInitialAuthState: () => {
        const token = getToken();
        const user = getUser();
        if (token && user) {
          set({ 
            isAuthenticated: true, 
            token, 
            user,
            error: null 
          });
          console.log('AuthStore: Установлено начальное состояние', {
            hasToken: !!token,
            hasUser: !!user,
            role: user.role
          });
        } else {
          console.log('AuthStore: Нет сохраненных данных авторизации');
        }
      },

      initialize: async () => {
        try {
          const token = getToken();
          const user = getUser();

          if (token && user) {
            console.log('AuthStore: Инициализация с сохраненными данными', { 
              hasToken: !!token,
              hasUser: !!user,
              role: user.role 
            });
            
            set({ 
              isAuthenticated: true, 
              token, 
              user,
              error: null 
            });

            // Проверяем актуальность данных пользователя
            try {
              const currentUser = await authApi.getProfile();
              console.log('AuthStore: Обновление профиля пользователя', { 
                hasUser: !!currentUser,
                role: currentUser.role 
              });
              
              saveUser(currentUser);
              set({ user: currentUser });
            } catch (error) {
              console.error('AuthStore: Ошибка при обновлении профиля', error);
              // Если не удалось получить актуальные данные, оставляем сохраненные
            }
          } else {
            console.log('AuthStore: Нет сохраненных данных авторизации');
            set({ 
              isAuthenticated: false, 
              token: null, 
              user: null,
              error: null 
            });
          }
        } catch (error) {
          console.error('AuthStore: Ошибка при инициализации', error);
          set({ 
            isAuthenticated: false, 
            token: null, 
            user: null,
            error: null 
          });
        }
      },

      login: async (credentials: LoginCredentials): Promise<LoginResponse> => {
        try {
          set({ isLoading: true, error: null });
          console.log('AuthStore: Начало процесса входа', { 
            email: credentials.email,
            hasPassword: !!credentials.password,
            isMobile: isMobileDevice()
          });

          const response = await authApi.login(credentials) as LoginResponse;
          
          console.log('AuthStore: Получен ответ от сервера', {
            hasToken: !!response.access_token,
            hasUser: !!response.user,
            userEmail: response.user?.email,
            userRole: response.user?.role
          });

          if (!response.access_token || !response.user) {
            throw new Error('Неполные данные в ответе сервера');
          }

          set({
            isAuthenticated: true,
            token: response.access_token,
            user: response.user,
            error: null,
            isLoading: false
          });

          return response;
        } catch (error: any) {
          console.error('AuthStore: Ошибка входа', error);
          
          // Очищаем данные при ошибке
          clearAuth();
          
          set({ 
            isAuthenticated: false,
            token: null,
            user: null,
            error: error.message || 'Произошла ошибка при входе',
            isLoading: false
          });
          
          throw error;
        }
      },

      register: async (credentials: RegisterCredentials) => {
        try {
          set({ isLoading: true, error: null });
          console.log('AuthStore: Попытка регистрации', { email: credentials.email });

          const response = await authApi.register(credentials);

          if (!response.access_token || !response.user) {
            throw new Error('Неверный формат ответа от сервера');
          }

          // Сохраняем данные
          saveToken(response.access_token);
          saveUser(response.user);

          set({
            isAuthenticated: true,
            token: response.access_token,
            user: response.user,
            error: null,
            isLoading: false
          });

          console.log('AuthStore: Успешная регистрация', { 
            isAuthenticated: true,
            role: response.user.role 
          });
        } catch (error: any) {
          console.error('AuthStore: Ошибка регистрации', error);
          
          // Очищаем данные при ошибке
          clearAuth();
          
          set({
            isAuthenticated: false,
            token: null,
            user: null,
            error: error.message || 'Произошла ошибка при регистрации',
            isLoading: false
          });
          
          throw error;
        }
      },

      logout: async () => {
        try {
          console.log('AuthStore: Начало процесса выхода');
          set({ isLoading: true });
          
          await authApi.logout();
          
          // Очищаем все данные
          clearAuth();
          
          set({
            isAuthenticated: false,
            token: null,
            user: null,
            error: null,
            isLoading: false
          });
          
          console.log('AuthStore: Успешный выход');
        } catch (error) {
          console.error('AuthStore: Ошибка при выходе', error);
          
          // Очищаем данные даже при ошибке
          clearAuth();
          
          set({
            isAuthenticated: false,
            token: null,
            user: null,
            error: null,
            isLoading: false
          });
        }
      },

      fetchUserProfile: async () => {
        try {
          console.log('AuthStore: Запрос профиля пользователя');
          const currentUser = await authApi.getProfile();
          
          if (!currentUser) {
            throw new Error('Не удалось получить данные пользователя');
          }
          
          saveUser(currentUser);
          set({ user: currentUser });
          
          console.log('AuthStore: Профиль успешно получен', {
            hasUser: !!currentUser,
            role: currentUser.role
          });
        } catch (error: any) {
          console.error('AuthStore: Ошибка при получении профиля', error);
          throw error;
        }
      },

      refreshProfile: async () => {
        try {
          console.log('AuthStore: Обновление профиля пользователя');
          const currentUser = await authApi.getProfile();
          
          if (!currentUser) {
            throw new Error('Не удалось получить данные пользователя');
          }
          
          saveUser(currentUser);
          set({ user: currentUser });
          
          console.log('AuthStore: Профиль успешно обновлен', {
            hasUser: !!currentUser,
            role: currentUser.role
          });
          
          return currentUser;
        } catch (error: any) {
          console.error('AuthStore: Ошибка при обновлении профиля', error);
          throw error;
        }
      },

      isMobileDevice
    }),
    {
      name: STORE_NAME,
      // Исключаем из персистентности некоторые поля
      partialize: (state) => ({
        token: state.token,
        user: state.user,
        isAuthenticated: state.isAuthenticated
      })
    }
  )
);

export default useAuthStore; 