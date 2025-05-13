import { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

/**
 * API-прокси для работы с заказами
 * Обрабатывает CORS и проксирует запросы к основному API
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Настройка CORS заголовков
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  // Обработка предварительных запросов CORS
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { start_date, end_date } = req.query;
  const { authorization } = req.headers;

  try {
    console.log('[Orders API] Получение заказов с параметрами:', { start_date, end_date });

    const response = await axios.get(`${API_BASE_URL}/orders`, {
      params: {
        start_date,
        end_date
      },
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...(authorization ? { 'Authorization': authorization } : {})
      }
    });

    console.log('[Orders API] Получен ответ от сервера:', {
      status: response.status,
      data: response.data
    });

    return res.status(200).json(response.data);
        } catch (error: any) {
    console.error('[Orders API] Ошибка при получении заказов:', error);
          
    // Если есть ответ от сервера, передаем его
          if (error.response) {
      return res.status(error.response.status).json(error.response.data);
    }

    // Если нет ответа, возвращаем общую ошибку
    return res.status(500).json({ 
      message: error.message || 'Внутренняя ошибка сервера'
    });
  }
} 