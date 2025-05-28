import { NextApiRequest, NextApiResponse } from 'next';
import { query as dbQuery, checkConnection } from '../../lib/db';
import jwt from 'jsonwebtoken';

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

interface DishData {
  dishId: number;
  dishName: string;
  salesCount: number;
  revenue: number;
  percentage: number;
  profit?: number;
  profitMargin?: number;
  costPrice?: number;
}

interface CustomerData {
  totalCustomers: number;
  newCustomers: number;
  returningCustomers: number;
  returnRate: number;
  averageVisitsPerCustomer: number;
  customerSatisfaction: number;
}

interface OperationalData {
  averageOrderPreparationTime: number;
  averageTableTurnoverTime: number;
  tablesCount: number;
  averageOrdersPerTable: number;
  orderCompletionRates: string;
}

interface TableData {
  table_id: number;
  orderCount: number;
}

interface HourlyData {
  hour: string;
  orderCount: number;
}

interface PredictiveData {
  salesForecast: string;
}

interface InventoryData {
  id: number;
  name: string;
  currentStock: number;
  weeklyUsage: number;
}

interface DashboardData {
  totalRevenue: number;
  ordersCount: number;
  customersCount: number;
  avgPreparationTime: number;
}

// Добавляем интерфейс для результата запроса
interface QueryResult {
  [key: string]: any;
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
    let result: QueryResult = {};
    
    switch (targetEndpoint) {
      case 'financial':
        const financialData = await dbQuery(SQL_QUERIES.financial, [startDate, endDate]) as FinancialData[];
        
        // Формируем объект для ответа
        result = {
          totalRevenue: financialData[0]?.totalRevenue ?? 0,
          totalCost: financialData[0]?.totalCost ?? 0,
          grossProfit: financialData[0]?.grossProfit ?? 0,
          profitMargin: financialData[0]?.profitMargin ?? 0,
          averageOrderValue: financialData[0]?.averageOrderValue ?? 0,
          orderCount: financialData[0]?.orderCount ?? 0,
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
        `, [startDate, endDate]) as CategoryData[];
        
        // Добавляем данные по категориям в результат
        categoryData.forEach((cat: CategoryData) => {
          result.revenueByCategory[cat.categoryId] = cat.revenue;
        });
        
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
        
        result.revenueTrend = trendData;
        break;
        
      case 'menu':
        // Получаем топ продаваемых блюд
        const topSellingDishes = await dbQuery(SQL_QUERIES.menu, [startDate, endDate, startDate, endDate]) as DishData[];
        
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
        `, [startDate, endDate, startDate, endDate]) as DishData[];
        
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
          averageCookingTime: 18.5,
          categoryPopularity: {} as Record<string, number>,
          menuItemSalesTrend: {} as Record<string, any>,
          period: { startDate, endDate }
        };
        break;
        
      case 'customers':
        try {
          const customerData = await dbQuery(SQL_QUERIES.customers, [startDate, endDate, startDate, endDate]) as CustomerData[];
          
          result = {
            totalCustomers: customerData[0]?.totalCustomers ?? 0,
            newCustomers: customerData[0]?.newCustomers ?? 0,
            returningCustomers: customerData[0]?.returningCustomers ?? 0,
            customerRetentionRate: customerData[0]?.returnRate ?? 0,
            returnRate: customerData[0]?.returnRate ?? 0,
            averageVisitsPerCustomer: customerData[0]?.averageVisitsPerCustomer ?? 0,
            customerSatisfaction: customerData[0]?.customerSatisfaction ?? 0,
            customerSegmentation: {} as Record<string, number>,
            topCustomers: [] as any[],
            customerDemographics: {
              age: {} as Record<string, number>,
              gender: {} as Record<string, number>
            },
            period: { startDate, endDate }
          } as QueryResult;
          
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
        const operationalData = await dbQuery(SQL_QUERIES.operational, [startDate, endDate, startDate, endDate, startDate, endDate]) as OperationalData[];
        
        result = {
          averageOrderPreparationTime: operationalData?.[0]?.averageOrderPreparationTime ?? 0,
          averageTableTurnoverTime: operationalData?.[0]?.averageTableTurnoverTime ?? 0,
          tablesCount: operationalData?.[0]?.tablesCount ?? 0,
          averageTableUtilization: 0,
          averageOrdersPerTable: operationalData?.[0]?.averageOrdersPerTable ?? 0,
          tableUtilization: {} as Record<string, number>,
          peakHours: {} as Record<string, number>,
          staffEfficiency: {} as Record<string, any>,
          orderCompletionRates: operationalData?.[0]?.orderCompletionRates ? JSON.parse(operationalData[0].orderCompletionRates) : {},
          period: { startDate, endDate }
        } as QueryResult;
        
        // Получаем данные по загрузке столиков
        const tableData = await dbQuery(`
          SELECT 
            table_id,
            COUNT(*) as orderCount
          FROM orders
          WHERE created_at BETWEEN ? AND ?
            AND table_id IS NOT NULL
          GROUP BY table_id
        `, [startDate, endDate]) as TableData[];
        
        // Рассчитываем утилизацию столиков
        const maxOrdersPerTable = Math.max(...tableData.map((t: TableData) => t.orderCount), 1);
        tableData.forEach((t: TableData) => {
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
        `, [startDate, endDate]) as HourlyData[];
        
        // Преобразуем пиковые часы в проценты от максимума
        const maxHourlyOrders = Math.max(...hourlyData.map((h: HourlyData) => h.orderCount), 1);
        hourlyData.forEach((h: HourlyData) => {
          result.peakHours[h.hour] = Math.round((h.orderCount / maxHourlyOrders) * 100);
        });
        break;
        
      case 'predictive':
        const predictiveData = await dbQuery(SQL_QUERIES.predictive, [endDate, endDate]) as PredictiveData[];
        
        result = {
          salesForecast: predictiveData?.[0]?.salesForecast ? JSON.parse(predictiveData[0].salesForecast) : [],
          inventoryForecast: {} as Record<number, number>,
          staffingNeeds: {
            'monday': { '10-14': 3, '14-18': 4, '18-22': 5 },
            'tuesday': { '10-14': 3, '14-18': 4, '18-22': 5 },
            'wednesday': { '10-14': 3, '14-18': 4, '18-22': 5 },
            'thursday': { '10-14': 4, '14-18': 5, '18-22': 6 },
            'friday': { '10-14': 5, '14-18': 6, '18-22': 7 },
            'saturday': { '10-14': 6, '14-18': 7, '18-22': 8 },
            'sunday': { '10-14': 5, '14-18': 6, '18-22': 6 }
          },
          peakTimePrediction: {} as Record<string, number>,
          suggestedPromotions: [],
          period: { startDate, endDate }
        } as QueryResult;
        
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
        `, [endDate, endDate]) as InventoryData[];
        
        // Преобразуем данные по запасам
        inventoryData.forEach((i: InventoryData) => {
          if (i.id && i.weeklyUsage) {
            result.inventoryForecast[i.id] = Math.round(i.weeklyUsage * 1.1); // Прогноз с 10% запасом
          }
        });
        
        break;
        
      case 'dashboard':
        // Получаем сводные данные для дашборда
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
        `, [startDate, endDate, startDate, endDate, startDate, endDate, startDate, endDate]) as DashboardData[];
        
        result = {
          revenue: dashboardData?.[0]?.totalRevenue ?? 0,
          orders: dashboardData?.[0]?.ordersCount ?? 0,
          customers: dashboardData?.[0]?.customersCount ?? 0,
          avgPreparationTime: dashboardData?.[0]?.avgPreparationTime ?? 0,
          period: { startDate, endDate }
        } as QueryResult;
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

// Функция для получения мок-данных в случае ошибки API
export function getMockData(endpoint: string): any {
  console.log(`Возвращаем заглушку для ${endpoint}`);
  
  const defaultDateRange = {
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  };
  
  // Базовые заглушки для каждого типа данных
  const mockData: Record<string, any> = {
    dashboard: {
      summary: {
        totalRevenue: 1250000,
        totalOrders: 357,
        averageCheck: 3500,
        customersCount: 320
      },
      period: defaultDateRange
    },
    
    financial: {
      totalRevenue: 1250000,
      totalCost: 750000,
      grossProfit: 500000,
      profitMargin: 40,
      averageOrderValue: 3500,
      orderCount: 357,
      revenueByCategory: {
        1: 350000,
        2: 280000,
        3: 210000,
        4: 170000,
        5: 140000
      },
      revenueByMonth: {
        'Январь': 290000,
        'Февраль': 310000,
        'Март': 350000,
        'Апрель': 300000
      },
      expensesByMonth: {
        'Январь': 190000,
        'Февраль': 180000,
        'Март': 200000,
        'Апрель': 180000
      },
      averageOrderValueByDay: {
        '2025-04-25': 3450,
        '2025-04-26': 3520,
        '2025-04-27': 3480,
        '2025-04-28': 3550,
        '2025-04-29': 3600,
        '2025-04-30': 3520,
        '2025-05-01': 3480,
        '2025-05-02': 3520
      },
      revenueChange: 5.8,
      profitChange: 7.2,
      averageOrderValueChange: 3.5,
      orderCountChange: 12.4,
      previousRevenue: 1180000,
      previousProfit: 480000,
      previousAverageOrderValue: 3380,
      previousOrderCount: 318,
      period: defaultDateRange
    },
    
    menu: {
      topSellingDishes: [
        { dishId: 1, dishName: "Бургер Классический", salesCount: 85, revenue: 212500, profitMargin: 40 },
        { dishId: 2, dishName: "Пицца Маргарита", salesCount: 78, revenue: 195000, profitMargin: 38 },
        { dishId: 3, dishName: "Карбонара", salesCount: 70, revenue: 175000, profitMargin: 36 },
        { dishId: 4, dishName: "Цезарь с курицей", salesCount: 62, revenue: 155000, profitMargin: 34 },
        { dishId: 5, dishName: "Стейк Рибай", salesCount: 54, revenue: 270000, profitMargin: 42 }
      ],
      
      mostProfitableDishes: [
        { dishId: 5, dishName: "Стейк Рибай", salesCount: 54, revenue: 270000, percentage: 10.8, costPrice: 156600, profit: 113400, profitMargin: 42 },
        { dishId: 9, dishName: "Тирамису", salesCount: 35, revenue: 87500, percentage: 3.5, costPrice: 47250, profit: 40250, profitMargin: 46 },
        { dishId: 8, dishName: "Суши-сет", salesCount: 38, revenue: 190000, percentage: 7.6, costPrice: 106400, profit: 83600, profitMargin: 44 },
        { dishId: 1, dishName: "Бургер Классический", salesCount: 85, revenue: 212500, percentage: 8.5, costPrice: 127500, profit: 85000, profitMargin: 40 },
        { dishId: 10, dishName: "Наполеон", salesCount: 32, revenue: 80000, percentage: 3.2, costPrice: 48000, profit: 32000, profitMargin: 40 }
      ],
      
      leastSellingDishes: [
        { dishId: 15, dishName: "Окрошка", salesCount: 12, revenue: 24000, percentage: 0.96 },
        { dishId: 16, dishName: "Тар-тар из говядины", salesCount: 15, revenue: 60000, percentage: 2.4 },
        { dishId: 17, dishName: "Паста с морепродуктами", salesCount: 18, revenue: 72000, percentage: 2.88 },
        { dishId: 18, dishName: "Фуа-гра", salesCount: 20, revenue: 120000, percentage: 4.8 },
        { dishId: 19, dishName: "Устрицы", salesCount: 22, revenue: 132000, percentage: 5.28 }
      ],
      
      averageCookingTime: 18,
      
      categoryPopularity: {
        "Горячие блюда": 40,
        "Супы": 15,
        "Салаты": 20,
        "Десерты": 15,
        "Напитки": 10
      },
      
      menuItemSalesTrend: {
        "Бургер Классический": [
          { date: '2023-05-20', value: 12 },
          { date: '2023-05-21', value: 14 },
          { date: '2023-05-22', value: 10 },
          { date: '2023-05-23', value: 15 },
          { date: '2023-05-24', value: 16 },
          { date: '2023-05-25', value: 18 },
          { date: '2023-05-26', value: 20 }
        ],
        "Пицца Маргарита": [
          { date: '2023-05-20', value: 10 },
          { date: '2023-05-21', value: 12 },
          { date: '2023-05-22', value: 14 },
          { date: '2023-05-23', value: 11 },
          { date: '2023-05-24', value: 9 },
          { date: '2023-05-25', value: 15 },
          { date: '2023-05-26', value: 17 }
        ]
      },
      
      menuItemPerformance: [
        { dishId: 1, dishName: "Бургер Классический", salesCount: 85, revenue: 212500, profitMargin: 40 },
        { dishId: 2, dishName: "Пицца Маргарита", salesCount: 78, revenue: 195000, profitMargin: 38 },
        { dishId: 3, dishName: "Карбонара", salesCount: 70, revenue: 175000, profitMargin: 36 },
        { dishId: 4, dishName: "Цезарь с курицей", salesCount: 62, revenue: 155000, profitMargin: 34 },
        { dishId: 5, dishName: "Стейк Рибай", salesCount: 54, revenue: 270000, profitMargin: 42 }
      ],
      
      categoryPerformance: {
        "Горячие блюда": {
          salesPercentage: 35.2,
          averageOrderValue: 5200,
          averageProfitMargin: 42
        },
        "Супы": {
          salesPercentage: 18.5,
          averageOrderValue: 2500,
          averageProfitMargin: 35
        },
        "Салаты": {
          salesPercentage: 15.7,
          averageOrderValue: 2200,
          averageProfitMargin: 38
        },
        "Десерты": {
          salesPercentage: 12.3,
          averageOrderValue: 1800,
          averageProfitMargin: 45
        },
        "Напитки": {
          salesPercentage: 18.3,
          averageOrderValue: 1200,
          averageProfitMargin: 60
        }
      },
      
      period: defaultDateRange
    },
    
    customers: {
      totalCustomers: 1200,
      newCustomers: 180,
      returningCustomers: 420,
      customerRetentionRate: 35,
      returnRate: 35,
      averageVisitsPerCustomer: 2.8,
      customerSatisfaction: 4.2,
      foodRating: 4.3,
      serviceRating: 4.0,
      customerSegmentation: {},
      newCustomersChange: 12.5,
      returnRateChange: 3.2,
      averageOrderValueChange: 5.8,
      customerDemographics: {
        age_groups: {
          '18-24': 15,
          '25-34': 35,
          '35-44': 25,
          '45-54': 15,
          '55+': 10
        },
        total_customers: 1200
      },
      visitTimes: {
        'Утро (8-12)': 20,
        'Обед (12-16)': 40,
        'Вечер (16-20)': 30,
        'Ночь (20-24)': 10
      },
      topCustomers: [
        { userId: 1, fullName: "Иван Петров", email: "ivan@example.com", totalSpent: 58000, ordersCount: 12, averageRating: 4.8, lastVisit: "2025-04-25" },
        { userId: 2, fullName: "Анна Сидорова", email: "anna@example.com", totalSpent: 52000, ordersCount: 10, averageRating: 4.5, lastVisit: "2025-04-28" },
        { userId: 3, fullName: "Сергей Иванов", email: "sergey@example.com", totalSpent: 48000, ordersCount: 8, averageRating: 4.2, lastVisit: "2025-04-22" },
        { userId: 4, fullName: "Ольга Смирнова", email: "olga@example.com", totalSpent: 43000, ordersCount: 7, averageRating: 4.0, lastVisit: "2025-04-27" },
        { userId: 5, fullName: "Николай Козлов", email: "nikolay@example.com", totalSpent: 40000, ordersCount: 6, averageRating: 4.7, lastVisit: "2025-04-26" }
      ],
      period: defaultDateRange
    },
    
    operational: {
      averageOrderPreparationTime: 20.5,
      averageTableTurnoverTime: 62.0,
      tablesCount: 15,
      averageTableUtilization: 72,
      averageOrdersPerTable: 24,
      tableUtilization: {
        1: 85,
        2: 90,
        3: 75,
        4: 80,
        5: 95,
        6: 70,
        7: 65,
        8: 75,
        9: 80,
        10: 85,
        11: 55,
        12: 60,
        13: 45,
        14: 50,
        15: 65
      },
      peakHours: {
        '12:00': 100,
        '13:00': 95,
        '14:00': 90,
        '19:00': 85,
        '20:00': 80
      },
      staffEfficiency: {
        1: { name: "Анна", role: "Официант", averageServiceTime: 12.5, customersServed: 35, rating: 4.8 },
        2: { name: "Иван", role: "Официант", averageServiceTime: 14.8, customersServed: 28, rating: 4.5 },
        3: { name: "Мария", role: "Официант", averageServiceTime: 11.2, customersServed: 32, rating: 4.9 },
        4: { name: "Алексей", role: "Официант", averageServiceTime: 15.5, customersServed: 25, rating: 4.2 },
        5: { name: "Елена", role: "Официант", averageServiceTime: 13.0, customersServed: 30, rating: 4.6 },
        6: { name: "Дмитрий", role: "Повар", averageServiceTime: 18.5, dishesCooked: 60, rating: 4.7 },
        7: { name: "Светлана", role: "Повар", averageServiceTime: 17.0, dishesCooked: 55, rating: 4.8 },
        8: { name: "Николай", role: "Повар", averageServiceTime: 20.5, dishesCooked: 45, rating: 4.3 }
      },
      orderCompletionRates: {
        'В ожидании': 15.2,
        'В обработке': 22.8,
        'Готовится': 18.5,
        'Готов к выдаче': 12.0,
        'Завершён': 26.3,
        'Отменен': 5.2
      },
      period: defaultDateRange
    },
    
    predictive: {
      salesForecast: Array.from({ length: 7 }, (_, i) => {
        const date = new Date();
        date.setDate(date.getDate() + i);
        const isWeekend = date.getDay() === 0 || date.getDay() === 6;
        const baseValue = 350000;
        const randomFactor = Math.random() * 50000 - 25000;
        const weekendBonus = isWeekend ? 100000 : 0;
        
        return {
          date: date.toISOString().split('T')[0],
          value: Math.round(baseValue + randomFactor + weekendBonus)
        };
      }),
      
      inventoryForecast: {
        ingredients: [
          { name: 'Мясо', currentStock: 50, recommendedStock: 75, reorderPoint: 30 },
          { name: 'Овощи', currentStock: 80, recommendedStock: 100, reorderPoint: 40 },
          { name: 'Молочные продукты', currentStock: 60, recommendedStock: 80, reorderPoint: 35 }
        ],
        recommendations: [
          'Увеличить запас мяса на 25 кг',
          'Текущий запас овощей оптимален',
          'Заказать молочные продукты в течение 2 дней'
        ]
      },
      
      staffingNeeds: {
        'Понедельник': { 
          '10:00-14:00': { waiters: 3, cooks: 2 },
          '14:00-18:00': { waiters: 4, cooks: 3 },
          '18:00-22:00': { waiters: 5, cooks: 4 }
        },
        'Вторник': {
          '10:00-14:00': { waiters: 3, cooks: 2 },
          '14:00-18:00': { waiters: 4, cooks: 3 },
          '18:00-22:00': { waiters: 5, cooks: 4 }
        },
        'Среда': {
          '10:00-14:00': { waiters: 3, cooks: 2 },
          '14:00-18:00': { waiters: 4, cooks: 3 },
          '18:00-22:00': { waiters: 5, cooks: 4 }
        },
        'Четверг': {
          '10:00-14:00': { waiters: 4, cooks: 3 },
          '14:00-18:00': { waiters: 5, cooks: 4 },
          '18:00-22:00': { waiters: 6, cooks: 5 }
        },
        'Пятница': {
          '10:00-14:00': { waiters: 5, cooks: 4 },
          '14:00-18:00': { waiters: 6, cooks: 5 },
          '18:00-22:00': { waiters: 7, cooks: 6 }
        },
        'Суббота': {
          '10:00-14:00': { waiters: 6, cooks: 5 },
          '14:00-18:00': { waiters: 7, cooks: 6 },
          '18:00-22:00': { waiters: 8, cooks: 7 }
        },
        'Воскресенье': {
          '10:00-14:00': { waiters: 5, cooks: 4 },
          '14:00-18:00': { waiters: 6, cooks: 5 },
          '18:00-22:00': { waiters: 6, cooks: 5 }
        }
      },
      
      peakTimePrediction: {
        weekday: {
          'lunch': { start: '12:00', end: '14:00', expectedGuests: 80 },
          'dinner': { start: '18:00', end: '20:00', expectedGuests: 120 }
        },
        weekend: {
          'lunch': { start: '13:00', end: '15:00', expectedGuests: 100 },
          'dinner': { start: '19:00', end: '21:00', expectedGuests: 150 }
        }
      },
      
      suggestedPromotions: [
        {
          dishId: 5,
          dishName: "Стейк Рибай",
          suggestedDiscount: 15,
          potentialRevenue: 85000,
          reason: "Низкие продажи в будние дни"
        },
        {
          dishId: 12,
          dishName: "Салат Греческий",
          suggestedDiscount: 10,
          potentialRevenue: 42000,
          reason: "Повышение спроса на здоровую пищу"
        },
        {
          dishId: 8,
          dishName: "Суши-сет",
          suggestedDiscount: 20,
          potentialRevenue: 65000,
          reason: "Высокая конкуренция в сегменте"
        }
      ],
      
      period: defaultDateRange
    }
  };
  
  // Пробуем получить данные по типу, иначе возвращаем финансовые данные как запасной вариант
  return mockData[endpoint] || 
         mockData['financial'] || 
         mockData['menu'] || 
         mockData['customers'] || 
         mockData['operational'] || 
         mockData['predictive'] || 
         mockData['dashboard'];
}