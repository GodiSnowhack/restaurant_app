import { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';
import { getSecureApiUrl } from '../../../lib/utils/api';
import { getDefaultApiUrl } from '../../../src/config/defaults';

/**
 * API-прокси для работы с конкретным заказом
 * Обрабатывает CORS и проксирует запросы к основному API
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Настройка CORS заголовков
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  // Обработка предварительных запросов CORS
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { id } = req.query;
  const { authorization } = req.headers;

  try {
    console.log('[Order API] Получение заказа по ID:', id);
    console.log('[Order API] Заголовок авторизации:', authorization);

    // Получаем базовый URL API, гарантированно с HTTPS
    const baseApiUrl = getDefaultApiUrl().replace('http://', 'https://');
    
    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...(authorization ? { 'Authorization': authorization } : {})
    };

    try {
      // Получаем данные заказа
      const orderResponse = await axios.get(`${baseApiUrl}/orders/${id}/`, { 
        headers,
        maxRedirects: 5,
        timeout: 8000,
        // Опции для предотвращения проблем с сертификатами
        httpsAgent: new (require('https').Agent)({
          rejectUnauthorized: false
        })
      });
      
      const order = orderResponse.data;
      console.log('[Order API] Получены данные заказа:', order);

      // Если нет данных о блюдах, возвращаем заказ как есть
      if (!order.items || !Array.isArray(order.items) || order.items.length === 0) {
        return res.status(200).json(order);
      }

      // Получаем информацию о каждом блюде
      const dishPromises = order.items.map(async (item: any) => {
        try {
          console.log(`[Order API] Запрос информации о блюде ${item.dish_id}`);
          const dishResponse = await axios.get(`${baseApiUrl}/menu/dishes/${item.dish_id}/`, { 
            headers,
            maxRedirects: 5
          });
          console.log(`[Order API] Получена информация о блюде ${item.dish_id}:`, dishResponse.data);
          
          return {
            ...item,
            name: dishResponse.data.name || item.name || `Блюдо #${item.dish_id}`,
            description: dishResponse.data.description || ''
          };
        } catch (error) {
          console.error(`[Order API] Ошибка при получении информации о блюде ${item.dish_id}:`, error);
          return {
            ...item,
            name: item.name || `Блюдо #${item.dish_id}`,
            description: ''
          };
        }
      });

      const itemsWithDetails = await Promise.all(dishPromises);
      const orderWithDishDetails = {
        ...order,
        items: itemsWithDetails
      };

      console.log('[Order API] Подготовлен ответ с деталями блюд:', orderWithDishDetails);

      return res.status(200).json(orderWithDishDetails);
    } catch (error) {
      console.error('[Order API] Ошибка при получении заказа с сервера:', error);
      
      // В случае ошибки возвращаем объект с информацией об ошибке
      return res.status(404).json({
        message: `Заказ с ID ${id} не найден`,
        error: 'order_not_found'
      });
    }
  } catch (error: any) {
    console.error('[Order API] Критическая ошибка при получении заказа:', error);
    
    // Возвращаем ошибку
    return res.status(500).json({
      message: 'Ошибка при получении заказа',
      error: error.message
    });
  }
} 