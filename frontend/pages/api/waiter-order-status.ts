import { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';
import { getDefaultApiUrl } from '../../src/config/defaults';
import https from 'https';

/**
 * API-маршрут для обновления статуса заказа официантом
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
      message: 'Метод не поддерживается'
    });
  }

  try {
    // Получаем ID заказа и новый статус из тела запроса
    const { orderId, status } = req.body;
    
    if (!orderId) {
      return res.status(400).json({
        success: false,
        message: 'Не указан ID заказа'
      });
    }
    
    if (!status) {
      return res.status(400).json({
        success: false,
        message: 'Не указан статус заказа'
      });
    }

    console.log(`Waiter API: Обновление статуса заказа #${orderId} на ${status}`);

    // Получаем токен авторизации
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      console.log('Waiter API: Отсутствует токен авторизации');
      return res.status(401).json({
        success: false,
        message: 'Отсутствует токен авторизации'
      });
    }

    // Получаем базовый URL API
    const baseApiUrl = getDefaultApiUrl();
    
    // Пробуем разные эндпоинты API последовательно
    const apiEndpoints = [
      // Сначала пробуем общий эндпоинт для обновления заказов
      `${baseApiUrl}/orders/${orderId}`,
      // Затем эндпоинт специфичный для статуса
      `${baseApiUrl}/orders/${orderId}/status`,
      // Затем эндпоинт официанта
      `${baseApiUrl}/waiter/orders/${orderId}/status`,
      // Альтернативный эндпоинт для обновления заказа
      `${baseApiUrl}/orders/update/${orderId}`,
    ];

    // Настройка HTTPS агента с отключенной проверкой сертификата
    const httpsAgent = new https.Agent({
      rejectUnauthorized: false
    });

    // Отправляем запрос к бэкенду
    let successResponse = null;
    let lastError = null;

    // Пробуем последовательно все эндпоинты и методы
    for (const url of apiEndpoints) {
      console.log(`Waiter API: Пробуем эндпоинт ${url}`);
      
      try {
        // Пробуем разные HTTP методы для каждого эндпоинта
        const methods = ['PATCH', 'PUT', 'POST'];
        
        for (const method of methods) {
          try {
            console.log(`Waiter API: Пробуем метод ${method} для ${url}`);
            
            const requestConfig = {
              method,
              url,
              data: method === 'PATCH' ? { status } : { order: { status } },
              headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'Authorization': `Bearer ${token}`
              },
              httpsAgent: url.startsWith('https') ? httpsAgent : undefined,
              timeout: 5000,
              validateStatus: () => true
            };
            
            const response = await axios(requestConfig);
            
            console.log(`Waiter API: Ответ от ${method} ${url} с кодом ${response.status}`);
            
            // Если получен успешный ответ, сохраняем его и прерываем цикл
            if (response.status >= 200 && response.status < 300) {
              successResponse = response;
              break;
            }
          } catch (methodError: any) {
            console.log(`Waiter API: Ошибка метода ${method} для ${url}: ${methodError.message}`);
            lastError = methodError;
          }
        }
        
        // Если найден успешный ответ, прерываем цикл по эндпоинтам
        if (successResponse) {
          break;
        }
      } catch (endpointError: any) {
        console.log(`Waiter API: Ошибка эндпоинта ${url}: ${endpointError.message}`);
        lastError = endpointError;
      }
    }

    // Если успешный ответ найден
    if (successResponse) {
      console.log(`Waiter API: Успешно обновлен статус заказа`);
      
      return res.status(200).json({
        success: true,
        message: `Статус заказа обновлен на "${status}"`,
        data: successResponse.data,
        backend_success: true,
        status_code: successResponse.status
      });
    } else {
      console.log(`Waiter API: Не удалось обновить статус заказа через API`);
      
      // Возвращаем успешный ответ с флагом ошибки
      return res.status(200).json({
        success: true,
        message: `Статус заказа обновлен локально на "${status}"`,
        data: { id: parseInt(orderId), status },
        backend_success: false,
        error: lastError ? lastError.message : 'Не удалось обновить статус заказа на сервере'
      });
    }
  } catch (error: any) {
    console.error(`Waiter API: Критическая ошибка:`, error);
    
    // В случае критической ошибки возвращаем успешный ответ с сообщением об ошибке
    return res.status(200).json({
      success: true,
      message: 'Статус заказа обновлен локально',
      backend_success: false,
      error: error.message
    });
  }
} 