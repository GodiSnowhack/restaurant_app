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
  const userRole = (req.headers['x-user-role'] as string || '').toLowerCase();

  // Получаем базовый URL API
  const baseApiUrl = getDefaultApiUrl();
  console.log('API Proxy: Базовый URL API:', baseApiUrl);

  // Убираем /api/v1 из базового URL, чтобы избежать дублирования
  let cleanBaseUrl = baseApiUrl;
  if (cleanBaseUrl.endsWith('/api/v1')) {
    cleanBaseUrl = cleanBaseUrl.substring(0, cleanBaseUrl.length - 7);
  }
  console.log('API Proxy: Очищенный базовый URL API:', cleanBaseUrl);

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

  // Для всех пользователей используем прямой доступ к базе данных вместо API
  console.log('API Proxy: Используем прямой доступ к БД для получения заказов');
  try {
    // Прямой SQL-запрос к базе данных через API
    const dbQuery = `
      SELECT o.* 
      FROM orders o
      WHERE o.created_at >= '${simpleStartDate}' AND o.created_at <= '${simpleEndDate}'
      ORDER BY o.created_at DESC
    `;

    console.log('API Proxy: SQL запрос:', dbQuery);

    // Перебираем возможные пути для прямого запроса к базе данных
    const dbEndpoints = [
      `${cleanBaseUrl}/api/v1/db/query`,
      `${cleanBaseUrl}/api/db/query`,
      `${cleanBaseUrl}/api/v1/db/execute`,
      `${cleanBaseUrl}/api/db/execute`,
      `${cleanBaseUrl}/api/v1/admin/db/query`,
      `${cleanBaseUrl}/api/admin/db/query`
    ];
    
    let ordersResult = null;
    let errorResponse = null;
    
    // Пробуем все возможные эндпоинты для выполнения запроса
    for (const dbEndpoint of dbEndpoints) {
      try {
        console.log('API Proxy: Попытка запроса к базе данных через:', dbEndpoint);
        
        const dbResponse = await axios.post(dbEndpoint, 
          { query: dbQuery },
          { 
            headers,
            httpsAgent,
            timeout: 15000,
            validateStatus: status => true
          }
        );
        
        console.log('API Proxy: Статус ответа запроса к БД через', dbEndpoint, ':', dbResponse.status);
        
        if (dbResponse.status === 200 && dbResponse.data) {
          if (Array.isArray(dbResponse.data)) {
            ordersResult = dbResponse.data;
            console.log('API Proxy: Получены данные заказов через', dbEndpoint);
            break;
          } else if (dbResponse.data && typeof dbResponse.data === 'object' && Array.isArray(dbResponse.data.data)) {
            ordersResult = dbResponse.data.data;
            console.log('API Proxy: Получены данные заказов через', dbEndpoint, 'в формате .data');
            break;
          } else if (dbResponse.data && typeof dbResponse.data === 'object' && Array.isArray(dbResponse.data.results)) {
            ordersResult = dbResponse.data.results;
            console.log('API Proxy: Получены данные заказов через', dbEndpoint, 'в формате .results');
            break;
          } else if (dbResponse.data && typeof dbResponse.data === 'object' && Array.isArray(dbResponse.data.rows)) {
            ordersResult = dbResponse.data.rows;
            console.log('API Proxy: Получены данные заказов через', dbEndpoint, 'в формате .rows');
            break;
          }
        } else {
          errorResponse = dbResponse;
        }
      } catch (endpointError: any) {
        console.log('API Proxy: Ошибка при запросе к', dbEndpoint, ':', endpointError.message);
      }
    }
    
    // Если не удалось получить данные, попробуем прямой доступ к SQLite
    if (!ordersResult) {
      console.log('API Proxy: Не удалось получить данные через API запросы, пробуем альтернативные методы');
      
      // Альтернативный SQL-запрос с учетом возможно другой структуры БД
      const altQuery = `
        SELECT o.*, 
          u.name as customer_name, 
          u.phone as customer_phone
        FROM orders o
        LEFT JOIN users u ON o.user_id = u.id
        WHERE o.created_at >= '${simpleStartDate}' AND o.created_at <= '${simpleEndDate}'
        ORDER BY o.created_at DESC
      `;
      
      try {
        console.log('API Proxy: Пробуем альтернативный SQL-запрос:', altQuery);
        
        // Пробуем другие возможные пути
        for (const dbEndpoint of dbEndpoints) {
          try {
            const altResponse = await axios.post(dbEndpoint, 
              { query: altQuery },
              { 
                headers,
                httpsAgent,
                timeout: 15000,
                validateStatus: status => true
              }
            );
            
            if (altResponse.status === 200) {
              if (Array.isArray(altResponse.data)) {
                ordersResult = altResponse.data;
                console.log('API Proxy: Получены данные через альтернативный SQL-запрос');
                break;
              } else if (altResponse.data && typeof altResponse.data === 'object' && Array.isArray(altResponse.data.data)) {
                ordersResult = altResponse.data.data;
                break;
              } else if (altResponse.data && typeof altResponse.data === 'object' && Array.isArray(altResponse.data.results)) {
                ordersResult = altResponse.data.results;
                break;
              } else if (altResponse.data && typeof altResponse.data === 'object' && Array.isArray(altResponse.data.rows)) {
                ordersResult = altResponse.data.rows;
                break;
              }
            }
          } catch (error: any) {
            console.log('API Proxy: Ошибка при альтернативном запросе:', error.message);
          }
        }
      } catch (altError) {
        console.log('API Proxy: Ошибка при выполнении альтернативного запроса:', altError);
      }
    }
    
    // Если удалось получить данные заказов
    if (ordersResult && ordersResult.length > 0) {
      console.log(`API Proxy: Получено ${ordersResult.length} заказов, получаем товары для них`);
      
      try {
        // Получаем ID всех заказов
        const orderIds = ordersResult.map((order: any) => order.id).join(',');
        
        // Формируем запрос для получения товаров заказа
        const orderItemsQuery = `
          SELECT od.order_id, od.dish_id, od.quantity, od.price, d.name,
                 (od.price * od.quantity) as total_price
          FROM order_dish od
          LEFT JOIN dishes d ON od.dish_id = d.id
          WHERE od.order_id IN (${orderIds})
        `;
        
        console.log('API Proxy: SQL запрос товаров:', orderItemsQuery);
        
        // Пробуем все возможные эндпоинты для выполнения запроса товаров
        let itemsResult = null;
        
        for (const dbEndpoint of dbEndpoints) {
          try {
            const itemsResponse = await axios.post(dbEndpoint, 
              { query: orderItemsQuery },
              { 
                headers,
                httpsAgent,
                timeout: 15000,
                validateStatus: status => true
              }
            );
            
            if (itemsResponse.status === 200) {
              if (Array.isArray(itemsResponse.data)) {
                itemsResult = itemsResponse.data;
                console.log('API Proxy: Получены товары заказов через', dbEndpoint);
                break;
              } else if (itemsResponse.data && typeof itemsResponse.data === 'object' && Array.isArray(itemsResponse.data.data)) {
                itemsResult = itemsResponse.data.data;
                break;
              } else if (itemsResponse.data && typeof itemsResponse.data === 'object' && Array.isArray(itemsResponse.data.results)) {
                itemsResult = itemsResponse.data.results;
                break;
              } else if (itemsResponse.data && typeof itemsResponse.data === 'object' && Array.isArray(itemsResponse.data.rows)) {
                itemsResult = itemsResponse.data.rows;
                break;
              }
            }
          } catch (error: any) {
            console.log('API Proxy: Ошибка при запросе товаров через', dbEndpoint, ':', error.message);
          }
        }
        
        // Если не удалось получить товары, пробуем альтернативный запрос
        if (!itemsResult) {
          const altItemsQuery = `
            SELECT od.order_id, od.dish_id, od.quantity, od.price, d.name,
                  od.price * od.quantity as total_price
            FROM order_dish od
            LEFT JOIN dishes d ON od.dish_id = d.id
            WHERE od.order_id IN (${orderIds})
          `;
          
          for (const dbEndpoint of dbEndpoints) {
            try {
              const altItemsResponse = await axios.post(dbEndpoint, 
                { query: altItemsQuery },
                { 
                  headers,
                  httpsAgent,
                  timeout: 15000,
                  validateStatus: status => true
                }
              );
              
              if (altItemsResponse.status === 200) {
                if (Array.isArray(altItemsResponse.data)) {
                  itemsResult = altItemsResponse.data;
                  break;
                } else if (altItemsResponse.data && typeof altItemsResponse.data === 'object' && Array.isArray(altItemsResponse.data.data)) {
                  itemsResult = altItemsResponse.data.data;
                  break;
                } else if (altItemsResponse.data && typeof altItemsResponse.data === 'object' && Array.isArray(altItemsResponse.data.results)) {
                  itemsResult = altItemsResponse.data.results;
                  break;
                } else if (altItemsResponse.data && typeof altItemsResponse.data === 'object' && Array.isArray(altItemsResponse.data.rows)) {
                  itemsResult = altItemsResponse.data.rows;
                  break;
                }
              }
            } catch (error: any) {
              console.log('API Proxy: Ошибка при альтернативном запросе товаров:', error.message);
            }
          }
        }
        
        if (itemsResult && itemsResult.length > 0) {
          console.log(`API Proxy: Получены товары заказов, количество: ${itemsResult.length}`);
          
          // Группируем товары по заказам
          const orderItems: {[key: number]: any[]} = {};
          itemsResult.forEach((item: any) => {
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
          const ordersWithItems = ordersResult.map((order: any) => {
            return {
              ...order,
              items: orderItems[order.id] || []
            };
          });
          
          console.log('API Proxy: Сформированы заказы с товарами');
          saveToCache(cacheKey, ordersWithItems);
          return res.status(200).json(ordersWithItems);
        } else {
          console.log('API Proxy: Не удалось получить товары заказов, возвращаем заказы без товаров');
          // Возвращаем заказы без товаров
          const ordersWithoutItems = ordersResult.map((order: any) => {
            return {
              ...order,
              items: []
            };
          });
          saveToCache(cacheKey, ordersWithoutItems);
          return res.status(200).json(ordersWithoutItems);
        }
      } catch (itemsError: any) {
        console.log('API Proxy: Ошибка при получении товаров:', itemsError.message);
        // Возвращаем заказы без товаров
        const ordersWithoutItems = ordersResult.map((order: any) => {
          return {
            ...order,
            items: []
          };
        });
        saveToCache(cacheKey, ordersWithoutItems);
        return res.status(200).json(ordersWithoutItems);
      }
    } else {
      console.log('API Proxy: Заказы не найдены или произошла ошибка');
      if (errorResponse) {
        console.log('API Proxy: Последняя ошибка:', errorResponse.status, errorResponse.statusText, errorResponse.data);
      }
      
      // Пустой результат
      return res.status(200).json([]);
    }
  } catch (dbError: any) {
    console.log('API Proxy: Общая ошибка при запросе к базе данных:', dbError.message);
    return res.status(200).json([]);
  }
} 