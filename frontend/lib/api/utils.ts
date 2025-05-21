import type { Dish } from '@/types';
import { Order } from './types';

// Функция форматирования цены
export const formatPrice = (price: number, currencySymbol = '₸'): string => {
  // Проверяем, валидно ли число
  if (isNaN(price)) return `0 ${currencySymbol}`;
  
  // Форматируем число с разделителем тысяч
  return price.toLocaleString('ru-RU') + ' ' + currencySymbol;
};

// Форматирование массива блюд: добавление отформатированной цены
export const formatDishes = (dishes: Dish[], currencySymbol = '₸'): Dish[] => {
  return dishes.map(dish => ({
    ...dish,
    formatted_price: formatPrice(dish.price, currencySymbol)
  }));
};

// Форматирование даты и времени
export const formatDateTime = (dateTimeStr: string): string => {
  try {
    const date = new Date(dateTimeStr);
    
    // Если дата невалидна, возвращаем исходную строку
    if (isNaN(date.getTime())) return dateTimeStr;
    
    return date.toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch (error) {
    console.error('API Utils: Ошибка при форматировании даты и времени:', error);
    return dateTimeStr;
  }
};

// Форматирование только даты
export const formatDate = (dateStr: string): string => {
  try {
    const date = new Date(dateStr);
    
    // Если дата невалидна, возвращаем исходную строку
    if (isNaN(date.getTime())) return dateStr;
    
    return date.toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  } catch (error) {
    console.error('API Utils: Ошибка при форматировании даты:', error);
    return dateStr;
  }
};

// Форматирование только времени
export const formatTime = (timeStr: string): string => {
  try {
    // Проверяем, является ли строка временем в формате HH:MM
    if (/^\d{1,2}:\d{2}$/.test(timeStr)) {
      return timeStr;
    }
    
    // Если строка представляет полную дату и время
    const date = new Date(timeStr);
    
    // Если дата невалидна, возвращаем исходную строку
    if (isNaN(date.getTime())) return timeStr;
    
    return date.toLocaleString('ru-RU', {
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch (error) {
    console.error('API Utils: Ошибка при форматировании времени:', error);
    return timeStr;
  }
};

// Расчёт общей суммы заказа
export const calculateOrderTotal = (order: Order): number => {
  if (!order.items || !Array.isArray(order.items)) return 0;
  
  return order.items.reduce((total, item) => {
    return total + (item.price * item.quantity);
  }, 0);
};

// Проверка, является ли текущее устройство мобильным
export const isMobile = (): boolean => {
  if (typeof window === 'undefined') return false;
  
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );
};

// Функция для получения коротких имен статусов заказа
export const getOrderStatusText = (status: string): string => {
  const statusMap: Record<string, string> = {
    pending: 'В ожидании',
    confirmed: 'Подтвержден',
    in_progress: 'Готовится',
    ready: 'Готов',
    delivered: 'Доставлен',
    completed: 'Завершен',
    cancelled: 'Отменен'
  };
  
  return statusMap[status] || status;
};

// Функция для получения цветов статусов заказа
export const getOrderStatusColor = (status: string): string => {
  const colorMap: Record<string, string> = {
    pending: '#FFB946', // Оранжевый
    confirmed: '#2F80ED', // Синий
    in_progress: '#9B51E0', // Фиолетовый
    ready: '#00BFA5', // Бирюзовый
    delivered: '#00C853', // Зеленый
    completed: '#4CAF50', // Зеленый
    cancelled: '#F44336' // Красный
  };
  
  return colorMap[status] || '#E0E0E0'; // Серый по умолчанию
};

// Функция для получения времени ожидания заказа в зависимости от статуса
export const getOrderWaitingTime = (order: Order): number => {
  if (!order.created_at) return 0;
  
  const createdDate = new Date(order.created_at);
  const now = new Date();
  
  // Если заказ завершен или отменен, возвращаем 0
  if (order.status === 'completed' || order.status === 'cancelled') {
    return 0;
  }
  
  // Разница в миллисекундах
  const diffMs = now.getTime() - createdDate.getTime();
  
  // Возвращаем время в минутах
  return Math.floor(diffMs / 60000);
};

// Функция для проверки, просрочен ли заказ
export const isOrderOverdue = (order: Order, maxWaitingTime = 30): boolean => {
  const waitingTime = getOrderWaitingTime(order);
  
  // Если заказ в процессе и время ожидания превышает максимальное, считаем его просроченным
  return (order.status === 'pending' || order.status === 'confirmed' || order.status === 'in_progress') && 
    waitingTime > maxWaitingTime;
};

// Функция для сортировки заказов по приоритету
export const sortOrdersByPriority = (orders: Order[]): Order[] => {
  // Приоритет статусов (от высшего к низшему)
  const statusPriority: Record<string, number> = {
    ready: 5,
    in_progress: 4,
    confirmed: 3,
    pending: 2,
    delivered: 1,
    completed: 0,
    cancelled: 0
  };
  
  return [...orders].sort((a, b) => {
    // Сначала сортируем по приоритету статуса
    const statusDiff = (statusPriority[b.status] || 0) - (statusPriority[a.status] || 0);
    if (statusDiff !== 0) return statusDiff;
    
    // Затем по времени ожидания (просроченные первыми)
    const aOverdue = isOrderOverdue(a);
    const bOverdue = isOrderOverdue(b);
    
    if (aOverdue && !bOverdue) return -1;
    if (!aOverdue && bOverdue) return 1;
    
    // Наконец, по времени создания (сначала более старые)
    const aTime = a.created_at ? new Date(a.created_at).getTime() : 0;
    const bTime = b.created_at ? new Date(b.created_at).getTime() : 0;
    
    return aTime - bTime;
  });
};

// Функция для фильтрации заказов по статусу
export const filterOrdersByStatus = (orders: Order[], status: string): Order[] => {
  return orders.filter(order => order.status === status);
};

// Функция для группировки блюд по категориям
export const groupDishesByCategory = (dishes: Dish[]): Record<number, Dish[]> => {
  return dishes.reduce((groups, dish) => {
    const categoryId = dish.category_id;
    
    if (!groups[categoryId]) {
      groups[categoryId] = [];
    }
    
    groups[categoryId].push(dish);
    return groups;
  }, {} as Record<number, Dish[]>);
};

// Функция для получения случайных рекомендуемых блюд
export const getRandomFeaturedDishes = (dishes: Dish[], count = 3): Dish[] => {
  // Фильтруем только рекомендуемые блюда
  const featuredDishes = dishes.filter(dish => dish.is_featured);
  
  // Если рекомендуемых блюд меньше запрошенного количества, возвращаем их все
  if (featuredDishes.length <= count) return featuredDishes;
  
  // Перемешиваем массив и берем первые count элементов
  return [...featuredDishes]
    .sort(() => 0.5 - Math.random())
    .slice(0, count);
};

// Функция для получения случайных популярных блюд
export const getRandomPopularDishes = (dishes: Dish[], count = 3): Dish[] => {
  // Если блюд меньше запрошенного количества, возвращаем их все
  if (dishes.length <= count) return dishes;
  
  // Перемешиваем массив и берем первые count элементов
  return [...dishes]
    .sort(() => 0.5 - Math.random())
    .slice(0, count);
}; 