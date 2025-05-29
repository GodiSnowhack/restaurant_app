import type { NextApiRequest, NextApiResponse } from 'next';
import { getDefaultApiUrl } from '../../src/config/defaults';

/**
 * API-прокси для работы с заказами
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Базовый URL API
  const apiUrl = `${getDefaultApiUrl()}/orders`;
  console.log(`API Proxy: Базовый URL API: ${getDefaultApiUrl()}`);
  console.log(`API Proxy: URL API заказов: ${apiUrl}`);
  
  try {
    // Сохраняем токен авторизации из запроса
    const authHeader = req.headers.authorization;
    const userIdHeader = req.headers['x-user-id'];
    const userRoleHeader = req.headers['x-user-role'];

    // Формируем URL с параметрами
    let url = apiUrl;
    if (req.url && req.url.includes('?')) {
      const queryParams = req.url.split('?')[1];
      url = `${apiUrl}?${queryParams}`;
      console.log(`API Proxy: Параметры запроса: ?${queryParams}`);
    }

    // Настраиваем заголовки для запроса к API
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };

    // Добавляем заголовки авторизации, если они есть
    if (authHeader) {
      headers['Authorization'] = authHeader;
    }
    if (userIdHeader && typeof userIdHeader === 'string') {
      headers['X-User-ID'] = userIdHeader;
    }
    if (userRoleHeader && typeof userRoleHeader === 'string') {
      headers['X-User-Role'] = userRoleHeader;
    }

    console.log('API Proxy: Заголовки запроса:', {
      Authorization: authHeader ? 'Bearer [скрыто]' : undefined,
      'Content-Type': headers['Content-Type'],
      Accept: headers['Accept'],
      'X-User-Role': headers['X-User-Role'],
      'X-User-ID': headers['X-User-ID']
    });

    // Получаем тело запроса
    const body = req.body ? JSON.stringify(req.body) : undefined;

    // Отправляем запрос к API
    console.log(`API Proxy: Отправка запроса к API: ${url}`);
    const response = await fetch(url, {
      method: req.method,
      headers,
      body: req.method !== 'GET' && req.method !== 'HEAD' ? body : undefined,
      redirect: 'follow', // Разрешаем следовать за редиректами
    });

    // Получаем ответ
    const data = await response.json().catch(() => ({}));
    
    if (!response.ok) {
      console.log(`API Proxy: Ошибка при запросе к API: ${response.status}`);
      return res.status(response.status).json(data);
    }

    // Возвращаем успешный ответ
    return res.status(response.status).json(data);
  } catch (error) {
    console.error('API Proxy: Ошибка при запросе к API:', error);
    return res.status(500).json({ message: 'Ошибка при выполнении запроса к API' });
  }
} 