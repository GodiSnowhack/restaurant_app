import { NextApiRequest, NextApiResponse } from 'next';
import { getDefaultApiUrl, getOrdersApiUrl } from '../../../src/config/defaults';
import https from 'https';
import axios from 'axios';
import fs from 'fs';
import path from 'path';

// Путь к кешу
const CACHE_DIR = path.join(process.cwd(), 'data', 'cache');
const ORDER_CACHE_PREFIX = 'order_';
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
    const cacheFilePath = path.join(CACHE_DIR, `${key}.json`);
    
    if (!fs.existsSync(cacheFilePath)) {
      return null;
    }
    
    const cacheData = JSON.parse(fs.readFileSync(cacheFilePath, 'utf8'));
    
    if (Date.now() - cacheData.timestamp > CACHE_TTL) {
      // Кеш устарел
      return null;
    }
    
    return cacheData.data;
  } catch (error) {
    console.error('Ошибка при чтении кеша:', error);
    return null;
  }
};

// Сохранение данных в кеш
const saveToCache = (key: string, data: any) => {
  try {
    ensureCacheDir();
    const cacheFilePath = path.join(CACHE_DIR, `${key}.json`);
    
    const cacheData = {
      data,
      timestamp: Date.now()
    };
    
    fs.writeFileSync(cacheFilePath, JSON.stringify(cacheData, null, 2), 'utf8');
  } catch (error) {
    console.error('Ошибка при сохранении в кеш:', error);
  }
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Настройка CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization, X-User-ID, X-User-Role'
  );

  // Обработка префлайт-запросов
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // Получаем ID заказа из запроса
    const { id } = req.query;
    if (!id || Array.isArray(id)) {
      return res.status(400).json({ message: 'Требуется указать ID заказа' });
    }
    
    // Получаем токен авторизации
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ message: 'Отсутствует токен авторизации' });
    }
    
    // Получаем ID и роль пользователя из заголовков
    const userId = req.headers['x-user-id'] as string || '1';
    const userRole = (req.headers['x-user-role'] as string || 'admin').toLowerCase();
    
    // Заголовки запроса
    const headers = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'X-User-Role': userRole,
      'X-User-ID': userId
    };

    // HTTPS агент для безопасных запросов
    const httpsAgent = new https.Agent({
      rejectUnauthorized: false
    });

    // GET запрос - получение заказа
    if (req.method === 'GET') {
      // Ключ для кеширования
      const cacheKey = `${ORDER_CACHE_PREFIX}${id}`;
      
      // Проверяем наличие данных в кеше
      const cachedData = getFromCache(cacheKey);
      if (cachedData) {
        console.log(`API Proxy: Данные заказа #${id} получены из кеша`);
        return res.status(200).json(cachedData);
      }
      
      // Определяем URL-ы для запросов
      const baseApiUrl = getDefaultApiUrl();
      const ordersApiUrl = getOrdersApiUrl();
      
      // Очищаем baseApiUrl от возможного двойного /api/v1
      let cleanBaseUrl = baseApiUrl;
      if (cleanBaseUrl.endsWith('/api/v1')) {
        cleanBaseUrl = cleanBaseUrl.substring(0, cleanBaseUrl.length - 7);
      }

      // Список возможных эндпоинтов
      const apiEndpoints = [
        { url: `${ordersApiUrl}/${id}`, description: 'прямой URL заказов' },
        { url: `${cleanBaseUrl}/api/v1/orders/${id}`, description: 'основной API путь' },
        { url: `${cleanBaseUrl}/orders/${id}`, description: 'короткий путь' },
        { url: `${cleanBaseUrl}/api/orders/${id}`, description: 'альтернативный API путь' }
      ];
      
      let orderData = null;
      let error = null;
      
      // Перебираем все эндпоинты
      for (const endpoint of apiEndpoints) {
        try {
          console.log(`API Proxy: Пробуем получить заказ #${id} через ${endpoint.description}:`, endpoint.url);
          
          const response = await axios.get(endpoint.url, {
            headers,
            httpsAgent,
            timeout: 15000
          });
          
          console.log(`API Proxy: Ответ от ${endpoint.description}, статус:`, response.status);
          
          if (response.status === 200 && response.data) {
            console.log(`API Proxy: Получены данные заказа #${id} от ${endpoint.description}`);
            orderData = response.data;
            break;
          } else if (response.status === 401) {
            error = { status: 401, message: 'Ошибка авторизации. Пожалуйста, войдите в систему заново.' };
            break;
          } else if (response.status === 404) {
            error = { status: 404, message: `Заказ #${id} не найден` };
          }
        } catch (endpointError: any) {
          console.log(`API Proxy: Ошибка при запросе к ${endpoint.description}:`, endpointError.message);
        }
      }
      
      // Если получили данные, возвращаем их
      if (orderData) {
        saveToCache(cacheKey, orderData);
        return res.status(200).json(orderData);
      }
      
      // Если есть ошибка, возвращаем её
      if (error) {
        return res.status(error.status).json({ message: error.message });
      }
      
      // Если заказ не найден и нет других ошибок
      return res.status(404).json({ message: `Заказ #${id} не найден` });
    }
    
    // PATCH запрос - обновление заказа
    if (req.method === 'PATCH') {
      const updateData = req.body;
      
      // Базовый URL API
      const baseApiUrl = getDefaultApiUrl();
      
      // Очищаем baseApiUrl от возможного двойного /api/v1
      let cleanBaseUrl = baseApiUrl;
      if (cleanBaseUrl.endsWith('/api/v1')) {
        cleanBaseUrl = cleanBaseUrl.substring(0, cleanBaseUrl.length - 7);
      }
      
      // URL для обновления заказа
      const updateUrl = `${cleanBaseUrl}/api/v1/orders/${id}`;
      console.log(`API Proxy: Обновление заказа #${id}:`, updateUrl);
      
      try {
        const response = await axios.patch(updateUrl, updateData, {
          headers,
          httpsAgent,
          timeout: 15000
        });
        
        console.log(`API Proxy: Ответ на обновление заказа #${id}, статус:`, response.status);
        
        if (response.status === 200) {
          // Очищаем кеш для обновленного заказа
          const cacheKey = `${ORDER_CACHE_PREFIX}${id}`;
          const cacheFilePath = path.join(CACHE_DIR, `${cacheKey}.json`);
          if (fs.existsSync(cacheFilePath)) {
            fs.unlinkSync(cacheFilePath);
          }
          
          return res.status(200).json(response.data);
        } else {
          return res.status(response.status).json(response.data || { message: 'Ошибка при обновлении заказа' });
        }
      } catch (error: any) {
        console.error(`API Proxy: Ошибка при обновлении заказа #${id}:`, error.message);
        
        if (error.response) {
          return res.status(error.response.status).json(error.response.data);
        }
        
        return res.status(500).json({ 
          message: 'Ошибка при обновлении заказа', 
          error: error.message 
        });
      }
    }
    
    // DELETE запрос - удаление заказа
    if (req.method === 'DELETE') {
      // Базовый URL API
      const baseApiUrl = getDefaultApiUrl();
      
      // Очищаем baseApiUrl от возможного двойного /api/v1
      let cleanBaseUrl = baseApiUrl;
      if (cleanBaseUrl.endsWith('/api/v1')) {
        cleanBaseUrl = cleanBaseUrl.substring(0, cleanBaseUrl.length - 7);
      }
      
      // URL для удаления заказа
      const deleteUrl = `${cleanBaseUrl}/api/v1/orders/${id}`;
      console.log(`API Proxy: Удаление заказа #${id}:`, deleteUrl);
      
      try {
        const response = await axios.delete(deleteUrl, {
          headers,
          httpsAgent,
          timeout: 15000
        });
        
        console.log(`API Proxy: Ответ на удаление заказа #${id}, статус:`, response.status);
        
        if (response.status === 200 || response.status === 204) {
          // Очищаем кеш для удаленного заказа
          const cacheKey = `${ORDER_CACHE_PREFIX}${id}`;
          const cacheFilePath = path.join(CACHE_DIR, `${cacheKey}.json`);
          if (fs.existsSync(cacheFilePath)) {
            fs.unlinkSync(cacheFilePath);
          }
          
          return res.status(200).json({ 
            success: true, 
            message: `Заказ #${id} успешно удален` 
          });
        } else {
          return res.status(response.status).json(response.data || { 
            success: false, 
            message: 'Ошибка при удалении заказа' 
          });
        }
      } catch (error: any) {
        console.error(`API Proxy: Ошибка при удалении заказа #${id}:`, error.message);
        
        if (error.response) {
          return res.status(error.response.status).json({
            success: false,
            ...error.response.data
          });
        }
        
        return res.status(500).json({ 
          success: false,
          message: 'Ошибка при удалении заказа', 
          error: error.message 
        });
      }
    }
    
    // Если метод не поддерживается
    return res.status(405).json({ message: 'Метод не поддерживается' });
  } catch (error: any) {
    console.error('API Proxy: Непредвиденная ошибка:', error);
    return res.status(500).json({ 
      message: 'Внутренняя ошибка сервера', 
      error: error.message 
    });
  }
} 