import type { NextApiRequest, NextApiResponse } from 'next';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://backend-production-1a78.up.railway.app/api/v1';

/**
 * API-прокси для авторизации пользователей
 * Обрабатывает авторизацию для всех типов клиентов, включая мобильные устройства
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    console.log('Login Proxy - Отправка запроса авторизации на', `${API_URL}/auth/login`);

    const response = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(req.body),
    });

    const data = await response.json();

    console.log('Login Proxy - Ответ от сервера:', {
      status: response.status,
      hasData: !!data,
      hasToken: !!data.access_token,
      role: data.user?.role
    });

    if (!response.ok) {
      throw new Error(data.detail || 'Ошибка авторизации');
    }

    // Проверяем наличие необходимых данных
    if (!data.access_token || !data.user) {
      throw new Error('Неверный формат ответа от сервера');
    }

    // Возвращаем данные клиенту
    return res.status(200).json(data);
  } catch (error: any) {
    console.error('Login Proxy - Ошибка:', error.message);
    return res.status(error.status || 500).json({
      message: error.message || 'Internal server error'
    });
  }
} 