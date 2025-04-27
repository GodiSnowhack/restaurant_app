import { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';

/**
 * API-прокси для привязки заказа к официанту
 */
export default async function assignOrderProxy(req: NextApiRequest, res: NextApiResponse) {
  // Разрешаем CORS для всех клиентов
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  // Обрабатываем предварительные запросы CORS
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Метод не поддерживается' });
  }

  try {
    const { id } = req.query;
    const orderCode = req.body.order_code;
    
    if (!id) {
      return res.status(400).json({ message: 'ID заказа не указан' });
    }
    
    if (!orderCode) {
      return res.status(400).json({ message: 'Код заказа не указан' });
    }
    
    const userAgent = req.headers['user-agent'] || 'Unknown';
    const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    
    // Определяем, является ли устройство мобильным
    const isMobile = /Mobile|Android|iPhone|iPad|iPod|Windows Phone/i.test(userAgent);
    console.log(`Assign Order API - Запрос от устройства${isMobile ? ' (мобильное)' : ''}: ${userAgent}`);
    console.log(`Assign Order API - IP клиента: ${clientIp}`);
    
    // Получаем токен авторизации из заголовков
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ 
        detail: 'Отсутствует токен авторизации',
        message: 'Необходимо авторизоваться'
      });
    }
    
    const token = authHeader.substring(7); // Убираем 'Bearer ' из начала строки
    
    // Формируем URL для запроса к основному API
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';
    const assignUrl = `${apiUrl}/orders/${id}/assign`;
    
    console.log(`Assign Order API - Отправка запроса на ${assignUrl}`);
    console.log(`Assign Order API - Данные запроса:`, { order_code: orderCode });
    
    // Выполняем запрос к API
    const response = await axios.post(assignUrl, 
      { order_code: orderCode },
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'User-Agent': userAgent
        },
        timeout: isMobile ? 60000 : 30000 // Увеличенный таймаут для мобильных устройств
      }
    );
    
    console.log(`Assign Order API - Успешный ответ:`, response.data);
    
    // Возвращаем ответ клиенту
    return res.status(response.status).json(response.data);
  } catch (error: any) {
    console.error('Assign Order API - Ошибка:', error);
    
    // Форматируем сообщение об ошибке для клиента
    const statusCode = error.response?.status || 500;
    const errorMessage = error.response?.data?.detail || error.message || 'Внутренняя ошибка сервера';
    
    return res.status(statusCode).json({ 
      detail: errorMessage, 
      message: 'Ошибка при привязке заказа к официанту'
    });
  }
} 