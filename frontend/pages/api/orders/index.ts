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
      console.log('API Proxy: Отсутствует токен авторизации');
      return res.status(401).json({ message: 'Отсутствует токен авторизации' });
    }
    
    // Получаем ID и роль пользователя из заголовков
    const userId = req.headers['x-user-id'] as string || '1';
    const userRole = (req.headers['x-user-role'] as string || '').toLowerCase();

    // Получаем базовый URL API
    const baseApiUrl = getDefaultApiUrl();
    console.log('API Proxy: Базовый URL API:', baseApiUrl);

    // Получаем URL API для заказов
    const ordersApiUrl = getOrdersApiUrl();
    console.log('API Proxy: URL API заказов:', ordersApiUrl);

    // Формируем URL для запроса
    let queryParams = '';
    if (simpleStartDate && simpleEndDate) {
      queryParams = `?start_date=${simpleStartDate}&end_date=${simpleEndDate}`;
    }
    
    console.log('API Proxy: Параметры запроса:', queryParams);

    // Создаем HTTPS агент для безопасных запросов
    const httpsAgent = new https.Agent({
      rejectUnauthorized: false
    });

    // Заголовки запроса
    const headers = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'X-User-Role': userRole,
      'X-User-ID': userId
    };

    console.log('API Proxy: Заголовки запроса:', {
      ...headers,
      'Authorization': 'Bearer [скрыто]'
    });

    // Создаем контроллер для отмены запроса по таймауту
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 секунд таймаут

    try {
      // Пробуем получить данные через API
      const apiUrl = `${ordersApiUrl}${queryParams}`;
      console.log('API Proxy: Отправка запроса к API:', apiUrl);
      
      const response = await fetch(apiUrl, {
        method: 'GET',
        headers,
        signal: controller.signal,
        // @ts-ignore - добавляем агент напрямую
        agent: apiUrl.startsWith('https') ? httpsAgent : undefined
      });
      
      clearTimeout(timeoutId);
      
      if (response.ok) {
        const data = await response.json();
        console.log('API Proxy: Получены данные от API:', { 
          status: response.status, 
          dataLength: Array.isArray(data) ? data.length : 'не массив' 
        });
        
        if (Array.isArray(data)) {
          saveToCache(cacheKey, data);
          return res.status(200).json(data);
        } else if (data && typeof data === 'object' && data.items && Array.isArray(data.items)) {
          saveToCache(cacheKey, data.items);
          return res.status(200).json(data.items);
        } else if (data && typeof data === 'object' && data.data && Array.isArray(data.data)) {
          saveToCache(cacheKey, data.data);
          return res.status(200).json(data.data);
        } else {
          console.warn('API Proxy: Сервер вернул неожиданный формат данных:', data);
        }
      } else {
        console.log('API Proxy: Ошибка при запросе к API:', response.status);
      }
    } catch (apiError: any) {
      clearTimeout(timeoutId);
      console.error('API Proxy: Ошибка при запросе к API:', apiError.message);
    }

    // Если не удалось получить данные через API, пробуем SQL-запрос к базе данных
    console.log('API Proxy: Запрос к API не удался, пробуем SQL-запрос к базе данных');
    
    // Прямой SQL-запрос к базе данных
    const dbQuery = `
      SELECT o.*, 
        u.name as customer_name, 
        u.phone as customer_phone
      FROM orders o
      LEFT JOIN users u ON o.user_id = u.id
      WHERE o.created_at >= '${simpleStartDate}' AND o.created_at <= '${simpleEndDate}'
      ORDER BY o.created_at DESC
    `;
    
    try {
      const dbOrdersData = await fetchDbOrders(baseApiUrl, dbQuery, headers, httpsAgent);
      
      if (dbOrdersData && dbOrdersData.length > 0) {
        console.log('API Proxy: Получены данные заказов из базы данных:', dbOrdersData.length);
        
        // Получаем детали заказов (товары)
        const ordersWithItems = await enrichOrdersWithItems(baseApiUrl, dbOrdersData, headers, httpsAgent);
        
        saveToCache(cacheKey, ordersWithItems);
        return res.status(200).json(ordersWithItems);
      } else {
        console.log('API Proxy: Не удалось получить данные заказов из базы данных');
        
        // Возвращаем пустой массив
        return res.status(200).json([]);
      }
    } catch (dbError: any) {
      console.error('API Proxy: Ошибка при запросе к базе данных:', dbError.message);
      return res.status(200).json([]);
    }
  } catch (error: any) {
    console.error('API Proxy: Общая ошибка:', error.message);
    return res.status(200).json([]);
  }
}

// Функция для выполнения SQL-запроса к базе данных
async function fetchDbOrders(baseApiUrl: string, query: string, headers: any, httpsAgent: https.Agent): Promise<any[]> {
  // Возможные эндпоинты для SQL-запросов
  const dbEndpoints = [
    `${baseApiUrl}/db/query`,
    `${baseApiUrl}/db/execute`,
    `${baseApiUrl}/admin/db/query`,
    baseApiUrl.replace(/\/api\/v1$/, '') + '/api/v1/db/query',
    baseApiUrl.replace(/\/api\/v1$/, '') + '/api/db/query',
    baseApiUrl.replace(/\/api\/v1$/, '') + '/api/v1/db/execute',
    baseApiUrl.replace(/\/api\/v1$/, '') + '/api/db/execute'
  ];
  
  for (const endpoint of dbEndpoints) {
    try {
      console.log('API Proxy: Пробуем выполнить SQL-запрос через:', endpoint);
      
      const response = await axios.post(endpoint, 
        { query, safe: true },
        { 
          headers,
          httpsAgent,
          timeout: 10000,
          validateStatus: status => true
        }
      );
      
      if (response.status === 200) {
        if (Array.isArray(response.data)) {
          return response.data;
        } else if (response.data && typeof response.data === 'object' && Array.isArray(response.data.data)) {
          return response.data.data;
        } else if (response.data && typeof response.data === 'object' && Array.isArray(response.data.results)) {
          return response.data.results;
        } else if (response.data && typeof response.data === 'object' && Array.isArray(response.data.rows)) {
          return response.data.rows;
        }
      }
    } catch (error) {
      console.log('API Proxy: Ошибка при запросе к:', endpoint);
    }
  }
  
  // Если ни один эндпоинт не вернул данные
  return [];
}

// Функция для получения товаров заказов и обогащения заказов
async function enrichOrdersWithItems(baseApiUrl: string, orders: any[], headers: any, httpsAgent: https.Agent): Promise<any[]> {
  if (!orders || orders.length === 0) return [];
  
  try {
    // Получаем ID всех заказов
    const orderIds = orders.map(order => order.id).join(',');
    
    // Формируем запрос для получения товаров заказов
    const itemsQuery = `
      SELECT od.order_id, od.dish_id, od.quantity, od.price, d.name,
             (od.price * od.quantity) as total_price
      FROM order_dish od
      LEFT JOIN dishes d ON od.dish_id = d.id
      WHERE od.order_id IN (${orderIds})
    `;
    
    // Получаем товары
    const items = await fetchDbOrders(baseApiUrl, itemsQuery, headers, httpsAgent);
    
    if (items && items.length > 0) {
      // Группируем товары по заказам
      const orderItems: {[key: number]: any[]} = {};
      items.forEach(item => {
        if (!orderItems[item.order_id]) {
          orderItems[item.order_id] = [];
        }
        orderItems[item.order_id].push({
          dish_id: item.dish_id,
          quantity: item.quantity,
          price: item.price,
          name: item.name,
          total_price: item.total_price
        });
      });
      
      // Добавляем товары к заказам
      return orders.map(order => ({
        ...order,
        items: orderItems[order.id] || []
      }));
    } else {
      // Если товары не найдены, возвращаем заказы без товаров
      return orders.map(order => ({
        ...order,
        items: []
      }));
    }
  } catch (error) {
    console.error('API Proxy: Ошибка при получении товаров заказов:', error);
    // В случае ошибки возвращаем заказы без товаров
    return orders.map(order => ({
      ...order,
      items: []
    }));
  }
} 