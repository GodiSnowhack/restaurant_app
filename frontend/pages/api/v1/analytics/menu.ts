import type { NextApiRequest, NextApiResponse } from 'next';
import { query } from '../../../../lib/db';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  console.log('API /menu: Запрос получен');
  
  // Проверка метода запроса
  if (req.method !== 'GET') {
    console.log('API /menu: Неверный метод запроса:', req.method);
    return res.status(405).json({ message: 'Метод не разрешен' });
  }

  try {
    // Получаем параметры запроса
    const { startDate, endDate } = req.query;
    
    // Проверяем наличие дат
    if (!startDate || !endDate) {
      console.log('API /menu: Отсутствуют параметры дат');
      return res.status(400).json({ message: 'Необходимо указать startDate и endDate' });
    }

    // Преобразуем даты в объекты Date
    const start = new Date(startDate as string);
    const end = new Date(endDate as string);

    // Проверяем валидность дат
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      console.log('API /menu: Некорректный формат дат');
      return res.status(400).json({ message: 'Некорректный формат дат' });
    }

    // SQL запрос для получения данных о продажах блюд
    const orderItemsSql = `
      SELECT 
        d.id AS dish_id,
        d.name AS dish_name,
        d.category_id,
        c.name AS category_name,
        d.cost_price,
        SUM(oi.quantity) AS sales_count,
        SUM(oi.price * oi.quantity) AS revenue
      FROM order_items oi
      JOIN orders o ON oi.order_id = o.id
      JOIN dishes d ON oi.dish_id = d.id
      LEFT JOIN categories c ON d.category_id = c.id
      WHERE o.created_at BETWEEN ? AND ?
        AND o.status = 'Оплачен'
      GROUP BY d.id, d.name, d.category_id, c.name, d.cost_price
      ORDER BY sales_count DESC
    `;

    const params = [start.toISOString(), end.toISOString()];
    
    console.log('API /menu: Выполнение запроса к базе данных (получение данных блюд)');
    // Выполнение запроса
    let dishesData;
    try {
      dishesData = await query(orderItemsSql, params);
      console.log('API /menu: Получены данные блюд, количество:', Array.isArray(dishesData) ? dishesData.length : 'не массив');
    } catch (error) {
      console.error('API /menu: Ошибка при получении данных блюд:', error);
      dishesData = []; // Для продолжения работы даже при ошибке
    }
    
    console.log('API /menu: Формирование запроса на получение общих данных');
    // Запрос для получения общего количества проданных блюд и выручки
    const totalsSql = `
      SELECT 
        SUM(oi.quantity) AS total_quantity,
        SUM(oi.price * oi.quantity) AS total_revenue
      FROM order_items oi
      JOIN orders o ON oi.order_id = o.id
      WHERE o.created_at BETWEEN ? AND ?
        AND o.status = 'Оплачен'
    `;
    
    let totalsResult;
    try {
      console.log('API /menu: Выполнение запроса к базе данных (получение общих данных)');
      totalsResult = await query(totalsSql, [start.toISOString(), end.toISOString()]);
      console.log('API /menu: Получены общие данные:', totalsResult);
    } catch (error) {
      console.error('API /menu: Ошибка при получении общих данных:', error);
      totalsResult = [{ total_quantity: 0, total_revenue: 0 }]; // Значения по умолчанию
    }
    
    const totals = Array.isArray(totalsResult) && totalsResult.length > 0 
      ? totalsResult[0] 
      : { total_quantity: 0, total_revenue: 0 };

    const totalQuantity = parseInt(totals.total_quantity || '0');
    const totalRevenue = parseFloat(totals.total_revenue || '0');

    // Топ продаваемых блюд
    const topSellingDishes = (dishesData as any[])
      .map(dish => {
        try {
          const salesCount = parseInt(dish.sales_count || '0');
          const revenue = parseFloat(dish.revenue || '0');
          const percentage = totalRevenue > 0 
            ? Math.round((revenue / totalRevenue) * 100) 
            : 0;
          
          return {
            dishId: dish.dish_id,
            dishName: dish.dish_name,
            categoryId: dish.category_id,
            categoryName: dish.category_name,
            salesCount,
            revenue: Math.round(revenue),
            percentage
          };
        } catch (error) {
          console.error('API /menu: Ошибка при форматировании топового блюда:', error, dish);
          return {
            dishId: 0,
            dishName: 'Ошибка данных',
            categoryId: 0,
            categoryName: '',
            salesCount: 0,
            revenue: 0,
            percentage: 0
          };
        }
      })
      .sort((a, b) => b.salesCount - a.salesCount)
      .slice(0, 10);

    // Самые прибыльные блюда
    const mostProfitableDishes = (dishesData as any[])
      .map(dish => {
        try {
          const salesCount = parseInt(dish.sales_count || '0');
          const revenue = parseFloat(dish.revenue || '0');
          const costPrice = parseFloat(dish.cost_price || '0') * salesCount;
          const profit = revenue - costPrice;
          const profitMargin = revenue > 0 ? Math.round((profit / revenue) * 100) : 0;
          const percentage = totalRevenue > 0 
            ? Math.round((revenue / totalRevenue) * 100) 
            : 0;
          
          return {
            dishId: dish.dish_id,
            dishName: dish.dish_name,
            categoryId: dish.category_id,
            categoryName: dish.category_name,
            salesCount,
            revenue: Math.round(revenue),
            percentage,
            costPrice: Math.round(costPrice),
            profit: Math.round(profit),
            profitMargin
          };
        } catch (error) {
          console.error('API /menu: Ошибка при форматировании прибыльного блюда:', error, dish);
          return {
            dishId: 0,
            dishName: 'Ошибка данных',
            categoryId: 0,
            categoryName: '',
            salesCount: 0,
            revenue: 0,
            percentage: 0,
            costPrice: 0,
            profit: 0,
            profitMargin: 0
          };
        }
      })
      .sort((a, b) => b.profit - a.profit)
      .slice(0, 5);

    // Наименее продаваемые блюда
    const leastSellingDishes = (dishesData as any[])
      .map(dish => {
        try {
          const salesCount = parseInt(dish.sales_count || '0');
          const revenue = parseFloat(dish.revenue || '0');
          const percentage = totalRevenue > 0 
            ? Math.round((revenue / totalRevenue) * 100) 
            : 0;
          
          return {
            dishId: dish.dish_id,
            dishName: dish.dish_name,
            categoryId: dish.category_id,
            categoryName: dish.category_name,
            salesCount,
            revenue: Math.round(revenue),
            percentage
          };
        } catch (error) {
          console.error('API /menu: Ошибка при форматировании наименее продаваемого блюда:', error, dish);
          return {
            dishId: 0,
            dishName: 'Ошибка данных',
            categoryId: 0,
            categoryName: '',
            salesCount: 0,
            revenue: 0,
            percentage: 0
          };
        }
      })
      .sort((a, b) => a.salesCount - b.salesCount)
      .slice(0, 5);

    // Получаем среднее время приготовления
    const avgCookingTime = 30; // Временное значение, нужно реализовать расчет

    // Получаем данные о категориях
    const categoriesSql = `
      SELECT 
        c.id,
        c.name,
        SUM(oi.quantity) AS sales_count,
        SUM(oi.price * oi.quantity) AS revenue
      FROM order_items oi
      JOIN orders o ON oi.order_id = o.id
      JOIN dishes d ON oi.dish_id = d.id
      JOIN categories c ON d.category_id = c.id
      WHERE o.created_at BETWEEN ? AND ?
        AND o.status = 'Оплачен'
      GROUP BY c.id, c.name
      ORDER BY sales_count DESC
    `;

    let categoriesData;
    try {
      console.log('API /menu: Выполнение запроса к базе данных (получение данных категорий)');
      categoriesData = await query(categoriesSql, [start.toISOString(), end.toISOString()]);
      console.log('API /menu: Получены данные категорий, количество:', Array.isArray(categoriesData) ? categoriesData.length : 'не массив');
    } catch (error) {
      console.error('API /menu: Ошибка при получении данных категорий:', error);
      categoriesData = []; // Для продолжения работы даже при ошибке
    }

    // Формируем данные о популярности категорий
    const categoryPopularity: Record<number, number> = {};
    
    if (Array.isArray(categoriesData)) {
      (categoriesData as any[]).forEach(cat => {
        try {
          categoryPopularity[cat.id] = Math.round((parseInt(cat.sales_count || '0') / (totalQuantity || 1)) * 100);
        } catch (error) {
          console.error('API /menu: Ошибка при расчете популярности категории:', error, cat);
        }
      });
    }

    // Формируем данные о трендах продаж
    const menuItemSalesTrend: Record<number, { date: string; value: number }[]> = {};
    
    // Получаем ID топовых блюд
    const topDishIds = topSellingDishes.map(dish => dish.dishId);
    console.log('API /menu: ID топовых блюд:', topDishIds);
    
    // Если есть топовые блюда, получаем данные о продажах
    if (topDishIds.length > 0) {
      // Создаем список дат в диапазоне
      const dates: string[] = [];
      const dayRange = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
      
      for (let i = 0; i < dayRange; i++) {
        const date = new Date(start);
        date.setDate(date.getDate() + i);
        dates.push(date.toISOString().split('T')[0]);
      }
      
      // Формируем параметры запроса для IN
      const placeholders = topDishIds.map(() => '?').join(',');
      
      // SQL запрос для получения продаж топ блюд по дням
      const trendSql = `
        SELECT 
          d.id AS dish_id,
          DATE(o.created_at) AS order_date,
          SUM(oi.quantity) AS quantity
        FROM order_items oi
        JOIN orders o ON oi.order_id = o.id
        JOIN dishes d ON oi.dish_id = d.id
        WHERE o.created_at BETWEEN ? AND ?
          AND o.status = 'Оплачен'
          AND d.id IN (${placeholders})
        GROUP BY d.id, DATE(o.created_at)
        ORDER BY d.id, order_date
      `;
      
      const trendParams = [start.toISOString(), end.toISOString(), ...topDishIds];
      
      let trendData;
      try {
        console.log('API /menu: Выполнение запроса к базе данных (получение данных трендов)');
        trendData = await query(trendSql, trendParams);
        console.log('API /menu: Получены данные трендов, количество:', Array.isArray(trendData) ? trendData.length : 'не массив');
      } catch (error) {
        console.error('API /menu: Ошибка при получении данных трендов:', error);
        trendData = []; // Для продолжения работы даже при ошибке
      }
      
      // Инициализация структуры для каждого топового блюда
      topDishIds.forEach(dishId => {
        menuItemSalesTrend[dishId] = dates.map(date => ({
          date,
          value: 0
        }));
      });
      
      // Проверяем, что trendData является массивом
      if (Array.isArray(trendData)) {
        // Заполнение данными из БД
        (trendData as any[]).forEach(item => {
          try {
            const dishId = item.dish_id;
            const orderDate = typeof item.order_date === 'object' && item.order_date !== null
              ? item.order_date.toISOString().split('T')[0]
              : item.order_date;
            const quantity = parseInt(item.quantity);
            
            // Находим индекс даты в массиве
            const dateIndex = dates.indexOf(orderDate);
            if (dateIndex !== -1 && menuItemSalesTrend[dishId]) {
              menuItemSalesTrend[dishId][dateIndex].value = quantity;
            }
          } catch (error) {
            console.error('API /menu: Ошибка при обработке элемента тренда:', error, item);
          }
        });
      } else {
        console.error('API /menu: trendData не является массивом');
      }
    }

    // Формируем данные о производительности категорий
    const categoryPerformance: Record<string, {
      salesPercentage: number;
      averageOrderValue: number;
      averageProfitMargin: number;
    }> = {};

    if (Array.isArray(categoriesData) && categoriesData.length > 0) {
      console.log('API /menu: Формирование данных о категориях');
      
      for (const category of categoriesData) {
        const categoryId = category.id;
        // Находим все блюда этой категории
        const categoryDishes = (dishesData as any[]).filter(dish => 
          dish.category_id === categoryId
        );
        
        // Рассчитываем процент продаж
        const salesCount = parseInt(category.sales_count || '0');
        const salesPercentage = totalQuantity > 0 
          ? (salesCount / totalQuantity) * 100 
          : 0;
        
        // Рассчитываем средний чек для категории
        let totalRevenue = 0;
        let totalProfitMargin = 0;
        
        categoryDishes.forEach(dish => {
          const revenue = parseFloat(dish.revenue || '0');
          const costPrice = parseFloat(dish.cost_price || '0') * parseInt(dish.sales_count || '0');
          const profit = revenue - costPrice;
          const profitMargin = revenue > 0 ? (profit / revenue) * 100 : 0;
          
          totalRevenue += revenue;
          totalProfitMargin += profitMargin;
        });
        
        const averageOrderValue = salesCount > 0 ? totalRevenue / salesCount : 0;
        const averageProfitMargin = categoryDishes.length > 0 ? totalProfitMargin / categoryDishes.length : 0;
        
        categoryPerformance[category.name] = {
          salesPercentage,
          averageOrderValue,
          averageProfitMargin
        };
      }
    }

    console.log('API /menu: Формирование итогового ответа');
    // Формирование итогового ответа
    const menuData = {
      topSellingDishes,
      mostProfitableDishes,
      leastSellingDishes,
      averageCookingTime: avgCookingTime,
      categoryPopularity,
      menuItemSalesTrend,
      categoryPerformance
    };

    return res.status(200).json(menuData);
  } catch (error) {
    console.error('API /menu: Ошибка при обработке запроса:', error);
    return res.status(500).json({ 
      message: 'Внутренняя ошибка сервера',
      topSellingDishes: [],
      mostProfitableDishes: [],
      leastSellingDishes: [],
      averageCookingTime: 0,
      categoryPopularity: {},
      menuItemSalesTrend: {},
      categoryPerformance: {}
    });
  }
} 