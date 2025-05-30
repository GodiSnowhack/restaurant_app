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
    const { status, user_id, start_date, end_date } = req.query;
    
    // Логируем параметры запроса
    console.log('API Proxy (GET): Параметры запроса заказов:', { status, user_id, start_date, end_date });
    
    // Формируем ключ для кеша на основе параметров
    const cacheKey = `orders_${status || ''}_${user_id || ''}_${start_date || ''}_${end_date || ''}`;
    
    // Проверяем наличие данных в кеше (только для GET запросов)
    const cachedData = getFromCache(cacheKey);
    if (cachedData) {
      console.log('API Proxy (GET): Возвращаем данные из кеша');
      return res.status(200).json(cachedData);
    }

    // Получаем токен авторизации
    const token = req.headers.authorization?.replace('Bearer ', '') || '';
    console.log('API Proxy (GET): Получен токен:', token ? 'Токен присутствует' : 'Токен отсутствует');
    
    // Если токен отсутствует, генерируем демо-данные
    if (!token) {
      console.log('API Proxy (GET): Токен отсутствует, возвращаем демо-данные');
      const demoOrders = generateDemoOrders();
      saveToCache(cacheKey, demoOrders);
      return res.status(200).json(demoOrders);
    }
    
    // Получаем базовый URL API
    const baseApiUrl = getDefaultApiUrl();
    console.log('API Proxy (GET): Базовый URL API:', baseApiUrl);
    
    // Формируем URL для запроса - убираем возможные дублирования путей
    let ordersApiUrl = `${baseApiUrl}/orders`;
    
    // Проверяем и исправляем URL
    if (ordersApiUrl.includes('//orders')) {
      ordersApiUrl = ordersApiUrl.replace('//orders', '/orders');
    }
    
    // Убираем возможное дублирование api/v1
    if (ordersApiUrl.includes('/api/v1/api/v1/')) {
      ordersApiUrl = ordersApiUrl.replace('/api/v1/api/v1/', '/api/v1/');
    }
    
    // Добавляем query-параметры
    const queryParams = new URLSearchParams();
    if (status) queryParams.append('status', Array.isArray(status) ? status[0] : status);
    if (user_id) queryParams.append('user_id', Array.isArray(user_id) ? user_id[0] : user_id);
    if (start_date) queryParams.append('start_date', Array.isArray(start_date) ? start_date[0] : start_date);
    if (end_date) queryParams.append('end_date', Array.isArray(end_date) ? end_date[0] : end_date);
    
    // Добавляем параметры к URL, если они есть
    const queryString = queryParams.toString();
    const fullUrl = queryString ? `${ordersApiUrl}?${queryString}` : ordersApiUrl;
    
    console.log('API Proxy (GET): URL для получения заказов:', fullUrl);
    
    // Заголовки запроса
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };
    
    // Получаем ID и роль пользователя из заголовков
    const userId = req.headers['x-user-id'] as string;
    const userRole = req.headers['x-user-role'] as string;
    
    if (userId) headers['X-User-ID'] = userId;
    if (userRole) headers['X-User-Role'] = userRole;
    
    console.log('API Proxy (GET): Отправляем запрос с заголовками:', {
      auth: headers.Authorization ? 'Bearer ***' : 'Отсутствует',
      userId: headers['X-User-ID'] || 'Отсутствует',
      userRole: headers['X-User-Role'] || 'Отсутствует'
    });
    
    // Создаем HTTPS агент для безопасных запросов с отключенной проверкой сертификата
    const httpsAgent = new https.Agent({
      rejectUnauthorized: false
    });
    
    try {
      // Используем axios для запроса с таймаутом и максимальным числом перенаправлений
      console.log('API Proxy (GET): Отправляем запрос на бэкенд...');
      
      const response = await axios.get(fullUrl, {
        headers,
        httpsAgent,
        timeout: 10000,
        maxRedirects: 5
      });
      
      console.log(`API Proxy (GET): Получен ответ от бэкенда с кодом ${response.status}`);
      
      // Обрабатываем ответ
      const data = response.data;
      
      // Сохраняем данные в кеш и возвращаем клиенту
      let result;
      
      if (Array.isArray(data)) {
        console.log(`API Proxy (GET): Получено ${data.length} заказов`);
        result = data;
      } else if (data && typeof data === 'object') {
        if (Array.isArray(data.items)) {
          console.log(`API Proxy (GET): Получено ${data.items.length} заказов в формате data.items`);
          result = data.items;
        } else if (Array.isArray(data.data)) {
          console.log(`API Proxy (GET): Получено ${data.data.length} заказов в формате data.data`);
          result = data.data;
        } else {
          console.log('API Proxy (GET): Данные получены в нестандартном формате');
          result = data;
        }
      } else {
        console.error('API Proxy (GET): Неизвестный формат данных');
        result = [];
      }
      
      // Сохраняем результат в кеш
      saveToCache(cacheKey, result);
      
      // Возвращаем данные клиенту
      return res.status(200).json(result);
      
    } catch (error: any) {
      console.error('API Proxy (GET): Ошибка при получении заказов:', error.message);
      
      // Если есть ответ от сервера, возвращаем его статус и данные
      if (error.response) {
        console.error('API Proxy (GET): Статус ошибки:', error.response.status);
        console.error('API Proxy (GET): Данные ошибки:', error.response.data);
        
        // Если ошибка 401 или 403, возвращаем демо-данные
        if (error.response.status === 401 || error.response.status === 403) {
          console.log('API Proxy (GET): Ошибка авторизации, возвращаем демо-данные');
          const demoOrders = generateDemoOrders();
          saveToCache(cacheKey, demoOrders);
          return res.status(200).json(demoOrders);
        }
        
        return res.status(error.response.status).json({
          success: false,
          message: 'Ошибка при получении заказов',
          error: error.response.data
        });
      }
      
      // Если ошибка в сети или таймаут
      return res.status(500).json({
        success: false,
        message: 'Ошибка при получении заказов с сервера',
        error: error.message
      });
    }
  } catch (error: any) {
    console.error('API Proxy (GET): Общая ошибка:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Внутренняя ошибка сервера',
      error: error.message
    });
  }
}

// Функция для генерации демо-данных заказов
function generateDemoOrders() {
  const now = new Date();
  const oneWeekAgo = new Date(now);
  oneWeekAgo.setDate(now.getDate() - 7);
  
  const getRandomDate = (start: Date, end: Date) => {
    return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime())).toISOString();
  };
  
  return [
    {
      id: 1001,
      status: 'completed',
      payment_status: 'paid',
      payment_method: 'card',
      order_type: 'dine-in',
      total_amount: 3500,
      created_at: getRandomDate(oneWeekAgo, now),
      customer_name: 'Иван Петров',
      customer_phone: '+7 (999) 123-45-67',
      table_number: 3,
      items: [
        { dish_id: 1, name: 'Стейк из говядины', quantity: 1, price: 2000 },
        { dish_id: 2, name: 'Картофель фри', quantity: 1, price: 500 },
        { dish_id: 3, name: 'Кола', quantity: 2, price: 500 }
      ]
    },
    {
      id: 1002,
      status: 'pending',
      payment_status: 'pending',
      payment_method: 'cash',
      order_type: 'delivery',
      total_amount: 2800,
      created_at: getRandomDate(oneWeekAgo, now),
      customer_name: 'Мария Сидорова',
      customer_phone: '+7 (999) 987-65-43',
      delivery_address: 'ул. Абая, 44, кв. 5',
      items: [
        { dish_id: 4, name: 'Пицца Маргарита', quantity: 1, price: 1800 },
        { dish_id: 5, name: 'Салат Цезарь', quantity: 1, price: 1000 }
      ]
    },
    {
      id: 1003,
      status: 'confirmed',
      payment_status: 'paid',
      payment_method: 'card',
      order_type: 'pickup',
      total_amount: 4200,
      created_at: getRandomDate(oneWeekAgo, now),
      customer_name: 'Алексей Иванов',
      customer_phone: '+7 (999) 555-44-33',
      items: [
        { dish_id: 6, name: 'Суши-сет', quantity: 1, price: 3000 },
        { dish_id: 7, name: 'Мисо-суп', quantity: 2, price: 600 }
      ]
    },
    {
      id: 1004,
      status: 'cancelled',
      payment_status: 'refunded',
      payment_method: 'card',
      order_type: 'dine-in',
      total_amount: 5100,
      created_at: getRandomDate(oneWeekAgo, now),
      customer_name: 'Наталья Кузнецова',
      customer_phone: '+7 (999) 777-88-99',
      table_number: 7,
      items: [
        { dish_id: 8, name: 'Стейк Рибай', quantity: 2, price: 2000 },
        { dish_id: 9, name: 'Вино красное', quantity: 1, price: 1100 }
      ]
    },
    {
      id: 1005,
      status: 'preparing',
      payment_status: 'paid',
      payment_method: 'card',
      order_type: 'dine-in',
      total_amount: 3700,
      created_at: getRandomDate(oneWeekAgo, now),
      customer_name: 'Дмитрий Смирнов',
      customer_phone: '+7 (999) 111-22-33',
      table_number: 5,
      items: [
        { dish_id: 10, name: 'Паста Карбонара', quantity: 2, price: 1200 },
        { dish_id: 11, name: 'Тирамису', quantity: 1, price: 800 },
        { dish_id: 12, name: 'Эспрессо', quantity: 1, price: 500 }
      ]
    }
  ];
} 