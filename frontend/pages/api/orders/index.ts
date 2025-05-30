import { NextApiRequest, NextApiResponse } from 'next';
import { getDefaultApiUrl, getOrdersApiUrl } from '../../../src/config/defaults';
import https from 'https';
import fs from 'fs';
import path from 'path';
import axios from 'axios';

// Путь к кешу
const CACHE_DIR = path.join(process.cwd(), 'data', 'cache');
const ORDERS_CACHE_FILE = path.join(CACHE_DIR, 'orders_cache.json');
const CACHE_TTL = 5 * 60 * 1000; // 5 минут в миллисекундах

// Убедимся, что директория кеша существует
const ensureCacheDir = () => {
  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
  }
};

// Получение данных из кеша
const getFromCache = (key: string) => {
  try {
    ensureCacheDir();
    if (!fs.existsSync(ORDERS_CACHE_FILE)) {
      return null;
    }
    
    const cacheData = JSON.parse(fs.readFileSync(ORDERS_CACHE_FILE, 'utf8'));
    if (!cacheData[key] || (Date.now() - cacheData[key].timestamp > CACHE_TTL)) {
      return null;
    }
    
    return cacheData[key].data;
  } catch (error) {
    console.error('Ошибка при чтении кеша:', error);
    return null;
  }
};

// Сохранение данных в кеш
const saveToCache = (key: string, data: any) => {
  try {
    ensureCacheDir();
    
    let cacheData = {};
    if (fs.existsSync(ORDERS_CACHE_FILE)) {
      cacheData = JSON.parse(fs.readFileSync(ORDERS_CACHE_FILE, 'utf8'));
    }
    
    cacheData = {
      ...cacheData,
      [key]: {
        data,
        timestamp: Date.now()
      }
    };
    
    fs.writeFileSync(ORDERS_CACHE_FILE, JSON.stringify(cacheData, null, 2), 'utf8');
  } catch (error) {
    console.error('Ошибка при сохранении в кеш:', error);
  }
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Настройка CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST,PUT,DELETE,PATCH');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization, X-User-ID, X-User-Role'
  );

  // Обработка префлайт-запросов
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Проверка метода запроса
  if (req.method === 'POST') {
    try {
      // Получаем токен авторизации
      const token = req.headers.authorization?.replace('Bearer ', '');
      if (!token) {
        return res.status(401).json({
          success: false,
          message: 'Отсутствует токен авторизации'
        });
      }

      // Получаем базовый URL API
      const baseApiUrl = getDefaultApiUrl();
      console.log('API Proxy (POST): Базовый URL API:', baseApiUrl);

      // Формируем URL для запроса
      let ordersApiUrl = baseApiUrl + '/orders/';
      if (ordersApiUrl.includes('//orders')) {
        ordersApiUrl = ordersApiUrl.replace('//orders', '/orders');
      }

      console.log('API Proxy (POST): URL для создания заказа:', ordersApiUrl);
      console.log('API Proxy (POST): Данные заказа:', req.body);

      // Заголовки запроса
      const headers: Record<string, string> = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      };

      // Получаем ID пользователя из заголовков или из тела запроса
      const userId = req.headers['x-user-id'] as string || req.body.user_id;
      if (userId) {
        headers['X-User-ID'] = userId.toString();
      }

      // Создаем HTTPS агент для безопасных запросов
      const httpsAgent = new https.Agent({
        rejectUnauthorized: false
      });

      // Отправляем запрос на создание заказа
      const response = await axios.post(ordersApiUrl, req.body, {
        headers,
        httpsAgent,
        timeout: 10000
      });

      // Возвращаем результат
      return res.status(response.status).json(response.data);
    } catch (error: any) {
      console.error('API Proxy (POST): Ошибка при создании заказа:', error.message);
      
      // Если есть ответ от сервера, возвращаем его статус и данные
      if (error.response) {
        return res.status(error.response.status).json({
          success: false,
          message: 'Ошибка при создании заказа',
          error: error.response.data
        });
      }
      
      // Если нет ответа, возвращаем общую ошибку
      return res.status(500).json({
        success: false,
        message: 'Ошибка при создании заказа',
        error: error.message
      });
    }
  }

  if (req.method !== 'GET') {
    return res.status(405).json({
      success: false,
      message: 'Метод не поддерживается'
    });
  }

  try {
    // Получаем параметры запроса
    const { start_date, end_date } = req.query;
    
    // Преобразуем даты в формат YYYY-MM-DD
    const formatSimpleDate = (dateStr: string | string[] | undefined): string => {
      if (!dateStr) return '';
      try {
        const date = new Date(Array.isArray(dateStr) ? dateStr[0] : dateStr);
        return date.toISOString().split('T')[0]; // Возвращаем только часть с датой (YYYY-MM-DD)
      } catch (e) {
        console.log('API Proxy: Ошибка форматирования даты:', e);
        return '';
      }
    };
    
    const simpleStartDate = formatSimpleDate(start_date);
    const simpleEndDate = formatSimpleDate(end_date);
    
    console.log('API Proxy: Упрощенные даты:', { start_date: simpleStartDate, end_date: simpleEndDate });
    
    // Ключ для кеширования
    const cacheKey = `orders_${simpleStartDate}_${simpleEndDate}`;
    
    // Проверяем наличие данных в кеше
    const cachedData = getFromCache(cacheKey);
    if (cachedData) {
      console.log('API Proxy: Данные заказов получены из кеша');
      return res.status(200).json(cachedData);
    }

    // Получаем токен авторизации
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Отсутствует токен авторизации'
      });
    }
    
    // Получаем ID и роль пользователя из заголовков
    const userId = req.headers['x-user-id'] as string || '1';
    const userRole = (req.headers['x-user-role'] as string || '').toLowerCase();

    // Получаем базовый URL API
    const baseApiUrl = getDefaultApiUrl();
    console.log('API Proxy: Базовый URL API:', baseApiUrl);

    // Формируем URL для запроса - явно добавляем слеш в конце URL
    let ordersApiUrl = baseApiUrl + '/api/v1/orders/';
    if (ordersApiUrl.includes('//orders')) {
      ordersApiUrl = ordersApiUrl.replace('//orders', '/orders');
    }
    
    // Формируем параметры запроса
    let queryParams = '';
    if (simpleStartDate && simpleEndDate) {
      queryParams = `?start_date=${simpleStartDate}&end_date=${simpleEndDate}`;
    }
    
    console.log('API Proxy: URL для запроса:', ordersApiUrl + queryParams);

    // Заголовки запроса
    const headers = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };

    // Создаем HTTPS агент для безопасных запросов
    const httpsAgent = new https.Agent({
      rejectUnauthorized: false
    });

    try {
      // Прямой запрос с помощью axios вместо fetch, чтобы избежать проблем с редиректами
      const response = await axios.get(ordersApiUrl + queryParams, {
        headers,
        httpsAgent,
        timeout: 8000,
        maxRedirects: 5 // Явно разрешаем редиректы
      });
      
      // Проверяем ответ
      if (response.status >= 200 && response.status < 300) {
        const data = response.data;
        console.log('API Proxy: Получены данные от API:', { 
          status: response.status, 
          dataLength: Array.isArray(data) ? data.length : 'не массив' 
        });
        
        let resultData;
        if (Array.isArray(data)) {
          resultData = data;
        } else if (data && typeof data === 'object' && data.items && Array.isArray(data.items)) {
          resultData = data.items;
        } else if (data && typeof data === 'object' && data.data && Array.isArray(data.data)) {
          resultData = data.data;
        } else {
          console.warn('API Proxy: Сервер вернул неожиданный формат данных');
          resultData = [];
        }
        
        saveToCache(cacheKey, resultData);
        return res.status(200).json(resultData);
      } else {
        console.log('API Proxy: Ошибка при запросе к API:', response.status);
        return res.status(response.status).json({
          success: false,
          message: 'Ошибка при получении данных с сервера'
        });
      }
    } catch (error: any) {
      console.error('API Proxy: Ошибка при запросе к API:', error.message);
      if (error.response) {
        return res.status(error.response.status).json({
          success: false,
          message: 'Ошибка при получении данных с сервера',
          error: error.response.data
        });
      }
      return res.status(500).json({
        success: false,
        message: 'Ошибка при получении данных с сервера',
        error: error.message
      });
    }
  } catch (error: any) {
    console.error('API Proxy: Общая ошибка:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Внутренняя ошибка сервера',
      error: error.message
    });
  }
} 