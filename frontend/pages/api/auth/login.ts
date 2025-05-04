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
    console.log(`Auth API - Запрос авторизации от устройства${isMobile ? ' (мобильное)' : ''}: ${userAgent}`);
    console.log(`Auth API - IP клиента: ${clientIp}`);
    
    // Получаем учетные данные из тела запроса и обеспечиваем их валидность
    let { username, password, email } = req.body;
    
    console.log('Auth API - Данные запроса:', { 
      hasUsername: !!username, 
      hasPassword: !!password,
      hasEmail: !!email,
      bodyKeys: Object.keys(req.body)
    });
    
    // Если передан email вместо username, используем его
    if (!username && email) {
      username = email;
      console.log('Auth API - Используем email в качестве username');
    }
    
    // Проверяем логин и пароль
    if (!username || !password) {
      return res.status(400).json({ 
        detail: 'Необходимо указать имя пользователя/email и пароль',
        field_errors: {
          ...(username ? {} : { username: 'Обязательное поле' }),
          ...(password ? {} : { password: 'Обязательное поле' })
        }
      });
    }
    
    // Формируем URL для запроса к основному API
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';
    
    // Сначала проверяем доступность сервера перед запросом авторизации
    try {
      console.log('Auth API - Проверка доступности сервера перед авторизацией');
      const healthCheck = await axios.get(`${apiUrl}/health`, { 
        timeout: 5000,
        validateStatus: () => true // Принимаем любой код ответа
      });
      
      if (healthCheck.status >= 500) {
        console.error(`Auth API - Сервер недоступен, код ответа: ${healthCheck.status}`);
        return res.status(503).json({
          detail: 'Сервер временно недоступен',
          message: 'Пожалуйста, попробуйте позже',
          server_status: healthCheck.status
        });
      }
      
      console.log(`Auth API - Сервер доступен, код ответа: ${healthCheck.status}`);
    } catch (healthError: any) {
      console.warn('Auth API - Ошибка при проверке доступности сервера:', healthError.message);
      // Продолжаем работу, но запоминаем ошибку для диагностики
    }

    // Используем формат form-username (URL-encoded), который работает надежнее
    try {
      console.log('Auth API - Отправка запроса на авторизацию в формате form-username');
      
      // Формируем URL-encoded данные
      const requestBody = new URLSearchParams({ 
        username, 
        password 
      }).toString();
      
      const endpoint = `${apiUrl}/auth/login`;
      const response = await axios({
        method: 'POST',
        url: endpoint,
        data: requestBody,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json',
          'User-Agent': userAgent,
          'X-Client-Type': isMobile ? 'mobile' : 'desktop',
          'X-Forwarded-For': String(clientIp)
        },
        timeout: isMobile ? 60000 : 15000,
        validateStatus: (status) => status < 500 // Отклоняем только серверные ошибки 5xx
      });
      
      console.log(`Auth API - Получен ответ от сервера: ${response.status}`);
      
      // Если получили успешный ответ
      if (response.status === 200 && response.data && response.data.access_token) {
        const authResult = response.data;
        const duration = Date.now() - startTime;
        console.log(`Auth API - Авторизация успешна, время: ${duration}ms`);
        
        // Добавляем refresh_token, если его нет в ответе
        if (!authResult.refresh_token && authResult.access_token) {
          console.log(`Auth API - Добавляем refresh_token`);
          authResult.refresh_token = generateRefreshToken();
        }
        
        return res.status(200).json({
          ...authResult,
          auth_method: 'proxy',
          duration
        });
      }
      
      // Если ответ не 200 или нет токена, обрабатываем ошибку
      console.error(`Auth API - Ошибка авторизации, статус: ${response.status}`);
      
      return res.status(response.status || 400).json({
        detail: response.data?.detail || 'Ошибка авторизации',
        message: 'Не удалось авторизоваться. Проверьте правильность учетных данных.',
        status: response.status,
        data: response.data
      });
    } catch (error: any) {
      // Обрабатываем ошибки запроса
      console.error('Auth API - Ошибка при отправке запроса на авторизацию:', error.message);
      
      return res.status(500).json({
        detail: error.message,
        message: 'Внутренняя ошибка сервера при авторизации',
        timestamp: Date.now()
      });
    }
  } catch (error: any) {
    console.error('Auth API - Критическая ошибка:', error);
    
    return res.status(500).json({
      detail: error.message,
      message: 'Внутренняя ошибка сервера',
      timestamp: Date.now()
    });
  }
}

// Добавляем функцию генерации refresh_token
function generateRefreshToken(): string {
  const random = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  return `refresh_${random}_${Date.now()}`;
} 