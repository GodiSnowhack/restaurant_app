import { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';

/**
 * API-эндпоинт для проверки соединения с сервером
 * Обеспечивает полную диагностику проблем соединения с бэкендом
 */
export default async function pingHandler(req: NextApiRequest, res: NextApiResponse) {
  // Разрешаем любые методы для этого простого эндпоинта
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  // Если это предварительный запрос OPTIONS, возвращаем 200 OK
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  // Для HEAD и GET запросов возвращаем простой статус
  return res.status(200).json({ status: 'ok', message: 'pong' });
} 