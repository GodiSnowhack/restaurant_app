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
    
    // Формируем конечные точки, которые нужно попробовать для авторизации
    const endpoints = [
      { name: 'стандартный', url: `${apiUrl}/auth/login`, contentType: 'application/json' },
      { name: 'token', url: `${apiUrl}/token`, contentType: 'application/x-www-form-urlencoded' }
    ];
    
    // Формируем различные форматы данных для запросов
    let dataFormats = [
      { 
        name: 'json-username',
        format: (u: string, p: string) => JSON.stringify({ username: u, password: p }),
        contentType: 'application/json'
      },
      { 
        name: 'json-email',
        format: (u: string, p: string) => JSON.stringify({ email: u, password: p }),
        contentType: 'application/json'
      },
      { 
        name: 'form-username',
        format: (u: string, p: string) => new URLSearchParams({ username: u, password: p }).toString(),
        contentType: 'application/x-www-form-urlencoded'
      },
      { 
        name: 'form-email',
        format: (u: string, p: string) => new URLSearchParams({ email: u, password: p }).toString(),
        contentType: 'application/x-www-form-urlencoded'
      },
      { 
        name: 'oauth2',
        format: (u: string, p: string) => new URLSearchParams({ 
          grant_type: 'password',
          username: u,
          password: p
        }).toString(),
        contentType: 'application/x-www-form-urlencoded'
      }
    ];
    
    // Перемещаем форматы urlencoded в начало для мобильных устройств
    if (isMobile) {
      // Для мобильных устройств первым пробуем form-urlencoded формат, который работает с OAuth2PasswordRequestForm
      dataFormats = [
        // Выбираем работающие форматы первыми
        ...dataFormats.filter(format => ['form-username', 'form-email', 'oauth2'].includes(format.name)),
        // Оставшиеся форматы добавляем потом
        ...dataFormats.filter(format => !['form-username', 'form-email', 'oauth2'].includes(format.name))
      ];
      console.log('Auth API - Оптимизирован порядок запросов для мобильного устройства');
    }
    
    // Увеличенный таймаут для мобильных устройств
    const timeout = isMobile ? 60000 : 15000;
    
    // Переменные для отслеживания результатов
    let authSuccess = false;
    let authResult: any = null;
    let lastError: any = null;
    let attempts = 0;
    const maxAttempts = isMobile ? 6 : 3; // Больше попыток для мобильных устройств
    
    // Пробуем все комбинации endpoints и dataFormats
    endpointLoop: for (const endpoint of endpoints) {
      for (const dataFormat of dataFormats) {
        if (attempts >= maxAttempts) break endpointLoop;
        attempts++;
        
        try {
          console.log(`Auth API - Попытка #${attempts}: ${endpoint.name} + ${dataFormat.name}`);
          
          const requestBody = dataFormat.format(username, password);
          const useContentType = dataFormat.contentType;
          
          const response = await axios({
            method: 'POST',
            url: endpoint.url,
            data: requestBody,
            headers: {
              'Content-Type': useContentType,
              'Accept': 'application/json',
              'User-Agent': userAgent,
              'X-Client-Type': isMobile ? 'mobile' : 'desktop',
              'X-Forwarded-For': String(clientIp),
              'X-Attempt': String(attempts)
            },
            timeout,
            validateStatus: (status) => status < 500 // Отклоняем только серверные ошибки 5xx
          });
          
          console.log(`Auth API - Ответ от ${endpoint.name} (попытка #${attempts}): ${response.status}`);
          
          // Если получили успешный ответ
          if (response.status === 200 && response.data && response.data.access_token) {
            authSuccess = true;
            authResult = response.data;
            console.log(`Auth API - Успешная авторизация через ${endpoint.name} + ${dataFormat.name}`);
            break endpointLoop;
          }
          
          // Сохраняем данные последней ошибки
          if (response.status !== 200) {
            lastError = {
              status: response.status,
              data: response.data,
              endpoint: endpoint.name,
              format: dataFormat.name
            };
            
            // Если получили 401 (неверные учетные данные), нет смысла пробовать другие форматы
            if (response.status === 401) {
              console.log('Auth API - Получен 401, прекращаем попытки');
              break endpointLoop;
            }
          }
        } catch (error: any) {
          console.error(`Auth API - Ошибка при попытке ${attempts} (${endpoint.name} + ${dataFormat.name}):`, error.message);
          
          lastError = {
            message: error.message,
            code: error.code,
            endpoint: endpoint.name,
            format: dataFormat.name
          };
          
          // Ждем перед следующей попыткой
          if (attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }
      }
    }
    
    if (authSuccess && authResult) {
      // Возвращаем токен клиенту
      const duration = Date.now() - startTime;
      console.log(`Auth API - Авторизация успешна, время: ${duration}ms`);
      
      return res.status(200).json({
        ...authResult,
        auth_method: 'proxy',
        duration
      });
    } else {
      // Формируем информативное сообщение об ошибке
      console.error('Auth API - Не удалось авторизоваться после всех попыток');
      
      // Определяем подходящий код состояния и сообщение об ошибке
      let statusCode = 400;
      let errorMessage = 'Неизвестная ошибка авторизации';
      let errorDetail = 'Не удалось авторизоваться после нескольких попыток';
      let fieldErrors = {};
      
      if (lastError) {
        if (lastError.status === 401) {
          statusCode = 401;
          errorMessage = 'Неверное имя пользователя или пароль';
          errorDetail = 'Проверьте правильность введенных данных';
        } else if (lastError.status === 403) {
          statusCode = 403;
          errorMessage = 'Доступ запрещен';
          errorDetail = 'У вас нет прав доступа к системе';
        } else if (lastError.status === 422) {
          statusCode = 422;
          errorMessage = 'Ошибка валидации данных';
          errorDetail = 'Проверьте формат вводимых данных';
          
          if (lastError.data && lastError.data.detail) {
            errorDetail = lastError.data.detail;
          }
          
          if (lastError.data && lastError.data.validation_errors) {
            fieldErrors = lastError.data.validation_errors;
          }
        } else if (lastError.code === 'ECONNABORTED') {
          statusCode = 504;
          errorMessage = 'Превышено время ожидания ответа от сервера';
          errorDetail = 'Сервер не ответил в течение отведенного времени';
        } else if (lastError.code === 'ECONNREFUSED') {
          statusCode = 503;
          errorMessage = 'Не удалось подключиться к серверу';
          errorDetail = 'Сервер недоступен. Пожалуйста, попробуйте позже';
        }
      }
      
      return res.status(statusCode).json({
        detail: errorDetail,
        message: errorMessage,
        status: statusCode,
        isMobile,
        field_errors: fieldErrors,
        attempts,
        last_error: process.env.NODE_ENV === 'development' ? lastError : undefined,
        request_info: {
          has_username: !!username,
          username_length: username ? username.length : 0,
          has_password: !!password,
          client_ip: String(clientIp).slice(0, 15)
        }
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