import type { NextApiRequest, NextApiResponse } from 'next';
import { getDefaultApiUrl } from '../../../src/config/defaults';
import axios from 'axios';
import { getMockData } from '../analytics';

/**
 * API-прокси для получения предиктивной аналитики
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
      console.warn('Analytics API (predictive) - Отсутствует токен авторизации, возвращаем заглушку');
      return res.status(200).json(getMockData('predictive'));
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
    
    const analyticsUrl = `${baseApiUrl}/analytics/predictive${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;

    console.log('Analytics API (predictive) - Отправка запроса на', analyticsUrl);
    console.log('Analytics API (predictive) - Заголовки:', { 
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
        console.warn('Analytics API (predictive) - Ошибка от сервера:', {
          status: response.status,
          data: response.data
        });
        
        console.log('Analytics API (predictive) - Возвращаем заглушку из-за ошибки API');
        return res.status(200).json(getMockData('predictive'));
      }

      let data = response.data;

      console.log('Analytics API (predictive) - Ответ от сервера:', {
        status: response.status,
        dataType: typeof data,
        dataKeys: data && typeof data === 'object' ? Object.keys(data) : []
      });

      // Проверяем структуру данных и преобразуем их, если необходимо
      if (data && typeof data === 'object') {
        const predictiveData = {
          salesForecast: Array.isArray(data.salesForecast) 
            ? data.salesForecast.map((item: any) => ({
                date: typeof item.date === 'string' ? item.date : 
                      item.date?.toString() || new Date().toISOString().split('T')[0],
                value: typeof item.value === 'number' ? item.value : 
                       typeof item.value === 'string' ? parseFloat(item.value) : 0
              }))
            : [],
          
          inventoryForecast: data.inventoryForecast || {},
          
          staffingNeeds: data.staffingNeeds || {},
          
          peakTimePrediction: data.peakTimePrediction || {},
          
          suggestedPromotions: Array.isArray(data.suggestedPromotions)
            ? data.suggestedPromotions.map((promo: any) => ({
                dishId: promo.dishId || promo.dish_id || 0,
                dishName: promo.dishName || promo.dish_name || '',
                suggestedDiscount: typeof promo.suggestedDiscount === 'number' ? promo.suggestedDiscount : 
                                  typeof promo.suggested_discount === 'number' ? promo.suggested_discount : 0,
                potentialRevenue: typeof promo.potentialRevenue === 'number' ? promo.potentialRevenue : 
                                 typeof promo.potential_revenue === 'number' ? promo.potential_revenue : 0,
                reason: promo.reason || ''
              }))
            : [],
          
          period: data.period || { 
            startDate: new Date().toISOString().split('T')[0],
            endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
          }
        };
        
        // Возвращаем преобразованные данные
        return res.status(200).json(predictiveData);
      }

      // Возвращаем данные клиенту без изменений, если не соответствуют ожидаемой структуре
      return res.status(200).json(data);
    } catch (apiError: any) {
      // Если произошла ошибка при запросе к API, возвращаем заглушку
      console.error('Analytics API (predictive) - Ошибка при запросе к серверу:', apiError.message || apiError);
      console.log('Analytics API (predictive) - Возвращаем заглушку из-за ошибки запроса');
      return res.status(200).json(getMockData('predictive'));
    }
  } catch (error: any) {
    console.error('Analytics API (predictive) - Критическая ошибка:', error);
    
    // В любом случае возвращаем заглушку
    console.log('Analytics API (predictive) - Возвращаем заглушку из-за критической ошибки');
    return res.status(200).json(getMockData('predictive'));
  }
} 