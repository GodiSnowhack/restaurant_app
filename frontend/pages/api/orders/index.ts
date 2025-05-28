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

  // Получаем параметры запроса
  const { start_date, end_date } = req.query;
  
  // Ключ для кеширования
  const cacheKey = `orders_${start_date}_${end_date}`;
  
  // Проверяем наличие данных в кеше
  const cachedData = getFromCache(cacheKey);
  if (cachedData) {
    console.log('API Proxy: Данные заказов получены из кеша');
    return res.status(200).json(cachedData);
  }

  // Вывод информации о конфигурации окружения
  console.log('API Proxy: Переменные окружения:', {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
    NODE_ENV: process.env.NODE_ENV
  });

  // Получаем токен авторизации
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    console.log('API Proxy: Отсутствует токен авторизации');
    return res.status(401).json({ message: 'Отсутствует токен авторизации' });
  }
  
  // Получаем ID и роль пользователя из заголовков
  const userId = req.headers['x-user-id'] as string || '1';
  const userRole = (req.headers['x-user-role'] as string || 'admin').toLowerCase();

  // Логгируем параметры запроса
  console.log('API Proxy: Параметры запроса:', {
    start_date,
    end_date,
    status: req.query.status,
    user_id: req.query.user_id,
    headers: {
      'x-user-role': userRole,
      'x-user-id': userId,
      'authorization': token ? `Bearer ${token.substring(0, 10)}...` : undefined
    }
  });

  // Получаем базовый URL API
  const baseApiUrl = getDefaultApiUrl();
  console.log('API Proxy: Базовый URL API:', baseApiUrl);

  // Получаем прямой URL API для заказов
  const ordersApiUrl = getOrdersApiUrl();
  console.log('API Proxy: URL API заказов:', ordersApiUrl);

  // Убираем /api/v1 из базового URL, чтобы избежать дублирования
  let cleanBaseUrl = baseApiUrl;
  if (cleanBaseUrl.endsWith('/api/v1')) {
    cleanBaseUrl = cleanBaseUrl.substring(0, cleanBaseUrl.length - 7);
  }
  console.log('API Proxy: Очищенный базовый URL API:', cleanBaseUrl);

  // Формируем URL для запроса
    const queryParams = new URLSearchParams();
    if (start_date) queryParams.append('start_date', start_date as string);
    if (end_date) queryParams.append('end_date', end_date as string);
    
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

  // Сначала пробуем прямой запрос к API заказов
  let orderData = null;

  try {
    const directOrdersUrl = `${ordersApiUrl}${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
    console.log('API Proxy: Прямой запрос к API заказов:', directOrdersUrl);
    
    const directOrdersResponse = await axios.get(directOrdersUrl, {
      headers,
      httpsAgent,
      timeout: 15000,
      validateStatus: status => true
    });
    
    console.log('API Proxy: Ответ прямого запроса к API заказов, статус:', directOrdersResponse.status);
    
    if (directOrdersResponse.status === 200) {
      const directOrdersData = directOrdersResponse.data;
      
      if (Array.isArray(directOrdersData)) {
        console.log(`API Proxy: Получено ${directOrdersData.length} заказов через прямой запрос к API заказов`);
        orderData = directOrdersData;
      } else if (directOrdersData && typeof directOrdersData === 'object' && directOrdersData.items && Array.isArray(directOrdersData.items)) {
        console.log(`API Proxy: Получено ${directOrdersData.items.length} заказов в формате items через прямой запрос к API заказов`);
        orderData = directOrdersData.items;
      } else if (directOrdersData && typeof directOrdersData === 'object' && directOrdersData.status === 'success' && directOrdersData.data && Array.isArray(directOrdersData.data)) {
        console.log(`API Proxy: Получено ${directOrdersData.data.length} заказов в формате data.data через прямой запрос к API заказов`);
        orderData = directOrdersData.data;
      }
    }
  } catch (directOrdersError: any) {
    console.log('API Proxy: Ошибка при прямом запросе к API заказов:', directOrdersError.message);
  }

  // Если прямой запрос не сработал, пробуем другие пути
  if (!orderData) {
    console.log('API Proxy: Прямой запрос не удался, пробуем альтернативные пути');
    
    // Список возможных путей API для заказов
    const apiPaths = [
      '/api/v1/orders',
      '/orders',
      '/api/orders',
      '/api/v1/admin/orders',
      '/api/admin/orders'
    ];

    // Перебираем возможные пути API
    for (const path of apiPaths) {
      try {
        const fullUrl = `${cleanBaseUrl}${path}${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
        console.log(`API Proxy: Попытка получения данных по пути ${path}:`, fullUrl);
        
        const response = await axios.get(fullUrl, {
          headers,
          httpsAgent,
          timeout: 15000,
          validateStatus: status => true
        });
        
        console.log(`API Proxy: Ответ по пути ${path}, статус:`, response.status);
        
        if (response.status === 200) {
          const data = response.data;
          
          if (Array.isArray(data)) {
            console.log(`API Proxy: Получено ${data.length} заказов по пути ${path}`);
            orderData = data;
            break;
          } else if (data && typeof data === 'object' && data.items && Array.isArray(data.items)) {
            console.log(`API Proxy: Получено ${data.items.length} заказов в формате items по пути ${path}`);
            orderData = data.items;
            break;
          } else if (data && typeof data === 'object' && data.status === 'success' && data.data && Array.isArray(data.data)) {
            console.log(`API Proxy: Получено ${data.data.length} заказов в формате data.data по пути ${path}`);
            orderData = data.data;
            break;
          }
        }
      } catch (pathError: any) {
        console.log(`API Proxy: Ошибка при запросе к пути ${path}:`, pathError.message);
      }
    }
  }

  // Если получили данные, возвращаем их
  if (orderData) {
    console.log('API Proxy: Возвращаем полученные реальные данные');
    saveToCache(cacheKey, orderData);
    return res.status(200).json(orderData);
  } else {
    // Если не удалось получить данные, пробуем прямой запрос к базе данных
    console.log('API Proxy: Все попытки получить данные через API не удались, пробуем прямой запрос к базе данных');
    
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
      const dbEndpoint = `${cleanBaseUrl}/api/db/query`;
      console.log('API Proxy: Запрос к базе данных:', dbEndpoint);
      
      const dbResponse = await axios.post(dbEndpoint, 
        { query: dbQuery },
        { 
          headers,
          httpsAgent,
          timeout: 15000,
          validateStatus: status => true
        }
      );
      
      if (dbResponse.status === 200 && dbResponse.data) {
        console.log('API Proxy: Получены данные из базы данных');
        
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
        console.log('API Proxy: Не удалось получить данные из базы данных, возвращаем ошибку');
        return res.status(503).json({ 
          error: 'Не удалось получить данные заказов',
          message: 'Сервер временно недоступен. Пожалуйста, попробуйте позже.'
        });
      }
    } catch (dbError: any) {
      console.log('API Proxy: Ошибка при запросе к базе данных:', dbError.message);
      return res.status(503).json({ 
        error: 'Не удалось получить данные заказов',
        message: 'Сервер временно недоступен. Пожалуйста, попробуйте позже.'
      });
    }
  }
} 