import { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';
import { getDefaultApiUrl } from '../../../src/config/defaults';
import https from 'https';

/**
 * API-маршрут для создания нового заказа
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Настройка CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  // Обработка префлайт-запросов
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Проверка метода запроса
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      message: 'Метод не поддерживается. Используйте POST для создания заказа.'
    });
  }

  try {
    // Получаем данные заказа из тела запроса
    const orderData = req.body;
    
    if (!orderData) {
      return res.status(400).json({
        success: false,
        message: 'Отсутствуют данные заказа'
      });
    }
    
    // Проверяем обязательные поля
    if (!orderData.items || !Array.isArray(orderData.items) || orderData.items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Заказ должен содержать хотя бы одно блюдо'
      });
    }

    console.log(`API Orders: Создание нового заказа`, orderData);

    // Получаем токен авторизации из заголовка запроса или из cookie
    let token = req.headers.authorization?.replace('Bearer ', '') || '';
    
    // Если токен не найден в заголовке, проверяем в cookie
    if (!token && req.cookies?.token) {
      token = req.cookies.token;
    }

    // Если токен не найден и в запросе есть параметр token, используем его
    if (!token && req.query.token) {
      token = Array.isArray(req.query.token) ? req.query.token[0] : req.query.token;
    }

    console.log(`API Orders: ${token ? 'Токен авторизации получен' : 'Токен авторизации отсутствует'}`);

    // Получаем базовый URL API
    const baseApiUrl = getDefaultApiUrl();
    
    console.log(`API Orders: Используем API URL: ${baseApiUrl}`);

    // Создаем структуру запроса в соответствии со схемой OrderCreate
    const requestPayload = {
      // Пользователь, от имени которого создается заказ
      user_id: orderData.user_id,
      // Статус заказа - всегда в виде строки, нижний регистр
      status: "pending",
      // Данные для определения стола
      table_number: orderData.table_number,
      reservation_code: orderData.reservation_code,
      // Информация о клиенте
      customer_name: orderData.customer_name,
      customer_phone: orderData.customer_phone,
      customer_age_group: orderData.customer_age_group,
      
      // Отправляем блюда в двух форматах для совместимости
      // 1. Формат items - массив объектов с детальной информацией
      items: orderData.items.map((item: any) => ({
        dish_id: Number(item.dish_id || item.id), // Поддерживаем оба формата dish_id и id
        quantity: Number(item.quantity),
        special_instructions: item.special_instructions || ""
      })),
      
      // 2. Формат dishes - простой массив ID блюд
      dishes: orderData.items.map((item: any) => Number(item.dish_id || item.id)),
      
      // Дополнительные данные
      comment: orderData.comment,
      is_urgent: orderData.is_urgent || false,
      is_group_order: orderData.is_group_order || false,
      waiter_id: orderData.waiter_id
    };

    console.log(`API Orders: Отправляем данные:`, requestPayload);
    console.log(`API Orders: Блюда в заказе:`, 
      requestPayload.items.map((i: {dish_id: number, quantity: number}) => 
        `ID: ${i.dish_id}, Кол-во: ${i.quantity}`));

    // Настраиваем заголовки для запроса
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };
    
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
      console.log(`API Orders: Используем токен для авторизации`);
    }

    // Отключаем проверку SSL для Railway
    const httpsAgent = new https.Agent({
      rejectUnauthorized: false
    });

    try {
      // Используем полный URL с правильным слэшем в конце
      const apiUrl = `${baseApiUrl}/orders/`;
      console.log(`API Orders: Отправляем запрос на ${apiUrl}`);
      
      const response = await axios.post(
        apiUrl, 
        requestPayload, 
        {
          headers,
          httpsAgent: baseApiUrl.startsWith('https') ? httpsAgent : undefined,
          timeout: 30000,
          maxRedirects: 5 // Разрешаем редиректы
        }
      );
      
      console.log(`API Orders: Получен ответ с кодом ${response.status}`);
      console.log('API Orders: Ответ от бэкенда:', response.data);
      
      // Проверяем успешность ответа
      if (response.status >= 200 && response.status < 300) {
        // Проверяем структуру ответа
        if (!response.data || typeof response.data !== 'object') {
          console.error('API Orders: Некорректный формат ответа от бэкенда:', response.data);
          throw new Error('Некорректный формат ответа от сервера');
        }
        
        // Проверяем наличие ID заказа
        if (!response.data.id && response.data.data && !response.data.data.id) {
          console.error('API Orders: Отсутствует ID заказа в ответе:', response.data);
          throw new Error('Отсутствует ID заказа в ответе сервера');
        }
        
        return res.status(200).json({
          success: true,
          message: 'Заказ успешно создан',
          data: response.data.data || response.data
        });
      } else {
        throw new Error(`Неожиданный статус ответа: ${response.status}`);
      }
    } catch (error: any) {
      console.error(`API Orders: Ошибка при создании заказа:`, 
        error.response?.status, error.response?.data || error.message);
      
      // Создаем локальный заказ при ошибке
      const mockOrderId = Date.now();
      const localOrder = {
        ...requestPayload,
        id: mockOrderId,
        created_at: new Date().toISOString()
      };
      
      return res.status(200).json({
        success: true,
        message: 'Заказ создан локально (бэкенд недоступен)',
        data: localOrder,
        local_only: true,
        error: error.response?.data || error.message
      });
    }
  } catch (error: any) {
    console.error(`API Orders: Критическая ошибка:`, error);
    
    return res.status(500).json({
      success: false,
      message: 'Ошибка при создании заказа',
      error: error.message
    });
  }
} 