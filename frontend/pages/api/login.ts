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
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        detail: 'Необходимо указать email и пароль'
      });
    }

    // Формируем данные для отправки
    const formData = new URLSearchParams();
    formData.append('username', email);
    formData.append('password', password);
    formData.append('grant_type', 'password');

    // Отправляем запрос на бэкенд
    const response = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json'
      },
      body: formData.toString()
    });

    const data = await response.json();

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
      detail: 'Внутренняя ошибка сервера'
    });
  }
} 