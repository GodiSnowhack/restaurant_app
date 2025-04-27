import { NextApiRequest, NextApiResponse } from 'next';

/**
 * Улучшенное API для получения заказов официанта.
 * Показываются только заказы, прикрепленные к ID авторизованного пользователя (waiter_id)
 */
export default async function simpleWaiterOrdersApi(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Настройка CORS заголовков
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization, X-User-Role, X-User-ID, X-Is-Admin'
  );

  // Обрабатываем предварительный запрос OPTIONS
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Проверяем, что это GET запрос
  if (req.method !== 'GET') {
    console.error('[API Proxy] Неподдерживаемый метод HTTP:', req.method);
    return res.status(405).json({ error: 'Метод не разрешен' });
  }

  try {
    console.log('[API Proxy] Получен запрос на /api/waiter/simple-orders');
    
    // Получаем токен авторизации из заголовков
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.error('[API Proxy] Отсутствует токен авторизации');
      return res.status(401).json({ error: 'Необходима авторизация' });
    }
    
    const token = authHeader.substring(7);
    
    // Получаем роль пользователя и ID из заголовков
    let userRole = req.headers['x-user-role'] as string || 'unknown';
    let userId = req.headers['x-user-id'] as string || '';
    let isAdminRole = req.headers['x-is-admin'] === 'true' || 
                      req.query.is_admin === 'true' || 
                      req.query.role === 'admin' || 
                      userRole === 'admin';
    
    // Извлекаем информацию о пользователе из токена
    try {
      if (token) {
        const parts = token.split('.');
        if (parts.length === 3) {
          const payload = parts[1];
          // Правильно декодируем base64url формат токена
          const decodedPayload = Buffer.from(payload.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf-8');
          
          const payloadJson = JSON.parse(decodedPayload);
          console.log('[API Proxy] Информация из токена:', payloadJson);
          
          // Получаем ID пользователя из токена
          if (payloadJson.sub) {
            userId = String(payloadJson.sub);
            console.log(`[API Proxy] ID пользователя из токена: ${userId}`);
          }
          
          // Если в токене есть информация о роли - используем её
          if (payloadJson.role) {
            userRole = payloadJson.role;
            isAdminRole = userRole === 'admin';
          }
        }
      }
    } catch (tokenError) {
      console.warn('[API Proxy] Не удалось декодировать токен:', tokenError);
    }
    
    if (!userId) {
      console.error('[API Proxy] Не удалось определить ID пользователя');
      return res.status(400).json({ error: 'Отсутствует идентификатор пользователя' });
    }
    
    console.log(`[API Proxy] Получение заказов для пользователя: роль=${userRole}, ID=${userId}, isAdmin=${isAdminRole}`);
    
    // База API
    const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';
    
    // Определяем эндпоинты в зависимости от роли
    const endpoints = isAdminRole
      ? [
          '/admin/orders',  // Админский эндпоинт
          '/orders',        // Общий эндпоинт
        ]
      : [
          '/waiter/orders',  // Эндпоинт для официанта
        ];
    
    let orderData = null;
    let lastError = null;
    
    // Проходим по эндпоинтам и пытаемся получить данные
    for (const endpoint of endpoints) {
      try {
        let queryParams = '';
        
        // Добавляем фильтр по waiter_id для официантов
        if (userRole === 'waiter') {
          queryParams = `?waiter_id=${userId}`;
        } 
        // Для админа параметры могут быть разными в зависимости от эндпоинта
        else if (isAdminRole) {
          if (endpoint === '/admin/orders') {
            queryParams = '?role=admin';
          } else {
            // Для обычного эндпоинта /orders можно фильтровать по конкретному ID
            queryParams = `?waiter_id=${userId}&role=admin`;
          }
        }
        
        const targetUrl = `${apiBase}${endpoint}`;
        const fullUrl = `${targetUrl}${queryParams}`;
        console.log(`[API Proxy] Попытка запроса к ${fullUrl}`);
        
        const headers: HeadersInit = {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'X-User-Role': userRole,
          'X-User-ID': userId
        };
        
        // Добавляем заголовок для админа
        if (isAdminRole) {
          headers['X-Is-Admin'] = 'true';
        }
        
        console.log(`[API Proxy] Отправка запроса на ${fullUrl} с заголовками:`, headers);
        
        const response = await fetch(fullUrl, {
          method: 'GET',
          headers: headers,
        });
        
        // Проверяем статус ответа
        if (response.ok) {
          const data = await response.json();
          console.log(`[API Proxy] Успешно получены данные из ${fullUrl}, записей: ${Array.isArray(data) ? data.length : 'объект'}`);
          
          // Если получен массив, фильтруем его по waiter_id на клиентской стороне для дополнительной проверки
          if (Array.isArray(data) && userRole === 'waiter') {
            const filteredData = data.filter(order => 
              order.waiter_id === parseInt(userId) || 
              String(order.waiter_id) === userId
            );
            
            console.log(`[API Proxy] Отфильтровано заказов по waiter_id=${userId}: ${filteredData.length} из ${data.length}`);
            orderData = filteredData;
          } else {
            orderData = data;
          }
          
          break; // Выходим из цикла при успешном получении данных
        } else {
          const status = response.status;
          const errorText = await response.text();
          console.warn(`[API Proxy] Ошибка ${status} при запросе к ${fullUrl}: ${errorText}`);
          lastError = { status, message: errorText, endpoint, url: fullUrl };
        }
      } catch (error) {
        console.error(`[API Proxy] Ошибка при запросе к ${endpoint}:`, error);
        lastError = { message: String(error), endpoint };
      }
    }
    
    // Проверяем результат
    if (orderData) {
      // Возвращаем полученные данные
      return res.status(200).json(orderData);
    } else {
      // Для любого пользователя возвращаем пустой массив вместо ошибки
      console.log('[API Proxy] Нет данных, возвращаем пустой массив');
      return res.status(200).json([]);
    }
  } catch (error) {
    console.error('[API Proxy] Критическая ошибка:', error);
    return res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
} 