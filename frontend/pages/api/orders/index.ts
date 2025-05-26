import { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';
import { getSecureApiUrl } from '../../../lib/utils/api';

/**
 * API-прокси для работы с заказами
 * Обрабатывает CORS и проксирует запросы к основному API
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Настройка CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST,PUT,DELETE,PATCH');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization, X-User-ID, X-User-Role'
  );

  // Обработка префлайт-запросов
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Получаем токен авторизации
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Отсутствует токен авторизации'
    });
  }

  try {
    const { start_date, end_date } = req.query;
    
    // Используем безопасный URL для API
    const baseUrl = getSecureApiUrl();
    
    // Формируем URL с параметрами
    const queryParams = new URLSearchParams();
    if (start_date) queryParams.append('start_date', start_date as string);
    if (end_date) queryParams.append('end_date', end_date as string);
    
    const url = `${baseUrl}/orders${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
    
    console.log('Прокси заказов: отправка запроса к:', url);
    
    const response = await axios.get(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-User-ID': req.headers['x-user-id'] as string,
        'X-User-Role': req.headers['x-user-role'] as string
      }
    });

    return res.status(200).json(response.data);
  } catch (error: any) {
    console.error('Ошибка при получении заказов:', error);
    
    // Проверяем тип ошибки
    if (error.response) {
      // Ответ получен, но статус не 2xx
      return res.status(error.response.status).json({
        success: false,
        message: error.response.data?.message || 'Ошибка при получении данных',
        error: error.message
      });
    } else if (error.request) {
      // Запрос отправлен, но ответ не получен
      return res.status(503).json({
        success: false,
        message: 'Сервер недоступен',
        error: error.message
      });
    } else {
      // Ошибка при настройке запроса
      return res.status(500).json({
        success: false,
        message: 'Внутренняя ошибка сервера',
        error: error.message
      });
    }
  }
} 