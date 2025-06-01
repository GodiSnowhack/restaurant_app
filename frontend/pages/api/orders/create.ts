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

    // Получаем токен авторизации
    const token = req.headers.authorization?.replace('Bearer ', '') || '';

    // Получаем базовый URL API
    const baseApiUrl = getDefaultApiUrl();
    
    // Формируем URL для запроса к бэкенду
    const url = `${baseApiUrl}/orders`;

    // Настройка HTTPS агента с отключенной проверкой сертификата
    const httpsAgent = new https.Agent({
      rejectUnauthorized: false
    });

    console.log(`API Orders: Отправка запроса на создание заказа`);

    // Подготовка заголовков
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    // Отправляем запрос к бэкенду
    try {
      // Пробуем разные эндпоинты и методы
      const endpoints = [
        `${baseApiUrl}/orders`,
        `${baseApiUrl}/waiter/orders`,
        `${baseApiUrl}/orders/create`
      ];

      let successResponse = null;
      let lastError = null;

      for (const endpoint of endpoints) {
        try {
          console.log(`API Orders: Пробуем создать заказ через ${endpoint}`);
          
          const response = await axios.post(
            endpoint,
            orderData,
            { 
              headers,
              httpsAgent: endpoint.startsWith('https') ? httpsAgent : undefined,
              timeout: 10000,
              validateStatus: () => true
            }
          );

          console.log(`API Orders: Ответ от ${endpoint} с кодом ${response.status}`);
          
          // Если получили успешный статус, запоминаем ответ и прерываем цикл
          if (response.status >= 200 && response.status < 300) {
            successResponse = response;
            break;
          }
          
          // Если получили ошибку, но есть данные в ответе
          if (response.data) {
            lastError = new Error(
              response.data.message || 
              response.data.error || 
              `Ошибка создания заказа (HTTP ${response.status})`
            );
          }
        } catch (endpointError: any) {
          console.log(`API Orders: Ошибка при запросе к ${endpoint}: ${endpointError.message}`);
          lastError = endpointError;
        }
      }

      // Если успешный ответ найден, возвращаем его
      if (successResponse) {
        return res.status(200).json({
          success: true,
          message: 'Заказ успешно создан',
          data: successResponse.data
        });
      }
      
      // Если дошли до сюда, значит все эндпоинты вернули ошибку
      // Создаем локальный заказ для UI
      console.log(`API Orders: Все эндпоинты вернули ошибку, создаем локальный заказ`);
      
      const mockOrderId = Date.now(); // Используем timestamp как ID
      const localOrder = {
        ...orderData,
        id: mockOrderId,
        created_at: new Date().toISOString(),
        status: 'pending',
        payment_status: 'pending'
      };
      
      return res.status(200).json({
        success: true,
        message: 'Заказ создан локально',
        data: localOrder,
        local_only: true,
        error: lastError ? lastError.message : 'Не удалось создать заказ на сервере'
      });
    } catch (fetchError: any) {
      console.error(`API Orders: Ошибка при отправке запроса:`, fetchError.message);
      
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
        message: 'Заказ создан локально',
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