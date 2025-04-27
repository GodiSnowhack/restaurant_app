import { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';

const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Получаем id пользователя из URL
  const { id } = req.query;
  
  // Проверяем валидность id
  if (!id || isNaN(Number(id))) {
    return res.status(400).json({ detail: 'Неверный ID пользователя' });
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
    
    // Обработка запроса в зависимости от метода
    if (req.method === 'GET') {
      // Получение данных пользователя
      const response = await axios.get(
        `${backendUrl}/users/${id}`,
        { headers }
      );
      
      return res.status(200).json(response.data);
    } else if (req.method === 'PUT') {
      // Обновление данных пользователя
      const response = await axios.put(
        `${backendUrl}/users/${id}`,
        req.body,
        { headers }
      );
      
      return res.status(200).json(response.data);
    } else if (req.method === 'DELETE') {
      // Удаление пользователя
      const response = await axios.delete(
        `${backendUrl}/users/${id}`,
        { headers }
      );
      
      return res.status(204).json({});
    } else {
      return res.status(405).json({ detail: 'Метод не разрешен' });
    }
  } catch (error) {
    console.error(`Ошибка при ${req.method} запросе к /users/${id}:`, error);
    
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