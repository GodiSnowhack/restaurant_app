import { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';

const BACKEND_URL = 'https://backend-production-1a78.up.railway.app';

export default async function profileProxy(req: NextApiRequest, res: NextApiResponse) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ detail: 'Метод не поддерживается' });
  }

  try {
    // Получаем токен из заголовка
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ detail: 'Отсутствует токен авторизации' });
    }

    console.log('Profile Proxy - Отправка запроса на', `${BACKEND_URL}/api/v1/users/me`);

    const response = await axios.get(
      `${BACKEND_URL}/api/v1/users/me`,
      {
        headers: {
          'Authorization': authHeader,
          'Accept': 'application/json',
          'Origin': process.env.NEXT_PUBLIC_FRONTEND_URL || '*'
        },
        maxRedirects: 5,
        timeout: 10000
      }
    );

    console.log('Profile Proxy - Ответ от сервера:', {
      status: response.status,
      hasData: !!response.data
    });

    // Возвращаем данные профиля
    return res.status(200).json(response.data);

  } catch (error: any) {
    console.error('Profile Proxy - Ошибка:', {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status
    });

    // Если есть ответ от сервера с ошибкой
    if (error.response) {
      return res.status(error.response.status).json({
        detail: error.response.data?.detail || 'Ошибка получения профиля',
        error: error.response.data
      });
    }

    // Если ошибка сети или другая
    return res.status(500).json({
      detail: 'Ошибка сервера при получении профиля',
      error: error.message
    });
  }
} 