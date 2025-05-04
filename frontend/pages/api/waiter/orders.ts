import { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';
import { decode } from 'jsonwebtoken';

/**
 * API-прокси для заказов официанта 
 */
export default async function waiterOrdersProxy(req: NextApiRequest, res: NextApiResponse) {
  // Разрешаем CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  // Обрабатываем предварительные запросы CORS
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Метод не поддерживается' });
  }

  try {
    // Получаем токен авторизации из заголовков
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('Waiter Orders API - Отсутствует токен авторизации');
      
      // Возвращаем пустой массив вместо ошибки, чтобы клиентская часть могла корректно обработать
      return res.status(200).json([]);
    }
    
    // Извлекаем токен
    const token = authHeader.substring(7);
    
    // Формируем основной URL для API
    const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';
    const endpoint = `${apiBaseUrl}/waiter/orders`;
    
    // Формируем заголовки
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };
    
    // Добавляем заголовки из запроса
    if (req.headers['x-user-role']) {
      headers['X-User-Role'] = req.headers['x-user-role'] as string;
    }
    
    if (req.headers['x-user-id']) {
      headers['X-User-ID'] = req.headers['x-user-id'] as string;
    }
    
    try {
      // Делаем запрос к API с коротким таймаутом
      const response = await axios.get(endpoint, {
        headers,
        timeout: 5000 // 5 секунд таймаут для быстрого UI
      });
      
      // Если получили данные, возвращаем их
      if (response.status === 200 && Array.isArray(response.data)) {
        const data = response.data;
        console.log(`Waiter Orders API - Получено ${data.length} заказов`);
        
        // Дополняем данные полем total_price для совместимости
        const enhancedData = data.map(order => ({
          ...order,
          total_price: order.total_amount // Дублируем для совместимости
        }));
        
        return res.status(200).json(enhancedData);
      } else {
        console.log('Waiter Orders API - Некорректный формат данных');
        // Возвращаем пустой массив вместо ошибки
        return res.status(200).json([]);
      }
    } catch (apiError: any) {
      console.error('Waiter Orders API - Ошибка при запросе к API:', apiError.message);
      
      // Независимо от типа ошибки, возвращаем пустой массив
      // Это позволит клиентской части корректно обрабатывать ответ
      return res.status(200).json([]);
    }
  } catch (error: any) {
    console.error('Waiter Orders API - Общая ошибка:', error.message);
    // Возвращаем пустой массив вместо ошибки
    return res.status(200).json([]);
  }
} 