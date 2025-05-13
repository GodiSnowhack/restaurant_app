import { NextApiRequest, NextApiResponse } from 'next';
import { getApiBaseUrl } from '../../lib/api';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const { method, query, body } = req;
    const token = req.headers.authorization;
    const userId = req.headers['x-user-id'];

    // Получаем базовый URL API
    const baseUrl = getApiBaseUrl();
    const apiUrl = `${baseUrl}/api/v1/reservations`;

    // Формируем URL с учетом query параметров
    const url = query && Object.keys(query).length > 0
      ? `${apiUrl}?${new URLSearchParams(query as Record<string, string>).toString()}`
      : apiUrl;

    // Формируем заголовки запроса
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };

    // Добавляем заголовки авторизации
    if (token) {
      headers['Authorization'] = token;
    }
    if (userId) {
      headers['X-User-ID'] = userId.toString();
    }

    // Отправляем запрос к бэкенду
    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    // Получаем данные ответа
    const data = await response.json();

    // Отправляем ответ клиенту
    res.status(response.status).json(data);
  } catch (error: any) {
    console.error('[API Proxy] Ошибка при обработке запроса бронирований:', error);
    res.status(500).json({ 
      error: 'Внутренняя ошибка сервера',
      message: error.message 
    });
  }
} 