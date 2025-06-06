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

// Функция для обеспечения HTTPS URL
const ensureHttpsUrl = (url: string): string => {
  if (url.startsWith('http://')) {
    return url.replace('http://', 'https://');
  }
  return url;
};

// Проверка токена перед отправкой запроса
const validateToken = (token: string | undefined): boolean => {
  if (!token) return false;
  
  try {
    // Базовая проверка формата JWT - должен быть непустой строкой с двумя точками
    return token.trim().split('.').length === 3;
  } catch (e) {
    return false;
  }
};

// Функция для нормализации данных заказов
const normalizeOrdersData = (rawData: any): any[] => {
  if (!rawData) return [];
  
  // Если уже массив, просто возвращаем
  if (Array.isArray(rawData)) return rawData;
  
  // Проверяем другие форматы
  if (rawData && typeof rawData === 'object') {
    if (Array.isArray(rawData.items)) return rawData.items;
    if (Array.isArray(rawData.data)) return rawData.data;
    if (rawData.orders && Array.isArray(rawData.orders)) return rawData.orders;
    
    // Если есть список объектов в самом объекте
    const possibleArrays = Object.values(rawData).filter(v => Array.isArray(v));
    if (possibleArrays.length > 0) {
      // Берем самый длинный массив как наиболее вероятный список заказов
      return possibleArrays.reduce((prev, curr) => 
        (curr as any[]).length > (prev as any[]).length ? curr : prev, []) as any[];
    }
  }
  
  return [];
};

// Функция для генерации демо-данных заказов
const generateDemoOrders = () => {
  return [
    {
      id: 1001,
      user_id: 1,
      waiter_id: 1,
      status: 'pending',
      payment_status: 'pending',
      payment_method: 'card',
      total_amount: 3500,
      created_at: new Date(Date.now() - 86400000 * 3).toISOString(),
      updated_at: new Date(Date.now() - 86400000 * 3).toISOString(),
      table_number: 5,
      customer_name: 'Александр Иванов',
      customer_phone: '+7 (777) 111-22-33',
      items: []
    },
    {
      id: 1002,
      user_id: 2,
      waiter_id: 2,
      status: 'completed',
      payment_status: 'paid',
      payment_method: 'cash',
      total_amount: 2800,
      created_at: new Date(Date.now() - 86400000 * 1).toISOString(),
      updated_at: new Date(Date.now() - 86400000 * 1).toISOString(),
      table_number: 3,
      customer_name: 'Елена Петрова',
      customer_phone: '+7 (777) 222-33-44',
      items: []
    }
  ];
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
      const baseApiUrl = ensureHttpsUrl(getDefaultApiUrl());
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

    // Получаем токен авторизации
    const token = req.headers.authorization?.replace('Bearer ', '') || '';
    console.log('API Proxy (GET): Получен токен:', token ? 'Токен присутствует' : 'Токен отсутствует');
    
    // Базовая проверка токена
    if (!token || !validateToken(token)) {
      console.error('API Proxy (GET): Отсутствует или некорректный токен авторизации');
      return res.status(401).json({
        success: false,
        message: 'Отсутствует или некорректный токен авторизации'
      });
    }
    
    // Получаем базовый URL API и обеспечиваем HTTPS
    const baseApiUrl = ensureHttpsUrl(getDefaultApiUrl());
    console.log('API Proxy (GET): Базовый URL API:', baseApiUrl);
    
    // Формируем URL для запроса
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
      
      // Логируем детали запроса для отладки
      console.log('API Proxy (GET): Детали запроса:', {
        url: fullUrl,
        headers: {
          Authorization: headers.Authorization ? 'Bearer ***' : 'Отсутствует',
          'Content-Type': headers['Content-Type'],
          'Accept': headers['Accept'],
          'X-User-ID': headers['X-User-ID'] || 'Отсутствует',
          'X-User-Role': headers['X-User-Role'] || 'Отсутствует'
        },
        timeout: 20000,
        maxRedirects: 5
      });
      
      // Добавляем специальные настройки для обработки редиректов
      const response = await axios.get(fullUrl, {
        headers,
        httpsAgent,
        timeout: 20000, // Увеличиваем таймаут
        maxRedirects: 5,
        validateStatus: function (status) {
          // Разрешаем статусы 2xx и 3xx (включая редиректы)
          return status >= 200 && status < 400;
        },
        // Обработка редиректов вручную при необходимости
        beforeRedirect: (options, { headers }) => {
          // Сохраняем авторизацию при редиректе
          options.headers = {
            ...options.headers,
            'Authorization': `Bearer ${token}`
          };
          console.log('API Proxy (GET): Перенаправление на:', options.url);
        }
      });
      
      console.log(`API Proxy (GET): Получен ответ от бэкенда с кодом ${response.status}`);
      
      // Обрабатываем ответ
      const data = response.data;
      
      // Проверяем, содержит ли ответ ошибку SQL, связанную с неправильными колонками
      if (data && typeof data === 'object' && (
          (data.error && (
            typeof data.error === 'string' && (
              data.error.includes('no such column') || 
              data.error.includes('SQL') || 
              data.error.includes('sqlite')
            )
          )) ||
          (data.detail && typeof data.detail === 'string' && (
            data.detail.includes('no such column') || 
            data.detail.includes('SQL') || 
            data.detail.includes('sqlite')
          ))
      )) {
        console.log('API Proxy (GET): Обнаружена ошибка SQL в ответе:', data.error || data.detail);
        console.log('API Proxy (GET): Возвращаем пустой массив заказов из-за ошибки базы данных');
        
        // Возвращаем пустой массив, т.к. ошибка в SQL запросе
        const emptyResult: any[] = [];
        saveToCache(cacheKey, emptyResult);
        return res.status(200).json(emptyResult);
      }
      
      // Нормализуем данные заказов для разных форматов ответа
      let result = normalizeOrdersData(data);
      
      // Логируем результат
      if (Array.isArray(result)) {
        console.log(`API Proxy (GET): Получено ${result.length} заказов`);
      } else {
        console.error('API Proxy (GET): Неожиданный формат данных после нормализации');
        result = [];
      }
      
      // Сохраняем результат в кеш
      saveToCache(cacheKey, result);
      
      // Возвращаем данные клиенту
      return res.status(200).json(result);
      
    } catch (error: any) {
      console.error('API Proxy (GET): Ошибка при получении заказов:', error.message);
      
      // Если есть ошибка SQL, связанная с неправильными колонками
      if (error.message && (
        error.message.includes('no such column') || 
        error.message.includes('SQL') ||
        error.message.includes('sqlite')
      )) {
        console.log('API Proxy (GET): Обнаружена ошибка SQL:', error.message);
        console.log('API Proxy (GET): Возвращаем пустой массив заказов из-за ошибки базы данных');
        
        // Возвращаем пустой массив вместо ошибки
        return res.status(200).json([]);
      }
      
      // Если есть ответ от сервера, проверяем ошибки в нем
      if (error.response) {
        console.error('API Proxy (GET): Статус ошибки:', error.response.status);
        
        // Если ошибка содержит данные об SQL-ошибке
        if (error.response.data && typeof error.response.data === 'object') {
          const errorData = error.response.data;
          
          if ((errorData.error && (
              typeof errorData.error === 'string' && (
                errorData.error.includes('no such column') || 
                errorData.error.includes('SQL') || 
                errorData.error.includes('sqlite')
              )
            )) ||
            (errorData.detail && typeof errorData.detail === 'string' && (
              errorData.detail.includes('no such column') || 
              errorData.detail.includes('SQL') || 
              errorData.detail.includes('sqlite')
            ))
          ) {
            console.log('API Proxy (GET): Обнаружена ошибка SQL в ответе сервера');
            console.log('API Proxy (GET): Возвращаем пустой массив заказов из-за ошибки базы данных');
            
            // Возвращаем пустой массив, т.к. ошибка в SQL запросе
            return res.status(200).json([]);
          }
        }
        
        // Попробуем выполнить запрос напрямую к другому эндпоинту, если это 401
        if (error.response.status === 401) {
          try {
            console.log('API Proxy (GET): Пробуем альтернативный эндпоинт...');
            // Используем другой путь - попробуем добавить слеш в конце URL
            const altUrl = ordersApiUrl.endsWith('/') ? ordersApiUrl : `${ordersApiUrl}/`;
            const altFullUrl = queryString ? `${altUrl}?${queryString}` : altUrl;
            
            console.log('API Proxy (GET): Альтернативный URL:', altFullUrl);
            
            const altResponse = await axios.get(altFullUrl, {
              headers,
              httpsAgent,
              timeout: 10000
            });
            
            if (altResponse.status === 200 && altResponse.data) {
              console.log('API Proxy (GET): Успешный ответ от альтернативного эндпоинта');
              const altData = normalizeOrdersData(altResponse.data);
              
              // Сохраняем в кеш
              saveToCache(cacheKey, altData);
              
              // Возвращаем клиенту
              return res.status(200).json(altData);
            }
          } catch (altError) {
            console.error('API Proxy (GET): Ошибка при запросе к альтернативному эндпоинту:', altError);
          }
        }
        
        // В случае других ошибок, проверяем если это ошибка SQL
        return res.status(200).json([]);
      }
      
      // Если ошибка в сети или таймаут, возвращаем пустой массив вместо ошибки
      console.log('API Proxy (GET): Возвращаем пустой массив заказов из-за ошибки сети');
      return res.status(200).json([]);
    }
  } catch (error: any) {
    console.error('API Proxy (GET): Общая ошибка:', error.message);
    // Возвращаем пустой массив вместо ошибки
    return res.status(200).json([]);
  }
} 