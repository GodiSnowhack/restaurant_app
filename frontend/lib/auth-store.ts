import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { authApi } from './api/auth';
import { AuthState, LoginCredentials, RegisterCredentials, LoginResponse, User } from './types/auth';
import { saveToken, saveUser, clearAuth } from './utils/auth';
import { api } from './api/api';

// Начальное состояние
const initialState: AuthState = {
  isAuthenticated: false,
  user: null,
  token: null,
  error: null,
  isLoading: false
};

// Определяем тип для store с методами
export interface AuthStore extends AuthState {
  login: (credentials: LoginCredentials) => Promise<LoginResponse>;
  register: (credentials: RegisterCredentials) => Promise<void>;
  logout: () => Promise<void>;
  initialize: () => Promise<void>;
  fetchUserProfile: () => Promise<void>;
  refreshProfile: () => Promise<User>;
}

// Создаем хранилище с поддержкой персистентности
const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      ...initialState,

      initialize: async () => {
        try {
          console.log('AuthStore: Начало инициализации');
          
          // Проверяем все возможные источники токена
          let token = localStorage.getItem('token');
          if (!token) {
            token = sessionStorage.getItem('token');
            if (token) {
              localStorage.setItem('token', token);
            }
          }
          
          // Проверяем куки
          if (!token) {
            const cookies = document.cookie.split(';');
            for (const cookie of cookies) {
              const [name, value] = cookie.trim().split('=');
              if (name === 'auth_token' && value) {
                token = value;
                localStorage.setItem('token', token);
                break;
              }
            }
          }

          // Получаем сохраненные данные пользователя
          const userStr = localStorage.getItem('user_profile');
          const user = userStr ? JSON.parse(userStr) : null;

          console.log('AuthStore: Проверка данных авторизации', {
            hasToken: !!token,
            hasUser: !!user,
            userData: user ? {
              id: user.id,
              email: user.email,
              role: user.role
            } : null
          });

          if (token) {
            // Устанавливаем токен в axios
            api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
            
            try {
              // Проверяем валидность токена, получая профиль пользователя
              const currentUser = await authApi.getProfile();
              
              if (!currentUser || !currentUser.id || !currentUser.email || !currentUser.role) {
                throw new Error('Получен неполный профиль пользователя');
              }

              console.log('AuthStore: Получен текущий профиль', {
                userId: currentUser.id,
                email: currentUser.email,
                role: currentUser.role
              });
              
              // Обновляем данные в localStorage
              saveUser(currentUser);
              localStorage.setItem('token', token);
              
              // Обновляем состояние
              set({ 
                isAuthenticated: true, 
                token, 
                user: currentUser,
                error: null 
              });
            } catch (error) {
              console.error('AuthStore: Ошибка при получении профиля', error);
              // Если не удалось получить профиль, но есть сохраненные данные
              if (user && user.id && user.email && user.role) {
                console.log('AuthStore: Используем сохраненные данные пользователя', {
                  id: user.id,
                  email: user.email,
                  role: user.role
                });
                set({ 
                  isAuthenticated: true, 
                  token, 
                  user,
                  error: null 
                });
              } else {
                console.log('AuthStore: Очистка невалидных данных авторизации');
                clearAuth();
                set({ 
                  isAuthenticated: false, 
                  token: null, 
                  user: null,
                  error: null 
                });
              }
            }
          } else {
            console.log('AuthStore: Токен не найден, сброс состояния');
            clearAuth();
            set({ 
              isAuthenticated: false, 
              token: null, 
              user: null,
              error: null 
            });
          }
        } catch (error) {
          console.error('AuthStore: Критическая ошибка при инициализации', error);
          clearAuth();
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
            hasPassword: !!credentials.password
          });

          const response = await authApi.login(credentials);
          
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
          const response = await authApi.register(credentials);

          set({
            isAuthenticated: true,
            token: response.access_token,
            user: response.user,
            error: null,
            isLoading: false
          });
        } catch (error: any) {
          console.error('AuthStore: Ошибка регистрации', error);
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
          set({ isLoading: true });
          await authApi.logout();
          clearAuth();
          set({
            isAuthenticated: false,
            token: null,
            user: null,
            error: null,
            isLoading: false
          });
        } catch (error) {
          console.error('AuthStore: Ошибка при выходе', error);
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
          const currentUser = await authApi.getProfile();
          
          if (!currentUser || !currentUser.id || !currentUser.email || !currentUser.role) {
            throw new Error('Получен неполный профиль пользователя');
          }

          console.log('AuthStore: Получен профиль пользователя', {
            id: currentUser.id,
            email: currentUser.email,
            role: currentUser.role
          });

          saveUser(currentUser);
          set({ user: currentUser });
        } catch (error: any) {
          console.error('AuthStore: Ошибка при получении профиля', error);
          throw error;
        }
      },

      refreshProfile: async () => {
        try {
          const currentUser = await authApi.getProfile();
          if (!currentUser) {
            throw new Error('Не удалось получить данные пользователя');
          }
          saveUser(currentUser);
          set({ user: currentUser });
          return currentUser;
        } catch (error: any) {
          console.error('AuthStore: Ошибка при обновлении профиля', error);
          throw error;
        }
      }
    }),
    {
      name: 'auth-store',
      partialize: (state) => ({
        token: state.token,
        user: state.user,
        isAuthenticated: state.isAuthenticated
      })
    }
  )
);

export default useAuthStore; 