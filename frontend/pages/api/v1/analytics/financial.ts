import type { NextApiRequest, NextApiResponse } from 'next';
import { query } from '../../../../lib/db';

// Мок-данные для случая, когда запрос к БД не удался
const mockFinancialData = {
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
  revenueByTimeOfDay: {
    '12-14': 280000,
    '14-16': 220000,
    '16-18': 180000,
    '18-20': 320000,
    '20-22': 250000
  },
  revenueByDayOfWeek: {
    'Понедельник': 150000,
    'Вторник': 160000,
    'Среда': 170000,
    'Четверг': 190000,
    'Пятница': 220000,
    'Суббота': 190000,
    'Воскресенье': 170000
  },
  revenueTrend: Array.from({ length: 30 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - 30 + i);
    return {
      date: date.toISOString().split('T')[0],
      value: Math.round(30000 + Math.random() * 20000)
    };
  }),
  period: {
    startDate: (() => {
      const date = new Date();
      date.setMonth(date.getMonth() - 1);
      return date.toISOString().split('T')[0];
    })(),
    endDate: new Date().toISOString().split('T')[0]
  }
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  console.log('API /financial: Запрос получен');
  
  // Проверка метода запроса
  if (req.method !== 'GET') {
    console.log('API /financial: Неверный метод запроса:', req.method);
    return res.status(405).json({ message: 'Метод не разрешен' });
  }

  // Проверяем, запрошены ли мок-данные
  const { useMockData } = req.query;
  if (useMockData === 'true') {
    console.log('API /financial: Возвращаем мок-данные по запросу');
    return res.status(200).json(mockFinancialData);
  }

  try {
    // Получение параметров запроса
    const { startDate, endDate, categoryId } = req.query;
    console.log('API /financial: Параметры запроса:', { startDate, endDate, categoryId });
    
    // Преобразование параметров в нужный формат
    const start = startDate ? new Date(startDate as string) : new Date(new Date().setMonth(new Date().getMonth() - 1));
    const end = endDate ? new Date(endDate as string) : new Date();
    
    console.log('API /financial: Формирование SQL запроса');
    // SQL запрос для получения данных о заказах
    const ordersSql = `
      SELECT o.id, o.created_at, o.total_amount, o.status,
             oi.price, oi.quantity, 
             d.cost_price, d.id as dish_id, d.name as dish_name,
             c.id as category_id, c.name as category_name
      FROM orders o
      JOIN order_items oi ON o.id = oi.order_id
      JOIN dishes d ON oi.dish_id = d.id
      JOIN categories c ON d.category_id = c.id
      WHERE o.created_at BETWEEN ? AND ?
        AND o.status = 'Оплачен'
        ${categoryId ? 'AND c.id = ?' : ''}
      ORDER BY o.created_at
    `;
    
    const orderParams = [
      start.toISOString(), 
      end.toISOString(),
      ...(categoryId ? [parseInt(categoryId as string)] : [])
    ];
    
    // Выполнение запроса
    console.log('API /financial: Выполнение запроса к базе данных');
    let ordersData: any[] = [];
    try {
      ordersData = await query(ordersSql, orderParams) as any[];
      console.log('API /financial: Получены данные о заказах, количество:', ordersData.length);
    } catch (error) {
      console.error('API /financial: Ошибка при получении данных о заказах:', error);
      return res.status(500).json({ 
        error: 'Ошибка базы данных', 
        message: 'Произошла ошибка при получении данных о заказах' 
      });
    }
    
    console.log('API /financial: Расчет финансовых метрик');
    // Расчет финансовых метрик
    let totalRevenue = 0;
    let totalCost = 0;
    const revenueByCategory: Record<number, number> = {};
    const revenueByTimeOfDay: Record<string, number> = {
      '12-14': 0,
      '14-16': 0,
      '16-18': 0,
      '18-20': 0,
      '20-22': 0
    };
    const revenueByDayOfWeek: Record<string, number> = {
      'Понедельник': 0,
      'Вторник': 0,
      'Среда': 0,
      'Четверг': 0,
      'Пятница': 0,
      'Суббота': 0,
      'Воскресенье': 0
    };
    const dayNames = ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'];
    
    // Сбор данных для временного ряда
    const revenueTrendMap = new Map<string, number>();
    const dayRange = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    
    // Инициализация данных по дням
    console.log('API /financial: Инициализация данных по дням');
    for (let i = 0; i < dayRange; i++) {
      const date = new Date(start);
      date.setDate(date.getDate() + i);
      const dateStr = date.toISOString().split('T')[0];
      revenueTrendMap.set(dateStr, 0);
    }
    
    // Создаем Map для группировки заказов по ID
    const orderMap = new Map<number, {
      id: number,
      createdAt: Date,
      totalAmount: number,
      items: Array<{
        price: number,
        quantity: number,
        costPrice: number,
        categoryId: number
      }>
    }>();
    
    console.log('API /financial: Группировка данных по заказам');
    // Группируем данные по заказам
    try {
      ordersData.forEach((row: any) => {
        try {
          const orderId = row.id;
          const createdAt = new Date(row.created_at);
          const itemData = {
            price: parseFloat(row.price || '0'),
            quantity: parseInt(row.quantity || '0'),
            costPrice: parseFloat(row.cost_price || '0'),
            categoryId: parseInt(row.category_id || '0')
          };
          
          if (!orderMap.has(orderId)) {
            orderMap.set(orderId, {
              id: orderId,
              createdAt,
              totalAmount: parseFloat(row.total_amount || '0'),
              items: [itemData]
            });
          } else {
            const order = orderMap.get(orderId);
            if (order) {
              order.items.push(itemData);
            }
          }
        } catch (error) {
          console.error('API /financial: Ошибка при обработке заказа:', error, row);
        }
      });
    } catch (error) {
      console.error('API /financial: Ошибка при группировке заказов:', error);
      return res.status(500).json({ 
        error: 'Ошибка обработки данных', 
        message: 'Произошла ошибка при обработке данных о заказах' 
      });
    }
    
    console.log('API /financial: Расчет метрик на основе заказов');
    // Расчет метрик на основе заказов
    try {
      orderMap.forEach(order => {
        try {
          const orderTotal = order.totalAmount;
          totalRevenue += orderTotal;
          
          // Добавление данных к временному ряду
          const orderDate = order.createdAt.toISOString().split('T')[0];
          if (revenueTrendMap.has(orderDate)) {
            revenueTrendMap.set(orderDate, (revenueTrendMap.get(orderDate) || 0) + orderTotal);
          }
          
          // Расчет по времени суток
          const hour = order.createdAt.getHours();
          if (hour >= 12 && hour < 14) revenueByTimeOfDay['12-14'] += orderTotal;
          else if (hour >= 14 && hour < 16) revenueByTimeOfDay['14-16'] += orderTotal;
          else if (hour >= 16 && hour < 18) revenueByTimeOfDay['16-18'] += orderTotal;
          else if (hour >= 18 && hour < 20) revenueByTimeOfDay['18-20'] += orderTotal;
          else if (hour >= 20 && hour < 22) revenueByTimeOfDay['20-22'] += orderTotal;
          
          // Расчет по дням недели
          const dayIndex = order.createdAt.getDay();
          const dayOfWeek = dayNames[dayIndex];
          revenueByDayOfWeek[dayOfWeek] += orderTotal;
          
          // Расчет затрат и выручки по категориям
          order.items.forEach(item => {
            try {
              const categoryId = item.categoryId;
              const itemRevenue = item.price * item.quantity;
              const itemCost = item.costPrice * item.quantity;
              
              totalCost += itemCost;
              
              if (!revenueByCategory[categoryId]) {
                revenueByCategory[categoryId] = 0;
              }
              revenueByCategory[categoryId] += itemRevenue;
            } catch (error) {
              console.error('API /financial: Ошибка при обработке позиции заказа:', error, item);
            }
          });
        } catch (error) {
          console.error('API /financial: Ошибка при обработке данных заказа:', error, order);
        }
      });
    } catch (error) {
      console.error('API /financial: Ошибка при расчете метрик:', error);
      return res.status(500).json({ 
        error: 'Ошибка расчета метрик', 
        message: 'Произошла ошибка при расчете финансовых метрик' 
      });
    }
    
    console.log('API /financial: Преобразование временного ряда в массив');
    // Преобразование временного ряда в массив
    const revenueTrend = Array.from(revenueTrendMap.entries()).map(([date, value]) => ({
      date,
      value: Math.round(value) // Округляем для более читаемых данных
    }));
    
    // Вычисление среднего чека
    const averageOrderValue = orderMap.size > 0 ? Math.round(totalRevenue / orderMap.size) : 0;
    
    // Вычисление валовой прибыли и маржи
    const grossProfit = totalRevenue - totalCost;
    const profitMargin = totalRevenue > 0 ? Math.round((grossProfit / totalRevenue) * 100) : 0;
    
    console.log('API /financial: Формирование финансовых данных для ответа');
    const financialData = {
      totalRevenue: Math.round(totalRevenue),
      totalCost: Math.round(totalCost),
      grossProfit: Math.round(grossProfit),
      profitMargin,
      averageOrderValue,
      revenueByCategory,
      revenueByTimeOfDay,
      revenueByDayOfWeek,
      revenueTrend
    };

    // Добавим информацию о периоде
    const response = {
      ...financialData,
      period: {
        startDate: start.toISOString().split('T')[0],
        endDate: end.toISOString().split('T')[0]
      }
    };

    // Возвращаем успешный ответ
    console.log('API /financial: Отправка успешного ответа');
    return res.status(200).json(response);
  } catch (error) {
    console.error('API /financial: Критическая ошибка:', error);
    
    // В случае критической ошибки возвращаем мок-данные
    console.log('API /financial: Возвращаем мок-данные из-за ошибки');
    return res.status(200).json(mockFinancialData);
  }
} 