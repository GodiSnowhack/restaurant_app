import { NextApiRequest, NextApiResponse } from 'next';

/**
 * Маршрутизация API для раздела официанта
 */
export default async function waiterApiRouter(req: NextApiRequest, res: NextApiResponse) {
  // Разрешаем CORS для всех клиентов
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  // Обрабатываем предварительные запросы CORS
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Возвращаем справочную информацию о доступных API-endpoints
  return res.status(200).json({
    message: 'Waiter API endpoints',
    endpoints: [
      {
        path: '/api/waiter/orders',
        methods: ['GET'],
        description: 'Получение списка заказов, назначенных официанту'
      },
      {
        path: '/api/waiter/orders/[id]',
        methods: ['GET'],
        description: 'Получение информации о конкретном заказе'
      },
      {
        path: '/api/waiter/orders/[id]/complete',
        methods: ['POST'],
        description: 'Завершение заказа'
      },
      {
        path: '/api/waiter/orders/[id]/cancel',
        methods: ['POST'],
        description: 'Отмена заказа'
      }
    ]
  });
} 