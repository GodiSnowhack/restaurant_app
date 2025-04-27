import { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';

const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Проверяем метод запроса
  if (req.method !== 'GET' && req.method !== 'PUT') {
    return res.status(405).json({ detail: 'Метод не разрешен' });
  }
  
  try {
    // Получаем токен из заголовка
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      return res.status(401).json({ detail: 'Требуется авторизация' });
    }
    
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': authHeader
    };
    
    if (req.method === 'GET') {
      // Получение данных текущего пользователя
      const response = await axios.get(
        `${backendUrl}/users/me`,
        { headers }
      );
      
      return res.status(200).json(response.data);
    } else {
      // Обновление данных текущего пользователя
      const response = await axios.put(
        `${backendUrl}/users/me`,
        req.body,
        { headers }
      );
      
      return res.status(200).json(response.data);
    }
  } catch (error) {
    console.error(`Ошибка при ${req.method} запросе к /users/me:`, error);
    
    // Проверяем, есть ли ответ от сервера с ошибкой
    if (axios.isAxiosError(error) && error.response) {
      const statusCode = error.response.status;
      return res.status(statusCode).json(error.response.data);
    }
    
    // Для всех других ошибок
    return res.status(500).json({
      detail: 'Произошла ошибка при обработке запроса'
    });
  }
} 