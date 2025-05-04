import type { NextApiRequest, NextApiResponse } from 'next';
import { query } from '../../../../lib/db';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Проверка метода запроса
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Метод не разрешен' });
  }

  try {
    // Получение параметров запроса
    const { startDate, endDate } = req.query;
    
    // Преобразование параметров в нужный формат
    const start = startDate ? new Date(startDate as string) : new Date(new Date().setMonth(new Date().getMonth() - 1));
    const end = endDate ? new Date(endDate as string) : new Date();
    
    // Базовые параметры запросов
    const baseParams = [start.toISOString(), end.toISOString()];
    
    // SQL запрос для получения прогноза продаж на основе исторических данных
    const salesHistorySql = `
      SELECT 
        DATE(created_at) AS date,
        SUM(total_amount) AS total_sales
      FROM orders
      WHERE created_at BETWEEN DATE_SUB(?, INTERVAL 60 DAY) AND ?
        AND status = 'Оплачен'
      GROUP BY DATE(created_at)
      ORDER BY date
    `;
    
    // Получаем исторические данные за 60 дней до начала выбранного периода
    const historicalStart = new Date(start);
    historicalStart.setDate(historicalStart.getDate() - 60);
    
    const salesHistory = await query(salesHistorySql, [historicalStart.toISOString(), end.toISOString()]);
    
    // SQL запрос для получения средних продаж по дням недели
    const weekdaySalesSql = `
      SELECT 
        DAYOFWEEK(created_at) AS day_of_week,
        AVG(total_amount) AS avg_sales
      FROM orders
      WHERE created_at BETWEEN DATE_SUB(?, INTERVAL 60 DAY) AND ?
        AND status = 'Оплачен'
      GROUP BY DAYOFWEEK(created_at)
      ORDER BY day_of_week
    `;
    
    const weekdaySales = await query(weekdaySalesSql, [historicalStart.toISOString(), end.toISOString()]);
    
    // SQL запрос для получения средних продаж по часам
    const hourlySalesSql = `
      SELECT 
        HOUR(created_at) AS hour,
        AVG(total_amount) AS avg_sales,
        COUNT(*) AS order_count
      FROM orders
      WHERE created_at BETWEEN DATE_SUB(?, INTERVAL 60 DAY) AND ?
        AND status = 'Оплачен'
      GROUP BY HOUR(created_at)
      ORDER BY hour
    `;
    
    const hourlySales = await query(hourlySalesSql, [historicalStart.toISOString(), end.toISOString()]);
    
    // SQL запрос для получения данных о расходе ингредиентов
    const ingredientUsageSql = `
      SELECT 
        i.id,
        i.name,
        SUM(oi.quantity * di.amount) AS total_used
      FROM order_items oi
      JOIN orders o ON oi.order_id = o.id
      JOIN dish_ingredients di ON oi.dish_id = di.dish_id
      JOIN ingredients i ON di.ingredient_id = i.id
      WHERE o.created_at BETWEEN ? AND ?
        AND o.status = 'Оплачен'
      GROUP BY i.id
      ORDER BY total_used DESC
    `;
    
    const ingredientUsage = await query(ingredientUsageSql, baseParams);
    
    // Создание прогноза продаж на следующие 30 дней
    // Используем исторические данные и средние продажи по дням недели
    const salesForecast = [];
    const today = new Date();
    
    // Создаем карту средних продаж по дням недели для быстрого доступа
    const dayOfWeekSales = new Map();
    (weekdaySales as any[]).forEach(day => {
      dayOfWeekSales.set(parseInt(day.day_of_week), parseFloat(day.avg_sales));
    });
    
    // Создаем прогноз на следующие 30 дней
    for (let i = 0; i < 30; i++) {
      const forecastDate = new Date(today);
      forecastDate.setDate(forecastDate.getDate() + i);
      
      // Получаем день недели (1 = Воскресенье, 7 = Суббота в MySQL)
      const dayOfWeek = forecastDate.getDay() + 1;
      
      // Получаем среднее значение продаж для этого дня недели
      let value = dayOfWeekSales.get(dayOfWeek) || 0;
      
      // Добавляем случайное отклонение в пределах 15%
      const variance = (Math.random() * 0.3) - 0.15;
      value = Math.round(value * (1 + variance));
      
      salesForecast.push({
        date: forecastDate.toISOString().split('T')[0],
        value: Math.max(0, value)
      });
    }
    
    // Создание прогноза запасов ингредиентов
    const inventoryForecast: Record<number, number> = {};
    
    // На основе исторических данных о расходе ингредиентов
    // рассчитываем прогнозируемую потребность на следующие 7 дней
    (ingredientUsage as any[]).forEach(ingredient => {
      const id = ingredient.id;
      const avgDailyUsage = parseFloat(ingredient.total_used) / 30; // Среднедневной расход
      
      // Прогнозируем на 7 дней вперед
      inventoryForecast[id] = Math.round(avgDailyUsage * 7);
    });
    
    // Генерация прогноза необходимого количества персонала
    // На основе данных о пиковых часах и объемах заказов
    const staffingNeeds: Record<string, Record<string, number>> = {};
    
    // Названия дней недели
    const dayNames = ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'];
    
    // Формируем прогноз по дням недели
    for (let day = 0; day < 7; day++) {
      const dayName = dayNames[day];
      staffingNeeds[dayName] = {};
      
      // Формируем временные слоты с шагом 2 часа
      for (let hour = 10; hour < 22; hour += 2) {
        const timeSlot = `${hour}-${hour + 2}`;
        
        // Находим среднее количество заказов в этот час для данного дня недели
        const hourlyData = (hourlySales as any[]).find(h => parseInt(h.hour) === hour);
        const baseStaff = hourlyData ? Math.ceil(parseInt(hourlyData.order_count) / 5) : 1;
        
        // Корректируем в зависимости от дня недели (выходные требуют больше персонала)
        let staffNeeded = baseStaff;
        if (day === 5 || day === 6) { // Пятница и суббота
          staffNeeded = Math.ceil(baseStaff * 1.5);
        } else if (day === 0) { // Воскресенье
          staffNeeded = Math.ceil(baseStaff * 1.3);
        }
        
        // Корректируем по времени суток (пиковые часы)
        if (hour >= 12 && hour <= 14) staffNeeded = Math.ceil(staffNeeded * 1.2); // Обеденное время
        if (hour >= 18 && hour <= 20) staffNeeded = Math.ceil(staffNeeded * 1.3); // Вечернее время
        
        // Всегда нужен минимум 2 сотрудника
        staffNeeded = Math.max(2, staffNeeded);
        
        staffingNeeds[dayName][timeSlot] = staffNeeded;
      }
    }
    
    // Определение пиковых часов для каждого дня недели
    const peakTimePrediction: Record<string, string[]> = {};
    
    dayNames.forEach(dayName => {
      const timeSlots = Object.entries(staffingNeeds[dayName]);
      // Сортируем временные слоты по количеству требуемого персонала (убывание)
      const sortedSlots = timeSlots.sort((a, b) => b[1] - a[1]);
      
      // Берем топ-2 слота как пиковые
      const peakSlots = sortedSlots.slice(0, 2).map(([slot]) => {
        const [start, end] = slot.split('-');
        return `${start}:00-${end}:00`;
      });
      
      peakTimePrediction[dayName] = peakSlots;
    });
    
    // SQL запрос для получения наименее продаваемых блюд с хорошей маржой
    const suggestedPromotionsSql = `
      SELECT 
        d.id AS dish_id,
        d.name AS dish_name,
        d.price,
        d.cost_price,
        COUNT(oi.id) AS order_count
      FROM dishes d
      LEFT JOIN order_items oi ON d.id = oi.dish_id
      LEFT JOIN orders o ON oi.order_id = o.id AND o.created_at BETWEEN ? AND ? AND o.status = 'Оплачен'
      GROUP BY d.id
      HAVING order_count < 20
      ORDER BY (d.price - d.cost_price) / d.cost_price DESC, order_count
      LIMIT 5
    `;
    
    const promotionDishes = await query(suggestedPromotionsSql, baseParams);
    
    // Формируем предложения по акциям
    const suggestedPromotions = (promotionDishes as any[]).map(dish => {
      const dishId = dish.dish_id;
      const dishName = dish.dish_name;
      const price = parseFloat(dish.price);
      const costPrice = parseFloat(dish.cost_price);
      const orderCount = parseInt(dish.order_count);
      
      // Расчет скидки (больше скидка для менее продаваемых товаров)
      const suggestedDiscount = Math.round(15 - orderCount * 0.5);
      
      // Расчет потенциальной выручки (предположение, что продажи вырастут на 100% при скидке)
      const potentialRevenue = Math.round(price * 0.9 * orderCount * 2);
      
      // Определяем причину для акции
      let reason = 'Низкие продажи';
      const margin = (price - costPrice) / price * 100;
      
      if (margin > 60) {
        reason = 'Низкие продажи, высокая маржа';
      } else if (orderCount < 5) {
        reason = 'Очень низкие продажи, нужно внимание';
      }
      
      return {
        dishId,
        dishName,
        reason,
        suggestedDiscount: Math.min(30, Math.max(5, suggestedDiscount)),
        potentialRevenue
      };
    });
    
    // Формирование итогового ответа
    const predictiveData = {
      salesForecast,
      inventoryForecast,
      staffingNeeds,
      peakTimePrediction,
      suggestedPromotions
    };

    // Добавим информацию о периоде
    const response = {
      ...predictiveData,
      period: {
        startDate: start.toISOString().split('T')[0],
        endDate: end.toISOString().split('T')[0]
      }
    };

    // Возвращаем успешный ответ
    return res.status(200).json(response);
  } catch (error) {
    console.error('Ошибка получения предиктивных данных:', error);
    return res.status(500).json({ message: 'Внутренняя ошибка сервера' });
  }
} 