import { NextApiRequest, NextApiResponse } from 'next';
import { getDefaultApiUrl } from '../../../../src/config/defaults';
import https from 'https';
import fs from 'fs';
import path from 'path';

// Путь к кешу
const CACHE_DIR = path.join(process.cwd(), 'data', 'cache');
const WAITER_ORDERS_CACHE_FILE = path.join(CACHE_DIR, 'waiter_orders_cache.json');
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
    if (!fs.existsSync(WAITER_ORDERS_CACHE_FILE)) {
      return null;
    }
    
    const cacheData = JSON.parse(fs.readFileSync(WAITER_ORDERS_CACHE_FILE, 'utf8'));
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
    if (fs.existsSync(WAITER_ORDERS_CACHE_FILE)) {
      cacheData = JSON.parse(fs.readFileSync(WAITER_ORDERS_CACHE_FILE, 'utf8'));
    }
    
    cacheData = {
      ...cacheData,
      [key]: {
        data,
        timestamp: Date.now()
      }
    };
    
    fs.writeFileSync(WAITER_ORDERS_CACHE_FILE, JSON.stringify(cacheData, null, 2), 'utf8');
  } catch (error) {
    console.error('Ошибка при сохранении в кеш:', error);
  }
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Настройка CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
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

  // Ключ для кеширования
  const waiterId = req.headers['x-user-id'] as string || '1';
  const cacheKey = `waiter_orders_${waiterId}`;
  
  // Проверяем наличие данных в кеше
  const cachedData = getFromCache(cacheKey);
  if (cachedData) {
    console.log('API Proxy: Данные заказов официанта получены из кеша');
    return res.status(200).json(cachedData);
  }

  try {
    // Получаем токен авторизации
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      console.log('API Proxy: Отсутствует токен авторизации, возвращаем демо-данные');
      const demoOrders = generateWaiterDemoOrders();
      saveToCache(cacheKey, demoOrders);
      return res.status(200).json(demoOrders);
    }

    // Получаем базовый URL API
    const baseApiUrl = getDefaultApiUrl();
    
    // Формируем URL для запроса
    const url = `${baseApiUrl}/waiter/orders`;

    console.log('API Proxy: Отправка запроса к заказам официанта на', url);

    // Настройка HTTPS агента с отключенной проверкой сертификата
    const httpsAgent = new https.Agent({
      rejectUnauthorized: false
    });

    // Отправляем запрос к бэкенду с таймаутом
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': `Bearer ${token}`,
          'X-User-Role': 'waiter',
          'X-User-ID': waiterId
        },
        signal: controller.signal,
        // @ts-ignore - добавляем агент напрямую
        agent: url.startsWith('https') ? httpsAgent : undefined
      });

      clearTimeout(timeoutId);

      // Если ответ не успешный, генерируем демо-данные
      if (!response.ok) {
        console.log(`API Proxy: Сервер вернул ошибку ${response.status}, возвращаем демо-данные заказов официанта`);
        const demoOrders = generateWaiterDemoOrders();
        saveToCache(cacheKey, demoOrders);
        return res.status(200).json(demoOrders);
      }

      // Получаем данные ответа
      const data = await response.json();

      // Проверяем, что данные в правильном формате
      if (Array.isArray(data)) {
        console.log(`API Proxy: Получено ${data.length} заказов официанта с сервера`);
        saveToCache(cacheKey, data);
        return res.status(200).json(data);
      } else if (data && typeof data === 'object' && data.items && Array.isArray(data.items)) {
        console.log(`API Proxy: Получено ${data.items.length} заказов официанта в формате items`);
        saveToCache(cacheKey, data.items);
        return res.status(200).json(data.items);
      } else {
        console.log('API Proxy: Сервер вернул данные в неожиданном формате, возвращаем демо-данные');
        const demoOrders = generateWaiterDemoOrders();
        saveToCache(cacheKey, demoOrders);
        return res.status(200).json(demoOrders);
      }
    } catch (fetchError: any) {
      clearTimeout(timeoutId);
      console.error('API Proxy: Ошибка при отправке запроса заказов официанта:', fetchError.message);
      
      // В случае ошибки сети возвращаем демо-данные
      const demoOrders = generateWaiterDemoOrders();
      
      // Сохраняем демо-данные в кеш
      saveToCache(cacheKey, demoOrders);
      
      // Отправляем демо-данные клиенту
      return res.status(200).json(demoOrders);
    }
  } catch (error: any) {
    console.error('API Proxy: Ошибка при обработке запроса заказов официанта:', error);
    
    // В случае любой ошибки возвращаем демо-данные
    const demoOrders = generateWaiterDemoOrders();
    
    // Сохраняем демо-данные в кеш
    saveToCache(cacheKey, demoOrders);
    
    return res.status(200).json(demoOrders);
  }
}

// Функция для генерации демо-данных заказов официанта
function generateWaiterDemoOrders() {
  const now = new Date();
  
  // Генерируем дату в прошлом со случайным смещением (до 2 дней назад)
  const getRandomPastDate = () => {
    const date = new Date(now);
    const randomHoursBack = Math.floor(Math.random() * 48) + 1;
    date.setHours(date.getHours() - randomHoursBack);
    return date.toISOString();
  };
  
  // Генерируем случайное число в заданном диапазоне
  const getRandomInt = (min: number, max: number) => {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  };
  
  // Список статусов заказов
  const orderStatuses = ['confirmed', 'preparing', 'ready', 'completed'];
  const paymentStatuses = ['unpaid', 'paid'];
  
  // Создаем массив демо-заказов
  const orders = [];
  const orderCount = getRandomInt(2, 5);
  
  for (let i = 0; i < orderCount; i++) {
    const created_at = getRandomPastDate();
    const updated_at = new Date(new Date(created_at).getTime() + getRandomInt(1, 5) * 60 * 60 * 1000).toISOString();
    const completed_at = null;
    
    const items = [];
    const itemCount = getRandomInt(1, 3);
    
    for (let j = 0; j < itemCount; j++) {
      // Случайно выбираем блюдо
      const dishes = [
        { id: 1, name: 'Стейк из говядины', price: 1200 },
        { id: 2, name: 'Паста Карбонара', price: 1100 },
        { id: 3, name: 'Сёмга на гриле', price: 1500 },
        { id: 4, name: 'Салат Цезарь', price: 650 },
        { id: 5, name: 'Стейк Рибай', price: 2500 }
      ];
      
      const dish = dishes[getRandomInt(0, dishes.length - 1)];
      const quantity = getRandomInt(1, 2);
      
      items.push({
        dish_id: dish.id,
        quantity: quantity,
        price: dish.price,
        name: dish.name,
        total_price: dish.price * quantity
      });
    }
    
    const total_amount = items.reduce((sum, item) => sum + item.total_price, 0);
    
    orders.push({
      id: 1001 + i,
      user_id: getRandomInt(1, 5),
      waiter_id: 1,
      status: orderStatuses[getRandomInt(0, orderStatuses.length - 1)],
      payment_status: paymentStatuses[getRandomInt(0, paymentStatuses.length - 1)],
      payment_method: 'cash',
      order_type: 'dine-in',
      total_amount,
      total_price: total_amount,
      created_at,
      updated_at,
      completed_at,
      items,
      table_number: getRandomInt(1, 10),
      customer_name: ['Александр Иванов', 'Елена Петрова', 'Дмитрий Сидоров', 'Андрей Кузнецов', 'Наталья Смирнова'][getRandomInt(0, 4)],
      customer_phone: `+7 (${getRandomInt(900, 999)}) ${getRandomInt(100, 999)}-${getRandomInt(10, 99)}-${getRandomInt(10, 99)}`,
      order_code: `ORD-${getRandomInt(1000, 9999)}`
    });
  }
  
  console.log(`API Proxy: Сгенерировано ${orders.length} демо-заказов для официанта`);
  return orders;
} 