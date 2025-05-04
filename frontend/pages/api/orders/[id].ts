import { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';

/**
 * API-прокси для работы с конкретным заказом
 * Обрабатывает CORS и проксирует запросы к основному API
 */
export default async function orderByIdProxy(req: NextApiRequest, res: NextApiResponse) {
  // Разрешаем CORS для всех клиентов
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  // Обрабатываем предварительные запросы CORS
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Проверяем, что метод поддерживается
  if (!['GET', 'PUT', 'DELETE'].includes(req.method || '')) {
    return res.status(405).json({ message: 'Метод не поддерживается' });
  }

  try {
    // Получаем ID заказа из параметров URL
    const { id } = req.query;
    
    if (!id || Array.isArray(id)) {
      return res.status(400).json({ message: 'Неверный ID заказа' });
    }
    
    const userAgent = req.headers['user-agent'] || 'Unknown';
    
    // Определяем, является ли устройство мобильным
    const isMobile = /Mobile|Android|iPhone|iPad|iPod|Windows Phone/i.test(userAgent);
    console.log(`Order API - Запрос для заказа ${id} от устройства${isMobile ? ' (мобильное)' : ''}:`, userAgent);
    
    // Формируем URL для запроса к основному API
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';
    // Добавляем параметр для принудительного обновления данных (flush=1) и timestamp для предотвращения кэширования
    const timestamp = Date.now();
    const endpoint = `${apiUrl}/orders/${id}?flush=1&_t=${timestamp}`;
    
    console.log(`Order API - Отправка ${req.method} запроса на ${endpoint} (с принудительным обновлением данных)`);
    
    // Передаем токен авторизации, если он есть в заголовках запроса
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'User-Agent': userAgent,
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    };
    
    const authHeader = req.headers.authorization;
    if (authHeader) {
      headers['Authorization'] = authHeader;
    }
    
    // Увеличенный таймаут для мобильных устройств
    const timeout = isMobile ? 30000 : 10000;
    
    try {
      // Выполняем запрос с повторными попытками
      let response = null;
      let retryCount = 0;
      const maxRetries = 2;
      
      while (retryCount < maxRetries) {
        try {
          // Выбираем правильный метод axios в зависимости от HTTP метода
          switch (req.method) {
            case 'GET':
              response = await axios.get(endpoint, {
                headers,
                timeout,
                validateStatus: (status) => status < 500, // Принимаем все ответы кроме 5xx
                // Отключаем кэширование через параметры запроса
                params: {
                  flush: 1,
                  _t: timestamp
                }
              });
              break;
            case 'PUT':
              response = await axios.put(endpoint, req.body, {
                headers,
                timeout,
                validateStatus: (status) => status < 500
              });
              break;
            case 'DELETE':
              response = await axios.delete(endpoint, {
                headers,
                timeout,
                validateStatus: (status) => status < 500
              });
              break;
            default:
              throw new Error(`Неподдерживаемый метод: ${req.method}`);
          }
          
          // Успешный запрос, выходим из цикла
          break;
        } catch (error: any) {
          retryCount++;
          console.error(`Order API - Ошибка при попытке ${retryCount}/${maxRetries}:`, error.message);
          
          if (retryCount >= maxRetries) {
            // Если все попытки исчерпаны, выбрасываем ошибку
            throw error;
          }
          
          // Ждем перед следующей попыткой
          await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
        }
      }
      
      // Проверяем, что получили успешный ответ
      if (!response) {
        throw new Error('Не удалось получить ответ от сервера');
      }
      
      // Возвращаем успешный ответ
      return res.status(response.status).json(response.data);
    } catch (apiError: any) {
      console.error('Order API - Ошибка при запросе к серверу:', apiError.message);
      
      // Для мобильных устройств пробуем прямой fetch, если axios не сработал
      if (isMobile) {
        try {
          console.log('Order API - Пробуем прямой fetch для мобильного устройства');
          
          const fetchOptions: RequestInit = {
            method: req.method,
            headers,
            ...(req.method !== 'GET' && req.method !== 'DELETE' ? { body: JSON.stringify(req.body) } : {})
          };
          
          const fetchResponse = await fetch(endpoint, fetchOptions);
          
          if (fetchResponse.ok) {
            const data = await fetchResponse.json();
            console.log('Order API - Успешный прямой fetch');
            return res.status(fetchResponse.status).json(data);
          } else {
            console.error('Order API - Ошибка прямого fetch:', fetchResponse.status);
          }
        } catch (fetchError: any) {
          console.error('Order API - Ошибка прямого fetch:', fetchError.message);
        }
      }
      
      // Формируем информативное сообщение об ошибке
      let errorMessage = 'Ошибка при работе с заказом';
      let statusCode = 500;
      let errorData = {};
      
      if (apiError.response) {
        statusCode = apiError.response.status;
        errorMessage = `Ошибка сервера: ${statusCode}`;
        errorData = apiError.response.data || {};
        
        if (typeof errorData === 'object' && errorData !== null && 'detail' in errorData) {
          errorMessage = errorData.detail as string;
        } else if (typeof errorData === 'string') {
          errorMessage = errorData;
          errorData = { message: errorData };
        }
      } else if (apiError.code === 'ECONNABORTED') {
        errorMessage = 'Превышено время ожидания ответа от сервера';
        statusCode = 504;
      } else if (apiError.code === 'ECONNREFUSED') {
        errorMessage = 'Не удалось подключиться к серверу';
        statusCode = 503;
      }
      
      return res.status(statusCode).json({
        success: false,
        message: errorMessage,
        error: apiError.message,
        ...errorData,
        isMobile,
        endpoint,
        orderId: id
      });
    }
  } catch (error: any) {
    console.error('Order API - Внутренняя ошибка:', error);
    
    return res.status(500).json({
      success: false,
      message: 'Внутренняя ошибка сервера',
      error: error.message,
      timestamp: Date.now()
    });
  }
} 