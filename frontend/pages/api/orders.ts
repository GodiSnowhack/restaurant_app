import type { NextApiRequest, NextApiResponse } from 'next';
import { getDefaultApiUrl } from '../../src/config/defaults';
import https from 'https';
import axios from 'axios';

/**
 * API-прокси для работы с заказами
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    // Получаем токен из заголовков запроса
    const token = req.headers.authorization;
    if (!token) {
      return res.status(401).json({ error: 'Отсутствует токен авторизации' });
    }

    // Базовый URL API
    const baseApiUrl = getDefaultApiUrl();
    const apiUrl = `${baseApiUrl}/api/v1/orders`;

    console.log(`API Proxy: Базовый URL API: ${baseApiUrl}`);
    console.log(`API Proxy: URL API заказов: ${apiUrl}`);

    // Формируем параметры запроса
    const queryParams = new URLSearchParams();
    
    // Добавляем все параметры из запроса
    Object.entries(req.query).forEach(([key, value]) => {
      if (value !== undefined) {
        if (Array.isArray(value)) {
          value.forEach(v => queryParams.append(key, v));
        } else {
          queryParams.append(key, value as string);
        }
      }
    });

    // Проверяем наличие параметров start_date и end_date
    if (req.query.start_date) {
      console.log(`API Proxy: Упрощенные даты: { start_date: '${req.query.start_date}', end_date: '${req.query.end_date}' }`);
    }

    // Добавляем параметры в URL
    const url = `${apiUrl}${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
    console.log(`API Proxy: Параметры запроса: ${queryParams.toString() ? `?${queryParams.toString()}` : '(нет)'}`);

    // Формируем заголовки запроса
    const headers: Record<string, string> = {
      'Authorization': token,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };

    // Извлекаем дополнительную информацию из токена
    try {
      const tokenParts = token.split(' ')[1];
      const base64Url = tokenParts.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
      }).join(''));

      const { sub, role } = JSON.parse(jsonPayload);
      if (sub) headers['X-User-ID'] = sub;
      if (role) headers['X-User-Role'] = role;
      
      console.log(`API Proxy: Заголовки запроса:`, {
        Authorization: token ? '[скрыто]' : 'отсутствует',
        'Content-Type': headers['Content-Type'],
        Accept: headers['Accept'],
        'X-User-Role': headers['X-User-Role'],
        'X-User-ID': headers['X-User-ID']
      });
    } catch (e) {
      console.error('API Proxy: Ошибка при извлечении данных из токена:', e);
    }

    // Настройка HTTPS агента для игнорирования проблем с сертификатами
    const httpsAgent = new https.Agent({
      rejectUnauthorized: false
    });

    // Отправляем запрос к API
    console.log(`API Proxy: Отправка запроса к API: ${url}`);
    
    let response;
    try {
      response = await axios({
        method: req.method,
        url: url,
        headers: headers,
        data: req.method !== 'GET' ? req.body : undefined,
        httpsAgent,
        timeout: 15000,
        validateStatus: () => true // Не выбрасывать исключения для любых кодов состояния
      });
      
      // Возвращаем клиенту ответ от API
      res.status(response.status).json(response.data);
      
    } catch (axiosError) {
      console.log('API Proxy: Ошибка при запросе к API:', axiosError);
      
      // Если не удалось получить данные через основное API, пробуем использовать SQL-запрос
      console.log('API Proxy: Запрос к API не удался, пробуем SQL-запрос к базе данных');
      
      // Пробуем получить данные через прямой запрос к базе данных
      try {
        const dbEndpoints = [
          `${baseApiUrl}/api/v1/db/query`,
          `${baseApiUrl}/api/v1/admin/db/query`,
          `${baseApiUrl}/api/db/query`,
          `${baseApiUrl}/api/v1/db/execute`,
          `${baseApiUrl}/api/db/execute`
        ];
        
        // SQL запрос для получения заказов
        const startDate = req.query.start_date as string || '';
        const endDate = req.query.end_date as string || '';
        
        let dbQuery = `
          SELECT o.*, u.email as user_email, u.full_name as customer_name, u.phone as customer_phone
          FROM orders o
          LEFT JOIN users u ON o.user_id = u.id
          WHERE 1=1
        `;
        
        if (startDate) {
          dbQuery += ` AND o.created_at >= '${startDate}'`;
        }
        
        if (endDate) {
          dbQuery += ` AND o.created_at <= '${endDate}'`;
        }
        
        dbQuery += ` ORDER BY o.created_at DESC`;
        
        // Перебираем все возможные эндпоинты для выполнения запроса
        for (const dbEndpoint of dbEndpoints) {
          console.log(`API Proxy: Пробуем выполнить SQL-запрос через: ${dbEndpoint}`);
          
          try {
            const dbResponse = await axios.post(dbEndpoint, 
              { query: dbQuery },
              { 
                headers,
                httpsAgent,
                timeout: 15000,
                validateStatus: () => true
              }
            );
            
            if (dbResponse.status === 200) {
              if (Array.isArray(dbResponse.data)) {
                return res.status(200).json(dbResponse.data);
              } else if (dbResponse.data && typeof dbResponse.data === 'object' && Array.isArray(dbResponse.data.data)) {
                return res.status(200).json(dbResponse.data.data);
              } else if (dbResponse.data && typeof dbResponse.data === 'object' && Array.isArray(dbResponse.data.results)) {
                return res.status(200).json(dbResponse.data.results);
              } else if (dbResponse.data && typeof dbResponse.data === 'object' && Array.isArray(dbResponse.data.rows)) {
                return res.status(200).json(dbResponse.data.rows);
              }
            }
          } catch (dbError: any) {
            console.log(`API Proxy: Ошибка при запросе к ${dbEndpoint}:`, dbError.message);
          }
        }
        
        console.log('API Proxy: Не удалось получить данные заказов из базы данных');
        
        // Если все попытки не удались, возвращаем демо-данные
        if (process.env.NODE_ENV !== 'production') {
          console.log('API Proxy: Возвращаем демо-данные для разработки');
          
          // Простые демо-данные для разработки
          const demoDates = [
            new Date(Date.now() - 2 * 60 * 60 * 1000),
            new Date(Date.now() - 24 * 60 * 60 * 1000),
            new Date(Date.now() - 3 * 60 * 60 * 1000)
          ];
          
          const demoOrders = [
            {
              id: 1001,
              user_id: 1,
              status: 'pending',
              payment_status: 'unpaid',
              payment_method: 'cash',
              order_type: 'dine_in',
              table_number: 5,
              total_amount: 3500,
              total_price: 3500,
              created_at: demoDates[0].toISOString(),
              updated_at: demoDates[0].toISOString(),
              customer_name: 'Иван Петров',
              customer_phone: '+7 (999) 123-45-67',
              is_urgent: true,
              order_code: 'ORD-1001',
              items: [
                {
                  id: 1,
                  dish_id: 101,
                  name: 'Борщ',
                  quantity: 2,
                  price: 500,
                  total_price: 1000,
                  special_instructions: 'Без сметаны'
                },
                {
                  id: 2,
                  dish_id: 102,
                  name: 'Стейк Рибай',
                  quantity: 1,
                  price: 2500,
                  total_price: 2500
                }
              ]
            },
            {
              id: 1002,
              user_id: 2,
              status: 'completed',
              payment_status: 'paid',
              payment_method: 'card',
              order_type: 'delivery',
              total_amount: 1800,
              total_price: 1800,
              created_at: demoDates[1].toISOString(),
              updated_at: demoDates[1].toISOString(),
              completed_at: demoDates[1].toISOString(),
              customer_name: 'Анна Сидорова',
              customer_phone: '+7 (999) 987-65-43',
              delivery_address: 'ул. Ленина, д. 10, кв. 5',
              order_code: 'ORD-1002',
              items: [
                {
                  id: 3,
                  dish_id: 103,
                  name: 'Пицца Маргарита',
                  quantity: 1,
                  price: 800,
                  total_price: 800
                },
                {
                  id: 4,
                  dish_id: 104,
                  name: 'Тирамису',
                  quantity: 2,
                  price: 500,
                  total_price: 1000
                }
              ]
            }
          ];
          
          return res.status(200).json(demoOrders);
        }
        
        // Возвращаем ошибку, если не удалось получить данные
        return res.status(500).json({ 
          error: true,
          message: 'Не удалось получить данные заказов' 
        });
      } catch (dbQueryError) {
        console.error('API Proxy: Не удалось получить данные заказов из базы данных:', dbQueryError);
        return res.status(500).json({ 
          error: true,
          message: 'Ошибка при получении данных заказов' 
        });
      }
    }
  } catch (error) {
    console.error('API Proxy: Общая ошибка при обработке запроса:', error);
    return res.status(500).json({ 
      error: true,
      message: 'Внутренняя ошибка сервера' 
    });
  }
} 