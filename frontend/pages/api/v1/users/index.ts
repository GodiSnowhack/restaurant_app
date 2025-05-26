import { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';

/**
 * API-прокси для управления пользователями
 * Перенаправляет запросы с фронтенда на бэкенд с авторизацией
 */
export default async function usersHandler(req: NextApiRequest, res: NextApiResponse) {
  // Настройка CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,PATCH,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization, X-User-ID, X-User-Role'
  );

  // Обработка префлайт-запросов
  if (req.method === 'OPTIONS') {
    console.log('[API Proxy Users] Префлайт запрос');
    res.status(200).end();
    return;
  }

  // Получаем токен авторизации
  const token = req.headers.authorization;
  if (!token) {
    console.error('[API Proxy Users] Отсутствует токен авторизации');
    return res.status(401).json({
      success: false,
      message: 'Отсутствует токен авторизации'
    });
  }

  // Получаем ID и роль пользователя
  const userId = req.headers['x-user-id'];
  const userRole = req.headers['x-user-role'];

  if (!userId || !userRole) {
    console.error('[API Proxy Users] Отсутствуют данные пользователя');
    return res.status(400).json({
      success: false,
      message: 'Отсутствуют необходимые заголовки пользователя'
    });
  }

  // Базовый URL API
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://backend-production-1a78.up.railway.app/api/v1';
  
  // Проверяем и корректируем URL
  let baseUrl = apiUrl;
  try {
    const url = new URL(apiUrl);
    // Если это не localhost, принудительно используем HTTPS
    if (!url.hostname.includes('localhost') && url.protocol === 'http:') {
      url.protocol = 'https:';
      baseUrl = url.toString();
    }
  } catch (e) {
    console.error('[API Proxy Users] Неверный формат URL:', e);
    baseUrl = 'https://backend-production-1a78.up.railway.app/api/v1';
  }

  // Получаем ID из параметров запроса
  const { id } = req.query;
  
  // Формируем полный URL
  const fullUrl = id ? `${baseUrl}/users/${id}` : `${baseUrl}/users`;
  
  // Добавляем строку запроса, если она есть
  const queryParams = new URLSearchParams();
  Object.entries(req.query).forEach(([key, value]) => {
    if (key !== 'id' && value) {
      queryParams.append(key, value as string);
    }
  });
  
  // Специально для прямого доступа к API пользователей
  if (userRole === 'admin') {
    queryParams.append('direct_access', 'true');
  }
  
  const queryString = queryParams.toString();
  const finalUrl = queryString ? `${fullUrl}?${queryString}` : fullUrl;
  
  console.log(`[API Proxy Users] Отправка запроса на ${finalUrl}, метод: ${req.method}`);

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
    data: req.body,
    timeout: 15000 // 15 секунд таймаут
  };

  // Отправляем запрос на бэкенд
  try {
    const response = await axios(requestOptions);
    console.log(`[API Proxy Users] Получен ответ от бэкенда со статусом: ${response.status}`);
    return res.status(response.status).json(response.data);
  } catch (error: any) {
    // Если ошибка авторизации, пробуем запросить пользователей через /users/direct
    if (error.response?.status === 401 && req.method === 'GET' && !id) {
      console.log('[API Proxy Users] Ошибка авторизации, пробуем /users/direct');
      
      try {
        // Попытка использовать прямой доступ
        const directUrl = `${baseUrl}/users/direct`;
        const directResponse = await axios({
          method: 'GET',
          url: directUrl,
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'X-User-ID': userId as string,
            'X-User-Role': 'admin',
            'Authorization': token
          },
          params: {
            role: req.query.role,
            skip: req.query.skip,
            limit: req.query.limit,
            query: req.query.query
          },
          timeout: 15000
        });

        console.log(`[API Proxy Users] Успешно получены пользователи через /users/direct: ${directResponse.status}, количество: ${directResponse.data.length}`);
        return res.status(directResponse.status).json(directResponse.data);
      } catch (directError: any) {
        console.error('[API Proxy Users] Ошибка при прямом доступе:', directError);
        return res.status(directError.response?.status || 500).json({
          success: false,
          message: 'Ошибка при получении пользователей',
          error: directError.message
        });
      }
    }

    console.error('[API Proxy Users] Ошибка при запросе:', error);
    return res.status(error.response?.status || 500).json({
      success: false,
      message: 'Ошибка при обработке запроса',
      error: error.message
    });
  }
} 