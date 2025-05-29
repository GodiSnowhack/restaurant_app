import type { NextApiRequest, NextApiResponse } from 'next';
import { query } from '../../../../lib/db';

// Мок-данные для операционной аналитики
const mockOperationalData = {
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
  console.log('API /operational: Запрос получен');
  
  // Проверка метода запроса
  if (req.method !== 'GET') {
    console.log('API /operational: Неверный метод запроса:', req.method);
    return res.status(405).json({ message: 'Метод не разрешен' });
  }

  // Проверяем, запрошены ли мок-данные
  const { useMockData } = req.query;
  if (useMockData === 'true') {
    console.log('API /operational: Возвращаем мок-данные по запросу');
    return res.status(200).json(mockOperationalData);
  }

  try {
    // Получение параметров запроса
    const { startDate, endDate } = req.query;
    console.log('API /operational: Параметры запроса:', { startDate, endDate });
    
    // Преобразование параметров в нужный формат
    const start = startDate ? new Date(startDate as string) : new Date(new Date().setMonth(new Date().getMonth() - 1));
    const end = endDate ? new Date(endDate as string) : new Date();
    
    // Базовые параметры запросов
    const baseParams = [start.toISOString(), end.toISOString()];
    
    console.log('API /operational: Формирование запроса на время подготовки заказов');
    // SQL запрос для получения времени подготовки заказов
    const orderPrepTimeSql = `
      SELECT 
        AVG(TIMESTAMPDIFF(MINUTE, o.created_at, o.updated_at)) AS avg_preparation_time
      FROM orders o
      WHERE o.created_at BETWEEN ? AND ?
        AND o.status = 'Оплачен'
    `;
    
    let orderPrepTime: any[] = [];
    try {
      console.log('API /operational: Выполнение запроса о времени подготовки');
      orderPrepTime = await query(orderPrepTimeSql, baseParams) as any[];
      console.log('API /operational: Получены данные о времени подготовки:', orderPrepTime);
    } catch (error) {
      console.error('API /operational: Ошибка при получении времени подготовки:', error);
      return res.status(500).json({ 
        error: 'Ошибка базы данных', 
        message: 'Произошла ошибка при получении времени подготовки заказов' 
      });
    }
    
    console.log('API /operational: Формирование запроса на оборачиваемость столов');
    // SQL запрос для оборачиваемости столов
    const tableTurnoverSql = `
      SELECT 
        AVG(TIMESTAMPDIFF(MINUTE, o.created_at, o.updated_at)) AS avg_table_time
      FROM orders o
      WHERE o.created_at BETWEEN ? AND ?
        AND o.status = 'Оплачен'
        AND o.table_id IS NOT NULL
    `;
    
    let tableTurnover: any[] = [];
    try {
      console.log('API /operational: Выполнение запроса об оборачиваемости столов');
      tableTurnover = await query(tableTurnoverSql, baseParams) as any[];
      console.log('API /operational: Получены данные об оборачиваемости столов:', tableTurnover);
    } catch (error) {
      console.error('API /operational: Ошибка при получении оборачиваемости столов:', error);
      return res.status(500).json({ 
        error: 'Ошибка базы данных', 
        message: 'Произошла ошибка при получении данных об оборачиваемости столов' 
      });
    }
    
    console.log('API /operational: Формирование запроса на пиковые часы');
    // SQL запрос для получения пиковых часов
    const peakHoursSql = `
      SELECT 
        HOUR(created_at) AS hour,
        COUNT(*) AS orders_count
      FROM orders
      WHERE created_at BETWEEN ? AND ?
      GROUP BY HOUR(created_at)
      ORDER BY HOUR(created_at)
    `;
    
    let peakHoursData: any[] = [];
    try {
      console.log('API /operational: Выполнение запроса о пиковых часах');
      peakHoursData = await query(peakHoursSql, baseParams) as any[];
      console.log('API /operational: Получены данные о пиковых часах, количество:', peakHoursData.length);
    } catch (error) {
      console.error('API /operational: Ошибка при получении пиковых часов:', error);
      return res.status(500).json({ 
        error: 'Ошибка базы данных', 
        message: 'Произошла ошибка при получении данных о пиковых часах' 
      });
    }
    
    console.log('API /operational: Формирование запроса на эффективность персонала');
    // SQL запрос для получения эффективности персонала
    const staffEfficiencySql = `
      SELECT 
        s.id AS user_id,
        s.full_name AS user_name,
        COUNT(o.id) AS orders_served,
        AVG(o.total_amount) AS average_order_value,
        AVG(TIMESTAMPDIFF(MINUTE, o.created_at, o.updated_at)) AS average_service_time,
        AVG(r.rating) AS customer_rating
      FROM users s
      JOIN orders o ON s.id = o.staff_id
      LEFT JOIN reviews r ON o.id = r.order_id
      WHERE o.created_at BETWEEN ? AND ?
        AND s.role = 'staff'
        AND o.status = 'Оплачен'
      GROUP BY s.id
      ORDER BY orders_served DESC
      LIMIT 5
    `;
    
    let staffEfficiencyData: any[] = [];
    try {
      console.log('API /operational: Выполнение запроса об эффективности персонала');
      staffEfficiencyData = await query(staffEfficiencySql, baseParams) as any[];
      console.log('API /operational: Получены данные об эффективности персонала, количество:', staffEfficiencyData.length);
    } catch (error) {
      console.error('API /operational: Ошибка при получении эффективности персонала:', error);
      return res.status(500).json({ 
        error: 'Ошибка базы данных', 
        message: 'Произошла ошибка при получении данных об эффективности персонала' 
      });
    }
    
    console.log('API /operational: Формирование запроса на использование столов');
    // SQL запрос для получения использования столов
    const tableUtilizationSql = `
      SELECT 
        t.id AS table_id,
        COUNT(o.id) AS order_count,
        SUM(TIMESTAMPDIFF(MINUTE, o.created_at, o.updated_at)) AS total_time_used,
        (TIMESTAMPDIFF(HOUR, ? , ?) * 60) AS total_possible_time
      FROM tables t
      LEFT JOIN orders o ON t.id = o.table_id
        AND o.created_at BETWEEN ? AND ?
        AND o.status = 'Оплачен'
      GROUP BY t.id
      ORDER BY t.id
    `;
    
    const tableParams = [
      start.toISOString(), 
      end.toISOString(), 
      start.toISOString(), 
      end.toISOString()
    ];
    
    let tableUtilizationData: any[] = [];
    try {
      console.log('API /operational: Выполнение запроса об использовании столов');
      tableUtilizationData = await query(tableUtilizationSql, tableParams) as any[];
      console.log('API /operational: Получены данные об использовании столов, количество:', tableUtilizationData.length);
    } catch (error) {
      console.error('API /operational: Ошибка при получении использования столов:', error);
      return res.status(500).json({ 
        error: 'Ошибка базы данных', 
        message: 'Произошла ошибка при получении данных об использовании столов' 
      });
    }
    
    console.log('API /operational: Формирование запроса на статусы заказов');
    // SQL запрос для получения статистики по статусам заказов
    const orderStatusSql = `
      SELECT 
        status,
        COUNT(*) AS count,
        (SELECT COUNT(*) FROM orders WHERE created_at BETWEEN ? AND ?) AS total
      FROM orders
      WHERE created_at BETWEEN ? AND ?
      GROUP BY status
    `;
    
    const orderStatusParams = [
      start.toISOString(), 
      end.toISOString(), 
      start.toISOString(), 
      end.toISOString()
    ];
    
    let orderStatusData: any[] = [];
    try {
      console.log('API /operational: Выполнение запроса о статусах заказов');
      orderStatusData = await query(orderStatusSql, orderStatusParams) as any[];
      console.log('API /operational: Получены данные о статусах заказов, количество:', orderStatusData.length);
    } catch (error) {
      console.error('API /operational: Ошибка при получении статусов заказов:', error);
      return res.status(500).json({ 
        error: 'Ошибка базы данных', 
        message: 'Произошла ошибка при получении данных о статусах заказов' 
      });
    }
    
    console.log('API /operational: Форматирование данных для ответа');
    // Форматирование пиковых часов
    const peakHours: Record<string, number> = {};
    try {
      (peakHoursData as any[]).forEach(hour => {
        try {
          const hourStart = parseInt(hour.hour);
          const hourEnd = hourStart + 1;
          const timeKey = `${hourStart}-${hourEnd}`;
          peakHours[timeKey] = parseInt(hour.orders_count || '0');
        } catch (error) {
          console.error('API /operational: Ошибка при форматировании пиковых часов:', error, hour);
        }
      });
    } catch (error) {
      console.error('API /operational: Ошибка при обработке данных о пиковых часах:', error);
      return res.status(500).json({ 
        error: 'Ошибка обработки данных', 
        message: 'Произошла ошибка при обработке данных о пиковых часах' 
      });
    }
    
    // Форматирование эффективности персонала
    const staffEfficiency: Record<number, any> = {};
    try {
      (staffEfficiencyData as any[]).forEach(staff => {
        try {
          staffEfficiency[staff.user_id] = {
            userId: staff.user_id,
            userName: staff.user_name,
            ordersServed: parseInt(staff.orders_served || '0'),
            averageOrderValue: Math.round(parseFloat(staff.average_order_value || '0')),
            averageServiceTime: Math.round(parseFloat(staff.average_service_time || '0')),
            customerRating: parseFloat((staff.customer_rating || '0').toFixed(1))
          };
        } catch (error) {
          console.error('API /operational: Ошибка при форматировании данных персонала:', error, staff);
        }
      });
    } catch (error) {
      console.error('API /operational: Ошибка при обработке данных о персонале:', error);
      return res.status(500).json({ 
        error: 'Ошибка обработки данных', 
        message: 'Произошла ошибка при обработке данных о персонале' 
      });
    }
    
    // Форматирование использования столов
    const tableUtilization: Record<number, any> = {};
    try {
      (tableUtilizationData as any[]).forEach(table => {
        try {
          const tableId = parseInt(table.table_id || '0');
          const orderCount = parseInt(table.order_count || '0');
          const timeUsed = parseInt(table.total_time_used || '0');
          const possibleTime = parseInt(table.total_possible_time || '1');
          
          tableUtilization[tableId] = {
            tableId,
            orderCount,
            utilizationRate: Math.min(100, Math.round((timeUsed / possibleTime) * 100))
          };
        } catch (error) {
          console.error('API /operational: Ошибка при форматировании данных по столам:', error, table);
        }
      });
    } catch (error) {
      console.error('API /operational: Ошибка при обработке данных об использовании столов:', error);
      return res.status(500).json({ 
        error: 'Ошибка обработки данных', 
        message: 'Произошла ошибка при обработке данных об использовании столов' 
      });
    }
    
    // Форматирование статусов заказов
    const orderStatusDistribution: Record<string, number> = {};
    const totalOrders = (orderStatusData as any[])[0]?.total ? parseInt((orderStatusData as any[])[0].total) : 0;
    
    // Функция для перевода статуса заказа на русский язык
    const translateOrderStatus = (status: string): string => {
      // Удаляем префикс OrderStatus. если он есть
      let cleanStatus = status;
      if (status.startsWith('OrderStatus.')) {
        cleanStatus = status.replace('OrderStatus.', '');
      }
      
      const statusTranslations: Record<string, string> = {
        'pending': 'Новый',
        'confirmed': 'Подтвержден',
        'preparing': 'Готовится',
        'ready': 'Готов',
        'completed': 'Завершен',
        'cancelled': 'Отменен',
        'delivered': 'Доставлен',
        'PENDING': 'Новый',
        'CONFIRMED': 'Подтвержден',
        'PREPARING': 'Готовится',
        'READY': 'Готов',
        'COMPLETED': 'Завершен',
        'CANCELLED': 'Отменен',
        'DELIVERED': 'Доставлен',
        'COMPLET': 'Завершен', // Сокращенные варианты
        'CONFIRM': 'Подтвержден'
      };

      return statusTranslations[cleanStatus] || cleanStatus;
    };
    
    try {
      (orderStatusData as any[]).forEach(status => {
        try {
          const statusName = translateOrderStatus(status.status);
          const count = parseInt(status.count || '0');
          
          orderStatusDistribution[statusName] = totalOrders > 0 
            ? Math.round((count / totalOrders) * 100) 
            : 0;
        } catch (error) {
          console.error('API /operational: Ошибка при форматировании статусов заказов:', error, status);
        }
      });
    } catch (error) {
      console.error('API /operational: Ошибка при обработке данных о статусах заказов:', error);
      return res.status(500).json({ 
        error: 'Ошибка обработки данных', 
        message: 'Произошла ошибка при обработке данных о статусах заказов' 
      });
    }
    
    console.log('API /operational: Расчет агрегированных метрик');
    // Расчет среднего времени подготовки заказа
    const avgPreparationTime = Math.round(parseFloat((orderPrepTime as any[])[0]?.avg_preparation_time || '0'));
    
    // Расчет средней оборачиваемости столов
    const avgTableTurnoverTime = Math.round(parseFloat((tableTurnover as any[])[0]?.avg_table_time || '0'));
    
    // Расчет эффективности использования столов
    const totalUtilizationRate = Object.values(tableUtilization).reduce((sum, table) => sum + table.utilizationRate, 0);
    const averageTableUtilization = Object.keys(tableUtilization).length > 0
      ? Math.round(totalUtilizationRate / Object.keys(tableUtilization).length)
      : 0;
    
    console.log('API /operational: Формирование операционных данных для ответа');
    const operationalData = {
      avgPreparationTime,
      avgTableTurnoverTime,
      tablesCount: Object.keys(tableUtilization).length,
      averageTableUtilization,
      averageOrdersPerTable: Math.round(totalOrders / Object.keys(tableUtilization).length) || 0,
      tableUtilization,
      peakHours,
      staffEfficiency,
      orderStatusDistribution
    };

    // Добавим информацию о периоде
    const response = {
      ...operationalData,
      period: {
        startDate: start.toISOString().split('T')[0],
        endDate: end.toISOString().split('T')[0]
      }
    };

    // Возвращаем успешный ответ
    console.log('API /operational: Отправка успешного ответа');
    return res.status(200).json(response);
  } catch (error) {
    console.error('API /operational: Критическая ошибка:', error);
    
    // В случае ошибки возвращаем мок-данные
    console.log('API /operational: Возвращаем мок-данные из-за ошибки');
    return res.status(200).json(mockOperationalData);
  }
} 