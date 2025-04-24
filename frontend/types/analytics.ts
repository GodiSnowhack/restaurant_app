// Типы для аналитики ресторана

// Финансовые метрики
export interface FinancialMetrics {
  // Общие финансовые показатели
  totalRevenue: number;       // Общая выручка
  totalCost: number;          // Общие затраты
  grossProfit: number;        // Валовая прибыль
  profitMargin: number;       // Маржа прибыли в процентах
  averageOrderValue: number;  // Средний чек
  
  // Детализация по категориям
  revenueByCategory: Record<number, number>; // Выручка по категориям блюд
  
  // Детализация по времени
  revenueByTimeOfDay: Record<string, number>; // Выручка по времени суток
  revenueByDayOfWeek: Record<string, number>; // Выручка по дням недели
  
  // Тренд выручки за период
  revenueTrend: { date: string; value: number }[];

  // Изменение показателей по сравнению с предыдущим периодом (в процентах)
  revenueChange?: number;
  profitChange?: number;
  averageOrderValueChange?: number;
  orderCountChange?: number;

  // Предыдущие показатели для сравнения
  previousRevenue?: number;
  previousProfit?: number;
  previousAverageOrderValue?: number;
  previousOrderCount?: number;

  // Количество заказов
  orderCount?: number;
  
  // Данные по месяцам для графиков
  revenueByMonth?: Record<string, number>;
  expensesByMonth?: Record<string, number>;
}

// Метрики по меню
export interface MenuMetrics {
  // Топ продаваемых блюд
  topSellingDishes: {
    dishId: number;
    dishName: string;
    salesCount: number;
    revenue: number;
    percentage: number; // Процент от общих продаж
  }[];
  
  // Самые прибыльные блюда
  mostProfitableDishes: {
    dishId: number;
    dishName: string;
    salesCount: number;
    revenue: number;
    percentage: number;
    costPrice: number;
    profit: number;
    profitMargin: number; // %
  }[];
  
  // Наименее продаваемые блюда
  leastSellingDishes: {
    dishId: number;
    dishName: string;
    salesCount: number;
    revenue: number;
    percentage: number;
  }[];
  
  // Среднее время приготовления (в минутах)
  averageCookingTime: number;
  
  // Популярность категорий (в процентах)
  categoryPopularity: Record<number, number>;
  
  // Тренды продаж по отдельным блюдам
  menuItemSalesTrend: Record<number, { date: string; value: number }[]>;
}

// Метрики по клиентам
export interface CustomerMetrics {
  // Общая информация
  totalCustomers: number;        // Всего клиентов
  newCustomers: number;          // Новые клиенты за период
  returningCustomers: number;    // Вернувшиеся клиенты
  customerRetentionRate: number; // Процент удержания клиентов
  averageVisitsPerCustomer: number; // Среднее количество посещений на клиента
  
  // Сегментация клиентов (в процентах)
  customerSegmentation: Record<string, number>;
  
  // Топ клиентов
  topCustomers: {
    userId: number;
    fullName: string;
    email: string;
    totalSpent: number;
    ordersCount: number;
    averageRating: number;
    lastVisit: string;
  }[];
  
  // Уровень удовлетворенности клиентов (средний рейтинг)
  customerSatisfaction: number;
  
  // Изменения в метриках (в процентах)
  newCustomersChange?: number;
  returnRateChange?: number;
  averageOrderValueChange?: number;
  
  // Процент возврата клиентов
  returnRate?: number;
  
  // Демографические данные клиентов
  customerDemographics?: {
    age?: Record<string, number>; // Возрастные группы и их процент
    gender?: Record<string, number>; // Гендерное распределение
    location?: Record<string, number>; // Распределение по локациям
  };
  
  // Распределение по времени посещений
  visitTimes?: Record<string, number>;
}

// Операционные метрики
export interface OperationalMetrics {
  // Время выполнения заказа
  averageOrderPreparationTime: number; // в минутах
  
  // Среднее время оборота стола
  averageTableTurnoverTime: number; // в минутах
  
  // Пиковые часы (% загруженности)
  peakHours: Record<string, number>;
  
  // Эффективность персонала
  staffEfficiency: Record<number, {
    userId: number;
    userName: string;
    ordersServed: number;
    averageOrderValue: number;
    averageServiceTime: number; // в минутах
    customerRating: number;
  }>;
  
  // Загруженность столиков (%)
  tableUtilization: Record<number, number>;
  
  // Статистика по статусам заказов (%)
  orderCompletionRates: Record<string, number>;
}

// Предиктивные метрики
export interface PredictiveMetrics {
  // Прогноз продаж
  salesForecast: { date: string; value: number }[];
  
  // Прогноз необходимых запасов
  inventoryForecast: Record<number, number>;
  
  // Потребность в персонале по дням/часам
  staffingNeeds: Record<string, Record<string, number>>;
  
  // Прогноз пиковых часов по дням недели
  peakTimePrediction: Record<string, string[]>;
  
  // Рекомендации по акциям
  suggestedPromotions: {
    dishId: number;
    dishName: string;
    reason: string;
    suggestedDiscount: number; // %
    potentialRevenue: number;
  }[];
}

// Фильтры для аналитики
export interface AnalyticsFilters {
  startDate?: string;
  endDate?: string;
  categoryId?: number;
  dishId?: number;
  userId?: number;
  orderStatus?: string;
  timeSlot?: string;
  dayOfWeek?: string;
  limit?: number;
} 