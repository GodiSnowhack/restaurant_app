import { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';

/**
 * API-прокси для заказов.
 * Этот эндпоинт перенаправляет запросы к бэкенду, чтобы избежать проблем с CORS.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Получаем токен из заголовков
  const authHeader = req.headers.authorization || '';
  const userId = req.headers['x-user-id'] || '';
  const userRole = req.headers['x-user-role'] || '';
  
  // Проверяем метод запроса
  if (req.method !== 'GET' && req.method !== 'POST' && req.method !== 'PUT' && req.method !== 'DELETE') {
    return res.status(405).json({ message: 'Method not allowed' });
  }
  
  // Определяем базовый URL бэкенда
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://backend-production-1a78.up.railway.app/api/v1';
  
  // Формируем URL запроса к бэкенду
  const endpoint = '/orders';
  const queryString = new URLSearchParams(req.query as Record<string, string>).toString();
  const fullUrl = `${apiUrl}${endpoint}${queryString ? `?${queryString}` : ''}`;
  
  console.log(`[API Proxy] Перенаправление запроса к: ${fullUrl}`);
  console.log(`[API Proxy] Метод: ${req.method}`);
  console.log(`[API Proxy] Токен: ${authHeader ? 'Присутствует' : 'Отсутствует'}`);
  
  try {
    // Выполняем запрос к бэкенду
    const response = await axios({
      method: req.method,
      url: fullUrl,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...(authHeader ? { 'Authorization': authHeader } : {}),
        ...(userId ? { 'X-User-ID': userId } : {}),
        ...(userRole ? { 'X-User-Role': userRole } : {})
      },
      data: req.method !== 'GET' ? req.body : undefined,
      timeout: 30000,
    });
    
    // Возвращаем ответ от бэкенда
    return res.status(response.status).json(response.data);
  } catch (error: any) {
    console.error(`[API Proxy] Ошибка при запросе к бэкенду:`, error.message);
    
    // Возвращаем ответ с ошибкой
    return res.status(error.response?.status || 500).json({
      message: error.response?.data?.message || 'Ошибка при запросе к бэкенду',
      error: error.message,
      // Если запрос к бэкенду вернул ошибку, передаем ее данные
      details: error.response?.data || null
    });
  }
} 