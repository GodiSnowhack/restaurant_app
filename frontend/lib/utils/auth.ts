import { User } from '../types/auth';

// Ключи для хранения данных
const TOKEN_KEY = 'token';
const USER_KEY = 'user_profile';
const AUTH_TIMESTAMP_KEY = 'auth_timestamp';

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
    localStorage.setItem(USER_KEY, JSON.stringify(user));
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
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(AUTH_TIMESTAMP_KEY);
    console.log('Auth Utils: Данные авторизации успешно очищены');
  } catch (error) {
    console.error('Auth Utils: Ошибка при очистке данных авторизации:', error);
  }
};

// Функция для проверки срока действия токена
export const isTokenExpired = (token: string): boolean => {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
      return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));

    const { exp } = JSON.parse(jsonPayload);
    const expired = Date.now() >= exp * 1000;
    
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