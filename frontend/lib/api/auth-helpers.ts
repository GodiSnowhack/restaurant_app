import jwt from 'jsonwebtoken';
import axios from 'axios';

/**
 * Проверяет, не истёк ли токен
 * @param token JWT токен для проверки
 * @returns true, если токен истёк
 */
export const isTokenExpired = (token: string): boolean => {
  try {
    const decoded = jwt.decode(token) as { exp?: number };
    if (!decoded || !decoded.exp) return true;
    
    // Если срок действия токена истекает в течение 5 минут, считаем что пора обновить
    const nowWithBuffer = Math.floor(Date.now() / 1000) + 300; // текущее время + 5 минут
    return nowWithBuffer >= decoded.exp;
  } catch (e) {
    console.error('[Auth] Ошибка при проверке токена:', e);
    return true;
  }
};

/**
 * Обновляет токен с помощью refresh token
 * @returns Новый токен доступа или null в случае ошибки
 */
export const refreshToken = async (): Promise<string | null> => {
  try {
    const refreshToken = localStorage.getItem('refresh_token');
    if (!refreshToken) {
      console.error('[Auth] Отсутствует refresh token');
      return null;
    }
    
    // Используем локальный API-прокси для обновления токена
    const response = await axios.post('/api/auth/refresh', {
      refresh_token: refreshToken
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });
    
    if (response.status !== 200 || !response.data.access_token) {
      throw new Error('Не удалось обновить токен');
    }
    
    // Сохраняем новый токен
    const newToken = response.data.access_token;
    localStorage.setItem('token', newToken);
    
    // Если в ответе есть новый refresh token, сохраняем и его
    if (response.data.refresh_token) {
      localStorage.setItem('refresh_token', response.data.refresh_token);
    }
    
    return newToken;
  } catch (error) {
    console.error('[Auth] Ошибка при обновлении токена:', error);
    return null;
  }
};

/**
 * Получает актуальный токен, при необходимости обновляя его
 * @returns Актуальный токен или null
 */
export const getValidToken = async (): Promise<string | null> => {
  try {
    const token = localStorage.getItem('token');
    if (!token) return null;
    
    // Если токен истёк, пробуем обновить
    if (isTokenExpired(token)) {
      console.log('[Auth] Токен истёк, обновляем...');
      return await refreshToken();
    }
    
    return token;
  } catch (error) {
    console.error('[Auth] Ошибка при получении токена:', error);
    return null;
  }
}; 