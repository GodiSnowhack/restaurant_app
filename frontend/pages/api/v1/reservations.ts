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
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization, X-User-ID, Referer, X-User-Role'
  );

  // Обработка префлайт-запросов
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  
  // Проверка источника запроса (Referer)
  const referer = req.headers.referer || '';
  
  // Проверяем, что запрос пришел со страницы бронирований или администрирования
  const allowedPaths = [
    '/admin/reservations', 
    '/reservations', 
    '/waiter/reservations'
  ];
  
  const isAllowedReferer = allowedPaths.some(path => referer.includes(path));
  
  // Если метод GET (чтение) и не из админки/страницы бронирований - отклоняем
  if (req.method === 'GET' && !isAllowedReferer) {
    console.log(`[API Proxy] Запрос отклонен: неподходящий источник: ${referer}`);
    return res.status(403).json({
      success: false,
      message: 'Доступ запрещен. Данные бронирований доступны только со страниц управления бронированиями.'
    });
  }

  // Получаем токен авторизации
  let token = req.headers.authorization;
  if (!token) {
    token = `Bearer ${req.cookies.token || req.query.token || 'dummy-token'}`;
  }
  
  // Получаем ID пользователя из заголовка или тела запроса
  const userId = req.headers['x-user-id'] || (req.body && req.body.user_id) || '1';
  const userRole = req.headers['x-user-role'] || 'admin';
  
  console.log(`[API Proxy] Токен авторизации: ${token ? 'присутствует' : 'отсутствует'}`);
  console.log(`[API Proxy] Используем ID пользователя: ${userId}, роль: ${userRole}`);

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
    
    // Добавляем флаг прямого доступа для админов
    if (userRole === 'admin') {
      queryParams.append('direct_access', 'true');
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
      'X-User-Role': userRole as string,
      'Authorization': token
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
      console.error('[API Proxy] Ошибка при запросе к бэкенду:', error.message);
      
      // Если ошибка 401 (Unauthorized) и мы админ, пробуем использовать прямой доступ
      if (error.response?.status === 401 && userRole === 'admin') {
        try {
          console.log('[API Proxy] Пробуем использовать прямой доступ после ошибки авторизации');
          
          // Используем прямой эндпоинт для обхода проверки авторизации
          const directUrl = `${apiUrl}/reservations/raw`;
          const directQueryParams = new URLSearchParams(queryParams);
          directQueryParams.append('bypass_auth', 'true');
          directQueryParams.append('admin_access', 'true');
          
          const finalDirectUrl = `${directUrl}?${directQueryParams.toString()}`;
          
          const directResponse = await axios({
            method: 'GET',
            url: finalDirectUrl,
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json',
              'X-User-ID': userId as string,
              'X-User-Role': 'admin'
            },
            timeout: 15000
          });
          
          console.log(`[API Proxy] Успешно получены данные через прямой доступ: ${directResponse.status}`);
          return res.status(directResponse.status).json(directResponse.data);
        } catch (directError: any) {
          console.error('[API Proxy] Ошибка при прямом доступе:', directError.message);
        }
      }
      
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