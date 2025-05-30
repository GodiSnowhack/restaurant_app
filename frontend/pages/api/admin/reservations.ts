import { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';

/**
 * API-прокси для работы с бронированиями через админский интерфейс
 * Используется как запасной вариант, если основной прокси недоступен
 */
export default async function adminReservationsHandler(req: NextApiRequest, res: NextApiResponse) {
  // Настройка CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  // Обработка префлайт-запросов
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Получаем токен авторизации
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({
      success: false,
      message: 'Отсутствует токен авторизации'
    });
  }

  try {
    // Формируем URL для запроса на бэкенд
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
    
    // Подготавливаем URL запроса
    let endpoint = `${apiUrl}/api/v1/reservations`;
    
    // Добавляем параметры запроса
    const queryParams = new URLSearchParams();
    Object.entries(req.query).forEach(([key, value]) => {
      if (value) {
        queryParams.append(key, value as string);
      }
    });
    
    const queryString = queryParams.toString();
    const finalUrl = queryString ? `${endpoint}?${queryString}` : endpoint;
    
    console.log(`[Admin API] Отправка запроса на ${finalUrl}, метод: ${req.method}`);

    // Отправляем запрос к бэкенду
    const response = await axios({
      method: req.method,
      url: finalUrl,
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      data: req.body,
      timeout: 8000, // 8 секунд таймаут
      validateStatus: () => true // Принимаем любой статус ответа
    });

    // Если запрос неудачный и это запрос на получение списка, пробуем альтернативный URL
    if (response.status !== 200 && req.method === 'GET') {
      const alternativeUrl = `${apiUrl}/api/v1/admin/reservations`;
      console.log(`[Admin API] Пробуем альтернативный URL: ${alternativeUrl}`);
      
      const altResponse = await axios({
        method: 'GET',
        url: alternativeUrl,
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        timeout: 8000,
        validateStatus: () => true
      });
      
      if (altResponse.status === 200) {
        console.log(`[Admin API] Альтернативный запрос успешен`);
        return res.status(200).json(altResponse.data);
      }
    }

    // Возвращаем ответ от основного запроса
    return res.status(response.status).json(response.data);
  } catch (error: any) {
    console.error('[Admin API] Ошибка при обработке запроса бронирований:', error);
    
    return res.status(500).json({
      success: false,
      message: 'Внутренняя ошибка сервера',
      error: error.message
    });
  }
} 