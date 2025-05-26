import { User } from '../types/auth';
import { jwtDecode } from 'jwt-decode';

// Ключи для хранения данных
const TOKEN_KEY = 'token';
const USER_KEY = 'user_profile';
const AUTH_TIMESTAMP_KEY = 'auth_timestamp';

interface JWTPayload {
  sub: string;
  email: string;
  role: string;
  exp: number;
}

// Функция для сохранения токена
export const saveToken = (token: string): void => {
  try {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(AUTH_TIMESTAMP_KEY, Date.now().toString());
    console.log('Auth Utils: Токен успешно сохранен');
  } catch (error) {
    console.error('Auth Utils: Ошибка при сохранении токена:', error);
  }
};

// Функция для получения токена
export const getToken = (): string | null => {
  try {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      console.log('Auth Utils: Токен не найден');
      return null;
    }
    return token;
  } catch (error) {
    console.error('Auth Utils: Ошибка при получении токена:', error);
    return null;
  }
};

// Функция для сохранения данных пользователя
export const saveUser = (user: User): void => {
  try {
    if (!user) {
      console.error('Auth Utils: Попытка сохранить пустые данные пользователя');
      return;
    }

    // Проверяем наличие необходимых полей
    if (!user.id || !user.email || !user.role) {
      console.error('Auth Utils: Неполные данные пользователя:', {
        hasId: !!user.id,
        hasEmail: !!user.email,
        hasRole: !!user.role
      });
      return;
    }

    // Сохраняем полный объект пользователя
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    
    // Дополнительно сохраняем важные поля отдельно для надежности
    localStorage.setItem('user_id', user.id.toString());
    localStorage.setItem('user_role', user.role);
    localStorage.setItem('user_email', user.email);

    console.log('Auth Utils: Данные пользователя успешно сохранены', {
      id: user.id,
      email: user.email,
      role: user.role
    });
  } catch (error) {
    console.error('Auth Utils: Ошибка при сохранении данных пользователя:', error);
  }
};

// Функция для получения данных пользователя
export const getUser = (): User | null => {
  try {
    const userStr = localStorage.getItem(USER_KEY);
    if (!userStr) {
      console.log('Auth Utils: Данные пользователя не найдены');
      return null;
    }
    const user = JSON.parse(userStr) as User;
    return user;
  } catch (error) {
    console.error('Auth Utils: Ошибка при получении данных пользователя:', error);
    return null;
  }
};

// Функция для очистки данных авторизации
export const clearAuth = (): void => {
  if (typeof window === 'undefined') return;

  try {
    // Очищаем основные данные авторизации
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(AUTH_TIMESTAMP_KEY);

    // Очищаем дополнительные данные
    localStorage.removeItem('user_id');
    localStorage.removeItem('user_role');
    localStorage.removeItem('user_email');
    localStorage.removeItem('token');
    sessionStorage.removeItem('token');
    localStorage.removeItem('user');
    sessionStorage.removeItem('user');

    console.log('Auth Utils: Данные авторизации успешно очищены');
  } catch (error) {
    console.error('Auth Utils: Ошибка при очистке данных авторизации:', error);
  }
};

// Функция для проверки срока действия токена
export const isTokenExpired = (token: string): boolean => {
  try {
    const decoded = jwtDecode<JWTPayload>(token);
    const currentTime = Date.now() / 1000;
    
    const expired = decoded.exp < currentTime;
    if (expired) {
      console.log('Auth Utils: Токен истек');
    }
    
    return expired;
  } catch (error) {
    console.error('Auth Utils: Ошибка при проверке срока действия токена:', error);
    return true; // В случае ошибки считаем токен истекшим
  }
};

// Функция для проверки валидности данных авторизации
export const validateAuthData = (): boolean => {
  try {
    const token = getToken();
    const user = getUser();
    const timestamp = localStorage.getItem(AUTH_TIMESTAMP_KEY);

    if (!token || !user || !timestamp) {
      console.log('Auth Utils: Отсутствуют необходимые данные авторизации');
      return false;
    }

    // Проверяем срок действия токена
    if (isTokenExpired(token)) {
      console.log('Auth Utils: Токен истек');
      return false;
    }

    // Проверяем время последней авторизации (24 часа)
    const lastAuth = parseInt(timestamp);
    const now = Date.now();
    if (now - lastAuth > 24 * 60 * 60 * 1000) {
      console.log('Auth Utils: Истек срок сессии');
      return false;
    }

    return true;
  } catch (error) {
    console.error('Auth Utils: Ошибка при валидации данных авторизации:', error);
    return false;
  }
};

export const getAuthToken = (): string | null => {
  if (typeof window === 'undefined') return null;
  
  try {
    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    if (!token) return null;

    // Проверяем валидность токена
    const decoded = jwtDecode<JWTPayload>(token);
    const currentTime = Date.now() / 1000;
    
    if (decoded.exp < currentTime) {
      // Токен истек, удаляем его
      localStorage.removeItem('token');
      sessionStorage.removeItem('token');
      return null;
    }

    return token;
  } catch (e) {
    console.error('Ошибка при получении токена:', e);
    return null;
  }
};

export const getUserFromToken = (): { id: string; email: string; role: string } | null => {
  const token = getAuthToken();
  if (!token) return null;

  try {
    const decoded = jwtDecode<JWTPayload>(token);
    return {
      id: decoded.sub,
      email: decoded.email,
      role: decoded.role
    };
  } catch (e) {
    console.error('Ошибка при декодировании токена:', e);
    return null;
  }
};

export const isAuthenticated = (): boolean => {
  return !!getAuthToken();
};

export const isAdmin = (): boolean => {
  const user = getUserFromToken();
  return user?.role === 'admin';
};

export const getAuthHeaders = () => {
  const token = getAuthToken();
  const user = getUserFromToken();
  
  if (!token || !user) return {};
  
  return {
    'Authorization': `Bearer ${token}`,
    'X-User-ID': user.id,
    'X-User-Role': user.role,
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  };
}; 