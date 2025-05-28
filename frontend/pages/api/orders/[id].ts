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
            name: dishResponse.data.name || `Блюдо #${item.dish_id}`,
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
      // Возвращаем демо-данные
      return res.status(200).json(generateDemoOrder(Number(id)));
    }
  } catch (error: any) {
    console.error('[Order API] Критическая ошибка при получении заказа:', error);
    
    // В любом случае возвращаем демо-данные
    return res.status(200).json(generateDemoOrder(Number(id)));
  }
}

// Функция для генерации демо-данных заказа по ID
function generateDemoOrder(id: number) {
  const now = new Date();
  const createdAt = new Date(now);
  createdAt.setDate(createdAt.getDate() - Math.floor(Math.random() * 10));
  
  const demoOrders = [
    {
      id: id,
      user_id: 1,
      waiter_id: 1,
      status: 'confirmed',
      payment_status: 'pending',
      payment_method: 'card',
      order_type: 'dine-in',
      total_amount: 3500,
      created_at: createdAt.toISOString(),
      updated_at: now.toISOString(),
      items: [
        {
          dish_id: 1,
          quantity: 2,
          price: 1200,
          name: 'Стейк из говядины',
          description: 'Сочный стейк из мраморной говядины с овощами гриль'
        },
        {
          dish_id: 2,
          quantity: 1,
          price: 1100,
          name: 'Паста Карбонара',
          description: 'Классическая итальянская паста с беконом и сливочным соусом'
        }
      ],
      table_number: 5,
      customer_name: 'Александр Иванов',
      customer_phone: '+7 (777) 111-22-33'
    }
  ];
  
  return demoOrders[0];
} 