import { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';

/**
 * API-прокси для подтверждения оплаты заказа клиентом
 */
export default async function confirmPaymentProxy(req: NextApiRequest, res: NextApiResponse) {
  // Устанавливаем CORS заголовки
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

  // Проверяем, что метод поддерживается
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Метод не поддерживается' });
  }

  try {
    // Получаем ID заказа из параметров URL
    const { id } = req.query;
    
    if (!id || Array.isArray(id)) {
      return res.status(400).json({ message: 'Неверный ID заказа' });
    }
    
    const orderId = id;
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';
    const timestamp = Date.now(); // Добавляем timestamp для предотвращения кэширования
    const endpoint = `${apiUrl}/orders/${orderId}/confirm-payment?flush=1&_t=${timestamp}`;
    
    console.log(`Client API - Отправка запроса на подтверждение оплаты заказа ${orderId} (с принудительным обновлением данных)`);
    
    // Передаем токен авторизации, если он есть в заголовках запроса
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    };
    
    const authHeader = req.headers.authorization;
    if (authHeader) {
      headers['Authorization'] = authHeader;
    } else {
      return res.status(401).json({ message: 'Отсутствует токен авторизации' });
    }
    
    // Выполняем запрос к бэкенду
    const response = await axios.post(
      endpoint, 
      { 
        payment_status: 'paid',
        force_update: true
      }, 
      { 
        headers, 
        timeout: 10000,
        params: {
          flush: 1,
          _t: timestamp
        }
      }
    );
    
    console.log(`Client API - Успешное подтверждение оплаты заказа ${orderId}`, response.data);
    
    // Дополнительная проверка для гарантии, что статус обновлен
    if (response.data && (response.data.payment_status !== 'paid' || response.data.status !== 'completed')) {
      console.warn(`Client API - Внимание: Статусы заказа не были обновлены как ожидалось. Payment status: ${response.data.payment_status}, Status: ${response.data.status}`);
      
      // Пробуем сделать дополнительный запрос на обновление статуса
      try {
        console.log(`Client API - Отправка дополнительного запроса на обновление статуса заказа ${orderId}`);
        const updateEndpoint = `${apiUrl}/orders/${orderId}?flush=1&_t=${Date.now()}`;
        
        const updateResponse = await axios.put(
          updateEndpoint,
          {
            payment_status: 'paid',
            status: 'completed',
            force_update: true
          },
          { headers, timeout: 10000 }
        );
        
        console.log(`Client API - Дополнительное обновление статуса заказа ${orderId}`, updateResponse.data);
        
        // Возвращаем обновленные данные
        return res.status(200).json(updateResponse.data);
      } catch (updateError) {
        console.error(`Client API - Ошибка при дополнительном обновлении статуса заказа ${orderId}:`, updateError);
        // Продолжаем с оригинальным ответом
      }
    }
    
    // Возвращаем успешный ответ
    return res.status(response.status).json(response.data);
  } catch (error: any) {
    console.error('Client API - Ошибка при подтверждении оплаты заказа:', error.message);
    
    // Формируем информативное сообщение об ошибке
    let errorMessage = 'Ошибка при подтверждении оплаты заказа';
    let statusCode = 500;
    let errorData = {};
    
    if (error.response) {
      statusCode = error.response.status;
      errorMessage = `Ошибка сервера: ${statusCode}`;
      errorData = error.response.data || {};
      
      if (typeof errorData === 'object' && errorData !== null && 'detail' in errorData) {
        errorMessage = errorData.detail as string;
      }
    } else if (error.code === 'ECONNABORTED') {
      errorMessage = 'Превышено время ожидания ответа от сервера';
      statusCode = 504;
    }
    
    return res.status(statusCode).json({
      success: false,
      message: errorMessage,
      error: error.message,
      ...errorData
    });
  }
} 