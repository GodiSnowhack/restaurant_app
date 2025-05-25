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
    console.log('Login API - Отправка запроса авторизации:', {
      url: `${API_URL}/auth/login`,
      body: { email: req.body.email }
    });

    const formData = new URLSearchParams();
    formData.append('username', req.body.email);
    formData.append('password', req.body.password);

    const response = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
      },
      body: formData.toString(),
    });

    const data = await response.json();

    console.log('Login API - Ответ от сервера:', {
      status: response.status,
      hasData: !!data,
      error: !response.ok ? data : null
    });

    if (!response.ok) {
      // Возвращаем ошибку с сервера в правильном формате
      return res.status(response.status).json({
        message: data.detail || data.message || 'Ошибка авторизации',
        errors: data.errors || []
      });
    }

    // Проверяем наличие необходимых данных
    if (!data.access_token || !data.user) {
      console.error('Login API - Неверный формат ответа:', data);
      return res.status(500).json({
        message: 'Неверный формат ответа от сервера'
      });
    }

    // Возвращаем данные клиенту
    return res.status(200).json(data);
  } catch (error: any) {
    console.error('Login API - Ошибка:', error);
    return res.status(500).json({
      message: error.message || 'Внутренняя ошибка сервера',
      error: process.env.NODE_ENV === 'development' ? error : undefined
    });
  }
} 