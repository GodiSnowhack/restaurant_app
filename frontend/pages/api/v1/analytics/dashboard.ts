import type { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Метод не поддерживается' });
  }

  try {
    // Получаем токен авторизации
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Требуется авторизация' });
    }

    // Прокидываем параметры запроса (startDate, endDate, useMockData и т.д.)
    const { query } = req;
    const params = new URLSearchParams();
    for (const key in query) {
      const value = query[key];
      if (Array.isArray(value)) {
        value.forEach(v => params.append(key, v));
      } else if (value !== undefined) {
        params.append(key, value as string);
      }
    }

    // URL бэкенда
    const backendUrl = process.env.BACKEND_URL || 'https://backend-production-1a78.up.railway.app';
    const url = `${backendUrl}/api/v1/analytics/dashboard?${params.toString()}`;

    // Проксируем запрос
    const backendRes = await axios.get(url, {
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
      },
      timeout: 10000
    });

    return res.status(backendRes.status).json(backendRes.data);
  } catch (error: any) {
    console.error('[API analytics/dashboard] Ошибка:', error.message);
    if (error.response) {
      return res.status(error.response.status).json(error.response.data);
    }
    return res.status(500).json({ error: 'Ошибка при получении аналитики', message: error.message });
  }
} 