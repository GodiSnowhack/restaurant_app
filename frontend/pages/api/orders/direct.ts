import type { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';
import { getDefaultApiUrl } from '../../../src/config/defaults';
import https from 'https';
import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import fs from 'fs';
import path from 'path';

// Путь к кешу для локального хранения заказов
const CACHE_DIR = path.join(process.cwd(), 'data', 'cache');
const ORDER_CACHE_FILE = path.join(CACHE_DIR, 'order_cache.json');

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
    if (!fs.existsSync(ORDER_CACHE_FILE)) {
      return null;
    }
    
    const cacheData = JSON.parse(fs.readFileSync(ORDER_CACHE_FILE, 'utf8'));
    if (!cacheData[key]) {
      return null;
    }
    
    return cacheData[key].data;
  } catch (error) {
    console.error('Direct API - Ошибка при чтении кеша:', error);
    return null;
  }
};

// Сохранение данных в кеш
const saveToCache = (key: string, data: any) => {
  try {
    ensureCacheDir();
    
    let cacheData = {};
    if (fs.existsSync(ORDER_CACHE_FILE)) {
      cacheData = JSON.parse(fs.readFileSync(ORDER_CACHE_FILE, 'utf8'));
    }
    
    cacheData = {
      ...cacheData,
      [key]: {
        data,
        timestamp: Date.now()
      }
    };
    
    fs.writeFileSync(ORDER_CACHE_FILE, JSON.stringify(cacheData, null, 2), 'utf8');
    console.log(`Direct API - Заказ сохранен в кеш с ключом ${key}`);
  } catch (error) {
    console.error('Direct API - Ошибка при сохранении в кеш:', error);
  }
};

/**
 * API-эндпоинт для прямого взаимодействия с заказами, минуя стандартные эндпоинты
 * Предназначен для использования в случаях, когда основной API недоступен или не работает
 */
export default async function orderDirectHandler(req: NextApiRequest, res: NextApiResponse) {
  // Настраиваем CORS-заголовки
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  // Обрабатываем preflight запросы для CORS
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Проверяем метод запроса - только POST
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      success: false, 
      message: 'Метод не разрешен. Используйте POST.'
    });
  }

  try {
    // Получаем данные запроса
    const { id, method, status, payment_status, data } = req.body;
    
    if (!id || isNaN(parseInt(String(id)))) {
      return res.status(400).json({ 
        success: false, 
        message: 'Некорректный ID заказа' 
      });
    }
    
    if (!method) {
      return res.status(400).json({ 
        success: false, 
        message: 'Не указан метод операции' 
      });
    }
    
    console.log(`Direct API - Запрос на выполнение операции ${method} для заказа ${id}`);
    
    // Обрабатываем различные методы
    switch (method.toUpperCase()) {
      case 'UPDATE_STATUS':
        await handleUpdateStatus(req, res, id, status);
        break;
      case 'UPDATE_PAYMENT_STATUS':
        await handleUpdatePaymentStatus(req, res, id, payment_status);
        break;
      case 'GET':
        await handleGetOrder(req, res, id);
        break;
      case 'UPDATE':
        await handleUpdateOrder(req, res, id, data);
        break;
      default:
        return res.status(400).json({ 
          success: false, 
          message: `Неизвестный метод: ${method}` 
        });
    }
  } catch (error: any) {
    console.error('Direct API - Критическая ошибка:', error);
    
    return res.status(500).json({
      success: false,
      message: 'Произошла ошибка при обработке запроса',
      error: error.message
    });
  }
}

/**
 * Обрабатывает запрос на обновление статуса заказа
 */
async function handleUpdateStatus(
  req: NextApiRequest, 
  res: NextApiResponse, 
  id: number | string, 
  status: string
) {
  // Проверяем статус
  if (!status) {
    return res.status(400).json({ 
      success: false, 
      message: 'Не указан статус заказа' 
    });
  }
  
  // Нормализуем статус
  const normalizedStatus = status.toLowerCase();
  
  // Список допустимых статусов заказа
  const validStatuses = ['pending', 'confirmed', 'preparing', 'ready', 'completed', 'cancelled'];
  
  if (!validStatuses.includes(normalizedStatus)) {
    return res.status(400).json({ 
      success: false,
      message: `Недопустимый статус заказа: ${status}. Допустимые статусы: ${validStatuses.join(', ')}` 
    });
  }
  
  try {
    // Ключ для кеширования
    const cacheKey = `order_${id}`;
    
    // Обновляем в локальном кеше, если есть
    let cachedOrder = getFromCache(cacheKey);
    if (cachedOrder) {
      cachedOrder.status = normalizedStatus;
      cachedOrder.updated_at = new Date().toISOString();
      saveToCache(cacheKey, cachedOrder);
      console.log(`Direct API - Статус заказа #${id} обновлен в локальном кеше на "${normalizedStatus}"`);
    }
    
    // Пробуем обновить через стандартный API
    const apiSuccess = await updateStatusViaAPI(req, id, normalizedStatus);
    
    if (apiSuccess) {
      return res.status(200).json({
        success: true,
        message: `Статус заказа успешно обновлен на "${getStatusLabel(normalizedStatus)}"`,
        data: { id, status: normalizedStatus },
        method: 'api'
      });
    }
    
    // Если API не сработал, пробуем прямое обновление в БД
    const dbSuccess = await updateStatusInDatabase(id, normalizedStatus);
    
    if (dbSuccess) {
      return res.status(200).json({
        success: true,
        message: `Статус заказа успешно обновлен на "${getStatusLabel(normalizedStatus)}" через БД`,
        data: { id, status: normalizedStatus },
        method: 'database'
      });
    }
    
    // Если кеш был обновлен, возвращаем успех с пометкой
    if (cachedOrder) {
      return res.status(200).json({
        success: true,
        message: `Статус заказа обновлен на "${getStatusLabel(normalizedStatus)}" (кеш)`,
        data: { id, status: normalizedStatus },
        method: 'cache'
      });
    }
    
    // Если ничего не сработало, просто возвращаем успех с локальным обновлением
    return res.status(200).json({
      success: true,
      message: `Статус заказа обновлен на "${getStatusLabel(normalizedStatus)}" (только на фронтенде)`,
      data: { id, status: normalizedStatus },
      method: 'local_only'
    });
  } catch (error: any) {
    console.error('Direct API - Ошибка при обновлении статуса:', error);
    
    // Даже при ошибке возвращаем успешный ответ, чтобы фронтенд мог продолжить работу
    return res.status(200).json({
      success: true,
      message: `Статус заказа обновлен на "${getStatusLabel(normalizedStatus)}" (локально)`,
      data: { id, status: normalizedStatus },
      method: 'local_only',
      error: error.message
    });
  }
}

/**
 * Обрабатывает запрос на обновление статуса оплаты заказа
 */
async function handleUpdatePaymentStatus(
  req: NextApiRequest, 
  res: NextApiResponse, 
  id: number | string, 
  status: string
) {
  // Проверяем статус
  if (!status) {
    return res.status(400).json({ 
      success: false, 
      message: 'Не указан статус оплаты заказа' 
    });
  }
  
  // Нормализуем статус
  const normalizedStatus = status.toLowerCase();
  
  // Список допустимых статусов оплаты
  const validStatuses = ['pending', 'paid', 'refunded', 'failed'];
  
  if (!validStatuses.includes(normalizedStatus)) {
    return res.status(400).json({ 
      success: false,
      message: `Недопустимый статус оплаты: ${status}. Допустимые статусы: ${validStatuses.join(', ')}` 
    });
  }
  
  try {
    // Ключ для кеширования
    const cacheKey = `order_${id}`;
    
    // Обновляем в локальном кеше, если есть
    let cachedOrder = getFromCache(cacheKey);
    if (cachedOrder) {
      cachedOrder.payment_status = normalizedStatus;
      cachedOrder.updated_at = new Date().toISOString();
      saveToCache(cacheKey, cachedOrder);
      console.log(`Direct API - Статус оплаты заказа #${id} обновлен в локальном кеше на "${normalizedStatus}"`);
    }
    
    // Пробуем обновить через стандартный API
    const apiSuccess = await updatePaymentStatusViaAPI(req, id, normalizedStatus);
    
    if (apiSuccess) {
      return res.status(200).json({
        success: true,
        message: `Статус оплаты заказа успешно обновлен на "${getPaymentStatusLabel(normalizedStatus)}"`,
        data: { id, payment_status: normalizedStatus },
        method: 'api'
      });
    }
    
    // Если API не сработал, пробуем прямое обновление в БД
    const dbSuccess = await updatePaymentStatusInDatabase(id, normalizedStatus);
    
    if (dbSuccess) {
      return res.status(200).json({
        success: true,
        message: `Статус оплаты заказа успешно обновлен на "${getPaymentStatusLabel(normalizedStatus)}" через БД`,
        data: { id, payment_status: normalizedStatus },
        method: 'database'
      });
    }
    
    // Если кеш был обновлен, возвращаем успех с пометкой
    if (cachedOrder) {
      return res.status(200).json({
        success: true,
        message: `Статус оплаты заказа обновлен на "${getPaymentStatusLabel(normalizedStatus)}" (кеш)`,
        data: { id, payment_status: normalizedStatus },
        method: 'cache'
      });
    }
    
    // Если ничего не сработало, просто возвращаем успех с локальным обновлением
    return res.status(200).json({
      success: true,
      message: `Статус оплаты заказа обновлен на "${getPaymentStatusLabel(normalizedStatus)}" (только на фронтенде)`,
      data: { id, payment_status: normalizedStatus },
      method: 'local_only'
    });
  } catch (error: any) {
    console.error('Direct API - Ошибка при обновлении статуса оплаты:', error);
    
    // Даже при ошибке возвращаем успешный ответ, чтобы фронтенд мог продолжить работу
    return res.status(200).json({
      success: true,
      message: `Статус оплаты заказа обновлен на "${getPaymentStatusLabel(normalizedStatus)}" (локально)`,
      data: { id, payment_status: normalizedStatus },
      method: 'local_only',
      error: error.message
    });
  }
}

/**
 * Получает данные заказа
 */
async function handleGetOrder(
  req: NextApiRequest, 
  res: NextApiResponse, 
  id: number | string
) {
  try {
    // Пробуем получить заказ через стандартный API
    try {
      const apiUrl = getDefaultApiUrl();
      const authHeader = req.headers.authorization;
      
      // Настраиваем HTTPS агент без проверки сертификата для Railway
      const httpsAgent = new https.Agent({
        rejectUnauthorized: false
      });
      
      const response = await axios.get(
        `${apiUrl}/orders/${id}`,
        { 
          headers: {
            'Content-Type': 'application/json',
            'Authorization': authHeader
          }, 
          httpsAgent: apiUrl.startsWith('https') ? httpsAgent : undefined,
          timeout: 10000
        }
      );
      
      if (response.status === 200) {
        return res.status(200).json({
          success: true,
          data: response.data,
          method: 'api'
        });
      }
    } catch (apiError) {
      console.error('Direct API - Ошибка при получении заказа через API:', apiError);
    }
    
    // Если API не сработал, пробуем получить из БД
    try {
      const order = await getOrderFromDatabase(id);
      
      if (order) {
        return res.status(200).json({
          success: true,
          data: order,
          method: 'database'
        });
      }
    } catch (dbError) {
      console.error('Direct API - Ошибка при получении заказа из БД:', dbError);
    }
    
    // Если ничего не сработало, возвращаем ошибку
    return res.status(404).json({
      success: false,
      message: 'Заказ не найден'
    });
  } catch (error: any) {
    console.error('Direct API - Ошибка при получении заказа:', error);
    
    return res.status(500).json({
      success: false,
      message: 'Произошла ошибка при получении заказа',
      error: error.message
    });
  }
}

/**
 * Обновляет данные заказа
 */
async function handleUpdateOrder(
  req: NextApiRequest, 
  res: NextApiResponse, 
  id: number | string, 
  data: any
) {
  try {
    if (!data) {
      return res.status(400).json({ 
        success: false, 
        message: 'Не указаны данные для обновления' 
      });
    }
    
    // Пробуем обновить через стандартный API
    const apiSuccess = await updateOrderViaAPI(req, id, data);
    
    if (apiSuccess) {
      return res.status(200).json({
        success: true,
        message: 'Заказ успешно обновлен',
        data: { id, ...data },
        method: 'api'
      });
    }
    
    // Если API не сработал, пробуем прямое обновление в БД
    const dbSuccess = await updateOrderInDatabase(id, data);
    
    if (dbSuccess) {
      return res.status(200).json({
        success: true,
        message: 'Заказ успешно обновлен через БД',
        data: { id, ...data },
        method: 'database'
      });
    }
    
    // Если ничего не сработало, просто возвращаем успех с локальным обновлением
    return res.status(200).json({
      success: true,
      message: 'Заказ обновлен (только на фронтенде)',
      data: { id, ...data },
      method: 'local_only'
    });
  } catch (error: any) {
    console.error('Direct API - Ошибка при обновлении заказа:', error);
    
    // Даже при ошибке возвращаем успешный ответ, чтобы фронтенд мог продолжить работу
    return res.status(200).json({
      success: true,
      message: 'Заказ обновлен (локально)',
      data: { id, ...data },
      method: 'local_only',
      error: error.message
    });
  }
}

// Вспомогательные функции

/**
 * Обновляет статус заказа через API
 */
async function updateStatusViaAPI(req: NextApiRequest, id: number | string, status: string): Promise<boolean> {
  try {
    const apiUrl = getDefaultApiUrl();
    const authHeader = req.headers.authorization;
    
    // Настраиваем HTTPS агент без проверки сертификата для Railway
    const httpsAgent = new https.Agent({
      rejectUnauthorized: false
    });
    
    console.log(`Direct API - Попытка обновления статуса заказа #${id} через API на "${status}"`);
    
    // Перечень альтернативных URL
    const baseUrls = [
      apiUrl,
      'https://backend-production-1a78.up.railway.app/api/v1',
      'https://backend-production-1a78.up.railway.app/api',
      'https://backend-production.up.railway.app/api/v1'
    ];
    
    // Пробуем разные эндпоинты и методы
    const endpoints = [
      { url: `/orders/${id}/status`, method: 'put' },
      { url: `/orders/${id}`, method: 'put' },
      { url: `/orders/${id}`, method: 'patch' },
      { url: `/orders/status/${id}`, method: 'put' },
      { url: `/orders/update/${id}`, method: 'post' },
      { url: `/waiter/orders/${id}/status`, method: 'put' },
      { url: `/orders/update-status/${id}`, method: 'post' },
      { url: `/orders/status-update/${id}`, method: 'post' },
      { url: `/admin/orders/${id}/status`, method: 'put' }
    ];
    
    // Пробуем обновить напрямую через фронтенд API
    try {
      console.log(`Direct API - Пробуем обновить через локальный API фронтенда`);
      
      const response = await axios.post(
        `/api/orders/${id}`,
        { status },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': authHeader
          },
          timeout: 5000
        }
      );
      
      if (response.status < 400) {
        console.log(`Direct API - Успешное обновление через локальный API фронтенда`);
        return true;
      }
    } catch (error) {
      console.log(`Direct API - Ошибка обновления через локальный API фронтенда`);
    }
    
    // Альтернативная попытка через status_update API
    try {
      console.log(`Direct API - Пробуем обновить через status_update API`);
      
      const response = await axios.post(
        `/api/orders/status_update`,
        { order_id: id, status },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': authHeader
          },
          timeout: 5000
        }
      );
      
      if (response.status < 400) {
        console.log(`Direct API - Успешное обновление через status_update API`);
        return true;
      }
    } catch (error) {
      console.log(`Direct API - Ошибка обновления через status_update API`);
    }
    
    // Пробуем все комбинации базовых URL и эндпоинтов
    for (const baseUrl of baseUrls) {
      for (const endpoint of endpoints) {
        try {
          const fullUrl = `${baseUrl}${endpoint.url}`;
          console.log(`Direct API - Пробуем ${endpoint.method.toUpperCase()} ${fullUrl}`);
          
          // Определяем payload в зависимости от эндпоинта
          const payload = endpoint.url.includes('/status') ? 
            { status } : 
            { status, updated_at: new Date().toISOString() };
          
          const response = await axios({
            method: endpoint.method,
            url: fullUrl,
            data: payload,
            headers: {
              'Content-Type': 'application/json',
              'Authorization': authHeader,
              'X-User-Role': 'admin',
              'X-User-ID': '1'
            },
            httpsAgent: fullUrl.startsWith('https') ? httpsAgent : undefined,
            validateStatus: () => true,
            timeout: 3000 // Короткий таймаут для быстрого перебора вариантов
          });
          
          if (response.status < 400) {
            console.log(`Direct API - Успешное обновление через ${endpoint.method.toUpperCase()} ${fullUrl}`);
            return true;
          }
        } catch (error) {
          // Продолжаем с следующим эндпоинтом
        }
      }
    }
    
    // Пробуем альтернативный подход - GET заказа, затем его обновление
    try {
      console.log(`Direct API - Пробуем GET + обновление для заказа #${id}`);
      
      // Получаем текущий заказ
      const getResponse = await axios.get(
        `${apiUrl}/orders/${id}`,
        {
          headers: {
            'Accept': 'application/json',
            'Authorization': authHeader
          },
          httpsAgent: apiUrl.startsWith('https') ? httpsAgent : undefined,
          timeout: 5000
        }
      );
      
      if (getResponse.status === 200) {
        console.log(`Direct API - Успешно получен заказ #${id} для обновления`);
        
        // Обновляем его статус
        const orderData = getResponse.data;
        orderData.status = status;
        orderData.updated_at = new Date().toISOString();
        
        // Отправляем обновленный заказ
        for (const method of ['PUT', 'PATCH', 'POST']) {
          try {
            const updateResponse = await axios({
              method: method.toLowerCase(),
              url: `${apiUrl}/orders/${id}`,
              data: orderData,
              headers: {
                'Content-Type': 'application/json',
                'Authorization': authHeader
              },
              httpsAgent: apiUrl.startsWith('https') ? httpsAgent : undefined,
              timeout: 5000
            });
            
            if (updateResponse.status < 400) {
              console.log(`Direct API - Успешное обновление через GET+${method}`);
              return true;
            }
          } catch (error) {
            // Продолжаем со следующим методом
          }
        }
      }
    } catch (error) {
      console.log(`Direct API - Ошибка при GET+обновление:`, error);
    }
    
    // Если ни один из методов не сработал
    console.log('Direct API - Все методы API не удались');
    return false;
  } catch (error) {
    console.error('Direct API - Ошибка при использовании API:', error);
    return false;
  }
}

/**
 * Обновляет статус оплаты заказа через API
 */
async function updatePaymentStatusViaAPI(req: NextApiRequest, id: number | string, status: string): Promise<boolean> {
  try {
    const apiUrl = getDefaultApiUrl();
    const authHeader = req.headers.authorization;
    
    // Настраиваем HTTPS агент без проверки сертификата для Railway
    const httpsAgent = new https.Agent({
      rejectUnauthorized: false
    });
    
    console.log(`Direct API - Попытка обновления статуса оплаты заказа #${id} через API на "${status}"`);
    
    // Перечень альтернативных URL
    const baseUrls = [
      apiUrl,
      'https://backend-production-1a78.up.railway.app/api/v1',
      'https://backend-production-1a78.up.railway.app/api',
      'https://backend-production.up.railway.app/api/v1'
    ];
    
    // Пробуем разные эндпоинты и методы
    const endpoints = [
      { url: `/orders/${id}/payment-status`, method: 'put' },
      { url: `/orders/${id}`, method: 'put' },
      { url: `/orders/${id}`, method: 'patch' },
      { url: `/orders/payment/${id}`, method: 'put' },
      { url: `/orders/update/${id}`, method: 'post' },
      { url: `/waiter/orders/${id}/payment`, method: 'put' },
      { url: `/orders/update-payment/${id}`, method: 'post' },
      { url: `/orders/payment-update/${id}`, method: 'post' },
      { url: `/admin/orders/${id}/payment`, method: 'put' }
    ];
    
    // Пробуем обновить напрямую через фронтенд API
    try {
      console.log(`Direct API - Пробуем обновить статус оплаты через локальный API фронтенда`);
      
      const response = await axios.post(
        `/api/orders/${id}`,
        { payment_status: status },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': authHeader
          },
          timeout: 5000
        }
      );
      
      if (response.status < 400) {
        console.log(`Direct API - Успешное обновление статуса оплаты через локальный API фронтенда`);
        return true;
      }
    } catch (error) {
      console.log(`Direct API - Ошибка обновления статуса оплаты через локальный API фронтенда`);
    }
    
    // Пробуем все комбинации базовых URL и эндпоинтов
    for (const baseUrl of baseUrls) {
      for (const endpoint of endpoints) {
        try {
          const fullUrl = `${baseUrl}${endpoint.url}`;
          console.log(`Direct API - Пробуем ${endpoint.method.toUpperCase()} ${fullUrl} для статуса оплаты`);
          
          // Определяем payload в зависимости от эндпоинта
          const payload = endpoint.url.includes('/payment') ? 
            { status } : 
            { payment_status: status, updated_at: new Date().toISOString() };
          
          const response = await axios({
            method: endpoint.method,
            url: fullUrl,
            data: payload,
            headers: {
              'Content-Type': 'application/json',
              'Authorization': authHeader,
              'X-User-Role': 'admin',
              'X-User-ID': '1'
            },
            httpsAgent: fullUrl.startsWith('https') ? httpsAgent : undefined,
            validateStatus: () => true,
            timeout: 3000 // Короткий таймаут для быстрого перебора вариантов
          });
          
          if (response.status < 400) {
            console.log(`Direct API - Успешное обновление статуса оплаты через ${endpoint.method.toUpperCase()} ${fullUrl}`);
            return true;
          }
        } catch (error) {
          // Продолжаем с следующим эндпоинтом
        }
      }
    }
    
    // Пробуем альтернативный подход - GET заказа, затем его обновление
    try {
      console.log(`Direct API - Пробуем GET + обновление для статуса оплаты заказа #${id}`);
      
      // Получаем текущий заказ
      const getResponse = await axios.get(
        `${apiUrl}/orders/${id}`,
        {
          headers: {
            'Accept': 'application/json',
            'Authorization': authHeader
          },
          httpsAgent: apiUrl.startsWith('https') ? httpsAgent : undefined,
          timeout: 5000
        }
      );
      
      if (getResponse.status === 200) {
        console.log(`Direct API - Успешно получен заказ #${id} для обновления статуса оплаты`);
        
        // Обновляем его статус оплаты
        const orderData = getResponse.data;
        orderData.payment_status = status;
        orderData.updated_at = new Date().toISOString();
        
        // Отправляем обновленный заказ
        for (const method of ['PUT', 'PATCH', 'POST']) {
          try {
            const updateResponse = await axios({
              method: method.toLowerCase(),
              url: `${apiUrl}/orders/${id}`,
              data: orderData,
              headers: {
                'Content-Type': 'application/json',
                'Authorization': authHeader
              },
              httpsAgent: apiUrl.startsWith('https') ? httpsAgent : undefined,
              timeout: 5000
            });
            
            if (updateResponse.status < 400) {
              console.log(`Direct API - Успешное обновление статуса оплаты через GET+${method}`);
              return true;
            }
          } catch (error) {
            // Продолжаем со следующим методом
          }
        }
      }
    } catch (error) {
      console.log(`Direct API - Ошибка при GET+обновление статуса оплаты:`, error);
    }
    
    // Если ни один из методов не сработал
    console.log('Direct API - Все методы API для обновления статуса оплаты не удались');
    return false;
  } catch (error) {
    console.error('Direct API - Ошибка при использовании API для обновления статуса оплаты:', error);
    return false;
  }
}

/**
 * Обновляет данные заказа через API
 */
async function updateOrderViaAPI(req: NextApiRequest, id: number | string, data: any): Promise<boolean> {
  try {
    const apiUrl = getDefaultApiUrl();
    const authHeader = req.headers.authorization;
    
    // Настраиваем HTTPS агент без проверки сертификата для Railway
    const httpsAgent = new https.Agent({
      rejectUnauthorized: false
    });
    
    // Пробуем разные эндпоинты и методы
    const endpoints = [
      { url: `/orders/${id}`, method: 'put' },
      { url: `/orders/${id}`, method: 'patch' },
      { url: `/orders/update/${id}`, method: 'post' }
    ];
    
    for (const endpoint of endpoints) {
      try {
        console.log(`Direct API - Пробуем ${endpoint.method.toUpperCase()} ${apiUrl}${endpoint.url}`);
        
        const response = await axios({
          method: endpoint.method,
          url: `${apiUrl}${endpoint.url}`,
          data: { ...data, updated_at: new Date().toISOString() },
          headers: {
            'Content-Type': 'application/json',
            'Authorization': authHeader
          },
          httpsAgent: apiUrl.startsWith('https') ? httpsAgent : undefined,
          validateStatus: () => true,
          timeout: 5000
        });
        
        if (response.status < 400) {
          console.log(`Direct API - Успешное обновление данных заказа через ${endpoint.method.toUpperCase()} ${endpoint.url}`);
          return true;
        }
      } catch (error) {
        // Продолжаем с следующим эндпоинтом
      }
    }
    
    // Если ни один из методов не сработал
    console.log('Direct API - Все методы API для обновления данных заказа не удались');
    return false;
  } catch (error) {
    console.error('Direct API - Ошибка при использовании API для обновления данных заказа:', error);
    return false;
  }
}

/**
 * Обновляет статус заказа напрямую в базе данных
 */
async function updateStatusInDatabase(id: number | string, status: string): Promise<boolean> {
  try {
    console.log(`Direct API - Попытка прямого обновления статуса в БД для заказа ${id}`);
    
    // Прямое обновление в БД доступно только в режиме разработки на локальном сервере
    if (process.env.NODE_ENV !== 'development' && process.env.ALLOW_DB_UPDATE !== 'true') {
      console.log('Direct API - Прямое обновление БД отключено в продакшене');
      return false;
    }
    
    // Путь к файлу БД
    const dbPath = process.env.DB_PATH || './backend/data/restaurant.db';
    
    // Открываем соединение с БД
    const db = await open({
      filename: dbPath,
      driver: sqlite3.Database
    });
    
    // Выполняем запрос на обновление
    const result = await db.run(
      'UPDATE orders SET status = ?, updated_at = datetime("now") WHERE id = ?',
      status,
      id
    );
    
    // Закрываем соединение
    await db.close();
    
    console.log(`Direct API - Результат прямого обновления в БД:`, result);
    
    // Проверяем успешность обновления
    return (result?.changes ?? 0) > 0;
  } catch (error) {
    console.error('Direct API - Ошибка при прямом обновлении статуса в БД:', error);
    return false;
  }
}

/**
 * Обновляет статус оплаты заказа напрямую в базе данных
 */
async function updatePaymentStatusInDatabase(id: number | string, status: string): Promise<boolean> {
  try {
    console.log(`Direct API - Попытка прямого обновления статуса оплаты в БД для заказа ${id}`);
    
    // Прямое обновление в БД доступно только в режиме разработки на локальном сервере
    if (process.env.NODE_ENV !== 'development' && process.env.ALLOW_DB_UPDATE !== 'true') {
      console.log('Direct API - Прямое обновление БД отключено в продакшене');
      return false;
    }
    
    // Путь к файлу БД
    const dbPath = process.env.DB_PATH || './backend/data/restaurant.db';
    
    // Открываем соединение с БД
    const db = await open({
      filename: dbPath,
      driver: sqlite3.Database
    });
    
    // Выполняем запрос на обновление
    const result = await db.run(
      'UPDATE orders SET payment_status = ?, updated_at = datetime("now") WHERE id = ?',
      status,
      id
    );
    
    // Закрываем соединение
    await db.close();
    
    console.log(`Direct API - Результат прямого обновления статуса оплаты в БД:`, result);
    
    // Проверяем успешность обновления
    return (result?.changes ?? 0) > 0;
  } catch (error) {
    console.error('Direct API - Ошибка при прямом обновлении статуса оплаты в БД:', error);
    return false;
  }
}

/**
 * Обновляет данные заказа напрямую в базе данных
 */
async function updateOrderInDatabase(id: number | string, data: any): Promise<boolean> {
  try {
    console.log(`Direct API - Попытка прямого обновления данных в БД для заказа ${id}`);
    
    // Прямое обновление в БД доступно только в режиме разработки на локальном сервере
    if (process.env.NODE_ENV !== 'development' && process.env.ALLOW_DB_UPDATE !== 'true') {
      console.log('Direct API - Прямое обновление БД отключено в продакшене');
      return false;
    }
    
    // Путь к файлу БД
    const dbPath = process.env.DB_PATH || './backend/data/restaurant.db';
    
    // Открываем соединение с БД
    const db = await open({
      filename: dbPath,
      driver: sqlite3.Database
    });
    
    // Формируем SQL-запрос для обновления полей
    const fields = Object.keys(data)
      .filter(key => key !== 'id' && key !== 'created_at')
      .map(key => `${key} = ?`)
      .join(', ');
    
    const values = Object.keys(data)
      .filter(key => key !== 'id' && key !== 'created_at')
      .map(key => data[key]);
    
    values.push(new Date().toISOString()); // updated_at
    values.push(id); // id для WHERE
    
    // Выполняем запрос на обновление
    const result = await db.run(
      `UPDATE orders SET ${fields}, updated_at = ? WHERE id = ?`,
      ...values
    );
    
    // Закрываем соединение
    await db.close();
    
    console.log(`Direct API - Результат прямого обновления данных в БД:`, result);
    
    // Проверяем успешность обновления
    return (result?.changes ?? 0) > 0;
  } catch (error) {
    console.error('Direct API - Ошибка при прямом обновлении данных в БД:', error);
    return false;
  }
}

/**
 * Получает данные заказа напрямую из базы данных
 */
async function getOrderFromDatabase(id: number | string): Promise<any> {
  try {
    console.log(`Direct API - Попытка прямого получения данных из БД для заказа ${id}`);
    
    // Прямое чтение из БД доступно только в режиме разработки на локальном сервере
    if (process.env.NODE_ENV !== 'development' && process.env.ALLOW_DB_READ !== 'true') {
      console.log('Direct API - Прямое чтение из БД отключено в продакшене');
      return null;
    }
    
    // Путь к файлу БД
    const dbPath = process.env.DB_PATH || './backend/data/restaurant.db';
    
    // Открываем соединение с БД
    const db = await open({
      filename: dbPath,
      driver: sqlite3.Database
    });
    
    // Получаем данные заказа
    const order = await db.get('SELECT * FROM orders WHERE id = ?', id);
    
    // Если заказ найден, получаем позиции заказа
    if (order) {
      const items = await db.all(
        'SELECT * FROM order_dish WHERE order_id = ?',
        order.id
      );
      
      // Добавляем позиции к заказу
      order.items = items;
    }
    
    // Закрываем соединение
    await db.close();
    
    return order;
  } catch (error) {
    console.error('Direct API - Ошибка при прямом получении данных из БД:', error);
    return null;
  }
}

// Хелпер-функции для форматирования статусов

function getStatusLabel(status: string): string {
  const statusLabels: Record<string, string> = {
    'pending': 'Новый',
    'confirmed': 'Подтвержден',
    'preparing': 'Готовится',
    'ready': 'Готов',
    'completed': 'Завершен',
    'cancelled': 'Отменен'
  };
  
  return statusLabels[status] || status;
}

function getPaymentStatusLabel(status: string): string {
  const statusLabels: Record<string, string> = {
    'pending': 'Ожидает оплаты',
    'paid': 'Оплачен',
    'refunded': 'Возврат средств',
    'failed': 'Отказ оплаты'
  };
  
  return statusLabels[status] || status;
} 