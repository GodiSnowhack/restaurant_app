import { create } from 'zustand';
import { authApi, UserProfile } from './api';

interface AuthState {
  isAuthenticated: boolean;
  user: UserProfile | null;
  isLoading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, fullName: string, phone?: string) => Promise<void>;
  logout: () => void;
  fetchUserProfile: () => Promise<void>;
}

// Функция для загрузки кэшированного профиля
const loadCachedProfile = (): UserProfile | null => {
  if (typeof window !== 'undefined') {
    const cached = localStorage.getItem('user_profile');
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch (e) {
        return null;
      }
    }
  }
  return null;
};

// Функция для проверки токена безопасно
const hasToken = (): boolean => {
  return typeof window !== 'undefined' && !!localStorage.getItem('token');
};

// Начальное состояние с загрузкой кэшированного профиля
const cachedProfile = loadCachedProfile();
const initialState = {
  isAuthenticated: hasToken() && !!cachedProfile,
  user: cachedProfile,
  isLoading: false,
  error: null
};

const useAuthStore = create<AuthState>((set) => ({
  ...initialState,
  
  login: async (email: string, password: string) => {
    set({ isLoading: true, error: null });
    try {
      await authApi.login({ username: email, password });
      await useAuthStore.getState().fetchUserProfile();
      set({ isAuthenticated: true, isLoading: false });
    } catch (error: any) {
      let errorMessage = 'Ошибка входа в систему';
      
      if (error.response?.data) {
        if (typeof error.response.data.detail === 'string') {
          errorMessage = error.response.data.detail;
        } else if (Array.isArray(error.response.data.detail)) {
          errorMessage = error.response.data.detail.map((err: any) => {
            if (err.loc && err.msg) {
              const field = err.loc.slice(1).join('.') || 'значение';
              return `Поле "${field}": ${err.msg}`;
            }
            return typeof err === 'string' ? err : JSON.stringify(err);
          }).join('\n');
        } else if (typeof error.response.data.detail === 'object') {
          errorMessage = JSON.stringify(error.response.data.detail);
        } else {
          errorMessage = JSON.stringify(error.response.data);
        }
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      set({ 
        isLoading: false, 
        error: errorMessage,
        isAuthenticated: false 
      });
    }
  },
  
  register: async (email: string, password: string, fullName: string, phone?: string) => {
    set({ isLoading: true, error: null });
    try {
      // Создаем объект с данными для регистрации
      const registrationData = { 
        email, 
        password, 
        full_name: fullName,
        phone
      };
      
      console.log('Отправляем данные для регистрации:', registrationData);
      
      await authApi.register(registrationData);
      set({ isLoading: false });
    } catch (error: any) {
      console.error('Ошибка при регистрации:', error);
      set({ 
        isLoading: false, 
        error: error.response?.data?.detail || 'Ошибка регистрации' 
      });
    }
  },
  
  logout: () => {
    authApi.logout();
    // Очищаем также кэшированный профиль
    if (typeof window !== 'undefined') {
      localStorage.removeItem('user_profile');
    }
    set({ isAuthenticated: false, user: null });
  },
  
  fetchUserProfile: async () => {
    set({ isLoading: true, error: null });
    try {
      const user = await authApi.getProfile();
      // Кэшируем профиль в localStorage
      if (typeof window !== 'undefined') {
        localStorage.setItem('user_profile', JSON.stringify(user));
      }
      set({ user, isLoading: false, isAuthenticated: true });
    } catch (error: any) {
      // Если 401, то пользователь не авторизован
      if (error.response?.status === 401) {
        set({ isAuthenticated: false, user: null, isLoading: false });
        // Удаляем токен и кэшированный профиль, так как они недействительны
        localStorage.removeItem('token');
        localStorage.removeItem('user_profile');
      } else {
        // При других ошибках (например, проблемы с сетью) не сбрасываем состояние авторизации
        set({ 
          isLoading: false, 
          error: error.response?.data?.detail || 'Ошибка получения профиля',
          // Оставляем предыдущее состояние аутентификации без изменений
        });
      }
    }
  },
}));

export default useAuthStore; 