import { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';

/**
 * API-прокси для получения статуса отзыва заказа
 */
export default async function reviewStatusProxy(req: NextApiRequest, res: NextApiResponse) {
  // Устанавливаем CORS заголовки
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

  // Проверяем, что метод поддерживается
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Метод не поддерживается' });
  }

  try {
    // Получаем ID заказа из параметров URL
    const { id } = req.query;
    
    if (!id || Array.isArray(id)) {
      return res.status(400).json({ message: 'Неверный ID заказа' });
    }
    
    const orderId = id;
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';
    const endpoint = `${apiUrl}/reviews/order/${orderId}/status`;
    
    console.log(`Reviews API - Отправка запроса на проверку статуса отзыва заказа ${orderId}`);
    
    // Передаем токен авторизации, если он есть в заголовках запроса
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };
    
    const authHeader = req.headers.authorization;
    if (authHeader) {
      headers['Authorization'] = authHeader;
    } else {
      return res.status(401).json({ 
        message: 'Отсутствует токен авторизации',
        can_review: false,
        already_reviewed: false,
        order_completed: false,
        payment_completed: false
      });
    }
    
    // Выполняем запрос к бэкенду
    const response = await axios.get(
      endpoint,
      { headers, timeout: 10000 }
    );
    
    console.log(`Reviews API - Успешная проверка статуса отзыва заказа ${orderId}`);
    
    // Возвращаем успешный ответ
    return res.status(response.status).json(response.data);
  } catch (error: any) {
    console.error('Reviews API - Ошибка при проверке статуса отзыва:', error.message);
    
    // Формируем информативное сообщение об ошибке
    let errorMessage = 'Ошибка при проверке статуса отзыва';
    let statusCode = 500;
    let errorData = {};
    
    // Формируем заглушку для ответа в случае ошибки
    const fallbackResponse = {
      can_review: false,
      already_reviewed: false,
      order_completed: false,
      payment_completed: false,
      error: true
    };
    
    if (error.response) {
      statusCode = error.response.status;
      errorMessage = `Ошибка сервера: ${statusCode}`;
      errorData = error.response.data || {};
      
      if (typeof errorData === 'object' && errorData !== null && 'detail' in errorData) {
        errorMessage = errorData.detail as string;
      }
      
      // Для случая 404 (заказ не найден или не существует), возвращаем заглушку с возможностью оставить отзыв
      if (statusCode === 404) {
        return res.status(200).json({
          can_review: true, // Разрешаем оставлять отзыв
          already_reviewed: false,
          order_completed: true, // Считаем, что заказ выполнен
          payment_completed: true, // Считаем, что оплата завершена
          error: true,
          message: 'Заказ не найден в системе отзывов, но вы можете оставить отзыв'
        });
      }
    } else if (error.code === 'ECONNABORTED') {
      errorMessage = 'Превышено время ожидания ответа от сервера';
      statusCode = 504;
    }
    
    // Возвращаем заглушку с информацией об ошибке
    return res.status(200).json({
      ...fallbackResponse,
      message: errorMessage,
      ...errorData
    });
  }
} 