import type { NextApiRequest, NextApiResponse } from 'next';
import { query } from '../../../../lib/db';

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
    
    // В случае критической ошибки возвращаем ошибку 500
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Произошла критическая ошибка при обработке запроса операционных данных'
    });
  }
} 