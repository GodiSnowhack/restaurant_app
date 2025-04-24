import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/[...nextauth]';
import { getBackendURL } from '../../../../lib/config';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    // Получаем сессию пользователя
    const session = await getServerSession(req, res, authOptions);
    
    // Проверяем аутентификацию
    if (!session) {
      return res.status(401).json({ error: 'Требуется авторизация' });
    }
    
    // Получаем ID заказа из URL
    const { id } = req.query;
    
    if (!id || Array.isArray(id)) {
      return res.status(400).json({ error: 'Недопустимый ID заказа' });
    }
    
    // Получаем URL бэкенда
    const backendURL = getBackendURL();
    
    // Формируем URL для отладочного эндпоинта
    const url = `${backendURL}/api/v1/orders/raw/${id}`;
    
    console.log(`[API Debug] Запрос к бэкенду: ${url}`);
    
    // Получаем токен из сессии
    const token = session.accessToken;
    
    // Выполняем запрос к бэкенду
    const backendResponse = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (!backendResponse.ok) {
      // Если запрос неуспешен, возвращаем ошибку
      const errorData = await backendResponse.text();
      console.error(`[API Debug] Ошибка бэкенда: ${backendResponse.status} ${backendResponse.statusText}`, errorData);
      
      return res.status(backendResponse.status).json({
        error: 'Ошибка при получении отладочных данных заказа',
        status: backendResponse.status,
        details: errorData
      });
    }
    
    // Получаем данные заказа
    const orderData = await backendResponse.json();
    
    console.log(`[API Debug] Получены отладочные данные заказа ${id}`);
    
    // Возвращаем необработанные данные заказа
    return res.status(200).json(orderData);
  } catch (error) {
    console.error('[API Debug] Ошибка при обработке запроса:', error);
    return res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
} 