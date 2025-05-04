import type { NextApiRequest, NextApiResponse } from 'next';
import { query } from '../../../../lib/db';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  console.log('API /customers: Запрос получен');
  
  // Проверка метода запроса
  if (req.method !== 'GET') {
    console.log('API /customers: Неверный метод запроса:', req.method);
    return res.status(405).json({ message: 'Метод не разрешен' });
  }

  try {
    // Получение параметров запроса
    const { startDate, endDate, userId } = req.query;
    console.log('API /customers: Параметры запроса:', { startDate, endDate, userId });
    
    // Преобразование параметров в нужный формат
    const start = startDate ? new Date(startDate as string) : new Date(new Date().setMonth(new Date().getMonth() - 1));
    const end = endDate ? new Date(endDate as string) : new Date();
    
    // Базовые параметры запросов
    const baseParams = [start.toISOString(), end.toISOString()];
    
    console.log('API /customers: Формирование SQL запроса для общей статистики');
    // SQL запрос для получения общей статистики по клиентам
    const customerStatsSql = `
      SELECT
        COUNT(DISTINCT u.id) AS total_customers,
        SUM(CASE WHEN u.created_at BETWEEN ? AND ? THEN 1 ELSE 0 END) AS new_customers,
        AVG(r.service_rating) AS avg_rating
      FROM users u
      LEFT JOIN orders o ON u.id = o.user_id
      LEFT JOIN reviews r ON o.id = r.order_id
      WHERE u.role = 'customer'
    `;
    
    let customerStats = [];
    try {
      console.log('API /customers: Выполнение запроса к базе данных (статистика клиентов)');
      customerStats = await query(customerStatsSql, baseParams) as any[];
      console.log('API /customers: Получены данные о статистике клиентов:', customerStats);
    } catch (error) {
      console.error('API /customers: Ошибка при получении статистики клиентов:', error);
      return res.status(500).json({ 
        error: 'Ошибка базы данных', 
        message: 'Произошла ошибка при получении статистики клиентов'
      });
    }
    
    console.log('API /customers: Формирование SQL запроса для данных о заказах клиентов');
    // SQL запрос для получения статистики заказов по клиентам
    const customerOrdersSql = `
      SELECT
        u.id,
        u.full_name,
        u.email,
        u.created_at,
        COUNT(o.id) AS orders_count,
        SUM(o.total_amount) AS total_spent,
        MAX(o.created_at) AS last_visit
      FROM users u
      LEFT JOIN orders o ON u.id = o.user_id AND o.created_at BETWEEN ? AND ? AND o.status = 'Оплачен'
      WHERE u.role = 'customer'
      GROUP BY u.id
      ORDER BY total_spent DESC
    `;
    
    let customersData = [];
    try {
      console.log('API /customers: Выполнение запроса к базе данных (данные о заказах клиентов)');
      customersData = await query(customerOrdersSql, baseParams) as any[];
      console.log('API /customers: Получены данные о заказах клиентов, количество:', customersData.length);
    } catch (error) {
      console.error('API /customers: Ошибка при получении данных о заказах клиентов:', error);
      return res.status(500).json({ 
        error: 'Ошибка базы данных', 
        message: 'Произошла ошибка при получении данных о заказах клиентов'
      });
    }
    
    console.log('API /customers: Формирование SQL запроса для рейтингов клиентов');
    // SQL запрос для получения средних оценок клиентов
    const customerRatingsSql = `
      SELECT
        o.user_id,
        AVG(r.service_rating) AS avg_rating
      FROM reviews r
      JOIN orders o ON r.order_id = o.id
      WHERE o.created_at BETWEEN ? AND ?
      GROUP BY o.user_id
    `;
    
    let customerRatings = [];
    try {
      console.log('API /customers: Выполнение запроса к базе данных (рейтинги клиентов)');
      customerRatings = await query(customerRatingsSql, baseParams) as any[];
      console.log('API /customers: Получены данные о рейтингах клиентов, количество:', customerRatings.length);
    } catch (error) {
      console.error('API /customers: Ошибка при получении рейтингов клиентов:', error);
      return res.status(500).json({ 
        error: 'Ошибка базы данных', 
        message: 'Произошла ошибка при получении рейтингов клиентов'
      });
    }
    
    console.log('API /customers: Обработка полученных данных');
    // Преобразуем рейтинги в Map для быстрого доступа
    const ratingsMap = new Map();
    try {
      (customerRatings as any[]).forEach(item => {
        ratingsMap.set(item.user_id, parseFloat(item.avg_rating));
      });
    } catch (error) {
      console.error('API /customers: Ошибка при обработке рейтингов:', error);
      return res.status(500).json({ 
        error: 'Ошибка обработки данных', 
        message: 'Произошла ошибка при обработке рейтингов клиентов'
      });
    }
    
    // Расчет метрик на основе полученных данных
    let totalCustomers = 0;
    let newCustomers = 0;
    let customerSatisfaction = 0;
    
    try {
      totalCustomers = parseInt((customerStats as any[])[0]?.total_customers || '0');
      newCustomers = parseInt((customerStats as any[])[0]?.new_customers || '0');
      customerSatisfaction = parseFloat(((customerStats as any[])[0]?.avg_rating || '0').toFixed(1));
    } catch (error) {
      console.error('API /customers: Ошибка при расчете базовых метрик:', error);
      return res.status(500).json({ 
        error: 'Ошибка обработки данных', 
        message: 'Произошла ошибка при расчете базовых метрик'
      });
    }
    
    const returningCustomers = Math.max(0, totalCustomers - newCustomers);
    const customerRetentionRate = totalCustomers > 0 ? Math.round((returningCustomers / totalCustomers) * 100) : 0;
    
    // Определение сегментов клиентов
    let totalOrdersCount = 0;
    let customersWithOrders = 0;
    
    // Подсчет клиентов по сегментам
    const segments: Record<string, number> = {
      'Новые': 0,
      'Случайные': 0,
      'Регулярные': 0,
      'Лояльные': 0
    };
    
    try {
      (customersData as any[]).forEach(customer => {
        try {
          const ordersCount = parseInt(customer.orders_count || '0');
          totalOrdersCount += ordersCount;
          
          if (ordersCount === 0) {
            segments['Новые']++;
          } else {
            customersWithOrders++;
            
            if (ordersCount === 1) {
              segments['Случайные']++;
            } else if (ordersCount >= 2 && ordersCount <= 5) {
              segments['Регулярные']++;
            } else {
              segments['Лояльные']++;
            }
          }
        } catch (error) {
          console.error('API /customers: Ошибка при обработке данных клиента:', error, customer);
        }
      });
    } catch (error) {
      console.error('API /customers: Ошибка при сегментации клиентов:', error);
      return res.status(500).json({ 
        error: 'Ошибка обработки данных', 
        message: 'Произошла ошибка при сегментации клиентов'
      });
    }
    
    // Расчет процентного соотношения сегментов
    const customerSegmentation: Record<string, number> = {};
    Object.keys(segments).forEach(key => {
      customerSegmentation[key] = totalCustomers > 0 ? Math.round((segments[key] / totalCustomers) * 100) : 0;
    });
    
    // Расчет среднего количества визитов на клиента
    const averageVisitsPerCustomer = customersWithOrders > 0 
      ? parseFloat((totalOrdersCount / customersWithOrders).toFixed(1)) 
      : 0;
    
    console.log('API /customers: Формирование списка ТОП клиентов');
    // Формирование списка ТОП клиентов
    const topCustomers = [];
    try {
      topCustomers.push(...(customersData as any[])
        .filter(c => parseInt(c.orders_count || '0') > 0)
        .slice(0, 5)
        .map(customer => ({
          userId: customer.id,
          fullName: customer.full_name,
          email: customer.email,
          totalSpent: Math.round(parseFloat(customer.total_spent || '0')),
          ordersCount: parseInt(customer.orders_count || '0'),
          averageRating: ratingsMap.get(customer.id) || 0,
          lastVisit: customer.last_visit ? new Date(customer.last_visit).toISOString().split('T')[0] : null
        })));
    } catch (error) {
      console.error('API /customers: Ошибка при формировании списка ТОП клиентов:', error);
      return res.status(500).json({ 
        error: 'Ошибка обработки данных', 
        message: 'Произошла ошибка при формировании списка ТОП клиентов'
      });
    }
    
    console.log('API /customers: Формирование итогового ответа');
    const customersMetrics = {
      totalCustomers,
      newCustomers,
      returningCustomers,
      customerRetentionRate,
      averageVisitsPerCustomer,
      customerSegmentation,
      topCustomers,
      customerSatisfaction
    };

    // Добавим информацию о периоде
    const response = {
      ...customersMetrics,
      period: {
        startDate: start.toISOString().split('T')[0],
        endDate: end.toISOString().split('T')[0]
      }
    };

    // Возвращаем успешный ответ
    console.log('API /customers: Отправка успешного ответа');
    return res.status(200).json(response);
  } catch (error) {
    console.error('API /customers: Критическая ошибка:', error);
    
    // В случае критической ошибки возвращаем ошибку 500
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Произошла критическая ошибка при обработке запроса данных о клиентах'
    });
  }
} 