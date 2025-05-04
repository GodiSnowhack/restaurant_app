import { NextApiRequest, NextApiResponse } from 'next';
import { query as dbQuery, checkConnection } from '../../lib/db';

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
  
  revenueByCategory: `
    SELECT 
      mi.category_id as categoryId,
      SUM(oi.price * oi.quantity) as revenue
    FROM orders o
    JOIN order_items oi ON o.id = oi.order_id
    JOIN menu_items mi ON oi.menu_item_id = mi.id
    WHERE o.status NOT IN ('cancelled', 'rejected')
      AND o.created_at BETWEEN ? AND ?
    GROUP BY mi.category_id
  `,
  
  revenueByTimeOfDay: `
    SELECT 
      CASE 
        WHEN strftime('%H', o.created_at) BETWEEN '09' AND '11' THEN '09-12'
        WHEN strftime('%H', o.created_at) BETWEEN '12' AND '13' THEN '12-14'
        WHEN strftime('%H', o.created_at) BETWEEN '14' AND '15' THEN '14-16'
        WHEN strftime('%H', o.created_at) BETWEEN '16' AND '17' THEN '16-18'
        WHEN strftime('%H', o.created_at) BETWEEN '18' AND '19' THEN '18-20'
        WHEN strftime('%H', o.created_at) BETWEEN '20' AND '22' THEN '20-22'
        ELSE 'other'
      END as timeSlot,
      SUM(oi.price * oi.quantity) as revenue
    FROM orders o
    JOIN order_items oi ON o.id = oi.order_id
    WHERE o.status NOT IN ('cancelled', 'rejected')
      AND o.created_at BETWEEN ? AND ?
    GROUP BY timeSlot
  `,
  
  revenueByDayOfWeek: `
    SELECT 
      CASE strftime('%w', o.created_at)
        WHEN '0' THEN 'Воскресенье'
        WHEN '1' THEN 'Понедельник'
        WHEN '2' THEN 'Вторник'
        WHEN '3' THEN 'Среда'
        WHEN '4' THEN 'Четверг'
        WHEN '5' THEN 'Пятница'
        WHEN '6' THEN 'Суббота'
      END as dayOfWeek,
      SUM(oi.price * oi.quantity) as revenue
    FROM orders o
    JOIN order_items oi ON o.id = oi.order_id
    WHERE o.status NOT IN ('cancelled', 'rejected')
      AND o.created_at BETWEEN ? AND ?
    GROUP BY dayOfWeek
    ORDER BY strftime('%w', o.created_at)
  `,
  
  revenueTrend: `
    SELECT 
      date(o.created_at) as date,
      SUM(oi.price * oi.quantity) as value
    FROM orders o
    JOIN order_items oi ON o.id = oi.order_id
    WHERE o.status NOT IN ('cancelled', 'rejected')
      AND o.created_at BETWEEN ? AND ?
    GROUP BY date(o.created_at)
    ORDER BY date(o.created_at)
  `,
  
  menu: `
    SELECT 
      mi.id as dishId,
      mi.name as dishName,
      COUNT(oi.id) as salesCount,
      SUM(oi.price * oi.quantity) as revenue,
      ROUND(SUM(oi.price * oi.quantity) / (
        SELECT SUM(oi2.price * oi2.quantity) 
        FROM order_items oi2 
        JOIN orders o2 ON oi2.order_id = o2.id 
        WHERE o2.status NOT IN ('cancelled', 'rejected')
          AND o2.created_at BETWEEN ? AND ?
      ) * 100, 1) as percentage
    FROM menu_items mi
    LEFT JOIN order_items oi ON mi.id = oi.menu_item_id
    LEFT JOIN orders o ON oi.order_id = o.id AND o.status NOT IN ('cancelled', 'rejected') AND o.created_at BETWEEN ? AND ?
    GROUP BY mi.id, mi.name
    ORDER BY revenue DESC
    LIMIT 10
  `,
  
  leastSellingDishes: `
    SELECT 
      mi.id as dishId,
      mi.name as dishName,
      COUNT(oi.id) as salesCount,
      COALESCE(SUM(oi.price * oi.quantity), 0) as revenue,
      CASE 
        WHEN (
          SELECT SUM(oi2.price * oi2.quantity) 
          FROM order_items oi2 
          JOIN orders o2 ON oi2.order_id = o2.id 
          WHERE o2.status NOT IN ('cancelled', 'rejected')
            AND o2.created_at BETWEEN ? AND ?
        ) > 0 
        THEN ROUND(COALESCE(SUM(oi.price * oi.quantity), 0) / (
          SELECT SUM(oi2.price * oi2.quantity) 
          FROM order_items oi2 
          JOIN orders o2 ON oi2.order_id = o2.id 
          WHERE o2.status NOT IN ('cancelled', 'rejected')
            AND o2.created_at BETWEEN ? AND ?
        ) * 100, 1)
        ELSE 0
      END as percentage
    FROM menu_items mi
    LEFT JOIN order_items oi ON mi.id = oi.menu_item_id
    LEFT JOIN orders o ON oi.order_id = o.id AND o.status NOT IN ('cancelled', 'rejected') AND o.created_at BETWEEN ? AND ?
    GROUP BY mi.id, mi.name
    HAVING salesCount > 0
    ORDER BY salesCount ASC
    LIMIT 5
  `,
  
  mostProfitableDishes: `
    SELECT 
      mi.id as dishId,
      mi.name as dishName,
      COUNT(oi.id) as salesCount,
      COALESCE(SUM(oi.price * oi.quantity), 0) as revenue,
      COALESCE(SUM(oi.cost_price * oi.quantity), 0) as costPrice,
      COALESCE(SUM((oi.price - oi.cost_price) * oi.quantity), 0) as profit,
      CASE 
        WHEN SUM(oi.price * oi.quantity) > 0 
        THEN ROUND((SUM((oi.price - oi.cost_price) * oi.quantity) / SUM(oi.price * oi.quantity)) * 100, 1) 
        ELSE 0 
      END as profitMargin,
      CASE 
        WHEN (
          SELECT SUM(oi2.price * oi2.quantity) 
          FROM order_items oi2 
          JOIN orders o2 ON oi2.order_id = o2.id 
          WHERE o2.status NOT IN ('cancelled', 'rejected')
            AND o2.created_at BETWEEN ? AND ?
        ) > 0 
        THEN ROUND(COALESCE(SUM(oi.price * oi.quantity), 0) / (
          SELECT SUM(oi2.price * oi2.quantity) 
          FROM order_items oi2 
          JOIN orders o2 ON oi2.order_id = o2.id 
          WHERE o2.status NOT IN ('cancelled', 'rejected')
            AND o2.created_at BETWEEN ? AND ?
        ) * 100, 1)
        ELSE 0
      END as percentage
    FROM menu_items mi
    LEFT JOIN order_items oi ON mi.id = oi.menu_item_id
    LEFT JOIN orders o ON oi.order_id = o.id AND o.status NOT IN ('cancelled', 'rejected') AND o.created_at BETWEEN ? AND ?
    GROUP BY mi.id, mi.name
    HAVING salesCount > 0
    ORDER BY profitMargin DESC
    LIMIT 5
  `,
  
  menuPerformanceByCategory: `
    SELECT 
      mc.id as categoryId,
      mc.name as categoryName,
      COUNT(oi.id) as salesCount,
      COALESCE(SUM(oi.price * oi.quantity), 0) as revenue
    FROM menu_categories mc
    LEFT JOIN menu_items mi ON mc.id = mi.category_id
    LEFT JOIN order_items oi ON mi.id = oi.menu_item_id
    LEFT JOIN orders o ON oi.order_id = o.id AND o.status NOT IN ('cancelled', 'rejected') AND o.created_at BETWEEN ? AND ?
    GROUP BY mc.id, mc.name
    ORDER BY revenue DESC
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

  topCustomers: `
    SELECT 
      u.id as userId,
      u.full_name as fullName,
      u.email,
      SUM(oi.price * oi.quantity) as totalSpent,
      COUNT(DISTINCT o.id) as ordersCount,
      AVG(COALESCE(r.rating, 0)) as averageRating,
      MAX(o.created_at) as lastVisit
    FROM users u
    JOIN orders o ON u.id = o.customer_id
    JOIN order_items oi ON o.id = oi.order_id
    LEFT JOIN reviews r ON u.id = r.user_id
    WHERE o.status NOT IN ('cancelled', 'rejected')
      AND o.created_at BETWEEN ? AND ?
    GROUP BY u.id, u.full_name, u.email
    ORDER BY totalSpent DESC
    LIMIT 5
  `,
  
  operational: `
    SELECT 
      ROUND(AVG(JULIANDAY(o.completed_at) - JULIANDAY(o.created_at)) * 24 * 60, 1) as averageOrderPreparationTime,
      ROUND(AVG(JULIANDAY(o.completed_at) - JULIANDAY(o.created_at)) * 24 * 60, 1) as averageTableTurnoverTime,
      COUNT(DISTINCT o.table_id) as tablesCount,
      COUNT(*) as totalOrders,
      ROUND(COUNT(*) * 1.0 / NULLIF(COUNT(DISTINCT o.table_id), 0), 1) as averageOrdersPerTable
    FROM orders o
    WHERE o.created_at BETWEEN ? AND ?
      AND o.completed_at IS NOT NULL
  `,
  
  orderCompletionRates: `
    SELECT 
      status,
      COUNT(*) as count,
      ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM orders WHERE created_at BETWEEN ? AND ?), 1) as percentage
    FROM orders
    WHERE created_at BETWEEN ? AND ?
    GROUP BY status
  `,
  
  peakHours: `
    SELECT 
      strftime('%H:00', o.created_at) as hour,
      COUNT(*) as orderCount,
      ROUND(COUNT(*) * 100.0 / (
        SELECT MAX(cnt) FROM (
          SELECT COUNT(*) as cnt 
          FROM orders 
          WHERE created_at BETWEEN ? AND ? 
          GROUP BY strftime('%H', created_at)
        )
      ), 1) as percentage
    FROM orders o
    WHERE o.created_at BETWEEN ? AND ?
    GROUP BY strftime('%H', o.created_at)
    ORDER BY orderCount DESC
    LIMIT 6
  `,
  
  staffEfficiency: `
    SELECT 
      u.id as userId,
      u.full_name as userName,
      COUNT(o.id) as ordersServed,
      ROUND(AVG(o_total.total), 0) as averageOrderValue,
      ROUND(AVG(JULIANDAY(o.completed_at) - JULIANDAY(o.created_at)) * 24 * 60, 1) as averageServiceTime,
      ROUND(AVG(COALESCE(r.rating, 0)), 1) as customerRating
    FROM users u
    JOIN orders o ON u.id = o.waiter_id
    JOIN (
      SELECT order_id, SUM(price * quantity) as total
      FROM order_items
      GROUP BY order_id
    ) o_total ON o.id = o_total.order_id
    LEFT JOIN reviews r ON o.id = r.order_id
    WHERE u.role = 'waiter'
      AND o.created_at BETWEEN ? AND ?
      AND o.completed_at IS NOT NULL
    GROUP BY u.id, u.full_name
    ORDER BY ordersServed DESC
    LIMIT 4
  `,
  
  popularDishesByTimeOfDay: `
    SELECT 
      mi.id as dishId,
      mi.name as dishName,
      CASE 
        WHEN strftime('%H', o.created_at) BETWEEN '06' AND '11' THEN 'breakfast'
        WHEN strftime('%H', o.created_at) BETWEEN '12' AND '15' THEN 'lunch'
        WHEN strftime('%H', o.created_at) BETWEEN '16' AND '18' THEN 'afternoon'
        WHEN strftime('%H', o.created_at) BETWEEN '19' AND '23' THEN 'dinner'
        ELSE 'other'
      END as timeOfDay,
      COUNT(oi.id) as salesCount,
      SUM(oi.price * oi.quantity) as revenue
    FROM menu_items mi
    JOIN order_items oi ON mi.id = oi.menu_item_id
    JOIN orders o ON oi.order_id = o.id
    WHERE o.status NOT IN ('cancelled', 'rejected')
      AND o.created_at BETWEEN ? AND ?
    GROUP BY mi.id, mi.name, timeOfDay
    ORDER BY timeOfDay, salesCount DESC
  `
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { method, query: reqQuery } = req;
  
  // Проверяем метод запроса
  if (method !== 'GET') {
    return res.status(405).json({ error: 'Метод не разрешен' });
  }

  // Определяем конечную точку запроса на основе пути
  const { endpoint } = reqQuery;
  let targetEndpoint = endpoint || 'dashboard';

  // Для случая, когда передан массив параметров
  if (Array.isArray(targetEndpoint)) {
    targetEndpoint = targetEndpoint.join('/');
  }

  // Получаем параметры дат из запроса или устанавливаем значения по умолчанию
  const now = new Date();
  const startDate = reqQuery.startDate 
    ? new Date(reqQuery.startDate as string).toISOString()
    : new Date(now.setMonth(now.getMonth() - 1)).toISOString();
  
  const endDate = reqQuery.endDate
    ? new Date(reqQuery.endDate as string).toISOString()
    : new Date().toISOString();

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
    let result;
    
    switch (targetEndpoint) {
      case 'financial':
        try {
          // Получаем основные финансовые метрики
          const financialData = await dbQuery(SQL_QUERIES.financial, [startDate, endDate]) as any[];
          const financial = financialData.length > 0 ? financialData[0] : {
            totalRevenue: 0,
            totalCost: 0,
            grossProfit: 0,
            profitMargin: 0,
            averageOrderValue: 0,
            orderCount: 0
          };

          // Получаем распределение выручки по категориям
          const revenueByCategory = await dbQuery(SQL_QUERIES.revenueByCategory, [startDate, endDate]) as Array<{
            categoryId: number;
            revenue: number;
          }>;
          const categoryRevenue = revenueByCategory.reduce((acc: Record<number, number>, item) => {
            acc[item.categoryId] = item.revenue;
            return acc;
          }, {});

          // Получаем распределение выручки по времени суток
          const revenueByTimeOfDay = await dbQuery(SQL_QUERIES.revenueByTimeOfDay, [startDate, endDate]) as Array<{
            timeSlot: string;
            revenue: number;
          }>;
          const timeOfDayRevenue = revenueByTimeOfDay.reduce((acc: Record<string, number>, item) => {
            acc[item.timeSlot] = item.revenue;
            return acc;
          }, {});

          // Получаем распределение выручки по дням недели
          const revenueByDayOfWeek = await dbQuery(SQL_QUERIES.revenueByDayOfWeek, [startDate, endDate]) as Array<{
            dayOfWeek: string;
            revenue: number;
          }>;
          const dayOfWeekRevenue = revenueByDayOfWeek.reduce((acc: Record<string, number>, item) => {
            acc[item.dayOfWeek] = item.revenue;
            return acc;
          }, {});

          // Получаем тренд выручки за период
          const revenueTrend = await dbQuery(SQL_QUERIES.revenueTrend, [startDate, endDate]) as Array<{
            date: string;
            value: number;
          }>;

          // Получение данных предыдущего периода для сравнения
          const periodDiff = new Date(endDate).getTime() - new Date(startDate).getTime();
          const prevStartDate = new Date(new Date(startDate).getTime() - periodDiff).toISOString();
          const prevEndDate = new Date(startDate).toISOString();

          const previousData = await dbQuery(SQL_QUERIES.financial, [prevStartDate, prevEndDate]) as any[];
          const previous = previousData.length > 0 ? previousData[0] : {
            totalRevenue: 0,
            totalCost: 0,
            grossProfit: 0,
            averageOrderValue: 0,
            orderCount: 0
          };

          // Рассчитываем изменения
          const revenueChange = previous.totalRevenue ? (financial.totalRevenue - previous.totalRevenue) / previous.totalRevenue * 100 : 0;
          const profitChange = previous.grossProfit ? (financial.grossProfit - previous.grossProfit) / previous.grossProfit * 100 : 0;
          const avgOrderChange = previous.averageOrderValue ? (financial.averageOrderValue - previous.averageOrderValue) / previous.averageOrderValue * 100 : 0;
          const orderCountChange = previous.orderCount ? (financial.orderCount - previous.orderCount) / previous.orderCount * 100 : 0;

          // Формируем итоговый результат
          result = {
            totalRevenue: financial.totalRevenue,
            totalCost: financial.totalCost,
            grossProfit: financial.grossProfit,
            profitMargin: financial.profitMargin,
            averageOrderValue: financial.averageOrderValue,
            orderCount: financial.orderCount,
            revenueByCategory: categoryRevenue,
            revenueByTimeOfDay: timeOfDayRevenue,
            revenueByDayOfWeek: dayOfWeekRevenue,
            revenueTrend: revenueTrend,
            revenueChange: Number(revenueChange.toFixed(1)),
            profitChange: Number(profitChange.toFixed(1)),
            averageOrderValueChange: Number(avgOrderChange.toFixed(1)),
            orderCountChange: Number(orderCountChange.toFixed(1)),
            previousRevenue: previous.totalRevenue,
            previousProfit: previous.grossProfit,
            previousAverageOrderValue: previous.averageOrderValue,
            previousOrderCount: previous.orderCount,
            period: { startDate, endDate }
          };
        } catch (error) {
          console.error('[Analytics API] Ошибка при получении финансовых данных:', error);
          result = {
            totalRevenue: 0,
            totalCost: 0,
            grossProfit: 0,
            profitMargin: 0,
            averageOrderValue: 0,
            orderCount: 0,
            revenueByCategory: {},
            revenueByTimeOfDay: {},
            revenueByDayOfWeek: {},
            revenueTrend: [],
            period: { startDate, endDate }
          };
        }
        break;
        
      case 'menu':
        try {
          // Получаем топ продаваемых блюд
          const topDishes = await dbQuery(SQL_QUERIES.menu, [startDate, endDate, startDate, endDate]) as Array<{
            dishId: number;
            dishName: string;
            salesCount: number;
            revenue: number;
            percentage: number;
          }>;

          // Получаем наименее продаваемые блюда
          const leastDishes = await dbQuery(SQL_QUERIES.leastSellingDishes, [
            startDate, endDate, startDate, endDate, startDate, endDate
          ]) as Array<{
            dishId: number;
            dishName: string;
            salesCount: number;
            revenue: number;
            percentage: number;
          }>;

          // Получаем самые прибыльные блюда
          const profitableDishes = await dbQuery(SQL_QUERIES.mostProfitableDishes, [
            startDate, endDate, startDate, endDate, startDate, endDate
          ]) as Array<{
            dishId: number;
            dishName: string;
            salesCount: number;
            revenue: number;
            costPrice: number;
            profit: number;
            profitMargin: number;
            percentage: number;
          }>;

          // Получаем показатели по категориям
          const menuCategories = await dbQuery(SQL_QUERIES.menuPerformanceByCategory, [startDate, endDate]) as Array<{
            categoryId: number;
            categoryName: string;
            salesCount: number;
            revenue: number;
          }>;
          
          const categoriesPerformance = menuCategories.reduce((acc: Record<number, any>, item) => {
            acc[item.categoryId] = {
              categoryName: item.categoryName,
              salesCount: item.salesCount,
              revenue: item.revenue
            };
            return acc;
          }, {});
          
          // Получаем популярные блюда по времени суток
          const timeBasedData = await dbQuery(SQL_QUERIES.popularDishesByTimeOfDay, [startDate, endDate]) as Array<{
            dishId: number;
            dishName: string;
            timeOfDay: string;
            salesCount: number;
            revenue: number;
          }>;
          
          // Преобразуем данные для удобного использования во фронтенде
          const dishPopularityByTime: Record<string, number[]> = {
            'breakfast': [],
            'lunch': [],
            'afternoon': [],
            'dinner': []
          };
          
          // Для каждого времени суток берем до 5 самых популярных блюд
          const timeSlots = ['breakfast', 'lunch', 'afternoon', 'dinner'];
          timeSlots.forEach(slot => {
            const dishesForTimeSlot = timeBasedData
              .filter(item => item.timeOfDay === slot)
              .sort((a, b) => b.salesCount - a.salesCount)
              .slice(0, 5)
              .map(item => item.dishId);
              
            dishPopularityByTime[slot] = dishesForTimeSlot;
          });

          result = {
            topSellingDishes: topDishes,
            leastSellingDishes: leastDishes,
            mostProfitableDishes: profitableDishes,
            menuPerformanceByCategory: categoriesPerformance,
            dishPopularityByTime: dishPopularityByTime,
            period: { startDate, endDate }
          };
        } catch (error) {
          console.error('[Analytics API] Ошибка при получении данных меню:', error);
          result = {
            topSellingDishes: [],
            leastSellingDishes: [],
            mostProfitableDishes: [],
            menuPerformanceByCategory: {},
            dishPopularityByTime: {
              'breakfast': [],
              'lunch': [],
              'afternoon': [],
              'dinner': []
            },
            period: { startDate, endDate }
          };
        }
        break;
        
      case 'customers':
        try {
          // Получаем основные метрики по клиентам
          const customerData = await dbQuery(SQL_QUERIES.customers, [startDate, endDate, startDate, endDate]) as any[];
          const customers = customerData.length > 0 ? customerData[0] : {
            totalCustomers: 0,
            newCustomers: 0,
            returningCustomers: 0,
            returnRate: 0,
            averageVisitsPerCustomer: 0,
            customerSatisfaction: 0
          };

          // Получаем топ клиентов
          const topCustomersData = await dbQuery(SQL_QUERIES.topCustomers, [startDate, endDate]) as Array<{
            userId: number;
            fullName: string;
            email: string;
            totalSpent: number;
            ordersCount: number;
            averageRating: number;
            lastVisit: string;
          }>;

          // Формируем итоговый результат
          result = {
            totalCustomers: customers.totalCustomers,
            newCustomers: customers.newCustomers,
            returningCustomers: customers.returningCustomers,
            customerRetentionRate: customers.returnRate,
            averageVisitsPerCustomer: customers.averageVisitsPerCustomer,
            customerSatisfaction: customers.customerSatisfaction,
            topCustomers: topCustomersData,
            period: { startDate, endDate }
          };
        } catch (error) {
          console.error('[Analytics API] Ошибка при получении данных о клиентах:', error);
          result = {
            totalCustomers: 0,
            newCustomers: 0,
            returningCustomers: 0,
            customerRetentionRate: 0,
            averageVisitsPerCustomer: 0,
            customerSatisfaction: 0,
            topCustomers: [],
            period: { startDate, endDate }
          };
        }
        break;
        
      case 'operational':
        try {
          // Получаем основные операционные метрики
          const operationalData = await dbQuery(SQL_QUERIES.operational, [startDate, endDate]) as any[];
          const operational = operationalData.length > 0 ? operationalData[0] : {
            averageOrderPreparationTime: 0,
            averageTableTurnoverTime: 0,
            tablesCount: 0,
            totalOrders: 0,
            averageOrdersPerTable: 0
          };

          // Получаем статистику по статусам заказов
          const orderStatusData = await dbQuery(SQL_QUERIES.orderCompletionRates, [startDate, endDate, startDate, endDate]) as Array<{
            status: string;
            count: number;
            percentage: number;
          }>;
          
          const orderCompletionRates = orderStatusData.reduce((acc: Record<string, number>, item) => {
            acc[item.status] = item.percentage;
            return acc;
          }, {});

          // Получаем данные о пиковых часах
          const peakHoursData = await dbQuery(SQL_QUERIES.peakHours, [startDate, endDate, startDate, endDate]) as Array<{
            hour: string;
            orderCount: number;
            percentage: number;
          }>;
          
          const peakHours = peakHoursData.reduce((acc: Record<string, number>, item) => {
            acc[item.hour] = item.percentage;
            return acc;
          }, {});

          // Получаем данные об эффективности персонала
          const staffData = await dbQuery(SQL_QUERIES.staffEfficiency, [startDate, endDate]) as Array<{
            userId: number;
            userName: string;
            ordersServed: number;
            averageOrderValue: number;
            averageServiceTime: number;
            customerRating: number;
          }>;
          
          const staffEfficiency = staffData.reduce((acc: Record<string, any>, item) => {
            acc[item.userId] = {
              userId: item.userId,
              userName: item.userName,
              ordersServed: item.ordersServed,
              averageOrderValue: item.averageOrderValue,
              averageServiceTime: item.averageServiceTime,
              customerRating: item.customerRating
            };
            return acc;
          }, {});

          // Формируем итоговый результат
          result = {
            averageOrderPreparationTime: operational.averageOrderPreparationTime,
            averageTableTurnoverTime: operational.averageTableTurnoverTime,
            tablesCount: operational.tablesCount,
            averageOrdersPerTable: operational.averageOrdersPerTable,
            orderCompletionRates,
            peakHours,
            staffEfficiency,
            period: { startDate, endDate }
          };
        } catch (error) {
          console.error('[Analytics API] Ошибка при получении операционных данных:', error);
          result = {
            averageOrderPreparationTime: 0,
            averageTableTurnoverTime: 0,
            tablesCount: 0,
            averageOrdersPerTable: 0,
            orderCompletionRates: {},
            peakHours: {},
            staffEfficiency: {},
            period: { startDate, endDate }
          };
        }
        break;
        
      case 'predictive':
        try {
          // Получаем данные о продажах за последние два месяца
          const twiceTheTimeDiff = 2 * (new Date(endDate).getTime() - new Date(startDate).getTime());
          const extendedStartDate = new Date(new Date(startDate).getTime() - twiceTheTimeDiff).toISOString();
          
          // Получаем тренд продаж для анализа
          const historicalSalesData = await dbQuery(SQL_QUERIES.revenueTrend, [extendedStartDate, endDate]) as Array<{
            date: string;
            value: number;
          }>;
          
          // Простой прогноз на основе скользящего среднего
          // Берем последние 7 дней и прогнозируем следующие 7
          const lastWeekData = historicalSalesData.slice(-7);
          
          if (lastWeekData.length > 0) {
            // Расчет среднего значения
            const sum = lastWeekData.reduce((acc, item) => acc + item.value, 0);
            const avg = sum / lastWeekData.length;
            
            // Расчет тренда (средний процент изменения)
            let trendFactor = 1.0;
            if (lastWeekData.length > 1) {
              const changes = [];
              for (let i = 1; i < lastWeekData.length; i++) {
                if (lastWeekData[i-1].value > 0) {
                  changes.push(lastWeekData[i].value / lastWeekData[i-1].value);
                }
              }
              if (changes.length > 0) {
                const avgChange = changes.reduce((a, b) => a + b, 0) / changes.length;
                trendFactor = avgChange;
              }
            }
            
            // Создаем прогноз на следующие 7 дней
            const lastDate = lastWeekData.length > 0 
              ? new Date(lastWeekData[lastWeekData.length - 1].date) 
              : new Date();
            
            const salesForecast = [];
            let forecastValue = lastWeekData.length > 0 ? lastWeekData[lastWeekData.length - 1].value : avg;
            
            for (let i = 1; i <= 7; i++) {
              const forecastDate = new Date(lastDate);
              forecastDate.setDate(forecastDate.getDate() + i);
              forecastValue *= trendFactor;
              
              salesForecast.push({
                date: forecastDate.toISOString().split('T')[0],
                value: Math.round(forecastValue)
              });
            }
            
            result = {
              salesForecast,
              inventoryForecast: { 1: 45, 2: 35, 3: 28, 4: 65, 5: 40 },
              staffingNeeds: {
                'monday': { '10-14': 3, '14-18': 4, '18-22': 5 },
                'tuesday': { '10-14': 3, '14-18': 4, '18-22': 5 },
                'wednesday': { '10-14': 3, '14-18': 4, '18-22': 5 },
                'thursday': { '10-14': 4, '14-18': 5, '18-22': 6 },
                'friday': { '10-14': 5, '14-18': 6, '18-22': 7 },
                'saturday': { '10-14': 6, '14-18': 7, '18-22': 8 },
                'sunday': { '10-14': 5, '14-18': 6, '18-22': 6 }
              },
              peakTimePrediction: {
                'monday': ['18:00', '19:00', '20:00'],
                'tuesday': ['18:00', '19:00', '20:00'],
                'wednesday': ['18:00', '19:00', '20:00'],
                'thursday': ['18:00', '19:00', '20:00', '21:00'],
                'friday': ['18:00', '19:00', '20:00', '21:00'],
                'saturday': ['13:00', '14:00', '18:00', '19:00', '20:00', '21:00'],
                'sunday': ['13:00', '14:00', '18:00', '19:00', '20:00']
              },
              suggestedPromotions: [
                { dishId: 15, dishName: 'Салат "Греческий"', reason: 'Низкие продажи, высокая маржинальность', suggestedDiscount: 25, potentialRevenue: 8500 },
                { dishId: 16, dishName: 'Бизнес-ланч', reason: 'Увеличение среднего чека', suggestedDiscount: 18, potentialRevenue: 6200 },
                { dishId: 17, dishName: 'Сезонное меню', reason: 'Привлечение новых клиентов', suggestedDiscount: 15, potentialRevenue: 9500 }
              ],
              period: { startDate, endDate }
            };
          } else {
            // Если нет исторических данных, используем моковые данные
            result = {
              salesForecast: [
                { date: '2023-06-01', value: 4100 },
                { date: '2023-06-02', value: 4250 },
                { date: '2023-06-03', value: 4900 },
                { date: '2023-06-04', value: 3800 },
                { date: '2023-06-05', value: 4200 },
                { date: '2023-06-06', value: 4600 },
                { date: '2023-06-07', value: 4750 }
              ],
              inventoryForecast: { 1: 45, 2: 35, 3: 28, 4: 65, 5: 40 },
              staffingNeeds: {
                'monday': { '10-14': 3, '14-18': 4, '18-22': 5 },
                'tuesday': { '10-14': 3, '14-18': 4, '18-22': 5 },
                'wednesday': { '10-14': 3, '14-18': 4, '18-22': 5 },
                'thursday': { '10-14': 4, '14-18': 5, '18-22': 6 },
                'friday': { '10-14': 5, '14-18': 6, '18-22': 7 },
                'saturday': { '10-14': 6, '14-18': 7, '18-22': 8 },
                'sunday': { '10-14': 5, '14-18': 6, '18-22': 6 }
              },
              peakTimePrediction: {
                'monday': ['18:00', '19:00', '20:00'],
                'tuesday': ['18:00', '19:00', '20:00'],
                'wednesday': ['18:00', '19:00', '20:00'],
                'thursday': ['18:00', '19:00', '20:00', '21:00'],
                'friday': ['18:00', '19:00', '20:00', '21:00'],
                'saturday': ['13:00', '14:00', '18:00', '19:00', '20:00', '21:00'],
                'sunday': ['13:00', '14:00', '18:00', '19:00', '20:00']
              },
              suggestedPromotions: [
                { dishId: 15, dishName: 'Салат "Греческий"', reason: 'Низкие продажи, высокая маржинальность', suggestedDiscount: 25, potentialRevenue: 8500 },
                { dishId: 16, dishName: 'Бизнес-ланч', reason: 'Увеличение среднего чека', suggestedDiscount: 18, potentialRevenue: 6200 },
                { dishId: 17, dishName: 'Сезонное меню', reason: 'Привлечение новых клиентов', suggestedDiscount: 15, potentialRevenue: 9500 }
              ],
              period: { startDate, endDate }
            };
          }
        } catch (error) {
          console.error('[Analytics API] Ошибка при получении предиктивных данных:', error);
          // Если произошла ошибка, используем моковые данные
          result = {
            salesForecast: [
              { date: '2023-06-01', value: 4100 },
              { date: '2023-06-02', value: 4250 },
              { date: '2023-06-03', value: 4900 },
              { date: '2023-06-04', value: 3800 },
              { date: '2023-06-05', value: 4200 },
              { date: '2023-06-06', value: 4600 },
              { date: '2023-06-07', value: 4750 }
            ],
            inventoryForecast: { 1: 45, 2: 35, 3: 28, 4: 65, 5: 40 },
            staffingNeeds: {
              'monday': { '10-14': 3, '14-18': 4, '18-22': 5 },
              'tuesday': { '10-14': 3, '14-18': 4, '18-22': 5 },
              'wednesday': { '10-14': 3, '14-18': 4, '18-22': 5 },
              'thursday': { '10-14': 4, '14-18': 5, '18-22': 6 },
              'friday': { '10-14': 5, '14-18': 6, '18-22': 7 },
              'saturday': { '10-14': 6, '14-18': 7, '18-22': 8 },
              'sunday': { '10-14': 5, '14-18': 6, '18-22': 6 }
            },
            peakTimePrediction: {
              'monday': ['18:00', '19:00', '20:00'],
              'tuesday': ['18:00', '19:00', '20:00'],
              'wednesday': ['18:00', '19:00', '20:00'],
              'thursday': ['18:00', '19:00', '20:00', '21:00'],
              'friday': ['18:00', '19:00', '20:00', '21:00'],
              'saturday': ['13:00', '14:00', '18:00', '19:00', '20:00', '21:00'],
              'sunday': ['13:00', '14:00', '18:00', '19:00', '20:00']
            },
            suggestedPromotions: [
              { dishId: 15, dishName: 'Салат "Греческий"', reason: 'Низкие продажи, высокая маржинальность', suggestedDiscount: 25, potentialRevenue: 8500 },
              { dishId: 16, dishName: 'Бизнес-ланч', reason: 'Увеличение среднего чека', suggestedDiscount: 18, potentialRevenue: 6200 },
              { dishId: 17, dishName: 'Сезонное меню', reason: 'Привлечение новых клиентов', suggestedDiscount: 15, potentialRevenue: 9500 }
            ],
            period: { startDate, endDate }
          };
        }
        break;
        
      case 'dashboard':
        try {
          // Получаем базовые финансовые метрики
          const financialData = await dbQuery(SQL_QUERIES.financial, [startDate, endDate]) as any[];
          const financial = financialData.length > 0 ? financialData[0] : { totalRevenue: 0, orderCount: 0 };

          // Получаем данные о клиентах
          const customerData = await dbQuery(SQL_QUERIES.customers, [startDate, endDate, startDate, endDate]) as any[];
          const customers = customerData.length > 0 ? customerData[0] : { totalCustomers: 0 };

          // Получаем операционные данные
          const operationalData = await dbQuery(SQL_QUERIES.operational, [startDate, endDate]) as any[];
          const operational = operationalData.length > 0 ? operationalData[0] : { averageOrderPreparationTime: 0 };

          // Формируем итоговый результат
          result = {
            revenue: financial.totalRevenue,
            orders: financial.orderCount,
            customers: customers.totalCustomers,
            avgPreparationTime: operational.averageOrderPreparationTime,
            period: { startDate, endDate }
          };
        } catch (error) {
          console.error('[Analytics API] Ошибка при получении данных для дашборда:', error);
          result = {
            revenue: 0,
            orders: 0,
            customers: 0,
            avgPreparationTime: 0,
            period: { startDate, endDate }
          };
        }
        break;
        
      default:
        return res.status(400).json({
          error: 'Invalid Endpoint',
          message: `Неизвестный эндпоинт аналитики: ${targetEndpoint}`
        });
    }

    // Отправляем результат
    res.status(200).json(result);
  } catch (error) {
    console.error('[Analytics API] Ошибка при выполнении запроса:', error);
    
    res.status(500).json({
      error: 'Database Error',
      message: 'Произошла ошибка при получении данных аналитики',
      details: error instanceof Error ? error.message : 'Неизвестная ошибка'
    });
  }
} 