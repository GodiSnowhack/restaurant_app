import { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';

/**
 * API-прокси для авторизации
 * Улучшенная версия с расширенной диагностикой и восстановлением после ошибок
 */
export default async function loginProxy(req: NextApiRequest, res: NextApiResponse) {
  // Разрешаем CORS для всех клиентов
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  // Обрабатываем предварительные запросы CORS
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Метод не поддерживается' });
  }

  try {
    const userAgent = req.headers['user-agent'] || 'Unknown';
    const startTime = Date.now();
    const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    
    // Определяем, является ли устройство мобильным
    const isMobile = /Mobile|Android|iPhone|iPad|iPod|Windows Phone/i.test(userAgent);
    console.log(`Auth API - Запрос авторизации от устройства: ${userAgent}`);
    console.log(`Auth API - IP клиента: ${clientIp}`);
    
    // Получаем учетные данные из тела запроса
    const { username, password } = req.body;
    
    console.log('Auth API - Данные запроса:', { 
      hasUsername: !!username, 
      hasPassword: !!password,
      bodyKeys: Object.keys(req.body)
    });
    
    // Проверяем логин и пароль
    if (!username || !password) {
      return res.status(400).json({ 
        detail: 'Необходимо указать email и пароль',
        field_errors: {
          ...(username ? {} : { username: 'Обязательное поле' }),
          ...(password ? {} : { password: 'Обязательное поле' })
        }
      });
    }

    // Проверяем доступность сервера перед отправкой запроса
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://backend-production-1a78.up.railway.app/api/v1';
    
    try {
      console.log('Auth API - Проверка доступности сервера перед авторизацией');
      const healthCheck = await axios.get(`${apiUrl}/health`);
      console.log(`Auth API - Сервер доступен, код ответа: ${healthCheck.status}`);
    } catch (error) {
      console.error('Auth API - Ошибка при проверке доступности сервера:', error);
      return res.status(503).json({
        detail: 'Сервер авторизации недоступен',
        message: 'Пожалуйста, попробуйте позже'
      });
    }

    // Отправляем запрос на авторизацию
    try {
      console.log('Auth API - Отправка запроса на авторизацию в формате form-data');
      
      // Формируем данные для отправки
      const formData = new URLSearchParams();
      formData.append('username', username);
      formData.append('password', password);

      const response = await axios.post(`${apiUrl}/auth/login`, formData, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json',
          'User-Agent': userAgent
        },
        timeout: isMobile ? 60000 : 15000
      });
      
      console.log(`Auth API - Получен ответ от сервера: ${response.status}`);
      
      if (response.data && response.data.access_token) {
        const duration = Date.now() - startTime;
        console.log(`Auth API - Авторизация успешна, время: ${duration}ms`);
        
        return res.status(200).json({
          ...response.data,
          auth_method: 'proxy',
          duration
        });
      } else {
        console.error('Auth API - Отсутствует токен в ответе');
        return res.status(401).json({
          detail: 'Неверные учетные данные',
          message: 'Проверьте правильность email и пароля'
        });
      }
    } catch (error: any) {
      console.error('Auth API - Ошибка при отправке запроса:', error.message);
      
      // Если есть ответ от сервера с деталями ошибки
      if (error.response) {
        return res.status(error.response.status).json(error.response.data);
      }
      
      return res.status(500).json({
        detail: error.message,
        message: 'Внутренняя ошибка сервера при авторизации'
      });
    }
  } catch (error: any) {
    console.error('Auth API - Критическая ошибка:', error);
    
    return res.status(500).json({
      detail: error.message,
      message: 'Внутренняя ошибка сервера'
    });
  }
}

// Добавляем функцию генерации refresh_token
function generateRefreshToken(): string {
  const random = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  return `refresh_${random}_${Date.now()}`;
} 