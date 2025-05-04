import { NextApiRequest, NextApiResponse } from 'next';
import axios, { AxiosError } from 'axios';

/**
 * Экстренный API-прокси для принудительного обновления waiter_id
 */
export default async function emergencyAssignProxy(req: NextApiRequest, res: NextApiResponse) {
  // Разрешаем CORS для всех клиентов
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  // Обрабатываем предварительные запросы CORS
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Метод не поддерживается' });
  }

  // Получаем код заказа и ID официанта из тела запроса или из query параметров
  const order_code = req.body.order_code || req.query.order_code;
  const waiter_id = req.body.waiter_id || req.query.waiter_id;
  
  if (!order_code || !waiter_id) {
    return res.status(400).json({ 
      success: false, 
      message: 'Отсутствуют необходимые параметры (order_code, waiter_id)' 
    });
  }

  console.log(`EMERGENCY API - Принудительное обновление заказа ${order_code}, waiter_id=${waiter_id}`);

  try {
    // Получаем токен авторизации
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ success: false, message: 'Отсутствует токен авторизации' });
    }

    // Определяем API URL
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';
    const emergencyUrl = `${apiUrl}/waiter/emergency-assign?order_code=${order_code}&waiter_id=${waiter_id}`;
    
    console.log(`EMERGENCY API - Отправка запроса на ${emergencyUrl}`);
    
    let success = false;
    let responseData = null;
    
    // Метод 1: Используем специальный эндпоинт emergency-assign
    try {
      console.log(`EMERGENCY API - МЕТОД 1: Используем специальный эндпоинт`);
      const response = await axios.post(
        emergencyUrl,
        {},
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'X-Emergency-Update': 'true',
            'User-Agent': req.headers['user-agent'] || 'Emergency Client'
          },
          timeout: 60000  // Увеличенный таймаут для экстренных операций
        }
      );

      console.log(`EMERGENCY API - МЕТОД 1: Получен ответ: статус ${response.status}`);
      console.log(`EMERGENCY API - МЕТОД 1: Данные:`, response.data);
      
      // Если метод 1 успешен, сохраняем результат
      if (response.data && response.data.success) {
        success = true;
        responseData = response.data;
        console.log(`EMERGENCY API - МЕТОД 1: УСПЕШНО`);
      }
    } catch (error) {
      const axiosError = error as AxiosError;
      console.error(`EMERGENCY API - МЕТОД 1: Ошибка:`, axiosError.message);
    }
    
    // Получаем ID заказа, если он есть в предыдущем ответе или из запроса
    let order_id = (responseData && responseData.order_id) || req.body.order_id || null;
    
    // Если первый метод не сработал и у нас нет ID заказа, пробуем найти его
    if (!success && !order_id) {
      try {
        console.log(`EMERGENCY API - Пытаемся найти ID заказа по коду ${order_code}`);
        const searchUrl = `${apiUrl}/orders?order_code=${order_code}`;
        const searchResponse = await axios.get(
          searchUrl,
          {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            timeout: 30000
          }
        );
        
        if (searchResponse.data && Array.isArray(searchResponse.data) && searchResponse.data.length > 0) {
          order_id = searchResponse.data[0].id;
          console.log(`EMERGENCY API - Найден ID заказа: ${order_id}`);
        }
      } catch (error) {
        const axiosError = error as AxiosError;
        console.error(`EMERGENCY API - Ошибка при поиске заказа:`, axiosError.message);
      }
    }
    
    // Метод 2: Делаем прямой PATCH запрос, если у нас есть ID заказа
    if (!success && order_id) {
      try {
        console.log(`EMERGENCY API - МЕТОД 2: Прямое обновление заказа ID=${order_id}`);
        
        // Прямой запрос на обновление заказа
        const directUrl = `${apiUrl}/orders/${order_id}`;
        const directResponse = await axios.patch(
          directUrl,
          { waiter_id: waiter_id, status: "CONFIRMED" },
          {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
              'X-Emergency-Update': 'true'
            },
            timeout: 30000
          }
        );
        
        if (directResponse.status >= 200 && directResponse.status < 300) {
          console.log(`EMERGENCY API - МЕТОД 2: Успешно!`);
          success = true;
          responseData = {
            success: true,
            message: "Заказ привязан через прямое обновление",
            order_id: order_id,
            waiter_id: waiter_id
          };
        }
      } catch (error) {
        const axiosError = error as AxiosError;
        console.error(`EMERGENCY API - МЕТОД 2: Ошибка:`, axiosError.message);
      }
    }
    
    // Метод 3: Пробуем использовать прямой SQL-запрос через скрипт
    if (!success) {
      try {
        console.log(`EMERGENCY API - МЕТОД 3: Вызов прямого SQL скрипта`);
        
        // URL для вызова скрипта экстренного обновления
        const scriptUrl = `${apiUrl}/admin/run-script`;
        const scriptResponse = await axios.post(
          scriptUrl,
          {
            script_name: "emergency_fix",
            params: [order_code, waiter_id]
          },
          {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
              'X-Emergency-Access': 'true'
            },
            timeout: 30000
          }
        );
        
        if (scriptResponse.status >= 200 && scriptResponse.status < 300) {
          console.log(`EMERGENCY API - МЕТОД 3: Успешно!`);
          success = true;
          responseData = {
            success: true,
            message: "Заказ привязан через SQL скрипт",
            order_id: order_id,
            waiter_id: waiter_id
          };
        }
      } catch (error) {
        const axiosError = error as AxiosError;
        console.error(`EMERGENCY API - МЕТОД 3: Ошибка:`, axiosError.message);
      }
    }
    
    // Возвращаем результат клиенту
    if (success && responseData) {
      return res.status(200).json(responseData);
    } else {
      // Проверим, существует ли запись в БД, даже если методы API завершились с ошибкой
      try {
        console.log(`EMERGENCY API - Проверка существования привязки в БД (order_code=${order_code}, waiter_id=${waiter_id})`);
        
        // URL для проверки статуса привязки
        const checkUrl = `${apiUrl}/waiter/orders?status=active`;
        const checkResponse = await axios.get(
          checkUrl,
          {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            timeout: 30000
          }
        );
        
        // Проверяем, есть ли среди заказов официанта заказ с нужным кодом
        if (checkResponse.data && Array.isArray(checkResponse.data)) {
          const foundOrder = checkResponse.data.find(order => 
            order.order_code === order_code || 
            (order_id && order.id === order_id)
          );
          
          if (foundOrder) {
            console.log(`EMERGENCY API - Нашли привязанный заказ в БД:`, foundOrder);
            return res.status(200).json({
              success: true,
              message: "Заказ успешно привязан в БД, несмотря на ошибки API",
              order_id: foundOrder.id,
              waiter_id: waiter_id
            });
          }
        }
      } catch (checkError) {
        console.error(`EMERGENCY API - Ошибка при проверке привязки в БД:`, checkError);
      }
      
      return res.status(500).json({
        success: false,
        message: "Все методы обновления завершились неудачно",
        order_code: order_code,
        waiter_id: waiter_id,
        order_id: order_id
      });
    }
  } catch (error: any) {
    console.error(`EMERGENCY API - Критическая ошибка:`, error.message);
    
    // Формируем сообщение об ошибке для клиента
    return res.status(500).json({
      success: false,
      message: `Ошибка при экстренном обновлении: ${error.message}`,
      error: error.response?.data || error.message
    });
  }
} 