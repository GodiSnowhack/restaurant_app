import type { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';

/**
 * API-прокси для обновления статуса заказа
 * Передает запрос на бэкенд API и возвращает результат
 */
export default async function orderStatusProxy(req: NextApiRequest, res: NextApiResponse) {
  // Устанавливаем CORS-заголовки для безопасности
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  // Обрабатываем preflight запросы для CORS
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Проверяем метод запроса - только PUT разрешен для обновления статуса
  if (req.method !== 'PUT') {
    return res.status(405).json({ 
      success: false, 
      message: 'Метод не разрешен. Для обновления статуса используйте PUT.'
    });
  }

  try {
    // Эндпоинты для обновления статуса заказа
    const UPDATE_ENDPOINTS = [
      // Основной универсальный эндпоинт для обновления заказа
      `/api/simple/orders/ORDER_ID`,
      
      // Резервные эндпоинты на случай недоступности основного
      `/api/v1/orders/ORDER_ID`,
      `/api/v1/orders/status/ORDER_ID`,
      `/api/v1/orders/ORDER_ID/status`
    ];

    // Получаем данные из запроса
    const { id } = req.query;
    if (!id || Array.isArray(id)) {
      return res.status(400).json({
        success: false,
        message: 'ID заказа не указан или имеет неверный формат'
      });
    }

    // Получаем данные из тела запроса
    let statusData: any;
    try {
      statusData = req.body;
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: 'Ошибка при обработке тела запроса'
      });
    }

    // Проверяем наличие статуса
    if (!statusData || !statusData.status) {
      return res.status(400).json({
        success: false,
        message: 'Статус заказа не указан'
      });
    }

    // Получаем токен для авторизации из заголовков запроса
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({
        success: false,
        message: 'Отсутствует токен авторизации'
      });
    }

    // Пробуем обновить статус через разные эндпоинты
    let successEndpoint = null;
    let successResponse = null;

    // Конфигурация для запроса
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://backend-production-1a78.up.railway.app';
    const requestConfig = {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader
      },
      timeout: 10000 // 10 секунд
    };

    // Функция для попытки обновления через определенный эндпоинт
    const tryEndpoint = async (endpoint: string, method: string = 'POST') => {
      try {
        console.log(`[API Прокси] Попытка ${method} ${endpoint}`);
        
        const url = `${apiUrl}${endpoint.replace('ORDER_ID', id)}`;
        const response = await axios({
          method,
          url,
          data: statusData,
          headers: requestConfig.headers,
          timeout: requestConfig.timeout
        });
        
        console.log(`[API Прокси] Ответ ${response.status} от ${endpoint}`);
        return { success: response.status < 300, response };
      } catch (error: any) {
        console.error(`[API Прокси] Ошибка ${method} ${endpoint}:`, 
          error.response?.status || error.message);
        return { success: false, error };
      }
    };

    // Перебираем все эндпоинты, начиная с основного
    for (const endpoint of UPDATE_ENDPOINTS) {
      // Пробуем POST
      const postResult = await tryEndpoint(endpoint, 'POST');
      if (postResult.success) {
        successEndpoint = `POST ${endpoint}`;
        successResponse = postResult.response;
        break;
      }
      
      // Пробуем PUT
      const putResult = await tryEndpoint(endpoint, 'PUT');
      if (putResult.success) {
        successEndpoint = `PUT ${endpoint}`;
        successResponse = putResult.response;
        break;
      }
      
      // Пробуем PATCH
      const patchResult = await tryEndpoint(endpoint, 'PATCH');
      if (patchResult.success) {
        successEndpoint = `PATCH ${endpoint}`;
        successResponse = patchResult.response;
        break;
      }
    }

    // Возвращаем результат
    if (successEndpoint && successResponse) {
      console.log(`[API Прокси] Успешное обновление через ${successEndpoint}`);
      return res.status(200).json({
        success: true,
        message: `Статус заказа успешно обновлен`,
        data: successResponse.data,
        endpoint: successEndpoint
      });
    } else {
      console.error(`[API Прокси] Все эндпоинты не удались`);
      return res.status(500).json({
        success: false,
        message: 'Не удалось обновить статус заказа через доступные эндпоинты',
        endpoints_tried: UPDATE_ENDPOINTS
      });
    }
  } catch (error: any) {
    // Обрабатываем общие ошибки
    console.error('API Proxy - Критическая ошибка:', error);
    return res.status(500).json({
      success: false,
      message: `Внутренняя ошибка сервера: ${error.message}`
    });
  }
}

// Хелпер-функция для перевода статуса в читаемую форму
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