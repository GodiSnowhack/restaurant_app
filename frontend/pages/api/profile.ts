import type { NextApiRequest, NextApiResponse } from 'next';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://backend-production-1a78.up.railway.app/api/v1';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const token = req.headers.authorization;

    if (!token) {
      return res.status(401).json({ message: 'No authorization token' });
    }

    console.log('Profile Proxy - Отправка запроса на', `${API_URL}/users/me`);

    const response = await fetch(`${API_URL}/users/me`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': token
      }
    });

    const data = await response.json();

    console.log('Profile Proxy - Ответ от сервера:', {
      status: response.status,
      hasData: !!data,
      role: data?.role
    });

    if (!response.ok) {
      throw new Error(data.detail || 'Ошибка получения профиля');
    }

    // Проверяем наличие необходимых данных
    if (!data.id || !data.role) {
      throw new Error('Неверный формат данных профиля');
    }

    // Возвращаем данные клиенту
    return res.status(200).json(data);
  } catch (error: any) {
    console.error('Profile Proxy - Ошибка:', error.message);
    return res.status(error.status || 500).json({
      message: error.message || 'Internal server error'
    });
  }
} 