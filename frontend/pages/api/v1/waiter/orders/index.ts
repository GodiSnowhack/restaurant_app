import { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';
import { getDefaultApiUrl } from '../../../../../src/config/defaults';
import https from 'https';

/**
 * API-маршрут для получения списка заказов официанта
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Настройка CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  // Обработка префлайт-запросов
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Проверка метода запроса
  if (req.method !== 'GET') {
    return res.status(405).json({
      success: false,
      message: 'Метод не поддерживается'
    });
  }

  try {
    // Получаем токен авторизации
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      console.log('Waiter API: Отсутствует токен авторизации');
      return res.status(401).json({
        success: false,
        message: 'Отсутствует токен авторизации'
      });
    }

    // Получаем базовый URL API
    const baseApiUrl = getDefaultApiUrl();
    
    // Формируем URL для запроса к бэкенду
    const url = `${baseApiUrl}/waiter/orders`;

    console.log(`Waiter API: Отправка запроса на ${url}`);

    // Настройка HTTPS агента с отключенной проверкой сертификата
    const httpsAgent = new https.Agent({
      rejectUnauthorized: false
    });

    // Отправляем запрос к бэкенду
    try {
      const response = await axios.get(
        url,
        { 
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          httpsAgent: url.startsWith('https') ? httpsAgent : undefined,
          timeout: 10000,
          validateStatus: () => true
        }
      );

      console.log(`Waiter API: Получен ответ с кодом ${response.status}`);

      // Возвращаем полученные данные
      return res.status(response.status).json(response.data);
    } catch (fetchError: any) {
      console.error(`Waiter API: Ошибка при отправке запроса:`, fetchError.message);
      
      // В случае ошибки сети возвращаем пустой массив заказов
      return res.status(200).json([]);
    }
  } catch (error: any) {
    console.error(`Waiter API: Критическая ошибка:`, error);
    
    // В случае критической ошибки возвращаем пустой массив заказов
    return res.status(200).json([]);
  }
} 