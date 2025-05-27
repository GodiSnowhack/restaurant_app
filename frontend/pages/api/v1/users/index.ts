import { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';
import { getSecureApiUrl } from '../../../../lib/utils/api';

/**
 * API-прокси для управления пользователями
 * Перенаправляет запросы с фронтенда на бэкенд с авторизацией
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
  const token = req.headers.authorization;
  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Отсутствует токен авторизации'
    });
  }

  // Получаем ID и роль пользователя
  const userId = req.headers['x-user-id'];
  const userRole = req.headers['x-user-role'];

  if (!userId || !userRole) {
    return res.status(400).json({
      success: false,
      message: 'Отсутствуют необходимые заголовки пользователя'
    });
  }

  // Проверяем права доступа
  if (userRole !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Недостаточно прав для доступа к API пользователей'
    });
  }

  try {
    // Создаем экземпляр axios с настройками
    const api = axios.create({
      baseURL: getSecureApiUrl(),
      headers: {
        'Authorization': token,
        'X-User-ID': userId,
        'X-User-Role': userRole,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      maxRedirects: 2, // Ограничиваем количество редиректов
      validateStatus: (status) => {
        return (status >= 200 && status < 300) || (status === 307 || status === 308);
      }
    });

    // Формируем URL с учетом query параметров
    const queryString = new URLSearchParams(req.query as Record<string, string>).toString();
    const url = `/users${queryString ? `?${queryString}` : ''}`;

    // Отправляем запрос на бэкенд
    console.log('Отправка запроса на бэкенд:', {
      method: req.method,
      url,
      headers: {
        'Authorization': token,
        'X-User-ID': userId,
        'X-User-Role': userRole
      }
    });

    const response = await api.request({
      method: req.method as string,
      url,
      data: req.body,
      maxRedirects: 5
    });

    // Проверяем на редирект
    if (response.status === 307 || response.status === 308) {
      const location = response.headers.location;
      if (location) {
        console.log('Получен редирект на:', location);
        const redirectResponse = await api.request({
          method: req.method as string,
          url: location,
          data: req.body,
          maxRedirects: 5
        });
        return res.status(redirectResponse.status).json(redirectResponse.data);
      }
    }

    // Возвращаем данные
    return res.status(response.status).json(response.data);
  } catch (error: any) {
    console.error('Прокси: ошибка при получении пользователей:', error);
    
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