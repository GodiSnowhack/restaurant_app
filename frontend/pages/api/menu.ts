import { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';

/**
 * API-прокси для получения меню и категорий
 * Используется как для десктопных, так и для мобильных устройств
 */
export default async function menuProxy(req: NextApiRequest, res: NextApiResponse) {
  // Разрешаем CORS для всех клиентов
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  // Обрабатываем предварительные запросы CORS
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Метод не поддерживается' });
  }

  try {
    const userAgent = req.headers['user-agent'] || 'Unknown';
    
    // Определяем, является ли устройство мобильным
    const isMobile = /Mobile|Android|iPhone|iPad|iPod|Windows Phone/i.test(userAgent);
    console.log(`Menu API - Запрос от устройства${isMobile ? ' (мобильное)' : ''}:`, userAgent);
    
    // Получаем указанный метод из параметров URL или используем 'categories' по умолчанию
    const { method = 'categories', category_id, is_vegetarian, is_vegan, available_only } = req.query;
    
    // Формируем URL для запроса к основному API
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';
    let endpoint = '';
    
    // Определяем конечную точку в зависимости от метода
    if (method === 'categories' || method === 'get-categories') {
      endpoint = `${apiUrl}/menu/categories`;
    } else if (method === 'dishes' || method === 'get-dishes') {
      endpoint = `${apiUrl}/menu/dishes`;
    } else if (method === 'dish' && req.query.id) {
      endpoint = `${apiUrl}/menu/dishes/${req.query.id}`;
    } else {
      return res.status(400).json({ message: 'Неверный метод или отсутствует id для получения блюда' });
    }
    
    // Добавляем query-параметры, если это запрос блюд
    if ((method === 'dishes' || method === 'get-dishes') && 
        (category_id || is_vegetarian || is_vegan || available_only)) {
      const params = new URLSearchParams();
      
      if (category_id) params.append('category_id', category_id.toString());
      if (is_vegetarian) params.append('is_vegetarian', is_vegetarian.toString());
      if (is_vegan) params.append('is_vegan', is_vegan.toString());
      if (available_only) params.append('available_only', available_only.toString());
      
      endpoint = `${endpoint}?${params.toString()}`;
    }
    
    console.log(`Menu API - Отправка запроса на ${endpoint}`);
    
    // Делаем запрос к основному API с передачей токена авторизации, если он есть
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'User-Agent': userAgent
    };
    
    // Передаем токен авторизации, если он есть в заголовках запроса
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
      const maxRetries = 3;
      
      while (retryCount < maxRetries) {
        try {
          response = await axios.get(endpoint, {
            headers,
            timeout,
            validateStatus: (status) => status < 500 // Принимаем все ответы кроме 5xx
          });
          
          // Успешный запрос, выходим из цикла
          break;
        } catch (error: any) {
          retryCount++;
          console.error(`Menu API - Ошибка при попытке ${retryCount}/${maxRetries}:`, error.message);
          
          if (retryCount >= maxRetries) {
            // Если все попытки исчерпаны, выбрасываем ошибку
            throw error;
          }
          
          // Ждем перед следующей попыткой (с увеличением времени)
          await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
        }
      }
      
      // Проверяем, что получили успешный ответ
      if (!response) {
        throw new Error('Не удалось получить ответ от сервера');
      }
      
      // Если статус 4xx, возвращаем ошибку
      if (response.status >= 400 && response.status < 500) {
        console.error(`Menu API - Ошибка ${response.status}:`, response.data);
        
        return res.status(response.status).json({
          success: false,
          message: `Ошибка при получении данных: ${response.status}`,
          error: response.data,
          endpoint
        });
      }
      
      console.log(`Menu API - Получен успешный ответ от сервера`);
      
      // Возвращаем успешный ответ
      return res.status(200).json(response.data);
    } catch (apiError: any) {
      console.error('Menu API - Ошибка при запросе к серверу:', apiError.message);
      
      // Для мобильных устройств пробуем сделать прямой запрос
      if (isMobile) {
        try {
          console.log('Menu API - Пробуем прямой fetch для мобильного устройства');
          
          const fetchResponse = await fetch(endpoint, {
            method: 'GET',
            headers
          });
          
          if (fetchResponse.ok) {
            const data = await fetchResponse.json();
            console.log('Menu API - Успешный прямой fetch');
            return res.status(200).json(data);
          } else {
            console.error('Menu API - Ошибка прямого fetch:', fetchResponse.status);
          }
        } catch (fetchError: any) {
          console.error('Menu API - Ошибка прямого fetch:', fetchError.message);
        }
      }
      
      // Формируем информативное сообщение об ошибке
      let errorMessage = 'Ошибка при получении данных';
      let statusCode = 500;
      
      if (apiError.response) {
        statusCode = apiError.response.status;
        errorMessage = `Ошибка сервера: ${statusCode}`;
        
        if (apiError.response.data) {
          if (typeof apiError.response.data === 'object' && apiError.response.data.detail) {
            errorMessage = apiError.response.data.detail;
          } else if (typeof apiError.response.data === 'string') {
            errorMessage = apiError.response.data;
          }
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
        isMobile,
        endpoint
      });
    }
  } catch (error: any) {
    console.error('Menu API - Внутренняя ошибка:', error);
    
    return res.status(500).json({
      success: false,
      message: 'Внутренняя ошибка сервера',
      error: error.message,
      timestamp: Date.now()
    });
  }
} 