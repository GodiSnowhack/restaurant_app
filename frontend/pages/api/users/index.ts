import { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';

const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Проверяем метод запроса
  if (req.method !== 'GET') {
    return res.status(405).json({ detail: 'Метод не разрешен' });
  }
  
  try {
    // Получаем токен из заголовка
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      return res.status(401).json({ detail: 'Требуется авторизация' });
    }
    
    // Получаем параметры запроса
    const { skip, limit, role } = req.query;
    
    // Формируем параметры запроса к бэкенду
    const params: Record<string, string | number> = {};
    
    if (skip) params.skip = Number(skip);
    if (limit) params.limit = Number(limit);
    if (role) params.role = String(role);
    
    // Отправляем запрос к бэкенду
    const response = await axios.get(
      `${backendUrl}/users`,
      {
        params,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': authHeader
        }
      }
    );
    
    // Возвращаем ответ
    return res.status(200).json(response.data);
  } catch (error) {
    console.error('Ошибка при получении списка пользователей:', error);
    
    // Проверяем, есть ли ответ от сервера с ошибкой
    if (axios.isAxiosError(error) && error.response) {
      const statusCode = error.response.status;
      return res.status(statusCode).json(error.response.data);
    }
    
    // Для всех других ошибок
    return res.status(500).json({
      detail: 'Произошла ошибка при получении списка пользователей'
    });
  }
} 