import { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';

/**
 * API-прокси для создания комбинированного отзыва (о заказе и обслуживании)
 */
export default async function createCombinedReviewProxy(req: NextApiRequest, res: NextApiResponse) {
  // Устанавливаем CORS заголовки
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

  // Проверяем метод запроса
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      message: 'Метод не поддерживается'
    });
  }

  try {
    // Проверяем наличие токена авторизации
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({
        success: false,
        message: 'Отсутствует токен авторизации'
      });
    }

    // Проверяем наличие необходимых данных в теле запроса
    const { order_id, food_rating, service_rating, comment } = req.body;

    console.log('Reviews API - Данные запроса:', {
      order_id,
      food_rating,
      service_rating,
      comment,
      headers: req.headers
    });

    if (!order_id || !food_rating || !service_rating) {
      return res.status(400).json({
        success: false,
        message: 'Отсутствуют необходимые данные для создания отзыва',
        received_data: {
          order_id,
          food_rating,
          service_rating,
          comment
        }
      });
    }

    // Получаем URL API из переменных окружения
    let apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://backend-production-1a78.up.railway.app/api/v1';
    // Убираем /api/v1, если он уже есть в apiUrl
    apiUrl = apiUrl.replace(/\/api\/v1$/, '');
    const endpoint = `${apiUrl}/api/v1/reviews/combined`;

    console.log('Reviews API - Отправка запроса:', {
      url: endpoint,
      data: req.body,
      headers: { Authorization: authHeader }
    });

    // Отправляем запрос на бэкенд
    const response = await axios.post(endpoint, req.body, {
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      timeout: 10000
    });

    console.log('Reviews API - Успешный ответ:', response.data);

    return res.status(200).json({
      success: true,
      message: 'Отзыв успешно создан',
      data: response.data
    });

  } catch (error: any) {
    console.error('Reviews API - Ошибка:', error.response?.data || error.message);

    // Формируем информативное сообщение об ошибке
    const statusCode = error.response?.status || 500;
    const errorMessage = error.response?.data?.detail || error.response?.data?.message || error.message || 'Неизвестная ошибка';

    return res.status(statusCode).json({
      success: false,
      message: 'Не удалось создать отзыв',
      error: errorMessage,
      detail: error.response?.data?.detail || errorMessage
    });
  }
} 