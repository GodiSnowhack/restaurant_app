import { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';
import { getSecureApiUrl } from '../../../lib/utils/api';

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

  if (!authorization) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  try {
    const url = `${getSecureApiUrl()}/orders`;
    const params = new URLSearchParams();
    
    if (start_date) params.append('start_date', start_date as string);
    if (end_date) params.append('end_date', end_date as string);
    
    const finalUrl = `${url}${params.toString() ? `?${params.toString()}` : ''}`;
    
    const response = await axios.get(finalUrl, {
      headers: {
        Authorization: authorization,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });

    return res.status(200).json(response.data);
  } catch (error: any) {
    console.error('Ошибка при получении заказов:', error);
    return res.status(error.response?.status || 500).json({
      message: error.response?.data?.message || 'Internal server error'
    });
  }
} 