/**
 * Определение типа User для возвращаемых данных
 */
interface User {
  id: number;
  email: string;
  role: string;
  full_name?: string;
}

/**
 * Безопасное декодирование Base64 для работы как в браузере, так и в Node.js
 */
function decodeBase64(base64Str: string): string {
  // Заменяем URL-safe символы на стандартные Base64
  const normalizedBase64 = base64Str.replace(/-/g, '+').replace(/_/g, '/');
  
  // В браузере
  if (typeof window !== 'undefined' && window.atob) {
    try {
      return window.atob(normalizedBase64);
    } catch (e) {
      console.error('Ошибка при декодировании Base64 в браузере:', e);
      throw e;
    }
  } 
  // В Node.js
  else if (typeof Buffer !== 'undefined') {
    try {
      return Buffer.from(normalizedBase64, 'base64').toString('utf8');
    } catch (e) {
      console.error('Ошибка при декодировании Base64 в Node.js:', e);
      throw e;
    }
  }
  
  throw new Error('Не удалось декодировать Base64: окружение не поддерживается');
}

/**
 * Извлекает информацию о пользователе из JWT токена
 * Простая имплементация без проверки подписи
 * @param token JWT токен
 * @returns Объект с информацией о пользователе или null
 */
export function getUserFromToken(token: string): User | null {
  try {
    // Декодируем payload часть токена (второй сегмент)
    const parts = token.split('.');
    if (parts.length !== 3) {
      console.error('Неверный формат JWT токена');
      return null;
    }
    
    // Декодируем payload
    const decodedPayload = decodeBase64(parts[1]);
    const payload = JSON.parse(decodedPayload);
    
    return {
      id: payload.sub,
      email: payload.email || '',
      role: payload.role || 'user',
      full_name: payload.full_name
    };
  } catch (error) {
    console.error('Ошибка декодирования токена:', error);
    return null;
  }
} 