import type { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';

/**
 * API-прокси для обновления статуса оплаты заказа
 * Использует POST метод для обновления платежного статуса
 */
export default async function orderPaymentProxy(req: NextApiRequest, res: NextApiResponse) {
  // Настраиваем CORS-заголовки
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  // Обрабатываем preflight запросы для CORS
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Проверяем метод запроса - поддерживаем POST, PUT и PATCH для большей совместимости
  if (req.method !== 'POST' && req.method !== 'PUT' && req.method !== 'PATCH') {
    return res.status(405).json({ 
      success: false, 
      message: 'Метод не разрешен. Для обновления статуса оплаты используйте POST, PUT или PATCH.'
    });
  }

  try {
    // Получаем ID заказа из URL
    const { id } = req.query;
    
    // Проверяем корректность ID
    if (!id || Array.isArray(id)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Некорректный ID заказа' 
      });
    }
    
    // Получаем новый статус из тела запроса
    const { payment_status } = req.body;
    
    if (!payment_status) {
      return res.status(400).json({ 
        success: false, 
        message: 'Не указан статус оплаты заказа' 
      });
    }
    
    // Приводим статус к нижнему регистру для совместимости с бэкендом
    const normalizedStatus = typeof payment_status === 'string' ? payment_status.toLowerCase() : payment_status;
    
    // Список допустимых статусов оплаты
    const validStatuses = ['pending', 'paid', 'failed', 'refunded'];
    
    if (!validStatuses.includes(normalizedStatus)) {
      return res.status(400).json({ 
        success: false,
        message: `Недопустимый статус оплаты: ${payment_status}. Допустимые статусы: ${validStatuses.join(', ')}` 
      });
    }
    
    // Получаем токен авторизации из заголовков
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ 
        success: false, 
        message: 'Отсутствует токен авторизации' 
      });
    }
    
    // Формируем URL для запроса к бэкенду
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';
    const backendUrl = `${apiUrl}/orders/update/${id}`;
    
    console.log(`API Proxy - Отправка запроса на обновление статуса оплаты заказа ${id} на ${normalizedStatus}`);
    
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': authHeader
    };
    
    try {
      // Используем PUT запрос к эндпоинту update
      const response = await axios.put(
        backendUrl,
        { payment_status: normalizedStatus },
        { headers, validateStatus: (status) => status < 500 }
      );
      
      // Обрабатываем ответ от сервера
      if (response.status >= 400) {
        console.error(`API Proxy - Ошибка при обновлении статуса оплаты заказа: ${JSON.stringify(response.data)}`);
        
        return res.status(response.status).json({
          success: false,
          message: `Ошибка при обновлении статуса оплаты заказа: ${response.data.detail || response.data.message || `Код ошибки: ${response.status}`}`
        });
      }
      
      // Обрабатываем успешный ответ
      console.log(`API Proxy - Статус оплаты заказа ${id} успешно обновлен на ${normalizedStatus}`);
      
      return res.status(200).json({
        success: true,
        message: `Статус оплаты заказа успешно обновлен на "${getPaymentStatusLabel(normalizedStatus)}"`,
        data: response.data
      });
    } catch (fetchError: any) {
      // Обрабатываем ошибку сети или другие ошибки
      console.error(`API Proxy - Ошибка при отправке запроса: ${fetchError.message}`);
      
      // Получаем детали ошибки, если доступны
      let errorDetail = fetchError.message;
      if (fetchError.response && fetchError.response.data) {
        errorDetail = fetchError.response.data.detail || fetchError.response.data.message || errorDetail;
      }
      
      return res.status(500).json({
        success: false,
        message: `Ошибка при обновлении статуса оплаты заказа: ${errorDetail}`
      });
    }
  } catch (error: any) {
    // Обрабатываем общие ошибки
    console.error('API Proxy - Критическая ошибка:', error);
    return res.status(500).json({
      success: false,
      message: `Внутренняя ошибка сервера: ${error.message}`
    });
  }
}

// Хелпер-функция для перевода статуса в читаемую форму
function getPaymentStatusLabel(status: string): string {
  const statusLabels: Record<string, string> = {
    'pending': 'Ожидает оплаты',
    'paid': 'Оплачен',
    'failed': 'Отказ оплаты',
    'refunded': 'Возврат средств'
  };
  
  return statusLabels[status] || status;
} 