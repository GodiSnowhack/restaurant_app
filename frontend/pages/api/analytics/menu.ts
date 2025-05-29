import { NextApiRequest, NextApiResponse } from 'next';
import { query } from '../../../lib/db';

// Функция проверки авторизации
const verifyAuth = (req: NextApiRequest): { isAuthenticated: boolean } => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return { isAuthenticated: false };
    }

    // В реальном приложении здесь должна быть настоящая проверка токена
    return { isAuthenticated: true };
  } catch (err) {
    console.error('Ошибка верификации токена:', err);
    return { isAuthenticated: false };
  }
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // Проверка авторизации
  const authResult = verifyAuth(req);
  if (!authResult.isAuthenticated) {
    return res.status(401).json({ error: 'Unauthorized' });
    }

  // Получаем параметры запроса
  const { startDate, endDate } = req.query;

  try {
    // SQL запрос для получения топ продаваемых блюд
    const topSellingDishesQuery = `
      SELECT 
        mi.id as dishId,
        mi.name as dishName,
        mi.category_id as categoryId,
        c.name as categoryName,
        COUNT(oi.id) as salesCount,
        SUM(oi.price * oi.quantity) as revenue,
        ROUND(SUM(oi.price * oi.quantity) / (
          SELECT SUM(price * quantity) 
          FROM order_items 
          JOIN orders o ON order_items.order_id = o.id
          WHERE o.status NOT IN ('cancelled', 'rejected')
            AND o.created_at BETWEEN ? AND ?
        ) * 100, 1) as percentage
      FROM menu_items mi
      JOIN order_items oi ON mi.id = oi.menu_item_id
      JOIN orders o ON oi.order_id = o.id
      LEFT JOIN categories c ON mi.category_id = c.id
      WHERE o.status NOT IN ('cancelled', 'rejected')
        AND o.created_at BETWEEN ? AND ?
      GROUP BY mi.id, mi.name, mi.category_id, c.name
      ORDER BY revenue DESC
      LIMIT 10
    `;

    // SQL запрос для получения самых прибыльных блюд
    const mostProfitableDishesQuery = `
      SELECT 
        mi.id as dishId,
        mi.name as dishName,
        mi.category_id as categoryId,
        c.name as categoryName,
        COUNT(oi.id) as salesCount,
        SUM(oi.price * oi.quantity) as revenue,
        SUM(oi.cost_price * oi.quantity) as costPrice,
        SUM((oi.price - oi.cost_price) * oi.quantity) as profit,
        ROUND(SUM((oi.price - oi.cost_price) * oi.quantity) / SUM(oi.price * oi.quantity) * 100, 1) as profitMargin
      FROM menu_items mi
      JOIN order_items oi ON mi.id = oi.menu_item_id
      JOIN orders o ON oi.order_id = o.id
      LEFT JOIN categories c ON mi.category_id = c.id
      WHERE o.status NOT IN ('cancelled', 'rejected')
        AND o.created_at BETWEEN ? AND ?
      GROUP BY mi.id, mi.name, mi.category_id, c.name
      ORDER BY profit DESC
      LIMIT 10
    `;

    // SQL запрос для получения наименее продаваемых блюд
    const leastSellingDishesQuery = `
      SELECT 
        mi.id as dishId,
        mi.name as dishName,
        mi.category_id as categoryId,
        c.name as categoryName,
        COUNT(oi.id) as salesCount,
        SUM(oi.price * oi.quantity) as revenue,
        ROUND(SUM(oi.price * oi.quantity) / (
          SELECT SUM(price * quantity) 
          FROM order_items 
          JOIN orders o ON order_items.order_id = o.id
          WHERE o.status NOT IN ('cancelled', 'rejected')
            AND o.created_at BETWEEN ? AND ?
        ) * 100, 1) as percentage
      FROM menu_items mi
      JOIN order_items oi ON mi.id = oi.menu_item_id
      JOIN orders o ON oi.order_id = o.id
      LEFT JOIN categories c ON mi.category_id = c.id
      WHERE o.status NOT IN ('cancelled', 'rejected')
        AND o.created_at BETWEEN ? AND ?
      GROUP BY mi.id, mi.name, mi.category_id, c.name
      ORDER BY salesCount ASC
      LIMIT 10
    `;

    // Выполнение запросов
    const [topSellingDishes, mostProfitableDishes, leastSellingDishes] = await Promise.all([
      query(topSellingDishesQuery, [startDate, endDate, startDate, endDate]),
      query(mostProfitableDishesQuery, [startDate, endDate]),
      query(leastSellingDishesQuery, [startDate, endDate, startDate, endDate])
    ]);
        
    // Формирование результата
    const result = {
      topSellingDishes,
      mostProfitableDishes,
      leastSellingDishes,
      // Дополнительные метрики
      averageCookingTime: 15, // Заглушка для среднего времени приготовления
      categoryPopularity: {}, // Заглушка для популярности категорий
      menuItemSalesTrend: {}, // Заглушка для трендов продаж
      period: { startDate, endDate }
    };

    return res.status(200).json(result);
  } catch (err) {
    const error = err as Error;
    console.error('Ошибка при получении аналитики меню:', error);
    return res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
} 