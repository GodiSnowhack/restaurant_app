import type { NextApiRequest, NextApiResponse } from 'next';
import { getDefaultApiUrl } from '../../src/config/defaults';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const token = req.headers.authorization;
    const baseApiUrl = getDefaultApiUrl();

    if (!token) {
      return res.status(401).json({ message: 'No authorization token' });
    }

    const profileUrl = `${baseApiUrl}/users/me`;
    console.log('Profile Proxy - Отправка запроса на', profileUrl);

    const response = await fetch(profileUrl, {
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