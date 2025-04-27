import { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';

/**
 * API-прокси для заказов официанта 
 * Обрабатывает получение заказов с нескольких эндпоинтов
 */
export default async function waiterOrdersProxy(req: NextApiRequest, res: NextApiResponse) {
  // Разрешаем CORS
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
    // Получаем токен авторизации из заголовков
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ 
        detail: 'Отсутствует токен авторизации',
        message: 'Необходимо авторизоваться'
      });
    }
    
    const token = authHeader.substring(7);
    
    // Формируем основной URL для API
    const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';
    
    // Список эндпоинтов для попытки получения заказов
    const endpoints = [
      `${apiBaseUrl}/orders/waiter`,
      `${apiBaseUrl}/waiter/orders`
    ];
    
    // Информация о дополнительных попытках
    const attempts = [];
    
    // Пробуем получать данные с каждого эндпоинта, пока не получим успешный ответ
    for (const endpoint of endpoints) {
      try {
        console.log(`Waiter Orders API - Попытка получения данных с ${endpoint}`);
        
        const response = await axios.get(endpoint, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          timeout: 30000 // 30 секунд таймаут
        });
        
        // Если получили данные, возвращаем их
        if (response.status === 200) {
          const data = response.data;
          
          // Проверяем, что данные корректны
          if (Array.isArray(data)) {
            console.log(`Waiter Orders API - Успешно получено ${data.length} заказов с эндпоинта ${endpoint}`);
            return res.status(200).json(data);
          } else {
            console.warn(`Waiter Orders API - Получены некорректные данные с ${endpoint}:`, typeof data);
            attempts.push({
              endpoint,
              status: response.status,
              error: 'Получены некорректные данные (не массив)'
            });
          }
        } else {
          console.warn(`Waiter Orders API - Необычный статус ответа от ${endpoint}: ${response.status}`);
          attempts.push({
            endpoint,
            status: response.status,
            error: 'Необычный статус ответа'
          });
        }
      } catch (error: any) {
        console.error(`Waiter Orders API - Ошибка при запросе к ${endpoint}:`, error.message);
        
        attempts.push({
          endpoint,
          status: error.response?.status || 0,
          error: error.message
        });
        
        // Если получили 404, это может означать отсутствие заказов
        if (error.response?.status === 404) {
          console.log(`Waiter Orders API - Эндпоинт ${endpoint} вернул 404, возможно заказов нет`);
        }
      }
    }
    
    // Если все попытки неудачны, возвращаем пустой массив с информацией об ошибках
    console.log('Waiter Orders API - Все попытки получения заказов не удались');
    return res.status(200).json([]);
    
  } catch (error: any) {
    console.error('Waiter Orders API - Общая ошибка:', error.message);
    
    // При любой общей ошибке возвращаем пустой массив для предотвращения поломки интерфейса
    return res.status(200).json([]);
  }
} 