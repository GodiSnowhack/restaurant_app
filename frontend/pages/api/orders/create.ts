import { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';
import { getDefaultApiUrl } from '../../../src/config/defaults';
import https from 'https';

/**
 * API-маршрут для создания нового заказа
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Настройка CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  // Обработка префлайт-запросов
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Проверка метода запроса
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      message: 'Метод не поддерживается. Используйте POST для создания заказа.'
    });
  }

  try {
    // Получаем данные заказа из тела запроса
    const orderData = req.body;
    
    if (!orderData) {
      return res.status(400).json({
        success: false,
        message: 'Отсутствуют данные заказа'
      });
    }
    
    // Проверяем обязательные поля
    if (!orderData.items || !Array.isArray(orderData.items) || orderData.items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Заказ должен содержать хотя бы одно блюдо'
      });
    }

    console.log(`API Orders: Создание нового заказа`, orderData);

    // Получаем токен авторизации из заголовка запроса или из cookie
    let token = req.headers.authorization?.replace('Bearer ', '') || '';
    
    // Если токен не найден в заголовке, проверяем в cookie
    if (!token && req.cookies?.token) {
      token = req.cookies.token;
    }

    // Если токен не найден и в запросе есть параметр token, используем его
    if (!token && req.query.token) {
      token = Array.isArray(req.query.token) ? req.query.token[0] : req.query.token;
    }

    console.log(`API Orders: ${token ? 'Токен авторизации получен' : 'Токен авторизации отсутствует'}`);

    // Получаем базовый URL API
    const baseApiUrl = getDefaultApiUrl();
    
    // Настройка HTTPS агента с отключенной проверкой сертификата
    const httpsAgent = new https.Agent({
      rejectUnauthorized: false
    });

    // Подготовка заголовков с правильным форматом для Railway
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
      console.log(`API Orders: Используем токен для авторизации`);
    }

    // Форматируем данные заказа для соответствия API бэкенда
    const formattedOrderData = {
      ...orderData,
      // Преобразуем все ID в числа
      waiter_id: orderData.waiter_id ? Number(orderData.waiter_id) : undefined,
      table_id: orderData.table_number ? Number(orderData.table_number) : undefined,
      table_number: orderData.table_number ? Number(orderData.table_number) : undefined,
      // Нормализуем статусы
      status: orderData.status?.toLowerCase() || 'pending',
      payment_status: orderData.payment_status?.toLowerCase() || 'pending',
      // Форматируем элементы заказа
      items: orderData.items.map((item: any) => ({
        dish_id: Number(item.dish_id),
        quantity: Number(item.quantity),
        special_instructions: item.special_instructions || ''
      }))
    };

    console.log(`API Orders: Подготовленные данные для отправки:`, formattedOrderData);

    // Отправляем запрос к бэкенду
    try {
      // Начинаем с основного API для создания заказов, с токеном авторизации
      console.log(`API Orders: Пробуем создать заказ на бэкенде`);
      
      // Первая попытка - прямой запрос к API заказов с токеном
      try {
        const mainResponse = await axios.post(
          `${baseApiUrl}/orders`,
          formattedOrderData,
          { 
            headers,
            httpsAgent: baseApiUrl.startsWith('https') ? httpsAgent : undefined,
            timeout: 15000,
            validateStatus: (status) => status < 500, // Принимаем все статусы, кроме 5xx
            maxRedirects: 5 // Разрешаем редиректы
          }
        );
        
        console.log(`API Orders: Ответ от основного API с кодом ${mainResponse.status}`);
        
        if (mainResponse.status >= 200 && mainResponse.status < 300) {
          // Успешный ответ
          return res.status(200).json({
            success: true,
            message: 'Заказ успешно создан',
            data: mainResponse.data
          });
        }
        
        // Если ответ содержит сообщение об ошибке, логируем его
        if (mainResponse.data) {
          console.log(`API Orders: Сообщение ошибки от сервера:`, mainResponse.data);
        }
      } catch (mainError: any) {
        console.error(`API Orders: Ошибка при создании заказа через основной API:`, mainError.message);
      }
      
      // Вторая попытка - запрос к API официанта
      try {
        const waiterResponse = await axios.post(
          `${baseApiUrl}/waiter/orders/create`,
          formattedOrderData,
          { 
            headers,
            httpsAgent: baseApiUrl.startsWith('https') ? httpsAgent : undefined,
            timeout: 15000,
            validateStatus: (status) => status < 500,
            maxRedirects: 5
          }
        );
        
        console.log(`API Orders: Ответ от API официанта с кодом ${waiterResponse.status}`);
        
        if (waiterResponse.status >= 200 && waiterResponse.status < 300) {
          // Успешный ответ
          return res.status(200).json({
            success: true,
            message: 'Заказ успешно создан через API официанта',
            data: waiterResponse.data
          });
        }
      } catch (waiterError: any) {
        console.error(`API Orders: Ошибка при создании заказа через API официанта:`, waiterError.message);
      }

      // Третья попытка - обход CORS через GET-запрос с параметрами
      try {
        // Формируем URL с параметрами
        const queryParams = new URLSearchParams({
          order: JSON.stringify(formattedOrderData)
        });
        
        const corsProxyResponse = await axios.get(
          `${baseApiUrl}/orders/create-proxy?${queryParams.toString()}`,
          { 
            headers,
            httpsAgent: baseApiUrl.startsWith('https') ? httpsAgent : undefined,
            timeout: 15000,
            validateStatus: (status) => status < 500,
            maxRedirects: 5
          }
        );
        
        console.log(`API Orders: Ответ от CORS прокси с кодом ${corsProxyResponse.status}`);
        
        if (corsProxyResponse.status >= 200 && corsProxyResponse.status < 300) {
          // Успешный ответ
          return res.status(200).json({
            success: true,
            message: 'Заказ успешно создан через CORS прокси',
            data: corsProxyResponse.data
          });
        }
      } catch (corsError: any) {
        console.error(`API Orders: Ошибка при создании заказа через CORS прокси:`, corsError.message);
      }

      // Если все запросы завершились с ошибкой, создаем локальный заказ
      console.log(`API Orders: Все попытки создать заказ на бэкенде завершились с ошибкой`);
      console.log(`API Orders: Создаем локальный заказ для UI`);
      
      const mockOrderId = Date.now(); // Используем timestamp как ID
      const localOrder = {
        ...formattedOrderData,
        id: mockOrderId,
        created_at: new Date().toISOString()
      };
      
      return res.status(200).json({
        success: true,
        message: 'Заказ создан локально (бэкенд недоступен)',
        data: localOrder,
        local_only: true
      });
    } catch (fetchError: any) {
      console.error(`API Orders: Критическая ошибка при отправке запросов:`, fetchError.message);
      
      // В случае сетевой ошибки создаем локальный заказ
      const mockOrderId = Date.now();
      const localOrder = {
        ...orderData,
        id: mockOrderId,
        created_at: new Date().toISOString(),
        status: 'pending',
        payment_status: 'pending'
      };
      
      return res.status(200).json({
        success: true,
        message: 'Заказ создан локально (сетевая ошибка)',
        data: localOrder,
        local_only: true,
        error: fetchError.message
      });
    }
  } catch (error: any) {
    console.error(`API Orders: Критическая ошибка:`, error);
    
    return res.status(500).json({
      success: false,
      message: 'Ошибка при создании заказа',
      error: error.message
    });
  }
} 