/**
 * Модуль для управления статусом оплаты заказов
 */

/**
 * Обновляет статус оплаты заказа
 * @param orderId - ID заказа
 * @param paymentStatus - Новый статус оплаты (должен быть 'paid')
 * @returns Promise с результатом операции
 */
export async function updateOrderPaymentStatus(orderId: number | string, paymentStatus: string): Promise<any> {
  try {
    console.log(`API updateOrderPaymentStatus - Обновление статуса оплаты заказа ${orderId} на ${paymentStatus}`);
    
    const token = localStorage.getItem('token');
    if (!token) {
      throw new Error('Необходима авторизация');
    }

    // Статус оплаты может быть только 'paid' при использовании эндпоинта подтверждения оплаты
    if (paymentStatus.toLowerCase() !== 'paid') {
      throw new Error(`Для смены статуса на ${paymentStatus} используйте другой метод. Этот метод поддерживает только подтверждение оплаты.`);
    }
    
    // Проверяем роль пользователя для выбора нужного эндпоинта
    const userRole = getUserInfo().role;
    let url;
    
    if (userRole === 'waiter') {
      // Используем эндпоинт для официанта
      url = `/api/waiter/orders/${orderId}/confirm-payment`;
    } else {
      // Используем эндпоинт для клиента
      url = `/api/orders/${orderId}/confirm-payment`;
    }
    
    // Отправляем запрос с изменением payment_status на "paid"
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      console.error(`API updateOrderPaymentStatus - Ошибка при подтверждении оплаты заказа ${orderId}:`, errorData);
      throw new Error(errorData.detail || errorData.message || 'Ошибка при подтверждении оплаты');
    }
    
    const data = await response.json();
    console.log(`API updateOrderPaymentStatus - Оплата заказа ${orderId} успешно подтверждена`);
    
    // Сбрасываем кэш заказов при необходимости
    // Эта функциональность реализована в вызывающем коде
    
    return { success: true, data };
  } catch (error: any) {
    console.error(`API updateOrderPaymentStatus - Критическая ошибка при обновлении статуса оплаты заказа ${orderId}:`, error);
    throw error;
  }
}

/**
 * Получаем информацию о пользователе
 * @returns Объект с информацией о роли пользователя
 */
function getUserInfo(): { role: string, id?: number | null } {
  try {
    // Проверяем localStorage на наличие данных пользователя
    const userDataStr = typeof localStorage !== 'undefined' ? localStorage.getItem('userData') : null;
    if (userDataStr) {
      try {
        const userData = JSON.parse(userDataStr);
        if (userData && userData.role) {
          const normalizedRole = String(userData.role).toLowerCase();
          return {
            role: normalizedRole,
            id: userData.id || null
          };
        }
      } catch (e) {
        console.error('Ошибка при парсинге данных пользователя:', e);
      }
    }
    
    // Проверяем localStorage на наличие токена
    const token = typeof localStorage !== 'undefined' ? localStorage.getItem('token') : null;
    if (token) {
      // Если есть токен, возвращаем default роль
      return { role: 'customer', id: null };
    }
  } catch (e) {
    console.error('Ошибка при получении информации о пользователе:', e);
  }
  
  // По умолчанию считаем, что это клиент
  return { role: 'customer', id: null };
} 