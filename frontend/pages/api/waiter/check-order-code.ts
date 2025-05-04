import type { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';

/**
 * Обработчик API для проверки информации о коде заказа
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Настройка CORS заголовков
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

  // Получаем токен авторизации
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ detail: 'Требуется авторизация' });
  }

  try {
    // Получаем код заказа из запроса
    const { order_code } = req.body;
    
    if (!order_code) {
      return res.status(400).json({ detail: 'Отсутствует код заказа' });
    }

    console.log('[CHECK-ORDER-CODE] Проверка кода заказа:', order_code);
    
    // Получаем URL бэкенда для отправки запроса
    const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';
    
    try {
      // Отправляем запрос на бэкенд для проверки кода заказа
      const response = await axios.get(`${backendUrl}/waiter/orders/check-code/${order_code}`, {
        headers: {
          'Authorization': authHeader,
          'Accept': 'application/json'
        },
        timeout: 5000, // 5 секунд таймаут
      });
      
      // Успешный ответ с информацией о заказе
      console.log('[CHECK-ORDER-CODE] Успешный ответ:', response.data);
      
      return res.status(200).json({
        success: true,
        order_id: response.data.order_id,
        waiter_id: response.data.waiter_id,
        status: response.data.status,
        message: 'Информация о заказе получена'
      });
    } catch (apiError: any) {
      // Если бэкенд не реализовал этот эндпоинт, эмулируем ответ с базовой информацией
      console.error('[CHECK-ORDER-CODE] Ошибка при запросе к бэкенду:', apiError.message);
      
      // Пробуем альтернативный эндпоинт
      try {
        // Иногда бэкенд может иметь другой формат эндпоинта
        const altResponse = await axios.post(`${backendUrl}/waiter/check-order`, 
          { code: order_code },
          {
            headers: {
              'Authorization': authHeader,
              'Content-Type': 'application/json',
              'Accept': 'application/json'
            },
            timeout: 5000,
          }
        );
        
        console.log('[CHECK-ORDER-CODE] Успешный ответ от альтернативного эндпоинта:', altResponse.data);
        
        return res.status(200).json({
          success: true,
          ...altResponse.data
        });
      } catch (altError: any) {
        console.error('[CHECK-ORDER-CODE] Ошибка при запросе к альтернативному эндпоинту:', altError.message);
        
        // Если оба запроса не сработали, возвращаем эмуляцию ответа для совместимости
        console.log('[CHECK-ORDER-CODE] Эмуляция ответа для обеспечения совместимости');
        
        return res.status(200).json({
          success: false,
          message: 'Информация о коде заказа недоступна',
          order_id: null,
          waiter_id: null
        });
      }
    }
  } catch (error: any) {
    console.error('[CHECK-ORDER-CODE] Ошибка обработки запроса:', error);
    
    return res.status(500).json({
      detail: 'Внутренняя ошибка сервера: ' + (error.message || 'Неизвестная ошибка')
    });
  }
} 