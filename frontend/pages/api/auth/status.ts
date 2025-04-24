import { NextApiRequest, NextApiResponse } from 'next';
import { parse } from 'cookie';

/**
 * API-эндпоинт для проверки статуса авторизации пользователя
 */
export default function authStatus(req: NextApiRequest, res: NextApiResponse) {
  try {
    const { headers } = req;
    
    // Проверяем наличие токена в заголовке Authorization
    const authHeader = headers.authorization;
    let token = authHeader ? authHeader.replace('Bearer ', '') : null;
    
    // Проверяем наличие токена в cookies
    if (!token && headers.cookie) {
      const cookies = parse(headers.cookie);
      if (cookies.token) {
        token = cookies.token;
      }
    }
    
    // Проверка токена на валидность (простая проверка на JWT формат)
    const isJWT = (token: string | null): boolean => {
      if (!token) return false;
      
      const parts = token.split('.');
      return parts.length === 3;
    };
    
    const isTokenValid = isJWT(token);
    
    return res.status(200).json({
      isAuthenticated: !!token,
      tokenDetails: {
        headerToken: !!authHeader,
        cookieToken: !!token && !authHeader,
        headerTokenValid: isTokenValid
      },
      message: token ? 'Пользователь аутентифицирован' : 'Пользователь не аутентифицирован'
    });
  } catch (error: any) {
    console.error('Ошибка при проверке статуса авторизации:', error);
    
    return res.status(500).json({
      isAuthenticated: false,
      error: error.message,
      message: 'Ошибка при проверке статуса авторизации'
    });
  }
} 