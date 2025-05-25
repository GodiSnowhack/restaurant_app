import type { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';

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
    const { email, password } = req.body;

    console.log('Login API - Получены данные:', { 
      email,
      hasPassword: !!password,
      password // временно для отладки
    });

    // Проверяем наличие необходимых данных
    if (!email || !password) {
      console.error('Login API - Отсутствуют необходимые данные:', {
        hasEmail: !!email,
        hasPassword: !!password
      });
      return res.status(400).json({
        detail: 'Отсутствуют необходимые данные для входа'
      });
    }

    console.log('Login API - Отправка запроса авторизации:', {
      url: `${API_URL}/auth/login`,
      email,
      hasPassword: !!password,
      password // временно для отладки
    });

    // Формируем данные для отправки
    const formData = new URLSearchParams();
    formData.append('username', email);
    formData.append('password', password);

    console.log('Auth API - Отправляемые данные:', {
      formData: formData.toString(),
      username: email,
      hasPassword: !!password,
      password // временно для отладки
    });

    const response = await axios.post(`${API_URL}/auth/login`, formData, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
        'X-Requested-With': 'XMLHttpRequest'
      },
      validateStatus: function (status) {
        return status < 500; // Разрешаем все статусы < 500
      }
    });

    console.log('Auth API - Ответ от сервера:', {
      status: response.status,
      hasData: !!response.data,
      data: {
        ...response.data,
        access_token: response.data?.access_token ? '***' : undefined
      },
      hasToken: !!response.data?.access_token,
      hasUser: !!response.data?.user
    });

    if (response.status === 401) {
      return res.status(401).json({
        detail: 'Неверные учетные данные'
      });
    }

    // Проверяем наличие всех необходимых полей в ответе
    if (!response.data?.access_token || !response.data?.user) {
      console.error('Auth API - Неполный ответ от сервера:', {
        ...response.data,
        access_token: response.data?.access_token ? '***' : undefined
      });
      return res.status(500).json({
        detail: 'Неверный формат ответа от сервера',
        debug: {
          hasToken: !!response.data?.access_token,
          hasUser: !!response.data?.user
        }
      });
    }

    // Возвращаем полный ответ от сервера
    const responseData = {
      access_token: response.data.access_token,
      token_type: response.data.token_type || 'bearer',
      user: response.data.user
    };

    console.log('Auth API - Подготовленный ответ для клиента:', {
      responseData: JSON.stringify(responseData),
      hasToken: !!responseData.access_token,
      hasUser: !!responseData.user,
      email: responseData.user?.email,
      role: responseData.user?.role
    });

    // Отправляем ответ клиенту
    res.setHeader('Content-Type', 'application/json');
    return res.status(200).json(responseData);
  } catch (error: any) {
    console.error('Login API - Ошибка:', error.response?.data || error.message);
    return res.status(500).json({
      message: error.response?.data?.detail || error.message || 'Внутренняя ошибка сервера',
      error: process.env.NODE_ENV === 'development' ? error.response?.data || error.message : undefined
    });
  }
} 