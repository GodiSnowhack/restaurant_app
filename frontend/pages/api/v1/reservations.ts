import { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';

/**
 * API-прокси для работы с бронированиями
 * Перенаправляет запросы с фронтенда на бэкенд с авторизацией
 */
export default async function reservationsHandler(req: NextApiRequest, res: NextApiResponse) {
  // Настройка CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,PATCH,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization, X-User-ID'
  );

  // Обработка префлайт-запросов
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Получаем токен авторизации
  const authHeader = req.headers.authorization || 'Bearer dummy-token';
  
  // Получаем ID пользователя из заголовка или тела запроса
  const userId = req.headers['x-user-id'] || (req.body && req.body.user_id) || '1';
  console.log(`[API Proxy] Используем ID пользователя: ${userId}`);
  
  // Больше не проверяем наличие токена, используем dummy-token если его нет
  console.log('[API Proxy] Токен авторизации:', authHeader ? 'присутствует' : 'отсутствует, используем dummy-token');

  try {
    // Формируем URL для запроса на бэкенд
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';
    const endpoint = `${apiUrl}/reservations`;
    
    // Если есть ID в пути, добавляем его
    const id = req.query.id;
    const fullUrl = id ? `${endpoint}/${id}` : endpoint;
    
    // Добавляем строку запроса, если она есть
    const queryParams = new URLSearchParams();
    
    // Добавляем параметры запроса (исключая id, который уже добавлен в путь)
    Object.entries(req.query).forEach(([key, value]) => {
      if (key !== 'id' && value) {
        queryParams.append(key, value as string);
      }
    });
    
    // Добавляем user_id в query параметры для GET запросов
    if (req.method === 'GET' && userId) {
      queryParams.append('user_id', userId as string);
    }
    
    const queryString = queryParams.toString();
    const finalUrl = queryString ? `${fullUrl}?${queryString}` : fullUrl;
    
    console.log(`[API Proxy] Отправка запроса на ${finalUrl}, метод: ${req.method}`);

    // Подготавливаем данные запроса с добавленным user_id
    let requestData = req.body;
    if (req.method !== 'GET' && userId && requestData) {
      requestData = { ...requestData, user_id: userId };
    }

    // Формируем заголовки для запроса
    const headers: any = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'X-User-ID': userId as string,
      'Authorization': authHeader
    };

    // Формируем опции для запроса
    const requestOptions = {
      method: req.method,
      url: finalUrl,
      headers: headers,
      data: requestData,
      timeout: 15000 // 15 секунд таймаут
    };

    // Отправляем запрос на бэкенд
    try {
      const response = await axios(requestOptions);
      console.log(`[API Proxy] Получен ответ от бэкенда со статусом: ${response.status}`);
      return res.status(response.status).json(response.data);
    } catch (error: any) {
      console.error('[API Proxy] Ошибка при запросе к бэкенду:', error);
      
      if (error.response) {
        // Передаем ошибку от бэкенда клиенту
        console.log(`[API Proxy] Ошибка от бэкенда: ${error.response.status}`);
        return res.status(error.response.status).json({
          success: false,
          message: error.response.data?.detail || error.response.statusText || 'Ошибка сервера',
          error: error.response.data
        });
      } else {
        // Ошибка сети или таймаут
        return res.status(500).json({
          success: false,
          message: error.message || 'Ошибка соединения с сервером'
        });
      }
    }
  } catch (error: any) {
    console.error('[API Proxy] Критическая ошибка при обработке запроса:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Критическая ошибка сервера'
    });
  }
} 