// Обработчик API запроса для прямой регистрации пользователя без использования axios
import type { NextApiRequest, NextApiResponse } from 'next';

/**
 * Прямое API для регистрации пользователя с улучшенной обработкой ошибок
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Настройка CORS заголовков для любых источников
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );
  
  // Обработка предварительных запросов OPTIONS
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Проверяем, что метод запроса - POST
  if (req.method !== 'POST') {
    return res.status(405).json({ detail: 'Метод не разрешен' });
  }

  try {
    // Получаем данные из запроса
    const { email, password, full_name, phone, role } = req.body;
    
    // Подробное логирование для отладки
    console.log('[REGISTER-DIRECT] Получен запрос на регистрацию:', {
      email,
      full_name,
      role,
      phone: phone || 'не указан',
      has_password: !!password,
      client_ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'неизвестно',
      user_agent: req.headers['user-agent'] || 'неизвестно'
    });

    // Проверяем наличие всех необходимых полей
    if (!email || !password || !full_name) {
      console.error('[REGISTER-DIRECT] Отсутствуют обязательные поля', {
        has_email: !!email,
        has_password: !!password,
        has_full_name: !!full_name
      });
      
      return res.status(400).json({ 
        detail: 'Отсутствуют обязательные поля',
        errors: [
          !email ? { loc: ['body', 'email'], msg: 'Это поле обязательно', type: 'value_error.missing' } : null,
          !password ? { loc: ['body', 'password'], msg: 'Это поле обязательно', type: 'value_error.missing' } : null,
          !full_name ? { loc: ['body', 'full_name'], msg: 'Это поле обязательно', type: 'value_error.missing' } : null
        ].filter(Boolean)
      });
    }

    // Получаем URL бэкенда для отправки запроса
    const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';
    
    // Формируем данные для отправки на бэкенд
    const userData = {
      email,
      password,
      full_name,
      phone: phone || undefined, // Пропускаем undefined значения
      role: role || 'client'
    };

    console.log('[REGISTER-DIRECT] Отправка запроса на бэкенд:', { 
      url: `${backendUrl}/auth/register`,
      method: 'POST',
      data: { ...userData, password: '********' } // Маскируем пароль в логах
    });
    
    try {
      // Проверяем подключение к интернету и доступность сервера
      try {
        const pingResponse = await fetch(`${backendUrl}/health-check`, { 
          method: 'HEAD',
          cache: 'no-cache',
          headers: { 'X-Ping-Check': 'true' }
        });
        console.log('[REGISTER-DIRECT] Проверка соединения с бэкендом:', {
          status: pingResponse.status,
          ok: pingResponse.ok
        });
      } catch (pingError) {
        console.warn('[REGISTER-DIRECT] Не удалось проверить соединение с бэкендом:', pingError);
        // Продолжаем выполнение - это не должно блокировать основной запрос
      }
      
      // Используем нативный fetch вместо axios
      const response = await fetch(`${backendUrl}/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Origin': process.env.NEXT_PUBLIC_FRONTEND_URL || 'http://localhost:3000',
          'User-Agent': req.headers['user-agent'] || 'Restaurant-App/1.0',
          'X-Request-ID': Math.random().toString(36).substring(2, 15)
        },
        body: JSON.stringify(userData),
      });
      
      console.log('[REGISTER-DIRECT] Получен ответ от бэкенда:', {
        status: response.status,
        statusText: response.statusText,
        headers: {
          'content-type': response.headers.get('content-type'),
          'content-length': response.headers.get('content-length'),
        }
      });
      
      // Пытаемся получить тело ответа
      let responseData;
      const contentType = response.headers.get('content-type');
      
      if (contentType?.includes('application/json')) {
        responseData = await response.json();
        console.log('[REGISTER-DIRECT] Тело ответа (JSON):', responseData);
      } else {
        const text = await response.text();
        console.log('[REGISTER-DIRECT] Тело ответа (текст):', text);
        
        // Пытаемся распарсить текст как JSON
        try {
          responseData = JSON.parse(text);
        } catch (e) {
          responseData = { detail: text || 'Нет данных в ответе' };
        }
      }
      
      // Обрабатываем статус ответа
      if (!response.ok) {
        // Формируем понятное сообщение об ошибке
        const errorDetail = typeof responseData === 'object' && responseData !== null 
          ? responseData.detail || JSON.stringify(responseData)
          : 'Неизвестная ошибка при регистрации';
          
        console.error('[REGISTER-DIRECT] Ошибка от бэкенда:', {
          status: response.status,
          detail: errorDetail
        });
        
        // Особая обработка распространенных случаев
        if (response.status === 409 || (typeof errorDetail === 'string' && errorDetail.includes('уже существует'))) {
          return res.status(409).json({
            detail: 'Пользователь с таким email уже существует',
            original: responseData
          });
        }
        
        if (response.status === 422) {
          return res.status(422).json({
            detail: 'Ошибка валидации данных',
            errors: Array.isArray(responseData.detail) 
              ? responseData.detail 
              : [responseData.detail],
            original: responseData
          });
        }
        
        // Возвращаем статус ошибки и данные
        return res.status(response.status).json({
          detail: typeof errorDetail === 'string' ? errorDetail : 'Ошибка регистрации',
          original: responseData
        });
      }
      
      // Успешный ответ с данными пользователя
      console.log('[REGISTER-DIRECT] Успешная регистрация пользователя');
      
      return res.status(201).json({
        id: responseData.id,
        email: responseData.email,
        full_name: responseData.full_name,
        role: responseData.role,
        message: 'Пользователь успешно зарегистрирован',
        original: responseData
      });
    } catch (fetchError: any) {
      // Детальное логирование ошибки fetch
      console.error('[REGISTER-DIRECT] Ошибка при выполнении fetch:', {
        message: fetchError.message,
        stack: fetchError.stack?.split('\n').slice(0, 3).join('\n'),
        cause: fetchError.cause,
        url: `${backendUrl}/auth/register`,
        network_status: typeof navigator !== 'undefined' ? (navigator.onLine ? 'online' : 'offline') : 'unknown'
      });
      
      // Пробуем альтернативный эндпоинт, если основной недоступен
      try {
        console.log('[REGISTER-DIRECT] Пробуем альтернативный эндпоинт для регистрации');
        const fallbackUrl = process.env.NEXT_PUBLIC_API_FALLBACK_URL || `${backendUrl}/auth/users/register`;
        
        const fallbackResponse = await fetch(fallbackUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Origin': process.env.NEXT_PUBLIC_FRONTEND_URL || 'http://localhost:3000',
            'X-Fallback-Request': 'true'
          },
          body: JSON.stringify(userData),
        });
        
        if (!fallbackResponse.ok) {
          throw new Error(`Ошибка на резервном эндпоинте: ${fallbackResponse.status}`);
        }
        
        const fallbackData = await fallbackResponse.json();
        
        console.log('[REGISTER-DIRECT] Успешная регистрация через резервный эндпоинт');
        
        return res.status(201).json({
          id: fallbackData.id,
          email: fallbackData.email,
          full_name: fallbackData.full_name,
          role: fallbackData.role,
          message: 'Пользователь успешно зарегистрирован (через резервный эндпоинт)',
          original: fallbackData
        });
      } catch (fallbackError: any) {
        console.error('[REGISTER-DIRECT] Резервный эндпоинт тоже недоступен:', fallbackError);
        
        // Возвращаем понятное сообщение об ошибке
        return res.status(503).json({
          detail: `Сервер временно недоступен. Пожалуйста, попробуйте позже.`,
          error: {
            message: fetchError.message,
            type: fetchError.name || 'FetchError'
          }
        });
      }
    }
  } catch (error: any) {
    // Обработка непредвиденных ошибок с подробным логированием
    console.error('[REGISTER-DIRECT] Критическая ошибка:', {
      message: error.message,
      name: error.name,
      stack: error.stack?.split('\n').slice(0, 5).join('\n')
    });
    
    return res.status(500).json({
      detail: 'Внутренняя ошибка сервера: ' + (error.message || 'Неизвестная ошибка'),
      error: {
        message: error.message,
        type: error.name || 'ServerError'
      }
    });
  }
} 