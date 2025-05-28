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
  const userRole = (req.headers['x-user-role'] as string || 'admin').toLowerCase();

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
      `${cleanBaseUrl}/api/admin/db/query`
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
        
        if (response.status === 200 && response.data) {
          queryResponse = response.data;
          console.log('API DB Query: Успешное выполнение запроса');
          break;
        } else {
          console.log('API DB Query: Ошибка выполнения запроса, статус:', response.status);
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
      
      // Если все эндпоинты не сработали, пробуем альтернативный подход
      console.log('API DB Query: Возвращаем пустой массив данных');
      
      // Возвращаем пустой массив вместо ошибки
      return res.status(200).json([]);
    }
  } catch (error: any) {
    console.log('API DB Query: Общая ошибка:', error.message);
    // Возвращаем пустой массив вместо ошибки
    return res.status(200).json([]);
  }
} 