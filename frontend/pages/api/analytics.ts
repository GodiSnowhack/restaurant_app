import { NextApiRequest, NextApiResponse } from 'next';
import { query as dbQuery, checkConnection } from '../../lib/db';
import jwt from 'jsonwebtoken';

// Интерфейсы для типизации данных
interface FinancialData {
  totalRevenue: number;
  totalCost: number;
  grossProfit: number;
  profitMargin: number;
  averageOrderValue: number;
  orderCount: number;
}

interface CategoryData {
  categoryId: number;
  categoryName: string;
  revenue: number;
}

interface TrendData {
  date: string;
  value: number;
}

// SQL запросы для аналитики
const SQL_QUERIES = {
  financial: `
    SELECT 
      COALESCE(SUM(oi.price * oi.quantity), 0) as totalRevenue,
      COALESCE(SUM(oi.cost_price * oi.quantity), 0) as totalCost,
      COALESCE(SUM((oi.price - oi.cost_price) * oi.quantity), 0) as grossProfit,
      CASE 
        WHEN SUM(oi.price * oi.quantity) > 0 
        THEN ROUND((SUM((oi.price - oi.cost_price) * oi.quantity) / SUM(oi.price * oi.quantity)) * 100, 1)
        ELSE 0 
      END as profitMargin,
      CASE 
        WHEN COUNT(DISTINCT o.id) > 0 
        THEN ROUND(SUM(oi.price * oi.quantity) / COUNT(DISTINCT o.id), 0)
        ELSE 0 
      END as averageOrderValue,
      COUNT(DISTINCT o.id) as orderCount
    FROM orders o
    JOIN order_items oi ON o.id = oi.order_id
    WHERE o.status NOT IN ('cancelled', 'rejected')
      AND o.created_at BETWEEN ? AND ?
  `,
  
  menu: `
    SELECT 
      m.id as dishId,
      m.name as dishName,
      COUNT(oi.id) as salesCount,
      SUM(oi.price * oi.quantity) as revenue,
      ROUND(SUM(oi.price * oi.quantity) / (SELECT SUM(price * quantity) FROM order_items WHERE created_at BETWEEN ? AND ?) * 100, 1) as percentage
    FROM menu_items m
    JOIN order_items oi ON m.id = oi.menu_item_id
    JOIN orders o ON oi.order_id = o.id
    WHERE o.status NOT IN ('cancelled', 'rejected')
      AND o.created_at BETWEEN ? AND ?
    GROUP BY m.id, m.name
    ORDER BY revenue DESC
    LIMIT 10
  `,
  
  customers: `
    SELECT 
      COUNT(DISTINCT u.id) as totalCustomers,
      SUM(CASE WHEN u.created_at BETWEEN ? AND ? THEN 1 ELSE 0 END) as newCustomers,
      COUNT(DISTINCT CASE WHEN o.customer_id IS NOT NULL THEN o.customer_id END) as returningCustomers,
      ROUND(
        COUNT(DISTINCT CASE WHEN orderCount > 1 THEN o.customer_id END) * 100.0 / 
        NULLIF(COUNT(DISTINCT o.customer_id), 0), 
        1
      ) as returnRate,
      ROUND(AVG(orderCount), 1) as averageVisitsPerCustomer,
      ROUND(AVG(CASE WHEN r.rating IS NOT NULL THEN r.rating ELSE 0 END), 1) as customerSatisfaction
    FROM users u
    LEFT JOIN (
      SELECT customer_id, COUNT(*) as orderCount
      FROM orders
      WHERE created_at BETWEEN ? AND ?
      GROUP BY customer_id
    ) o ON u.id = o.customer_id
    LEFT JOIN reviews r ON u.id = r.user_id
    WHERE u.role = 'customer'
  `,
  
  operational: `
    SELECT 
      ROUND(AVG(JULIANDAY(o.completed_at) - JULIANDAY(o.created_at)) * 24 * 60, 1) as averageOrderPreparationTime,
      ROUND(AVG(JULIANDAY(o.completed_at) - JULIANDAY(o.created_at)) * 24 * 60, 1) as averageTableTurnoverTime,
      COUNT(DISTINCT o.table_id) as tablesCount,
      COUNT(*) as totalOrders,
      ROUND(COUNT(*) * 1.0 / COUNT(DISTINCT o.table_id), 1) as averageOrdersPerTable,
      (
        SELECT json_group_object(status, percentage)
        FROM (
          SELECT 
            status,
            ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM orders WHERE created_at BETWEEN ? AND ?), 1) as percentage
          FROM orders
          WHERE created_at BETWEEN ? AND ?
          GROUP BY status
        )
      ) as orderCompletionRates
    FROM orders o
    WHERE o.created_at BETWEEN ? AND ?
  `,
  
  predictive: `
    WITH daily_sales AS (
      SELECT 
        date(o.created_at) as date,
        SUM(oi.price * oi.quantity) as value
      FROM orders o
      JOIN order_items oi ON o.id = oi.order_id
      WHERE o.status NOT IN ('cancelled', 'rejected')
        AND o.created_at BETWEEN date(?, '-30 days') AND ?
      GROUP BY date(o.created_at)
      ORDER BY date(o.created_at)
    )
    SELECT json_group_array(
      json_object(
        'date', date,
        'value', value
      )
    ) as salesForecast
    FROM daily_sales
  `
};

// Функция проверки авторизации
const verifyAuth = (req: NextApiRequest): boolean => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return false;
    }

    const token = authHeader.replace('Bearer ', '');
    if (!token) {
      return false;
    }

    // Проверяем токен JWT
    const secret = process.env.JWT_SECRET || 'your-secret-key';
    jwt.verify(token, secret);
    return true;
  } catch (error) {
    console.error('[Analytics API] Ошибка верификации токена:', error);
    return false;
  }
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { method, query } = req;
  
  // Проверяем метод запроса
  if (method !== 'GET') {
    return res.status(405).json({ error: 'Метод не разрешен' });
  }

  // Проверяем авторизацию
  if (!verifyAuth(req)) {
    return res.status(401).json({ error: 'Unauthorized', message: 'Требуется авторизация для доступа к API аналитики' });
  }

  // Определяем конечную точку запроса на основе пути
  const { endpoint } = query;
  let targetEndpoint = endpoint || 'dashboard';

  // Для случая, когда передан массив параметров
  if (Array.isArray(targetEndpoint)) {
    targetEndpoint = targetEndpoint.join('/');
  }

  // Получаем параметры дат из запроса или устанавливаем значения по умолчанию
  const now = new Date();
  const startDate = query.startDate 
    ? new Date(query.startDate as string).toISOString().split('T')[0]
    : new Date(now.setMonth(now.getMonth() - 1)).toISOString().split('T')[0];
  
  const endDate = query.endDate
    ? new Date(query.endDate as string).toISOString().split('T')[0]
    : new Date().toISOString().split('T')[0];

  console.log(`[Analytics API] Запрос аналитики: ${targetEndpoint}, период: ${startDate} - ${endDate}`);

  try {
    // Проверяем соединение с базой данных
    const isConnected = await checkConnection();
    if (!isConnected) {
      console.error('[Analytics API] Отсутствует соединение с базой данных');
      return res.status(503).json({
        error: 'Database Unavailable',
        message: 'Нет соединения с базой данных. Пожалуйста, проверьте настройки подключения.'
      });
    }

    // Выполняем запрос к базе данных в зависимости от типа эндпоинта
    let result: any;
    
    switch (targetEndpoint) {
      case 'financial':
        const financialData = await dbQuery<FinancialData[]>(SQL_QUERIES.financial, [startDate, endDate]);
        
        // Формируем объект для ответа
        result = {
          totalRevenue: financialData?.[0]?.totalRevenue ?? 0,
          totalCost: financialData?.[0]?.totalCost ?? 0,
          grossProfit: financialData?.[0]?.grossProfit ?? 0,
          profitMargin: financialData?.[0]?.profitMargin ?? 0,
          averageOrderValue: financialData?.[0]?.averageOrderValue ?? 0,
          orderCount: financialData?.[0]?.orderCount ?? 0,
          revenueByCategory: {} as Record<string, number>,
          revenueByTimeOfDay: {} as Record<string, number>,
          revenueByDayOfWeek: {} as Record<string, number>,
          revenueTrend: [],
          period: { startDate, endDate }
        };
        
        // Получаем данные по категориям
        const categoryData = await dbQuery<CategoryData[]>(`
          SELECT 
            c.id as categoryId,
            c.name as categoryName,
            SUM(oi.price * oi.quantity) as revenue
          FROM categories c
          JOIN menu_items m ON c.id = m.category_id
          JOIN order_items oi ON m.id = oi.menu_item_id
          JOIN orders o ON oi.order_id = o.id
          WHERE o.status NOT IN ('cancelled', 'rejected')
            AND o.created_at BETWEEN ? AND ?
          GROUP BY c.id, c.name
          ORDER BY revenue DESC
        `, [startDate, endDate]);
        
        // Добавляем данные по категориям в результат
        categoryData.forEach((cat) => {
          result.revenueByCategory[cat.categoryId] = cat.revenue;
        });
        
        // Получаем тренд выручки за период
        const trendData = await dbQuery<TrendData[]>(`
          SELECT 
            date(o.created_at) as date,
            SUM(oi.price * oi.quantity) as value
          FROM orders o
          JOIN order_items oi ON o.id = oi.order_id
          WHERE o.status NOT IN ('cancelled', 'rejected')
            AND o.created_at BETWEEN ? AND ?
          GROUP BY date(o.created_at)
          ORDER BY date(o.created_at)
        `, [startDate, endDate]);
        
        result.revenueTrend = trendData;
        break;
        
      case 'menu':
        // Получаем топ продаваемых блюд
        const topSellingDishes = await dbQuery(SQL_QUERIES.menu, [startDate, endDate, startDate, endDate]);
        
        // Получаем наименее продаваемые блюда
        const leastSellingDishes = await dbQuery(`
          SELECT 
            m.id as dishId,
            m.name as dishName,
            COUNT(oi.id) as salesCount,
            SUM(oi.price * oi.quantity) as revenue,
            ROUND(SUM(oi.price * oi.quantity) / (SELECT SUM(price * quantity) FROM order_items WHERE created_at BETWEEN ? AND ?) * 100, 1) as percentage
          FROM menu_items m
          JOIN order_items oi ON m.id = oi.menu_item_id
          JOIN orders o ON oi.order_id = o.id
          WHERE o.status NOT IN ('cancelled', 'rejected')
            AND o.created_at BETWEEN ? AND ?
          GROUP BY m.id, m.name
          ORDER BY salesCount ASC
          LIMIT 5
        `, [startDate, endDate, startDate, endDate]);
        
        // Получаем самые прибыльные блюда
        const mostProfitableDishes = await dbQuery(`
          SELECT 
            m.id as dishId,
            m.name as dishName,
            COUNT(oi.id) as salesCount,
            SUM(oi.price * oi.quantity) as revenue,
            ROUND(SUM((oi.price - oi.cost_price) * oi.quantity), 0) as profit,
            ROUND(SUM((oi.price - oi.cost_price) * oi.quantity) / SUM(oi.price * oi.quantity) * 100, 1) as profitMargin,
            ROUND(SUM(oi.price * oi.quantity) / (SELECT SUM(price * quantity) FROM order_items WHERE created_at BETWEEN ? AND ?) * 100, 1) as percentage,
            ROUND(AVG(oi.cost_price), 0) as costPrice
          FROM menu_items m
          JOIN order_items oi ON m.id = oi.menu_item_id
          JOIN orders o ON oi.order_id = o.id
          WHERE o.status NOT IN ('cancelled', 'rejected')
            AND o.created_at BETWEEN ? AND ?
          GROUP BY m.id, m.name
          ORDER BY profitMargin DESC, revenue DESC
          LIMIT 5
        `, [startDate, endDate, startDate, endDate]);
        
        result = {
          topSellingDishes,
          leastSellingDishes,
          mostProfitableDishes,
          averageCookingTime: 18.5, // Заглушка, так как нет реальных данных
          categoryPopularity: {},
          menuItemSalesTrend: {},
          period: { startDate, endDate }
        };
        break;
        
      case 'customers':
        try {
          const customerData = await dbQuery(SQL_QUERIES.customers, [startDate, endDate, startDate, endDate]);
          
          result = {
            totalCustomers: customerData[0]?.totalCustomers || 0,
            newCustomers: customerData[0]?.newCustomers || 0,
            returningCustomers: customerData[0]?.returningCustomers || 0,
            customerRetentionRate: customerData[0]?.returnRate || 0,
            returnRate: customerData[0]?.returnRate || 0,
            averageVisitsPerCustomer: customerData[0]?.averageVisitsPerCustomer || 0,
            customerSatisfaction: customerData[0]?.customerSatisfaction || 0,
            customerSegmentation: {},
            topCustomers: [],
            customerDemographics: {
              age: {},
              gender: {}
            },
            period: { startDate, endDate }
          };
          
          // Получаем топ клиентов
          const topCustomers = await dbQuery(`
            SELECT 
              u.id as userId,
              u.name || ' ' || u.lastname as fullName,
              u.email,
              SUM(o.total) as totalSpent,
              COUNT(o.id) as ordersCount,
              AVG(r.rating) as averageRating,
              MAX(o.created_at) as lastVisit
            FROM users u
            JOIN orders o ON u.id = o.customer_id
            LEFT JOIN reviews r ON u.id = r.user_id
            WHERE o.status = 'completed'
              AND o.created_at BETWEEN ? AND ?
            GROUP BY u.id, u.name, u.lastname, u.email
            ORDER BY totalSpent DESC
            LIMIT 10
          `, [startDate, endDate]);
          
          result.topCustomers = topCustomers;
        } catch (err) {
          console.error('[Analytics API] Ошибка при получении данных о клиентах:', err);
          return res.status(500).json({
            error: 'Internal Server Error',
            message: 'Ошибка при получении данных о клиентах'
          });
        }
        break;
        
      case 'operational':
        const operationalData = await dbQuery(SQL_QUERIES.operational, [startDate, endDate, startDate, endDate, startDate, endDate]);
        
        result = {
          averageOrderPreparationTime: operationalData[0]?.averageOrderPreparationTime || 0,
          averageTableTurnoverTime: operationalData[0]?.averageTableTurnoverTime || 0,
          tablesCount: operationalData[0]?.tablesCount || 0,
          averageTableUtilization: 0, // Заглушка
          averageOrdersPerTable: operationalData[0]?.averageOrdersPerTable || 0,
          tableUtilization: {} as Record<string, number>,
          peakHours: {} as Record<string, number>,
          staffEfficiency: {} as Record<string, any>,
          orderCompletionRates: operationalData[0]?.orderCompletionRates ? JSON.parse(operationalData[0].orderCompletionRates) : {},
          period: { startDate, endDate }
        };
        
        // Получаем данные по загрузке столиков
        const tableData = await dbQuery(`
          SELECT 
            table_id,
            COUNT(*) as orderCount
          FROM orders
          WHERE created_at BETWEEN ? AND ?
            AND table_id IS NOT NULL
          GROUP BY table_id
        `, [startDate, endDate]);
        
        // Рассчитываем утилизацию столиков (упрощенная логика)
        const maxOrdersPerTable = Math.max(...tableData.map((t: any) => t.orderCount), 1);
        tableData.forEach((t: any) => {
          result.tableUtilization[t.table_id] = Math.round((t.orderCount / maxOrdersPerTable) * 100);
        });
        
        // Получаем пиковые часы
        const hourlyData = await dbQuery(`
          SELECT 
            strftime('%H:00', created_at) as hour,
            COUNT(*) as orderCount
          FROM orders
          WHERE created_at BETWEEN ? AND ?
          GROUP BY hour
          ORDER BY orderCount DESC
        `, [startDate, endDate]);
        
        // Преобразуем пиковые часы в проценты от максимума
        const maxHourlyOrders = Math.max(...hourlyData.map((h: any) => h.orderCount), 1);
        hourlyData.forEach((h: any) => {
          result.peakHours[h.hour] = Math.round((h.orderCount / maxHourlyOrders) * 100);
        });
        break;
        
      case 'predictive':
        const predictiveData = await dbQuery(SQL_QUERIES.predictive, [endDate, endDate]);
        
        result = {
          salesForecast: predictiveData[0]?.salesForecast ? JSON.parse(predictiveData[0].salesForecast) : [],
          inventoryForecast: {},
          staffingNeeds: {
            'monday': { '10-14': 3, '14-18': 4, '18-22': 5 },
            'tuesday': { '10-14': 3, '14-18': 4, '18-22': 5 },
            'wednesday': { '10-14': 3, '14-18': 4, '18-22': 5 },
            'thursday': { '10-14': 4, '14-18': 5, '18-22': 6 },
            'friday': { '10-14': 5, '14-18': 6, '18-22': 7 },
            'saturday': { '10-14': 6, '14-18': 7, '18-22': 8 },
            'sunday': { '10-14': 5, '14-18': 6, '18-22': 6 }
          },
          peakTimePrediction: {},
          suggestedPromotions: [],
          period: { startDate, endDate }
        };
        
        // Получаем прогнозы по запасам (упрощенная логика)
        const inventoryData = await dbQuery(`
          SELECT 
            i.id,
            i.name,
            i.quantity as currentStock,
            (
              SELECT SUM(ri.quantity * oi.quantity)
              FROM recipe_ingredients ri
              JOIN menu_items m ON ri.recipe_id = m.recipe_id
              JOIN order_items oi ON m.id = oi.menu_item_id
              JOIN orders o ON oi.order_id = o.id
              WHERE ri.ingredient_id = i.id
                AND o.created_at BETWEEN date(?, '-7 days') AND ?
            ) as weeklyUsage
          FROM ingredients i
          ORDER BY weeklyUsage DESC NULLS LAST
          LIMIT 10
        `, [endDate, endDate]);
        
        // Преобразуем данные по запасам
        inventoryData.forEach((i: any) => {
          if (i.id && i.weeklyUsage) {
            result.inventoryForecast[i.id] = Math.round(i.weeklyUsage * 1.1); // Прогноз с 10% запасом
          }
        });
        
        break;
        
      case 'dashboard':
        // Получаем сводные данные для дашборда (упрощенная логика)
        const dashboardData = await dbQuery(`
          SELECT 
            (
              SELECT COALESCE(SUM(oi.price * oi.quantity), 0)
              FROM orders o
              JOIN order_items oi ON o.id = oi.order_id
              WHERE o.status NOT IN ('cancelled', 'rejected')
                AND o.created_at BETWEEN ? AND ?
            ) as totalRevenue,
            (
              SELECT COUNT(DISTINCT o.id)
              FROM orders o
              WHERE o.created_at BETWEEN ? AND ?
            ) as ordersCount,
            (
              SELECT COUNT(DISTINCT o.customer_id)
              FROM orders o
              WHERE o.created_at BETWEEN ? AND ?
                AND o.customer_id IS NOT NULL
            ) as customersCount,
            (
              SELECT ROUND(AVG(JULIANDAY(o.completed_at) - JULIANDAY(o.created_at)) * 24 * 60, 1)
              FROM orders o
              WHERE o.status = 'completed'
                AND o.created_at BETWEEN ? AND ?
                AND o.completed_at IS NOT NULL
            ) as avgPreparationTime
        `, [startDate, endDate, startDate, endDate, startDate, endDate, startDate, endDate]);
        
        result = {
          revenue: dashboardData[0]?.totalRevenue || 0,
          orders: dashboardData[0]?.ordersCount || 0,
          customers: dashboardData[0]?.customersCount || 0,
          avgPreparationTime: dashboardData[0]?.avgPreparationTime || 0,
          period: { startDate, endDate }
        };
        break;
        
      case 'top-dishes':
        // Получаем топ блюд
        const limit = parseInt(query.limit as string) || 10;
        const topDishes = await dbQuery(`
          SELECT 
            m.id as dishId,
            m.name as dishName,
            COUNT(oi.id) as salesCount,
            SUM(oi.price * oi.quantity) as revenue
          FROM menu_items m
          JOIN order_items oi ON m.id = oi.menu_item_id
          JOIN orders o ON oi.order_id = o.id
          WHERE o.status NOT IN ('cancelled', 'rejected')
            AND o.created_at BETWEEN ? AND ?
          GROUP BY m.id, m.name
          ORDER BY salesCount DESC
          LIMIT ?
        `, [startDate, endDate, limit]);
        
        result = {
          dishes: topDishes,
          period: { startDate, endDate }
        };
        break;
        
      default:
        return res.status(404).json({ 
          error: 'Not Found', 
          message: `Эндпоинт '${targetEndpoint}' не найден` 
        });
    }

    // Возвращаем результат
    return res.status(200).json(result);
  } catch (err) {
    console.error(`[Analytics API] Общая ошибка в эндпоинте ${targetEndpoint}:`, err);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Внутренняя ошибка сервера при получении данных аналитики'
    });
  }
}