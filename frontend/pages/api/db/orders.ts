import { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs';
import path from 'path';
import axios from 'axios';
import { getDefaultApiUrl } from '../../../src/config/defaults';
import https from 'https';

// Путь к кешу
const CACHE_DIR = path.join(process.cwd(), 'data', 'cache');
const ORDERS_CACHE_FILE = path.join(CACHE_DIR, 'orders_direct_cache.json');
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

  // Получаем параметры запроса
  const { start_date, end_date } = req.query;
  
  // Ключ для кеширования
  const cacheKey = `orders_direct_${start_date}_${end_date}`;
  
  // Проверяем наличие данных в кеше
  const cachedData = getFromCache(cacheKey);
  if (cachedData) {
    console.log('API DB Proxy: Данные заказов получены из кеша');
    return res.status(200).json(cachedData);
  }

  // Получаем токен авторизации
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    console.log('API DB Proxy: Отсутствует токен авторизации');
    return res.status(401).json({ message: 'Отсутствует токен авторизации' });
  }
  
  // Получаем ID и роль пользователя из заголовков
  const userId = req.headers['x-user-id'] as string || '1';
  const userRole = (req.headers['x-user-role'] as string || 'admin').toLowerCase();

  // Получаем базовый URL API
  const baseApiUrl = getDefaultApiUrl();
  console.log('API DB Proxy: Базовый URL API:', baseApiUrl);

  // Убираем /api/v1 из базового URL
  let cleanBaseUrl = baseApiUrl;
  if (cleanBaseUrl.endsWith('/api/v1')) {
    cleanBaseUrl = cleanBaseUrl.substring(0, cleanBaseUrl.length - 7);
  }
  console.log('API DB Proxy: Очищенный базовый URL API:', cleanBaseUrl);

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

  console.log('API DB Proxy: Заголовки запроса:', {
    ...headers,
    'Authorization': 'Bearer [скрыто]'
  });

  try {
    // Прямой SQL-запрос к базе данных через API
    const dbQuery = `
      SELECT o.*, json_group_array(json_object(
        'dish_id', od.dish_id,
        'quantity', od.quantity,
        'price', od.price,
        'name', d.name,
        'total_price', od.price * od.quantity
      )) as items
      FROM orders o
      LEFT JOIN order_dish od ON o.id = od.order_id
      LEFT JOIN dishes d ON od.dish_id = d.id
      WHERE o.created_at >= '${start_date}' AND o.created_at <= '${end_date}'
      GROUP BY o.id
      ORDER BY o.created_at DESC
    `;

    // Формируем URL для прямого запроса к базе данных
    const dbEndpoint = `${cleanBaseUrl}/api/v1/db/query`;
    console.log('API DB Proxy: Запрос к базе данных:', dbEndpoint);
    
    const dbResponse = await axios.post(dbEndpoint, 
      { query: dbQuery },
      { 
        headers,
        httpsAgent,
        timeout: 15000
      }
    );
    
    if (dbResponse.status === 200 && dbResponse.data) {
      console.log('API DB Proxy: Получены данные из базы данных');
      
      // Преобразуем данные в нужный формат
      const ordersData = dbResponse.data.map((order: any) => {
        // Преобразуем items из строки в объект, если это необходимо
        let items = order.items;
        if (typeof items === 'string') {
          try {
            items = JSON.parse(items);
          } catch (e) {
            items = [];
          }
        }
        
        return {
          ...order,
          items: items || []
        };
      });
      
      saveToCache(cacheKey, ordersData);
      return res.status(200).json(ordersData);
    } else {
      console.log('API DB Proxy: Не удалось получить данные из базы данных');
      return res.status(500).json({ 
        error: 'Не удалось получить данные заказов из базы данных',
        message: 'Ошибка при выполнении запроса к базе данных.'
      });
    }
  } catch (error: any) {
    console.log('API DB Proxy: Ошибка при запросе к базе данных:', error.message);
    return res.status(500).json({ 
      error: 'Ошибка при запросе к базе данных',
      message: error.message
    });
  }
} 