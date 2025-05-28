import type { NextApiRequest, NextApiResponse } from 'next';
import { getDefaultApiUrl } from '../../src/config/defaults';

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
    console.log('Login API - Получен запрос на вход', {
      contentType: req.headers['content-type'],
      bodyType: typeof req.body,
      hasBody: !!req.body
    });

    // Извлекаем email и password в зависимости от формата данных
    let email: string | undefined;
    let password: string | undefined;

    // Обрабатываем разные форматы тела запроса
    if (req.headers['content-type']?.includes('application/json')) {
      // JSON формат
      email = req.body.email;
      password = req.body.password;
    } else if (req.headers['content-type']?.includes('application/x-www-form-urlencoded')) {
      // Form-urlencoded формат
      email = req.body.username || req.body.email;
      password = req.body.password;
    } else {
      // Для других форматов пробуем извлечь из тела напрямую
      if (typeof req.body === 'string') {
        try {
          const parsedBody = JSON.parse(req.body);
          email = parsedBody.email || parsedBody.username;
          password = parsedBody.password;
        } catch (e) {
          // Если не удалось распарсить JSON, пробуем как form-data
          const params = new URLSearchParams(req.body);
          email = params.get('email') || params.get('username') || '';
          password = params.get('password') || '';
        }
      } else if (req.body) {
        // Объект
        email = req.body.email || req.body.username;
        password = req.body.password;
      }
    }

    console.log('Login API - Извлеченные данные:', {
      hasEmail: !!email,
      hasPassword: !!password,
      emailLength: email?.length,
      passwordLength: password?.length
    });

    if (!email || !password) {
      return res.status(400).json({
        detail: 'Необходимо указать email и пароль'
      });
    }

    const baseApiUrl = getDefaultApiUrl();

    // Формируем данные для отправки
    const formData = new URLSearchParams();
    formData.append('username', email);
    formData.append('password', password);
    formData.append('grant_type', 'password');

    console.log('Login API - Отправка запроса на', `${baseApiUrl}/auth/login`);

    // Отправляем запрос на бэкенд
    const response = await fetch(`${baseApiUrl}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json'
      },
      body: formData.toString()
    });

    const data = await response.json();

    console.log('Login API - Ответ от сервера:', {
      status: response.status,
      hasToken: !!data.access_token,
      hasUser: !!data.user,
      error: data.detail || null
    });

    // Проверяем статус ответа
    if (!response.ok) {
      return res.status(response.status).json({
        detail: data.detail || 'Ошибка авторизации'
      });
    }

    // Проверяем наличие необходимых данных
    if (!data.access_token || !data.user) {
      return res.status(500).json({
        detail: 'Неполные данные от сервера авторизации'
      });
    }

    // Возвращаем данные клиенту
    return res.status(200).json({
      access_token: data.access_token,
      token_type: data.token_type,
      user: data.user
    });

  } catch (error: any) {
    console.error('Login API - Ошибка:', error);
    return res.status(500).json({
      detail: 'Внутренняя ошибка сервера',
      error: error.message
    });
  }
} 