import { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';

/**
 * API-эндпоинт для получения IP-адреса и диагностики сетевых настроек
 * Помогает отладить проблемы с доступом через IP вместо localhost
 */
export default async function ipHandler(req: NextApiRequest, res: NextApiResponse) {
  // Разрешаем CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // Если это предварительный запрос OPTIONS, возвращаем 200 OK
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // Получаем реальный IP клиента
    const clientIp = req.headers['x-forwarded-for'] || 
                     req.headers['x-real-ip'] ||
                     req.socket.remoteAddress || 
                     'Unknown';
    
    // Получаем имя хоста сервера
    const hostname = req.headers.host || 'Unknown';
    
    // Проверяем доступность бэкенда
    let backendStatus = 'Unknown';
    let backendError = null;
    
    try {
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
      const backendResponse = await axios.get(`${backendUrl}/api/v1/ping`, { 
        timeout: 2000,
        headers: { 'Accept': 'application/json' }
      });
      
      backendStatus = backendResponse.status === 200 ? 'OK' : `Status: ${backendResponse.status}`;
    } catch (error) {
      backendStatus = 'Error';
      backendError = error instanceof Error ? error.message : String(error);
    }
    
    // Сетевые настройки API
    const apiConfig = {
      NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'Not set',
      NEXT_PUBLIC_BACKEND_URL: process.env.NEXT_PUBLIC_BACKEND_URL || 'Not set',
      NODE_ENV: process.env.NODE_ENV
    };
    
    // Формируем ответ
    return res.status(200).json({
      clientIp,
      hostname,
      serverInfo: {
        nodeEnv: process.env.NODE_ENV,
        time: new Date().toISOString(),
      },
      backendStatus,
      backendError,
      apiConfig,
      networkInfo: {
        headers: req.headers,
        protocol: req.headers['x-forwarded-proto'] || 'http',
      }
    });
  } catch (error) {
    console.error('IP endpoint error:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: error instanceof Error ? error.message : String(error)
    });
  }
} 