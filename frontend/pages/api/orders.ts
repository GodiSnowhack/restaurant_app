import type { NextApiRequest, NextApiResponse } from 'next';
import { getDefaultApiUrl } from '../../src/config/defaults';
import axios from 'axios';

/**
 * API-прокси для работы с заказами
 * Проксирует запросы к бэкенду и добавляет необходимые заголовки авторизации
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization, X-User-ID, X-User-Role'
  );

  // Обработка preflight запросов
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    // Получаем базовый URL API бэкенда
    const baseApiUrl = getDefaultApiUrl();
    
    // Извлекаем параметры запроса и формируем полный URL
    const { id, ...queryParams } = req.query;
    
    // Если есть id в пути, добавляем его к URL
    let apiPath = '/orders';
    if (id) {
      apiPath += `/${id}`;
      
      // Если есть дополнительные части пути, добавляем их
      const subPath = Array.isArray(req.query.subPath) 
        ? req.query.subPath.join('/') 
        : req.query.subPath;
      
      if (subPath) {
        apiPath += `/${subPath}`;
      }
    }
    
    // Формируем URL для запроса
    const apiUrl = `${baseApiUrl}${apiPath}`;
    
    // Строим query string из оставшихся параметров (исключая id и subPath)
    const queryString = new URLSearchParams();
    for (const [key, value] of Object.entries(queryParams)) {
      if (key !== 'subPath' && value !== undefined) {
        if (Array.isArray(value)) {
          value.forEach(v => queryString.append(key, v));
        } else {
          queryString.append(key, value as string);
        }
      }
    }
    
    // Полный URL с параметрами запроса
    const fullUrl = `${apiUrl}${queryString.toString() ? `?${queryString.toString()}` : ''}`;
    
    console.log(`API Proxy: Базовый URL API: ${baseApiUrl}`);
    console.log(`API Proxy: URL API заказов: ${apiUrl}`);
    console.log(`API Proxy: Параметры запроса: ${queryString.toString() ? `?${queryString.toString()}` : 'без параметров'}`);
    
    // Извлекаем заголовки авторизации из запроса
    const authHeader = req.headers.authorization;
    
    // Проверяем наличие заголовка авторизации
    if (!authHeader) {
      console.error('API Proxy: Отсутствует заголовок авторизации');
      return res.status(401).json({ error: 'Отсутствует заголовок авторизации' });
    }
    
    console.log('API Proxy: Заголовки запроса:', {
      Authorization: authHeader ? `${authHeader.substring(0, 20)}[скрыто]` : 'Отсутствует',
      'Content-Type': req.headers['content-type'],
      Accept: req.headers.accept,
      'X-User-Role': req.headers['x-user-role'],
      'X-User-ID': req.headers['x-user-id']
    });
    
    // Настраиваем заголовки для запроса к бэкенду
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };
    
    // Добавляем заголовок авторизации, если он есть
    if (authHeader) {
      headers['Authorization'] = authHeader;
    }
    
    // Добавляем дополнительные заголовки, если они есть
    if (req.headers['x-user-id']) {
      headers['X-User-ID'] = req.headers['x-user-id'] as string;
    }
    
    if (req.headers['x-user-role']) {
      headers['X-User-Role'] = req.headers['x-user-role'] as string;
    }
    
    // Формируем конфигурацию для запроса
    const config = {
      method: req.method,
      url: fullUrl,
      headers,
      data: req.method !== 'GET' && req.method !== 'HEAD' ? req.body : undefined,
      timeout: 10000, // 10 секунд таймаут
      validateStatus: (status: number) => status < 500, // Принимаем любые статусы кроме 5xx
    };
    
    console.log(`API Proxy: Отправка запроса к API: ${fullUrl}`);
    
    // Отправляем запрос к бэкенду
    try {
      const response = await axios(config);
      
      // Возвращаем статус, заголовки и тело ответа клиенту
      res.status(response.status);
      
      // Добавляем заголовки из ответа бэкенда
      for (const [key, value] of Object.entries(response.headers)) {
        if (value !== undefined && key.toLowerCase() !== 'content-length') {
          res.setHeader(key, value as string);
        }
      }
      
      // Возвращаем данные
      return res.json(response.data);
    } catch (error: any) {
      // Обрабатываем ошибки запроса
      console.error(`API Proxy: Ошибка при запросе к API: ${error.response?.status || error.code || error.message}`);
      
      // Если получен ответ с ошибкой от сервера, передаем его клиенту
      if (error.response) {
        const { status, data } = error.response;
        return res.status(status).json(data);
      }
      
      // Если ошибка связана с таймаутом или сетью
      if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
        return res.status(504).json({ error: 'Тайм-аут запроса к API', message: error.message });
      }
      
      // Для остальных ошибок
      return res.status(500).json({ 
        error: 'Ошибка при запросе к API', 
        message: error.message,
        code: error.code
      });
    }
  } catch (error: any) {
    // Обрабатываем общие ошибки прокси
    console.error('API Proxy: Критическая ошибка прокси:', error);
    return res.status(500).json({ 
      error: 'Критическая ошибка API прокси', 
      message: error.message 
    });
  }
} 