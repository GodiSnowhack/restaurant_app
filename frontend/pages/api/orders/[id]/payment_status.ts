import type { NextApiRequest, NextApiResponse } from 'next';

/**
 * API-прокси для обновления статуса оплаты заказа
 * Передает запрос на бэкенд API и возвращает результат
 */
export default async function orderPaymentStatusProxy(req: NextApiRequest, res: NextApiResponse) {
  // Устанавливаем CORS-заголовки для безопасности
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  // Обрабатываем preflight запросы для CORS
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Проверяем метод запроса - только PUT разрешен для обновления статуса
  if (req.method !== 'PUT') {
    return res.status(405).json({ 
      success: false, 
      message: 'Метод не разрешен. Для обновления статуса оплаты используйте PUT.'
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
    const validStatuses = ['pending', 'paid', 'refunded', 'cancelled'];
    
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
    const backendUrl = `${apiUrl}/orders/${id}`;
    
    console.log(`API Proxy - Отправка запроса на обновление статуса оплаты заказа ${id} на ${normalizedStatus}`);
    
    // Отправляем запрос с таймаутом
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 секунд таймаут
    
    try {
      const response = await fetch(backendUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': authHeader
        },
        body: JSON.stringify({ payment_status: normalizedStatus }),
        signal: controller.signal
      });
      
      // Очищаем таймер
      clearTimeout(timeoutId);
      
      // Обрабатываем ответ от сервера
      if (!response.ok) {
        let errorDetail = '';
        try {
          const errorData = await response.json();
          errorDetail = errorData.detail || errorData.message || `Код ошибки: ${response.status}`;
        } catch (e) {
          errorDetail = `Код ошибки: ${response.status}`;
        }
        
        console.error(`API Proxy - Ошибка при обновлении статуса оплаты заказа: ${errorDetail}`);
        
        return res.status(response.status).json({
          success: false,
          message: `Ошибка при обновлении статуса оплаты заказа: ${errorDetail}`
        });
      }
      
      // Обрабатываем успешный ответ
      const data = await response.json();
      console.log(`API Proxy - Статус оплаты заказа ${id} успешно обновлен на ${normalizedStatus}`);
      
      return res.status(200).json({
        success: true,
        message: `Статус оплаты заказа успешно обновлен на "${getPaymentStatusLabel(normalizedStatus)}"`,
        data
      });
    } catch (fetchError: any) {
      // Очищаем таймер при ошибке
      clearTimeout(timeoutId);
      
      // Обрабатываем ошибку таймаута
      if (fetchError.name === 'AbortError') {
        console.error(`API Proxy - Превышено время ожидания ответа от сервера при обновлении статуса оплаты заказа ${id}`);
        return res.status(504).json({
          success: false,
          message: 'Превышено время ожидания ответа от сервера'
        });
      }
      
      // Обрабатываем другие ошибки сети
      console.error(`API Proxy - Ошибка при отправке запроса: ${fetchError.message}`);
      return res.status(500).json({
        success: false,
        message: `Ошибка при обновлении статуса оплаты заказа: ${fetchError.message}`
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
    'refunded': 'Возврат средств',
    'cancelled': 'Отменен'
  };
  
  return statusLabels[status] || status;
} 