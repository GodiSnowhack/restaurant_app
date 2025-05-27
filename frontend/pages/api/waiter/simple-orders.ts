import { NextApiRequest, NextApiResponse } from 'next';
import { demoWaiterOrders } from '../../../lib/demo-data/waiter-orders';
import axios from 'axios';
import { getDefaultApiUrl } from '../../../src/config/defaults';

export default async function simpleWaiterOrdersApi(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Настройка CORS заголовков
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  const origin = req.headers.origin || 'http://localhost:3000';
  res.setHeader('Access-Control-Allow-Origin', origin);
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
      return res.status(200).json(demoWaiterOrders);
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
      const parts = token.split('.');
      if (parts.length === 3) {
        const payload = parts[1];
        const decodedPayload = Buffer.from(payload.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf-8');
        const payloadJson = JSON.parse(decodedPayload);
        console.log('[API Proxy] Информация из токена:', payloadJson);
        
        if (payloadJson.sub) {
          userId = String(payloadJson.sub);
          console.log(`[API Proxy] ID пользователя из токена: ${userId}`);
        }
        
        if (payloadJson.role) {
          userRole = payloadJson.role;
          isAdminRole = userRole === 'admin';
        }
      }
    } catch (tokenError) {
      console.error('[API Proxy] Ошибка при разборе токена:', tokenError);
    }

    console.log(`[API Proxy] Получение заказов для пользователя: роль=${userRole}, ID=${userId}, isAdmin=${isAdminRole}`);

    // Формируем URL для запроса к бэкенду
    const apiBaseUrl = getDefaultApiUrl();
    const endpoint = `${apiBaseUrl}/waiter/orders`;

    try {
      const response = await axios.get(endpoint, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'X-User-Role': userRole,
          'X-User-ID': userId
        },
        timeout: 5000
      });

      if (response.status === 200 && Array.isArray(response.data)) {
        console.log(`[API Proxy] Успешно получено ${response.data.length} заказов`);
        return res.status(200).json(response.data);
      }
    } catch (error: any) {
      console.error('[API Proxy] Ошибка при запросе к API:', error.message);
      console.log('[API Proxy] API сервер недоступен, используем демо-данные');
    }

    // В случае ошибки или отсутствия данных возвращаем демо-данные
    return res.status(200).json(demoWaiterOrders);
  } catch (error: any) {
    console.error('[API Proxy] Критическая ошибка:', error);
    return res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
} 