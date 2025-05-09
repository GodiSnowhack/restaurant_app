import { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';

// Базовый URL бэкенда
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Поддерживаем только GET запросы
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // Проверяем и получаем authorization header из куки или headers
  let token = '';
  
  // Проверяем headers
  if (req.headers.authorization && typeof req.headers.authorization === 'string') {
    token = req.headers.authorization.replace('Bearer ', '');
  }
  
  // Проверяем cookies
  if (!token && req.cookies.token) {
    token = req.cookies.token;
  }
  
  // Проверяем localStorage через cookie (если клиент передал её)
  if (!token && req.cookies.auth_token) {
    token = req.cookies.auth_token;
  }

  // Если токен не найден, возвращаем пустую сессию
  if (!token) {
    return res.status(200).json({
      user: null,
      expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    });
  }

  try {
    // Запрос к API для проверки сессии
    const response = await axios({
      method: 'GET',
      url: `${API_BASE_URL}/auth/me`,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      validateStatus: () => true, // Возвращает любой статус ответа
    });

    // Если запрос успешен, возвращаем данные пользователя
    if (response.status === 200) {
      const user = response.data;
      
      return res.status(200).json({
        user: {
          id: user.id,
          name: user.full_name,
          email: user.email,
          role: user.role,
          image: user.avatar || null,
        },
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      });
    }

    // Если первый запрос не удался, пробуем альтернативный эндпоинт
    const altResponse = await axios({
      method: 'GET',
      url: `${API_BASE_URL}/users/me`,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      validateStatus: () => true,
    });

    if (altResponse.status === 200) {
      const user = altResponse.data;
      
      return res.status(200).json({
        user: {
          id: user.id,
          name: user.full_name,
          email: user.email,
          role: user.role,
          image: user.avatar || null,
        },
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      });
    }

    // Если оба запроса не удались
    console.log(`[Auth Session API] Ошибка проверки профиля: ${response.status}`);
    
    return res.status(200).json({
      user: null,
      expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    });
  } catch (error) {
    console.error('[Auth Session API] Ошибка при получении профиля:', error);
    
    // В случае ошибки возвращаем пустую сессию
    return res.status(200).json({
      user: null,
      expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    });
  }
} 