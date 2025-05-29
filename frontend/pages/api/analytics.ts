import { NextApiRequest, NextApiResponse } from 'next';
import { query as dbQuery, checkConnection } from '../../lib/db';
import jwt from 'jsonwebtoken';

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
        const financialData = await dbQuery(SQL_QUERIES.financial, [startDate, endDate]);
        const financialDataArray = Array.isArray(financialData) ? financialData : [];
        
        // Формируем объект для ответа
        result = {
          totalRevenue: financialDataArray[0]?.totalRevenue || 0,
          totalCost: financialDataArray[0]?.totalCost || 0,
          grossProfit: financialDataArray[0]?.grossProfit || 0,
          profitMargin: financialDataArray[0]?.profitMargin || 0,
          averageOrderValue: financialDataArray[0]?.averageOrderValue || 0,
          orderCount: financialDataArray[0]?.orderCount || 0,
          revenueByCategory: {} as Record<string, number>,
          revenueByTimeOfDay: {} as Record<string, number>,
          revenueByDayOfWeek: {} as Record<string, number>,
          revenueTrend: [],
          period: { startDate, endDate }
        };
        
        // Получаем данные по категориям
        const categoryData = await dbQuery(`
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
        if (Array.isArray(categoryData)) {
          categoryData.forEach((cat: any) => {
            result.revenueByCategory[cat.categoryId] = cat.revenue;
          });
        }
        
        // Получаем тренд выручки за период
        const trendData = await dbQuery(`
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
        
        if (Array.isArray(trendData)) {
          result.revenueTrend = trendData;
        }
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
          const customerDataArray = Array.isArray(customerData) ? customerData : [];
          
          result = {
            totalCustomers: customerDataArray[0]?.totalCustomers || 0,
            newCustomers: customerDataArray[0]?.newCustomers || 0,
            returningCustomers: customerDataArray[0]?.returningCustomers || 0,
            customerRetentionRate: customerDataArray[0]?.returnRate || 0,
            returnRate: customerDataArray[0]?.returnRate || 0,
            averageVisitsPerCustomer: customerDataArray[0]?.averageVisitsPerCustomer || 0,
            customerSatisfaction: customerDataArray[0]?.customerSatisfaction || 0,
            customerSegmentation: {},
            topCustomers: [],
            customerDemographics: {
              age_groups: {},
              total_customers: 0
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
        const operationalDataArray = Array.isArray(operationalData) ? operationalData : [];
        
        result = {
          averageOrderPreparationTime: operationalDataArray[0]?.averageOrderPreparationTime || 0,
          averageTableTurnoverTime: operationalDataArray[0]?.averageTableTurnoverTime || 0,
          tablesCount: operationalDataArray[0]?.tablesCount || 0,
          averageTableUtilization: 0, // Заглушка
          averageOrdersPerTable: operationalDataArray[0]?.averageOrdersPerTable || 0,
          tableUtilization: {} as Record<string, number>,
          peakHours: {} as Record<string, number>,
          staffEfficiency: {} as Record<string, any>,
          orderCompletionRates: operationalDataArray[0]?.orderCompletionRates ? JSON.parse(operationalDataArray[0].orderCompletionRates) : {},
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
        const tableDataArray = Array.isArray(tableData) ? tableData : [];
        const maxOrdersPerTable = tableDataArray.length > 0 ? 
          Math.max(...tableDataArray.map((t: any) => t.orderCount), 1) : 1;
          
        tableDataArray.forEach((t: any) => {
          result.tableUtilization[t.table_id] = Math.round((t.orderCount / maxOrdersPerTable) * 100);
        });

        // Получаем пиковые часы
        const hourlyData = await dbQuery(`
          SELECT 
            strftime('%H:00', created_at) as hour,
            COUNT(*) as orderCount
          FROM orders
          WHERE created_at BETWEEN ? AND ?
          GROUP BY strftime('%H:00', created_at)
          ORDER BY orderCount DESC
          LIMIT 5
        `, [startDate, endDate]);
        
        // Преобразуем пиковые часы в проценты от максимума
        const hourlyDataArray = Array.isArray(hourlyData) ? hourlyData : [];
        if (hourlyDataArray.length > 0) {
          const maxHourlyOrders = Math.max(...hourlyDataArray.map((h: any) => h.orderCount), 1);
          hourlyDataArray.forEach((h: any) => {
            result.peakHours[h.hour] = Math.round((h.orderCount / maxHourlyOrders) * 100);
          });
        }
        break;
        
      case 'predictive':
        const salesData = await dbQuery(SQL_QUERIES.predictive, [startDate, endDate]);
        const salesDataArray = Array.isArray(salesData) ? salesData : [];
        
        result = {
          salesForecast: salesDataArray[0]?.salesForecast ? 
            JSON.parse(salesDataArray[0].salesForecast) : [],
          inventoryForecast: {},
          staffingNeeds: {},
          peakTimePrediction: {},
          suggestedPromotions: [],
          period: { startDate, endDate }
        };
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
        
        // Проверяем, что результат является массивом и имеет элементы
        const firstDashboardRecord = Array.isArray(dashboardData) && dashboardData.length > 0 
          ? dashboardData[0] 
          : null;
        
        result = {
          revenue: firstDashboardRecord?.totalRevenue || 0,
          orders: firstDashboardRecord?.ordersCount || 0,
          customers: firstDashboardRecord?.customersCount || 0,
          avgPreparationTime: firstDashboardRecord?.avgPreparationTime || 0,
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
        try {
          // Для неизвестных эндпоинтов возвращаем обобщенные данные дашборда
          const dashboardData = await dbQuery(`
            SELECT 
              COALESCE(SUM(oi.price * oi.quantity), 0) as totalRevenue,
              COUNT(DISTINCT o.id) as totalOrders,
              CASE 
                WHEN COUNT(DISTINCT o.id) > 0 
                THEN ROUND(SUM(oi.price * oi.quantity) / COUNT(DISTINCT o.id), 0)
                ELSE 0 
              END as averageCheck,
              COUNT(DISTINCT o.customer_id) as customersCount
            FROM orders o
            JOIN order_items oi ON o.id = oi.order_id
            WHERE o.status NOT IN ('cancelled', 'rejected')
              AND o.created_at BETWEEN ? AND ?
          `, [startDate, endDate]);
          
          const dashboardDataArray = Array.isArray(dashboardData) ? dashboardData : [];
          
          result = {
            summary: {
              totalRevenue: dashboardDataArray[0]?.totalRevenue || 0,
              totalOrders: dashboardDataArray[0]?.totalOrders || 0,
              averageCheck: dashboardDataArray[0]?.averageCheck || 0,
              customersCount: dashboardDataArray[0]?.customersCount || 0
            },
            period: { startDate, endDate }
          };
        } catch (err) {
          console.error('[Analytics API] Ошибка при получении данных дашборда:', err);
          return res.status(500).json({
            error: 'Internal Server Error',
            message: 'Ошибка при получении данных дашборда'
          });
        }
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