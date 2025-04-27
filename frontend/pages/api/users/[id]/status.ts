import { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';

const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Получаем id пользователя из URL
  const { id } = req.query;
  
  // Проверяем метод запроса
  if (req.method !== 'PUT') {
    return res.status(405).json({ detail: 'Метод не разрешен' });
  }
  
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
    
    // Проверяем тело запроса
    const { is_active } = req.body;
    
    if (typeof is_active !== 'boolean') {
      return res.status(400).json({ detail: 'Параметр is_active должен быть логическим значением' });
    }
    
    // Отправляем запрос к бэкенду
    const response = await axios.put(
      `${backendUrl}/users/${id}`,
      { is_active },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': authHeader
        }
      }
    );
    
    // Возвращаем ответ
    return res.status(200).json(response.data);
  } catch (error) {
    console.error(`Ошибка при изменении статуса пользователя ${id}:`, error);
    
    // Проверяем, есть ли ответ от сервера с ошибкой
    if (axios.isAxiosError(error) && error.response) {
      const statusCode = error.response.status;
      return res.status(statusCode).json(error.response.data);
    }
    
    // Для всех других ошибок
    return res.status(500).json({
      detail: 'Произошла ошибка при изменении статуса пользователя'
    });
  }
} 