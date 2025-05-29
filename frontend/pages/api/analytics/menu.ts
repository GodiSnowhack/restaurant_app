import type { NextApiRequest, NextApiResponse } from 'next';
import { getDefaultApiUrl } from '../../../src/config/defaults';
import axios from 'axios';
import { getMockData } from '../analytics';

/**
 * API-прокси для получения аналитики по меню
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const token = req.headers.authorization;
    
    if (!token) {
      console.warn('Analytics API (menu) - Отсутствует токен авторизации, возвращаем заглушку');
      return res.status(200).json(getMockData('menu'));
    }

    // Проверяем формат токена и при необходимости корректируем
    let authHeader = token;
    if (!token.startsWith('Bearer ')) {
      authHeader = `Bearer ${token}`;
    }

    const baseApiUrl = getDefaultApiUrl();
    
    // Получаем все параметры запроса
    const queryParams = new URLSearchParams();
    Object.entries(req.query).forEach(([key, value]) => {
      if (value) {
        if (Array.isArray(value)) {
          value.forEach(v => queryParams.append(key, v));
        } else {
          queryParams.append(key, value as string);
        }
      }
    });
    
    const analyticsUrl = `${baseApiUrl}/analytics/menu${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;

    console.log('Analytics API (menu) - Отправка запроса на', analyticsUrl);
    console.log('Analytics API (menu) - Заголовки:', { 
      Authorization: authHeader.substring(0, 15) + '...'
    });

    try {
      // Отправляем запрос на бэкенд
      const response = await axios.get(analyticsUrl, {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': authHeader
        },
        maxRedirects: 0,
        validateStatus: function (status) {
          return status < 500; // Принимаем все статусы, кроме 5xx
        },
        timeout: 10000 // 10 секунд таймаут
      });

      // Если ответ не успешный, возвращаем заглушку
      if (response.status >= 400) {
        console.warn('Analytics API (menu) - Ошибка от сервера:', {
          status: response.status,
          data: response.data
        });
        
        console.log('Analytics API (menu) - Возвращаем заглушку из-за ошибки API');
        return res.status(200).json(getMockData('menu'));
      }

      let data = response.data;

      console.log('Analytics API (menu) - Ответ от сервера:', {
        status: response.status,
        dataType: typeof data,
        dataKeys: data && typeof data === 'object' ? Object.keys(data) : []
      });

      // Проверяем структуру данных и преобразуем их, если необходимо
      if (data && typeof data === 'object') {
        // Гарантируем, что все поля будут в правильном формате
        const menuData = {
          topSellingDishes: Array.isArray(data.topSellingDishes) || Array.isArray(data.top_selling_dishes)
            ? (data.topSellingDishes || data.top_selling_dishes || []).map((dish: any) => ({
                dishId: Number(dish.dishId || dish.dish_id || 0),
                dishName: String(dish.dishName || dish.dish_name || ''),
                categoryId: dish.categoryId || dish.category_id ? Number(dish.categoryId || dish.category_id) : undefined,
                categoryName: dish.categoryName || dish.category_name ? String(dish.categoryName || dish.category_name) : undefined,
                salesCount: Number(dish.salesCount || dish.sales_count || 0),
                revenue: Number(dish.revenue || 0),
                percentage: Number(dish.percentage || 0)
              }))
            : getMockData('menu').topSellingDishes,
          
          mostProfitableDishes: Array.isArray(data.mostProfitableDishes) || Array.isArray(data.most_profitable_dishes)
            ? (data.mostProfitableDishes || data.most_profitable_dishes || []).map((dish: any) => ({
                dishId: Number(dish.dishId || dish.dish_id || 0),
                dishName: String(dish.dishName || dish.dish_name || ''),
                categoryId: dish.categoryId || dish.category_id ? Number(dish.categoryId || dish.category_id) : undefined,
                categoryName: dish.categoryName || dish.category_name ? String(dish.categoryName || dish.category_name) : undefined,
                salesCount: Number(dish.salesCount || dish.sales_count || 0),
                revenue: Number(dish.revenue || 0),
                percentage: Number(dish.percentage || 0),
                costPrice: Number(dish.costPrice || dish.cost_price || 0),
                profit: Number(dish.profit || 0),
                profitMargin: Number(dish.profitMargin || dish.profit_margin || 0)
              }))
            : getMockData('menu').mostProfitableDishes,
          
          leastSellingDishes: Array.isArray(data.leastSellingDishes) || Array.isArray(data.least_selling_dishes)
            ? (data.leastSellingDishes || data.least_selling_dishes || []).map((dish: any) => ({
                dishId: Number(dish.dishId || dish.dish_id || 0),
                dishName: String(dish.dishName || dish.dish_name || ''),
                categoryId: dish.categoryId || dish.category_id ? Number(dish.categoryId || dish.category_id) : undefined,
                categoryName: dish.categoryName || dish.category_name ? String(dish.categoryName || dish.category_name) : undefined,
                salesCount: Number(dish.salesCount || dish.sales_count || 0),
                revenue: Number(dish.revenue || 0),
                percentage: Number(dish.percentage || 0)
              }))
            : getMockData('menu').leastSellingDishes,
          
          averageCookingTime: Number(data.averageCookingTime || data.average_cooking_time || 18),
          
          categoryPopularity: data.categoryPopularity || data.category_popularity || {},
          
          menuItemSalesTrend: data.menuItemSalesTrend || data.menu_item_sales_trend || {},
          
          categoryPerformance: data.categoryPerformance || data.category_performance || {},
          
          period: data.period || { 
            startDate: new Date().toISOString().split('T')[0],
            endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
          }
        };
        
        // Возвращаем преобразованные данные
        return res.status(200).json(menuData);
      }

      // Если данные не соответствуют ожидаемой структуре, возвращаем заглушку
      console.log('Analytics API (menu) - Неправильная структура данных, возвращаем заглушку');
      return res.status(200).json(getMockData('menu'));
    } catch (apiError: any) {
      // Если произошла ошибка при запросе к API, возвращаем заглушку
      console.error('Analytics API (menu) - Ошибка при запросе к серверу:', apiError.message || apiError);
      console.log('Analytics API (menu) - Возвращаем заглушку из-за ошибки запроса');
      return res.status(200).json(getMockData('menu'));
    }
  } catch (error: any) {
    console.error('Analytics API (menu) - Критическая ошибка:', error);
    
    // В любом случае возвращаем заглушку
    console.log('Analytics API (menu) - Возвращаем заглушку из-за критической ошибки');
    return res.status(200).json(getMockData('menu'));
  }
} 