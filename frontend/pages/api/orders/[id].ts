import { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';
import { getSecureApiUrl } from '../../../lib/utils/api';

const API_BASE_URL = getSecureApiUrl();

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

    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...(authorization ? { 'Authorization': authorization } : {})
    };

    // Получаем данные заказа
    const orderResponse = await axios.get(`${API_BASE_URL}/orders/${id}`, { headers });
    const order = orderResponse.data;

    console.log('[Order API] Получены данные заказа:', order);

    // Получаем информацию о каждом блюде
    const dishPromises = order.items.map(async (item: any) => {
      try {
        console.log(`[Order API] Запрос информации о блюде ${item.dish_id}`);
        const dishResponse = await axios.get(`${API_BASE_URL}/menu/dishes/${item.dish_id}`, { headers });
        console.log(`[Order API] Получена информация о блюде ${item.dish_id}:`, dishResponse.data);
        
        return {
          ...item,
          name: dishResponse.data.name || `Блюдо #${item.dish_id}`,
          description: dishResponse.data.description || ''
        };
      } catch (error) {
        console.error(`[Order API] Ошибка при получении информации о блюде ${item.dish_id}:`, error);
        return {
          ...item,
          name: `Блюдо #${item.dish_id}`,
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
  } catch (error: any) {
    console.error('[Order API] Ошибка при получении заказа:', error);
    
    // Если есть ответ от сервера, передаем его
    if (error.response) {
      return res.status(error.response.status).json(error.response.data);
    }

    // Если нет ответа, возвращаем общую ошибку
    return res.status(500).json({ 
      message: error.message || 'Внутренняя ошибка сервера'
    });
  }
} 