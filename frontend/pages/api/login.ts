import { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';
import cookie from 'cookie';

/**
 * API-прокси для авторизации пользователей
 * Обрабатывает авторизацию для всех типов клиентов, включая мобильные устройства
 */
export default async function loginProxy(req: NextApiRequest, res: NextApiResponse) {
  // Разрешаем CORS для всех клиентов
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  // Обрабатываем предварительные запросы CORS
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

    console.log('Login Proxy - Отправка запроса авторизации');

    const response = await axios.post(
      'https://backend-production-1a78.up.railway.app/api/v1/auth/login',
      formData,
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json'
        },
        validateStatus: (status) => true // Принимаем любой статус для обработки ошибок
      }
    );

    console.log('Login Proxy - Получен ответ:', {
      status: response.status,
      hasData: !!response.data,
      hasToken: response.data?.access_token ? 'yes' : 'no'
    });

    // Проверяем статус ответа
    if (response.status === 401) {
      return res.status(401).json({ detail: 'Неверные учетные данные' });
    }

    if (response.status !== 200) {
      return res.status(response.status).json({ 
        detail: response.data?.detail || 'Ошибка авторизации',
        status: response.status
      });
    }

    // Проверяем наличие токена
    if (!response.data?.access_token) {
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
        path: '/'
      })
    ]);

    // Возвращаем токен
    return res.status(200).json({
      access_token: token,
      token_type: 'bearer'
    });

  } catch (error: any) {
    console.error('Login Proxy - Ошибка:', error.response?.data || error.message);

    // Возвращаем информативную ошибку
    return res.status(500).json({
      detail: 'Ошибка сервера при авторизации',
      error: error.response?.data?.detail || error.message
    });
  }
} 