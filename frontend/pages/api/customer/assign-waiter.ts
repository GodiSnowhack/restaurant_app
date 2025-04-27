import { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';

// Временное хранилище кодов (синхронизация с generate-code.ts)
// Формат: { waiterId: { code: string, createdAt: Date, expiresAt: Date } }
const waiterCodes: Record<string, { code: string, createdAt: Date, expiresAt: Date }> = {};

// Глобальный объект для хранения соответствия кодов и ID официантов
// Это позволит найти официанта даже если код был сгенерирован в отдельном экземпляре сервера
export const waiterCodeToIdMap: Record<string, string> = {};

// Хранение информации о заказах, привязанных к кодам
export const waiterCodeToOrderMap: Record<string, { 
  orderId: number, 
  customerName: string,
  assigned: boolean
}> = {};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  console.log('API: assign-waiter вызван, метод:', req.method);
  
  // Настройка CORS заголовков
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS, GET');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );
  
  // Обработка предварительных запросов OPTIONS
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  // Получение информации о коде официанта
  if (req.method === 'GET') {
    const { code } = req.query;
    
    if (!code || typeof code !== 'string') {
      return res.status(400).json({ success: false, message: 'Необходимо указать код официанта' });
    }
    
    // Проверяем есть ли информация о заказе для этого кода
    const orderInfo = waiterCodeToOrderMap[code];
    if (orderInfo) {
      return res.status(200).json({
        success: true,
        waiterCode: code,
        orderId: orderInfo.orderId,
        customerName: orderInfo.customerName,
        assigned: orderInfo.assigned
      });
    }
    
    // Проверяем, есть ли информация о том, кому принадлежит этот код
    const waiterId = waiterCodeToIdMap[code];
    if (waiterId) {
      return res.status(200).json({
        success: true,
        waiterCode: code,
        waiterId,
        assigned: false
      });
    }
    
    return res.status(404).json({ 
      success: false, 
      message: 'Информация о коде не найдена' 
    });
  }
  
  // Привязка заказа к официанту
  if (req.method === 'POST') {
    // Получаем код официанта из тела запроса
    const { waiterCode, orderId, customerName } = req.body;
    
    if (!waiterCode) {
      return res.status(400).json({ success: false, message: 'Необходимо указать код официанта' });
    }
    
    if (!orderId) {
      return res.status(400).json({ success: false, message: 'Необходимо указать ID заказа' });
    }
    
    try {
      // Поиск официанта по коду
      let foundWaiterId = waiterCodeToIdMap[waiterCode];
      console.log('Поиск ID официанта по коду:', waiterCode, 'найдено:', foundWaiterId);
      
      // Если код не найден в глобальном маппинге, ищем в локальном хранилище
      if (!foundWaiterId) {
        const now = new Date();
        
        // В реальном приложении здесь будет запрос в базу данных
        for (const [waiterId, codeInfo] of Object.entries(waiterCodes)) {
          if (codeInfo.code === waiterCode && codeInfo.expiresAt > now) {
            foundWaiterId = waiterId;
            // Сохраняем в маппинг
            waiterCodeToIdMap[waiterCode] = waiterId;
            break;
          }
        }
      }
      
      // Если код всё равно не найден, для тестирования создаем временный ID
      if (!foundWaiterId) {
        console.log('Код не найден в базе, создаем временный ID для демонстрации');
        foundWaiterId = `temp_waiter_${Date.now()}`;
        
        // Сохраняем код в глобальный маппинг для последующих запросов
        waiterCodeToIdMap[waiterCode] = foundWaiterId;
      }
      
      // Сохраняем информацию о привязке заказа к коду
      waiterCodeToOrderMap[waiterCode] = {
        orderId: Number(orderId),
        customerName: customerName || 'Гость',
        assigned: true
      };
      
      // Определяем URL для API бэкенда (в реальном приложении)
      const apiUrl = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1'}/orders/${orderId}/assign-waiter`;
      console.log(`API: Отправка запроса на бэкенд: ${apiUrl}`);
      
      try {
        // Пытаемся отправить запрос на бэкенд (может не работать в демо-режиме)
        const response = await axios.post(
          apiUrl,
          { waiter_id: foundWaiterId },
          {
            headers: {
              'Content-Type': 'application/json',
            },
          }
        );
        
        console.log(`API: Получен ответ от бэкенда, статус: ${response.status}`);
        
        // Возвращаем ответ от бэкенда
        return res.status(200).json({
          success: true,
          message: 'Заказ успешно привязан к официанту',
          waiterId: foundWaiterId,
          waiterCode: waiterCode
        });
      } catch (apiError) {
        console.error('Ошибка при обращении к бэкенду:', apiError);
        
        // В демо-режиме или при недоступности бэкенда - возвращаем успешный ответ
        return res.status(200).json({
          success: true,
          message: 'Заказ успешно привязан к официанту (локальный режим)',
          waiterId: foundWaiterId,
          waiterCode: waiterCode
        });
      }
    } catch (error: any) {
      console.error('API: Ошибка при обработке запроса:', error);
      
      if (error.response) {
        return res.status(error.response.status).json({
          success: false,
          message: error.response.data.message || 'Ошибка при привязке заказа к официанту'
        });
      }
      
      return res.status(500).json({ 
        success: false, 
        message: 'Произошла ошибка при привязке заказа к официанту' 
      });
    }
  }
  
  // Если метод не поддерживается
  return res.status(405).json({ success: false, message: 'Метод не поддерживается' });
} 