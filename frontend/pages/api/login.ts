import { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';
import cookie from 'cookie';

const BACKEND_URL = 'https://backend-production-1a78.up.railway.app';

/**
 * API-прокси для авторизации пользователей
 * Обрабатывает авторизацию для всех типов клиентов, включая мобильные устройства
 */
export default async function loginProxy(req: NextApiRequest, res: NextApiResponse) {
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
    return res.status(405).json({ detail: 'Метод не поддерживается' });
  }

  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ detail: 'Email и пароль обязательны' });
    }

    // Формируем данные для отправки
    const formData = new URLSearchParams();
    formData.append('username', email);
    formData.append('password', password);

    console.log('Login Proxy - Отправка запроса авторизации на', `${BACKEND_URL}/api/v1/auth/login`);

    const response = await axios.post(
      `${BACKEND_URL}/api/v1/auth/login`,
      formData,
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json',
          'Origin': process.env.NEXT_PUBLIC_FRONTEND_URL || '*'
        },
        maxRedirects: 5,
        timeout: 10000
      }
    );

    console.log('Login Proxy - Ответ от сервера:', {
      status: response.status,
      hasData: !!response.data,
      hasToken: !!response.data?.access_token
    });

    // Проверяем наличие токена в ответе
    if (!response.data?.access_token) {
      console.error('Login Proxy - Нет токена в ответе:', response.data);
      return res.status(400).json({ detail: 'Не получен токен доступа' });
    }

    const token = response.data.access_token;

    // Устанавливаем cookie
    res.setHeader('Set-Cookie', [
      cookie.serialize('auth_token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 7,
        path: '/',
        domain: process.env.COOKIE_DOMAIN || undefined
      })
    ]);

    // Возвращаем успешный ответ
    return res.status(200).json({
      access_token: token,
      token_type: 'bearer'
    });

  } catch (error: any) {
    console.error('Login Proxy - Ошибка:', {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status,
      config: {
        url: error.config?.url,
        method: error.config?.method,
        headers: error.config?.headers
      }
    });

    // Если есть ответ от сервера с ошибкой
    if (error.response) {
      return res.status(error.response.status).json({
        detail: error.response.data?.detail || 'Ошибка авторизации',
        error: error.response.data
      });
    }

    // Если ошибка сети или другая
    return res.status(500).json({
      detail: 'Ошибка сервера при авторизации',
      error: error.message
    });
  }
} 