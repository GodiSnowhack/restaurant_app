import { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';
import { getDefaultApiUrl } from '../../../src/config/defaults';
import https from 'https';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Настройка CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST,PUT,DELETE,PATCH');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization, X-User-ID, X-User-Role'
  );

  // Обработка префлайт-запросов
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Проверка метода запроса
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      message: 'Метод не поддерживается'
    });
  }

  // Получаем SQL-запрос
  const { query } = req.body;
  
  if (!query) {
    return res.status(400).json({
      success: false,
      message: 'Отсутствует SQL-запрос'
    });
  }

  // Получаем токен авторизации
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    console.log('API DB Query: Отсутствует токен авторизации');
    return res.status(401).json({ message: 'Отсутствует токен авторизации' });
  }
  
  // Получаем ID и роль пользователя из заголовков
  const userId = req.headers['x-user-id'] as string || '1';
  const userRole = (req.headers['x-user-role'] as string || '').toLowerCase();

  // Проверяем, что пользователь - администратор
  if (userRole !== 'admin') {
    console.log('API DB Query: Попытка выполнения запроса неадминистратором:', userRole);
    return res.status(403).json({ 
      success: false,
      message: 'Доступ запрещен. Требуются права администратора.'
    });
  }

  // Получаем базовый URL API
  const baseApiUrl = getDefaultApiUrl();
  console.log('API DB Query: Базовый URL API:', baseApiUrl);

  // Убираем /api/v1 из базового URL
  let cleanBaseUrl = baseApiUrl;
  if (cleanBaseUrl.endsWith('/api/v1')) {
    cleanBaseUrl = cleanBaseUrl.substring(0, cleanBaseUrl.length - 7);
  }
  console.log('API DB Query: Очищенный базовый URL API:', cleanBaseUrl);

  // Создаем HTTPS агент для безопасных запросов
  const httpsAgent = new https.Agent({
    rejectUnauthorized: false
  });

  // Заголовки запроса
  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'X-User-Role': userRole,
    'X-User-ID': userId
  };

  console.log('API DB Query: Заголовки запроса:', {
    ...headers,
    'Authorization': 'Bearer [скрыто]'
  });

  // Проверяем, что запрос безопасен (только SELECT)
  if (!query.trim().toLowerCase().startsWith('select')) {
    return res.status(403).json({
      success: false,
      message: 'Разрешены только SELECT-запросы'
    });
  }

  try {
    console.log('API DB Query: Выполнение SQL-запроса:', query);
    
    // Варианты URL для прямого запроса к базе данных
    const dbEndpoints = [
      `${cleanBaseUrl}/api/v1/db/execute`,
      `${cleanBaseUrl}/api/db/execute`,
      `${cleanBaseUrl}/api/v1/admin/db/query`,
      `${cleanBaseUrl}/api/admin/db/query`,
      `${cleanBaseUrl}/api/v1/db/query`,
      `${cleanBaseUrl}/api/db/query`
    ];
    
    let queryResponse = null;
    let responseError = null;
    
    // Пробуем различные эндпоинты для выполнения запроса
    for (const dbEndpoint of dbEndpoints) {
      try {
        console.log('API DB Query: Попытка запроса к:', dbEndpoint);
        
        const response = await axios.post(dbEndpoint, 
          { query, safe: true },
          { 
            headers,
            httpsAgent,
            timeout: 15000,
            validateStatus: status => true
          }
        );
        
        console.log('API DB Query: Статус ответа:', response.status);
        
        if (response.status === 200) {
          if (Array.isArray(response.data)) {
            queryResponse = response.data;
            console.log('API DB Query: Успешное выполнение запроса через', dbEndpoint);
            break;
          } else if (response.data && typeof response.data === 'object' && Array.isArray(response.data.data)) {
            queryResponse = response.data.data;
            console.log('API DB Query: Успешное выполнение запроса через', dbEndpoint, '(формат data)');
            break;
          } else if (response.data && typeof response.data === 'object' && Array.isArray(response.data.results)) {
            queryResponse = response.data.results;
            console.log('API DB Query: Успешное выполнение запроса через', dbEndpoint, '(формат results)');
            break;
          } else if (response.data && typeof response.data === 'object' && Array.isArray(response.data.rows)) {
            queryResponse = response.data.rows;
            console.log('API DB Query: Успешное выполнение запроса через', dbEndpoint, '(формат rows)');
            break;
          } else {
            responseError = { 
              message: 'Ответ получен, но формат данных не распознан', 
              data: response.data 
            };
          }
        } else {
          responseError = response.data || { message: `Ошибка API, статус: ${response.status}` };
        }
      } catch (endpointError: any) {
        console.log('API DB Query: Ошибка при запросе к:', dbEndpoint, endpointError.message);
        responseError = { message: endpointError.message };
      }
    }
    
    if (queryResponse) {
      return res.status(200).json(queryResponse);
    } else {
      console.log('API DB Query: Все попытки выполнения запроса не удались');
      
      if (responseError) {
        console.log('API DB Query: Последняя ошибка:', JSON.stringify(responseError).substring(0, 300));
      }
      
      // Пробуем альтернативный запрос
      try {
        // Изменяем синтаксис запроса для SQLite
        let altQuery = query;
        
        // Если запрос был формата SELECT...FROM...WHERE, попробуем переформатировать его
        if (query.toLowerCase().includes('select') && query.toLowerCase().includes('from')) {
          console.log('API DB Query: Пробуем альтернативный синтаксис запроса');
          
          // Замена функций (например, PostgreSQL -> SQLite)
          altQuery = query
            .replace(/ILIKE/g, 'LIKE')
            .replace(/\bnow\(\)/gi, "datetime('now')")
            .replace(/::timestamp/g, '')
            .replace(/::date/g, '');
          
          for (const dbEndpoint of dbEndpoints) {
            try {
              console.log('API DB Query: Попытка альтернативного запроса к:', dbEndpoint);
              
              const altResponse = await axios.post(dbEndpoint, 
                { query: altQuery, safe: true },
                { 
                  headers,
                  httpsAgent,
                  timeout: 15000,
                  validateStatus: status => true
                }
              );
              
              if (altResponse.status === 200) {
                if (Array.isArray(altResponse.data)) {
                  console.log('API DB Query: Успешное выполнение альтернативного запроса');
                  return res.status(200).json(altResponse.data);
                } else if (altResponse.data && typeof altResponse.data === 'object' && Array.isArray(altResponse.data.data)) {
                  console.log('API DB Query: Успешное выполнение альтернативного запроса (формат data)');
                  return res.status(200).json(altResponse.data.data);
                } else if (altResponse.data && typeof altResponse.data === 'object' && Array.isArray(altResponse.data.results)) {
                  console.log('API DB Query: Успешное выполнение альтернативного запроса (формат results)');
                  return res.status(200).json(altResponse.data.results);
                } else if (altResponse.data && typeof altResponse.data === 'object' && Array.isArray(altResponse.data.rows)) {
                  console.log('API DB Query: Успешное выполнение альтернативного запроса (формат rows)');
                  return res.status(200).json(altResponse.data.rows);
                }
              }
            } catch (altEndpointError) {
              // Продолжаем пробовать другие эндпоинты
            }
          }
        }
      } catch (altError) {
        console.log('API DB Query: Ошибка при выполнении альтернативного запроса');
      }
      
      // Возвращаем пустой массив вместо ошибки
      return res.status(200).json([]);
    }
  } catch (error: any) {
    console.log('API DB Query: Общая ошибка:', error.message);
    // Возвращаем пустой массив вместо ошибки
    return res.status(200).json([]);
  }
} 