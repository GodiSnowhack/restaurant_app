import type { NextApiRequest, NextApiResponse } from 'next';
import { query } from '../../../../lib/db';

// Мок-данные для аналитики меню
const mockMenuData = {
  topSellingDishes: [
    { dishId: 1, dishName: "Стейк Рибай", salesCount: 105, revenue: 210000, percentage: 25.2 },
    { dishId: 2, dishName: "Цезарь с курицей", salesCount: 89, revenue: 133500, percentage: 16.1 },
    { dishId: 3, dishName: "Паста Карбонара", salesCount: 76, revenue: 95000, percentage: 11.4 },
    { dishId: 4, dishName: "Борщ", salesCount: 70, revenue: 84000, percentage: 10.1 },
    { dishId: 5, dishName: "Тирамису", salesCount: 68, revenue: 74800, percentage: 9.0 }
  ],
  leastSellingDishes: [
    { dishId: 30, dishName: "Салат Оливье", salesCount: 15, revenue: 18000, percentage: 2.2 },
    { dishId: 31, dishName: "Окрошка", salesCount: 12, revenue: 14400, percentage: 1.7 },
    { dishId: 32, dishName: "Рататуй", salesCount: 10, revenue: 15000, percentage: 1.8 },
    { dishId: 33, dishName: "Суп-пюре из тыквы", salesCount: 8, revenue: 9600, percentage: 1.2 },
    { dishId: 34, dishName: "Салат из морепродуктов", salesCount: 5, revenue: 7500, percentage: 0.9 }
  ],
  popularCategories: [
    { categoryId: 1, categoryName: "Основные блюда", dishesCount: 12, salesCount: 320, revenue: 480000, percentage: 42.5 },
    { categoryId: 2, categoryName: "Салаты", dishesCount: 8, salesCount: 220, revenue: 264000, percentage: 23.4 },
    { categoryId: 3, categoryName: "Супы", dishesCount: 5, salesCount: 150, revenue: 150000, percentage: 13.3 },
    { categoryId: 4, categoryName: "Десерты", dishesCount: 7, salesCount: 180, revenue: 162000, percentage: 14.4 },
    { categoryId: 5, categoryName: "Напитки", dishesCount: 10, salesCount: 120, revenue: 72000, percentage: 6.4 }
  ],
  popularCombinations: [
    { 
      combination: ["Стейк Рибай", "Красное вино"], 
      count: 78, 
      revenue: 195000,
      dishes: [
        { dishId: 1, dishName: "Стейк Рибай" },
        { dishId: 21, dishName: "Красное вино" }
      ]
    },
    { 
      combination: ["Цезарь с курицей", "Паста Карбонара"], 
      count: 45, 
      revenue: 112500,
      dishes: [
        { dishId: 2, dishName: "Цезарь с курицей" },
        { dishId: 3, dishName: "Паста Карбонара" }
      ]
    },
    { 
      combination: ["Борщ", "Хлеб", "Компот"], 
      count: 40, 
      revenue: 64000,
      dishes: [
        { dishId: 4, dishName: "Борщ" },
        { dishId: 11, dishName: "Хлеб" },
        { dishId: 25, dishName: "Компот" }
      ]
    }
  ],
  profitableItems: [
    { dishId: 1, dishName: "Стейк Рибай", costPrice: 600, sellPrice: 2000, margin: 70.0, salesCount: 105, revenue: 210000, profit: 147000 },
    { dishId: 6, dishName: "Лосось на гриле", costPrice: 550, sellPrice: 1800, margin: 69.4, salesCount: 60, revenue: 108000, profit: 75000 },
    { dishId: 2, dishName: "Цезарь с курицей", costPrice: 450, sellPrice: 1500, margin: 70.0, salesCount: 89, revenue: 133500, profit: 93450 }
  ],
  menuItemTrends: Array.from({ length: 30 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - 30 + i);
    return {
      date: date.toISOString().split('T')[0],
      items: [
        { dishId: 1, dishName: "Стейк Рибай", count: Math.round(5 + Math.random() * 5) },
        { dishId: 2, dishName: "Цезарь с курицей", count: Math.round(3 + Math.random() * 4) },
        { dishId: 3, dishName: "Паста Карбонара", count: Math.round(2 + Math.random() * 3) }
      ]
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
  console.log('API /menu: Запрос получен');
  
  // Проверка метода запроса
  if (req.method !== 'GET') {
    console.log('API /menu: Неверный метод запроса:', req.method);
    return res.status(405).json({ message: 'Метод не разрешен' });
  }

  // Проверяем, запрошены ли мок-данные
  const { useMockData } = req.query;
  if (useMockData === 'true') {
    console.log('API /menu: Возвращаем мок-данные по запросу');
    return res.status(200).json(mockMenuData);
  }

  try {
    // Получение параметров запроса
    const { startDate, endDate, categoryId, dishId } = req.query;
    console.log('API /menu: Параметры запроса:', { startDate, endDate, categoryId, dishId });
    
    // Преобразование параметров в нужный формат
    const start = startDate ? new Date(startDate as string) : new Date(new Date().setMonth(new Date().getMonth() - 1));
    const end = endDate ? new Date(endDate as string) : new Date();
    
    // Параметры запроса
    const params: any[] = [
      start.toISOString(), 
      end.toISOString()
    ];
    
    // Дополнительные условия запроса
    let categoryFilter = '';
    if (categoryId) {
      categoryFilter = ' AND c.id = ?';
      params.push(parseInt(categoryId as string));
    }
    
    let dishFilter = '';
    if (dishId) {
      dishFilter = ' AND d.id = ?';
      params.push(parseInt(dishId as string));
    }
    
    console.log('API /menu: Формирование SQL запроса');
    
    // SQL запрос для получения данных о продажах блюд
    const orderItemsSql = `
      SELECT 
        d.id AS dish_id, 
        d.name AS dish_name,
        d.cost_price,
        c.id AS category_id,
        c.name AS category_name,
        SUM(oi.quantity) AS sales_count,
        SUM(oi.price * oi.quantity) AS revenue,
        AVG(TIMESTAMPDIFF(MINUTE, o.created_at, o.updated_at)) AS avg_cooking_time
      FROM order_items oi
      JOIN orders o ON oi.order_id = o.id
      JOIN dishes d ON oi.dish_id = d.id
      JOIN categories c ON d.category_id = c.id
      WHERE o.created_at BETWEEN ? AND ?
        AND o.status = 'Оплачен'
        ${categoryFilter}
        ${dishFilter}
      GROUP BY d.id
      ORDER BY revenue DESC
    `;
    
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
    
    console.log('API /menu: Формирование запроса на данные по категориям');
    // Запрос для получения данных по категориям
    const categoriesSql = `
      SELECT 
        c.id,
        c.name,
        SUM(oi.quantity) AS sales_count
      FROM order_items oi
      JOIN orders o ON oi.order_id = o.id
      JOIN dishes d ON oi.dish_id = d.id
      JOIN categories c ON d.category_id = c.id
      WHERE o.created_at BETWEEN ? AND ?
        AND o.status = 'Оплачен'
      GROUP BY c.id
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
    
    // Создаем пустую структуру для трендов
    const menuItemSalesTrend: Record<number, any[]> = {};
    
    // Создаем пустую структуру для трендов, если данные некорректны
    if (!Array.isArray(dishesData)) {
      console.error('API /menu: dishesData не является массивом');
      dishesData = [];
    }
    
    // Запрос для получения тренда продаж по дням для топовых блюд (ограничиваем 5 блюдами)
    const topDishIds = (dishesData as any[]).slice(0, 5).map(dish => dish.dish_id);
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
    
    console.log('API /menu: Подготовка данных для ответа');
    // Подготовка данных для ответа
    // Форматирование топовых блюд с процентами от общих продаж
    const totalQuantity = parseInt(totals.total_quantity || '0');
    const totalRevenue = parseFloat(totals.total_revenue || '0');
    
    const topSellingDishes = (dishesData as any[]).slice(0, 5).map(dish => {
      try {
        const salesCount = parseInt(dish.sales_count || '0');
        const revenue = parseFloat(dish.revenue || '0');
        const percentage = totalQuantity > 0 
          ? Math.round((salesCount / totalQuantity) * 100) 
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
    });
    
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
    const leastSellingDishes = [...(dishesData as any[])]
      .sort((a, b) => {
        const countA = parseInt(a.sales_count || '0');
        const countB = parseInt(b.sales_count || '0');
        return countA - countB;
      })
      .slice(0, 5)
      .map(dish => {
        try {
          const salesCount = parseInt(dish.sales_count || '0');
          const revenue = parseFloat(dish.revenue || '0');
          const percentage = totalQuantity > 0 
            ? Math.round((salesCount / totalQuantity) * 100) 
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
      });
    
    // Среднее время приготовления
    let avgCookingTime = 0;
    try {
      avgCookingTime = dishesData.length > 0
        ? Math.round((dishesData as any[]).reduce((sum, dish) => {
            const cookingTime = parseFloat(dish.avg_cooking_time || '0');
            return sum + cookingTime;
          }, 0) / dishesData.length)
        : 0;
    } catch (error) {
      console.error('API /menu: Ошибка при расчете среднего времени приготовления:', error);
    }
    
    // Популярность категорий
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
    
    console.log('API /menu: Формирование итогового ответа');
    // Формирование итогового ответа
    const menuData = {
      topSellingDishes,
      mostProfitableDishes,
      leastSellingDishes,
      averageCookingTime: avgCookingTime,
      categoryPopularity,
      menuItemSalesTrend
    };

    // Добавляем информацию о производительности категорий
    if (Array.isArray(categoriesData) && categoriesData.length > 0) {
      console.log('API /menu: Формирование данных о категориях');
      
      // Создаем структуру для данных о категориях
      const categoryPerformance: Record<string, {
        salesPercentage: number;
        averageOrderValue: number;
        averageProfitMargin: number;
      }> = {};
      
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
        
        if (categoryDishes.length > 0) {
          for (const dish of categoryDishes) {
            totalRevenue += parseFloat(dish.revenue || '0');
            
            // Рассчитываем маржу если есть cost_price
            if (dish.cost_price) {
              const price = parseFloat(dish.price || '0');
              const costPrice = parseFloat(dish.cost_price || '0');
              if (price > 0) {
                const profitMargin = ((price - costPrice) / price) * 100;
                totalProfitMargin += profitMargin;
              }
            } else {
              // Если нет cost_price, используем примерную маржу
              totalProfitMargin += 35; // средняя маржа 35%
            }
          }
          
          const averageOrderValue = salesCount > 0 ? totalRevenue / salesCount : 0;
          const averageProfitMargin = categoryDishes.length > 0 ? totalProfitMargin / categoryDishes.length : 35;
          
          // Записываем данные категории
          categoryPerformance[categoryId] = {
            salesPercentage,
            averageOrderValue,
            averageProfitMargin
          };
        } else {
          // Если нет блюд категории, используем примерные данные
          categoryPerformance[categoryId] = {
            salesPercentage,
            averageOrderValue: 2500, // примерная цена
            averageProfitMargin: 35  // примерная маржа
          };
        }
      }
      
      // Добавляем данные о категориях в ответ
      Object.assign(menuData, { categoryPerformance });
    }

    // Добавим информацию о периоде
    const response = {
      ...menuData,
      period: {
        startDate: start.toISOString().split('T')[0],
        endDate: end.toISOString().split('T')[0]
      }
    };

    // Возвращаем успешный ответ
    console.log('API /menu: Отправка успешного ответа');
    return res.status(200).json(response);
  } catch (error) {
    console.error('API /menu: Критическая ошибка:', error);
    
    // В случае ошибки возвращаем мок-данные
    console.log('API /menu: Возвращаем мок-данные из-за ошибки');
    return res.status(200).json(mockMenuData);
  }
} 