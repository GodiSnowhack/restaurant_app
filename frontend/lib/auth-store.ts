import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { authApi } from './api/auth';
import { AuthState, LoginCredentials, RegisterCredentials, LoginResponse, User } from './types/auth';
import { saveToken, saveUser, clearAuth } from './utils/auth';

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
          const token = localStorage.getItem('token');
          const userStr = localStorage.getItem('user');
          const user = userStr ? JSON.parse(userStr) : null;

          if (token && user) {
            set({ 
              isAuthenticated: true, 
              token, 
              user,
              error: null 
            });

            // Проверяем актуальность данных пользователя
            try {
              const currentUser = await authApi.getProfile();
              saveUser(currentUser);
              set({ user: currentUser });
            } catch (error) {
              console.error('AuthStore: Ошибка при обновлении профиля', error);
              // Если не удалось получить актуальные данные, оставляем сохраненные
            }
          } else {
            set({ 
              isAuthenticated: false, 
              token: null, 
              user: null,
              error: null 
            });
          }
        } catch (error) {
          console.error('AuthStore: Ошибка при инициализации', error);
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
          if (!currentUser) {
            throw new Error('Не удалось получить данные пользователя');
          }
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