import { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Настройка CORS заголовков
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST,PUT,DELETE');
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

  try {
    // Получаем токен из заголовков запроса
    const token = req.headers.authorization;

    // Настраиваем заголовки для запроса к бэкенду
    const headers: Record<string, string> = {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    };

    if (token) {
      headers['Authorization'] = token;
    }

    // Делаем запрос к бэкенду
    const response = await axios.get(`${API_BASE_URL}/menu/categories`, { headers });

    // Возвращаем данные клиенту
    return res.status(200).json(response.data);
  } catch (error: any) {
    console.error('Error fetching categories:', error);
    
    // Возвращаем ошибку клиенту
    return res.status(error.response?.status || 500).json({
      message: error.message,
      details: error.response?.data
    });
  }
} 