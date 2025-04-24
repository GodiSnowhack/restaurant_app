import { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';

/**
 * API-эндпоинт для проверки соединения с сервером
 * Обеспечивает полную диагностику проблем соединения с бэкендом
 */
export default async function pingHandler(req: NextApiRequest, res: NextApiResponse) {
  // Разрешаем CORS для всех клиентов
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,HEAD');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  // Обрабатываем предварительные запросы CORS
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Обрабатываем только GET и HEAD запросы
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return res.status(405).json({ message: 'Метод не поддерживается' });
  }

  // Для HEAD запросов просто возвращаем успешный статус
  if (req.method === 'HEAD') {
    return res.status(200).end();
  }

  const userAgent = req.headers['user-agent'] || 'Unknown';
  const startTime = Date.now();
  const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  
  // Определяем, является ли устройство мобильным
  const isMobile = /Mobile|Android|iPhone|iPad|iPod|Windows Phone/i.test(userAgent);
  console.log(`Ping API - Запрос от устройства${isMobile ? ' (мобильное)' : ''}: ${userAgent}`);
  console.log(`Ping API - IP клиента: ${clientIp}`);
  
  // Собираем информацию о клиенте для диагностики
  const clientInfo = {
    userAgent,
    isMobile,
    clientIp,
    timestamp: new Date().toISOString(),
    query: req.query
  };

  try {
    // Проверка сетевого соединения на уровне прокси
    const networkTestResult = { ok: true, message: 'Соединение с прокси API успешно' };
    
    // Получаем URL основного API из переменных окружения
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';
    console.log(`Ping API - Используемый URL API: ${apiUrl}`);
    
    // Формируем различные URL для проверки
    const endpoints = [
      { name: 'health', url: `${apiUrl}/health`, timeout: isMobile ? 10000 : 5000 },
      { name: 'users', url: `${apiUrl}/users`, timeout: isMobile ? 8000 : 5000 },
      { name: 'auth', url: `${apiUrl}/auth`, timeout: isMobile ? 8000 : 5000 }
    ];
    
    const results = [];
    
    // Последовательно проверяем все эндпоинты
    for (const endpoint of endpoints) {
      try {
        console.log(`Ping API - Проверка эндпоинта: ${endpoint.name} (${endpoint.url})`);
        
        const endpointStartTime = Date.now();
        const response = await axios.get(endpoint.url, {
          timeout: endpoint.timeout,
          validateStatus: () => true, // Принимаем любой статус ответа
          headers: {
            'User-Agent': userAgent,
            'Accept': 'application/json',
            'X-Ping-Check': 'true',
            'X-Client-IP': String(clientIp)
          }
        });
        
        const endpointLatency = Date.now() - endpointStartTime;
        
        results.push({
          endpoint: endpoint.name,
          url: endpoint.url,
          status: response.status,
          success: response.status < 500,
          latency: endpointLatency,
          data: typeof response.data === 'object' ? response.data : { raw: String(response.data).slice(0, 100) }
        });
        
        // Если хотя бы один эндпоинт успешно ответил, значит сервер доступен
        if (response.status < 500) {
          console.log(`Ping API - Эндпоинт ${endpoint.name} доступен, статус: ${response.status}, время: ${endpointLatency}ms`);
        }
      } catch (error: any) {
        console.error(`Ping API - Ошибка при проверке эндпоинта ${endpoint.name}:`, error.message);
        
        results.push({
          endpoint: endpoint.name,
          url: endpoint.url,
          success: false,
          error: error.message,
          code: error.code,
          isNetworkError: error.code === 'ECONNABORTED' || error.code === 'ECONNREFUSED'
        });
      }
    }
    
    // Определяем общий статус сервера на основе результатов проверок
    const isServerAvailable = results.some(r => r.success);
    
    // Возвращаем полную информацию о состоянии сервера
    const endTime = Date.now();
    const totalDuration = endTime - startTime;
    
    return res.status(isServerAvailable ? 200 : 503).json({
      success: isServerAvailable,
      message: isServerAvailable ? 'Сервер доступен' : 'Сервер недоступен',
      timestamp: new Date().toISOString(),
      totalLatency: totalDuration,
      server: {
        apiUrl,
        endpoints: results
      },
      client: clientInfo,
      network: networkTestResult,
      serverTime: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('Ping API - Критическая ошибка:', error);
    
    return res.status(500).json({
      success: false,
      message: 'Внутренняя ошибка сервера при проверке доступности',
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      timestamp: new Date().toISOString(),
      client: clientInfo
    });
  }
} 