import { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';

/**
 * API-прокси для получения рейтинга официанта
 */
export default async function waiterRatingProxy(req: NextApiRequest, res: NextApiResponse) {
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
    // Получаем ID официанта из параметров URL
    const { id } = req.query;
    
    if (!id || Array.isArray(id)) {
      return res.status(400).json({ message: 'Неверный ID официанта' });
    }
    
    const waiterId = id;
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';
    const endpoint = `${apiUrl}/reviews/waiter/${waiterId}/rating`;
    
    console.log(`Reviews API - Отправка запроса на получение рейтинга официанта ${waiterId}`);
    
    // Передаем токен авторизации, если он есть в заголовках запроса
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };
    
    const authHeader = req.headers.authorization;
    if (authHeader) {
      headers['Authorization'] = authHeader;
    }
    
    // Выполняем запрос к бэкенду
    const response = await axios.get(
      endpoint,
      { headers, timeout: 10000 }
    );
    
    console.log(`Reviews API - Успешное получение рейтинга официанта ${waiterId}`);
    
    // Возвращаем успешный ответ
    return res.status(response.status).json(response.data);
  } catch (error: any) {
    console.error('Reviews API - Ошибка при получении рейтинга официанта:', error.message);
    
    // Формируем информативное сообщение об ошибке
    let errorMessage = 'Ошибка при получении рейтинга';
    let statusCode = 500;
    let errorData = {};
    
    if (error.response) {
      statusCode = error.response.status;
      errorMessage = `Ошибка сервера: ${statusCode}`;
      errorData = error.response.data || {};
      
      if (typeof errorData === 'object' && errorData !== null && 'detail' in errorData) {
        errorMessage = errorData.detail as string;
      }
    } else if (error.code === 'ECONNABORTED') {
      errorMessage = 'Превышено время ожидания ответа от сервера';
      statusCode = 504;
    }
    
    // Возвращаем заглушку с рейтингом 0
    return res.status(200).json({
      average_rating: 0,
      total_reviews: 0,
      message: errorMessage,
      ...errorData
    });
  }
} 