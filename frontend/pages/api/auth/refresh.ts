import { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';

/**
 * API-прокси для обновления токена.
 * Этот эндпоинт перенаправляет запросы на обновление токена к бэкенду.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Проверяем метод запроса
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }
  
  // Получаем refresh token из тела запроса
  const { refresh_token } = req.body;
  
  if (!refresh_token) {
    return res.status(400).json({ message: 'Refresh token is required' });
  }
  
  // Определяем базовый URL бэкенда
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://backend-production-1a78.up.railway.app/api/v1';
  
  try {
    // Выполняем запрос к бэкенду
    const response = await axios.post(`${apiUrl}/auth/refresh`, { refresh_token }, {
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });
    
    // Возвращаем ответ от бэкенда
    return res.status(response.status).json(response.data);
  } catch (error: any) {
    console.error('Ошибка при обновлении токена:', error.message);
    
    // Возвращаем ответ с ошибкой
    return res.status(error.response?.status || 500).json({
      message: error.response?.data?.message || 'Ошибка при обновлении токена',
      error: error.message
    });
  }
} 