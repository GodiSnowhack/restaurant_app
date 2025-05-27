import axios, { InternalAxiosRequestConfig, AxiosError, AxiosResponse } from 'axios';
import { 
  FinancialMetrics, 
  CustomerMetrics,
  OperationalMetrics,
  AnalyticsFilters
} from '../../types/analytics';
import { api } from './core';

// Добавляем недостающие интерфейсы
interface MenuMetrics {
  topSellingDishes: Array<{
    dishId: number;
    dishName: string;
    salesCount: number;
    revenue: number;
    profitMargin: number;
  }>;
  mostProfitableDishes: Array<{
    dishId: number;
    dishName: string;
    salesCount: number;
    revenue: number;
    percentage: number;
    costPrice: number;
    profit: number;
    profitMargin: number;
  }>;
  leastSellingDishes: Array<{
    dishId: number;
    dishName: string;
    salesCount: number;
    revenue: number;
    percentage: number;
  }>;
  averageCookingTime: number;
  categoryPopularity: Record<string, number>;
  menuItemSalesTrend: Record<string, Array<{ date: string; value: number }>>;
  menuItemPerformance: Array<{
    dishId: number;
    dishName: string;
    salesCount: number;
    revenue: number;
    profitMargin: number;
  }>;
  categoryPerformance: Record<string, {
    salesPercentage: number;
    averageOrderValue: number;
    averageProfitMargin: number;
  }>;
  period: {
    startDate: string;
    endDate: string;
  };
}

interface PredictiveMetrics {
  salesForecast: Array<{
    date: string;
    value: number;
  }>;
  inventoryForecast: Record<string, any>;
  staffingNeeds: Record<string, Record<string, number>>;
  peakTimePrediction: Record<string, any>;
  suggestedPromotions: Array<{
    dishId: number;
    dishName: string;
    suggestedDiscount: number;
    potentialRevenue: number;
  }>;
  period: {
    startDate: string;
    endDate: string;
  };
}

export interface CustomerDemographics {
  age_groups: Record<string, number>;
  total_customers: number;
}

export interface AnalyticsData {
  // ... other fields ...
  customerDemographics: CustomerDemographics;
}

// Получаем базовый URL для API аналитики
const getAnalyticsBaseUrl = () => {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'https://backend-production-1a78.up.railway.app/api/v1';
  return `${baseUrl}/analytics`;
};

// Базовый URL для всех API аналитики
const API_BASE_URL = getAnalyticsBaseUrl();

// Настройка Axios для запросов аналитики
const analyticsAxios = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  },
  timeout: 20000, // Увеличиваем таймаут до 20 сек
  withCredentials: true,
  maxRedirects: 0 // Отключаем автоматические редиректы для предотвращения циклических редиректов
});

// Добавляем токен авторизации к каждому запросу
analyticsAxios.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Получение текущего диапазона дат
const getDefaultDateRange = () => {
  const today = new Date();
  const nextWeek = new Date(today);
  nextWeek.setDate(today.getDate() + 7);
  
  return {
    startDate: today.toISOString().split('T')[0],
    endDate: nextWeek.toISOString().split('T')[0]
  };
};

// Функция для преобразования параметров фильтрации в строку запроса
const buildQueryParams = (filters?: AnalyticsFilters): string => {
  if (!filters) {
    // Если фильтры не указаны, используем текущий период
    const defaultDates = getDefaultDateRange();
    const params = new URLSearchParams();
    params.append('startDate', defaultDates.startDate);
    params.append('endDate', defaultDates.endDate);
    return `?${params.toString()}`;
  }
  
  const params = new URLSearchParams();
  
  // Если дата начала не указана или некорректная, используем текущий период
  if (!filters.startDate || isNaN(Date.parse(filters.startDate))) {
    const defaultDates = getDefaultDateRange();
    params.append('startDate', defaultDates.startDate);
  } else {
    params.append('startDate', filters.startDate);
  }
  
  // Если дата окончания не указана или некорректная, используем текущий период
  if (!filters.endDate || isNaN(Date.parse(filters.endDate))) {
    const defaultDates = getDefaultDateRange();
    params.append('endDate', defaultDates.endDate);
  } else {
    params.append('endDate', filters.endDate);
  }
  
  // Добавляем остальные параметры
  if (filters.categoryId) params.append('categoryId', filters.categoryId.toString());
  if (filters.dishId) params.append('dishId', filters.dishId.toString());
  if (filters.userId) params.append('userId', filters.userId.toString());
  if (filters.orderStatus) params.append('orderStatus', filters.orderStatus);
  if (filters.timeSlot) params.append('timeSlot', filters.timeSlot);
  if (filters.dayOfWeek) params.append('dayOfWeek', filters.dayOfWeek);
  if (filters.limit) params.append('limit', filters.limit.toString());
  
  return params.toString() ? `?${params.toString()}` : '';
};

// Проверка периода дат на валидность и корректировка
const validateDateRange = (filters?: AnalyticsFilters): AnalyticsFilters => {
  // Если фильтры не переданы, возвращаем текущий период
  if (!filters) {
    return getDefaultDateRange();
  }
  
  const result = { ...filters };
  const defaultDates = getDefaultDateRange();
  
  // Проверяем дату начала
  if (!filters.startDate || isNaN(Date.parse(filters.startDate))) {
    console.warn('Некорректная дата начала или не указана, используем текущий период');
    result.startDate = defaultDates.startDate;
  }
  
  // Проверяем дату окончания
  if (!filters.endDate || isNaN(Date.parse(filters.endDate))) {
    console.warn('Некорректная дата окончания или не указана, используем текущий период');
    result.endDate = defaultDates.endDate;
  }
  
  // Проверяем, что дата начала не позже даты окончания
  if (result.startDate && result.endDate && 
      new Date(result.startDate).getTime() > new Date(result.endDate).getTime()) {
    console.warn('Дата начала позже даты окончания, меняем их местами');
    const temp = result.startDate;
    result.startDate = result.endDate;
    result.endDate = temp;
  }
  
  return result;
};

// Функция для получения аналитических данных
async function fetchAnalytics<T>(endpoint: string, filters?: AnalyticsFilters): Promise<T> {
  try {
    console.log(`[Analytics] Запрос данных для ${endpoint} с фильтрами:`, filters);

    // В режиме разработки или при недоступности API используем моковые данные
    if (process.env.NODE_ENV === 'development' || process.env.NEXT_PUBLIC_USE_MOCKS === 'true') {
      console.log('[Analytics] Используем моковые данные');
      return getMockData(endpoint);
    }

    const queryParams = buildQueryParams(filters);
    const url = `${getAnalyticsBaseUrl()}/${endpoint}${queryParams}`;
    
    console.log(`[Analytics] Отправка запроса на ${url}`);
    
    try {
      const response = await api.get<T>(url);
      return response.data;
    } catch (error) {
      console.error(`[Analytics] Ошибка при запросе к ${url}:`, error);
      console.log('[Analytics] Возвращаем моковые данные из-за ошибки');
      return getMockData(endpoint);
    }
  } catch (error) {
    console.error('[Analytics] Критическая ошибка:', error);
    return getMockData(endpoint);
  }
}

// Экспортируем функцию для доступа к мок-данным из других модулей
export function getMockDataForTesting(endpoint: string): any {
  return getMockData(endpoint);
}

// Функция для получения мок-данных в случае ошибки API
function getMockData(endpoint: string): any {
  console.log(`Возвращаем заглушку для ${endpoint}`);
  
  const defaultDateRange = getDefaultDateRange();
  
  // Базовые заглушки для каждого типа данных
  const mockData: Record<string, any> = {
    dashboard: {
      summary: {
        totalRevenue: 1250000,
        totalOrders: 357,
        averageCheck: 3500,
        customersCount: 320
      },
      period: defaultDateRange
    },
    
    financial: {
      totalRevenue: 1250000,
      totalCost: 750000,
      grossProfit: 500000,
      profitMargin: 40,
      averageOrderValue: 3500,
      orderCount: 357,
      revenueByCategory: {
        1: 350000,
        2: 280000,
        3: 210000,
        4: 170000,
        5: 140000
      },
      revenueByMonth: {
        'Январь': 290000,
        'Февраль': 310000,
        'Март': 350000,
        'Апрель': 300000
      },
      expensesByMonth: {
        'Январь': 190000,
        'Февраль': 180000,
        'Март': 200000,
        'Апрель': 180000
      },
      averageOrderValueByDay: {
        '2025-04-25': 3450,
        '2025-04-26': 3520,
        '2025-04-27': 3480,
        '2025-04-28': 3550,
        '2025-04-29': 3600,
        '2025-04-30': 3520,
        '2025-05-01': 3480,
        '2025-05-02': 3520
      },
      revenueChange: 5.8,
      profitChange: 7.2,
      averageOrderValueChange: 3.5,
      orderCountChange: 12.4,
      previousRevenue: 1180000,
      previousProfit: 480000,
      previousAverageOrderValue: 3380,
      previousOrderCount: 318,
      period: defaultDateRange
    },
    
    menu: {
      topSellingDishes: [
        { dishId: 1, dishName: "Бургер Классический", salesCount: 85, revenue: 212500, profitMargin: 40 },
        { dishId: 2, dishName: "Пицца Маргарита", salesCount: 78, revenue: 195000, profitMargin: 38 },
        { dishId: 3, dishName: "Карбонара", salesCount: 70, revenue: 175000, profitMargin: 36 },
        { dishId: 4, dishName: "Цезарь с курицей", salesCount: 62, revenue: 155000, profitMargin: 34 },
        { dishId: 5, dishName: "Стейк Рибай", salesCount: 54, revenue: 270000, profitMargin: 42 }
      ],
      
      mostProfitableDishes: [
        { dishId: 5, dishName: "Стейк Рибай", salesCount: 54, revenue: 270000, percentage: 10.8, costPrice: 156600, profit: 113400, profitMargin: 42 },
        { dishId: 9, dishName: "Тирамису", salesCount: 35, revenue: 87500, percentage: 3.5, costPrice: 47250, profit: 40250, profitMargin: 46 },
        { dishId: 8, dishName: "Суши-сет", salesCount: 38, revenue: 190000, percentage: 7.6, costPrice: 106400, profit: 83600, profitMargin: 44 },
        { dishId: 1, dishName: "Бургер Классический", salesCount: 85, revenue: 212500, percentage: 8.5, costPrice: 127500, profit: 85000, profitMargin: 40 },
        { dishId: 10, dishName: "Наполеон", salesCount: 32, revenue: 80000, percentage: 3.2, costPrice: 48000, profit: 32000, profitMargin: 40 }
      ],
      
      leastSellingDishes: [
        { dishId: 15, dishName: "Окрошка", salesCount: 12, revenue: 24000, percentage: 0.96 },
        { dishId: 16, dishName: "Тар-тар из говядины", salesCount: 15, revenue: 60000, percentage: 2.4 },
        { dishId: 17, dishName: "Паста с морепродуктами", salesCount: 18, revenue: 72000, percentage: 2.88 },
        { dishId: 18, dishName: "Фуа-гра", salesCount: 20, revenue: 120000, percentage: 4.8 },
        { dishId: 19, dishName: "Устрицы", salesCount: 22, revenue: 132000, percentage: 5.28 }
      ],
      
      averageCookingTime: 18,
      
      categoryPopularity: {
        "Горячие блюда": 40,
        "Супы": 15,
        "Салаты": 20,
        "Десерты": 15,
        "Напитки": 10
      },
      
      menuItemSalesTrend: {
        "Бургер Классический": [
          { date: '2023-05-20', value: 12 },
          { date: '2023-05-21', value: 14 },
          { date: '2023-05-22', value: 10 },
          { date: '2023-05-23', value: 15 },
          { date: '2023-05-24', value: 16 },
          { date: '2023-05-25', value: 18 },
          { date: '2023-05-26', value: 20 }
        ],
        "Пицца Маргарита": [
          { date: '2023-05-20', value: 10 },
          { date: '2023-05-21', value: 12 },
          { date: '2023-05-22', value: 14 },
          { date: '2023-05-23', value: 11 },
          { date: '2023-05-24', value: 9 },
          { date: '2023-05-25', value: 15 },
          { date: '2023-05-26', value: 17 }
        ]
      },
      
      menuItemPerformance: [
        { dishId: 1, dishName: "Бургер Классический", salesCount: 85, revenue: 212500, profitMargin: 40 },
        { dishId: 2, dishName: "Пицца Маргарита", salesCount: 78, revenue: 195000, profitMargin: 38 },
        { dishId: 3, dishName: "Карбонара", salesCount: 70, revenue: 175000, profitMargin: 36 },
        { dishId: 4, dishName: "Цезарь с курицей", salesCount: 62, revenue: 155000, profitMargin: 34 },
        { dishId: 5, dishName: "Стейк Рибай", salesCount: 54, revenue: 270000, profitMargin: 42 }
      ],
      
      categoryPerformance: {
        "Горячие блюда": {
          salesPercentage: 35.2,
          averageOrderValue: 5200,
          averageProfitMargin: 42
        },
        "Супы": {
          salesPercentage: 18.5,
          averageOrderValue: 2500,
          averageProfitMargin: 35
        },
        "Салаты": {
          salesPercentage: 15.7,
          averageOrderValue: 2200,
          averageProfitMargin: 38
        },
        "Десерты": {
          salesPercentage: 12.3,
          averageOrderValue: 1800,
          averageProfitMargin: 45
        },
        "Напитки": {
          salesPercentage: 18.3,
          averageOrderValue: 1200,
          averageProfitMargin: 60
        }
      },
      
      period: getDefaultDateRange()
    },
    
    customers: {
      totalCustomers: 1200,
      newCustomers: 180,
      returningCustomers: 420,
      customerRetentionRate: 35,
      returnRate: 35,
      averageVisitsPerCustomer: 2.8,
      customerSatisfaction: 4.2,
      foodRating: 4.3,
      serviceRating: 4.0,
      customerSegmentation: {},
      newCustomersChange: 12.5,
      returnRateChange: 3.2,
      averageOrderValueChange: 5.8,
      customerDemographics: {
        age_groups: {
          '18-24': 15,
          '25-34': 35,
          '35-44': 25,
          '45-54': 15,
          '55+': 10
        },
        total_customers: 1200
      },
      visitTimes: {
        'Утро (8-12)': 20,
        'Обед (12-16)': 40,
        'Вечер (16-20)': 30,
        'Ночь (20-24)': 10
      },
      topCustomers: [
        { userId: 1, fullName: "Иван Петров", email: "ivan@example.com", totalSpent: 58000, ordersCount: 12, averageRating: 4.8, lastVisit: "2025-04-25" },
        { userId: 2, fullName: "Анна Сидорова", email: "anna@example.com", totalSpent: 52000, ordersCount: 10, averageRating: 4.5, lastVisit: "2025-04-28" },
        { userId: 3, fullName: "Сергей Иванов", email: "sergey@example.com", totalSpent: 48000, ordersCount: 8, averageRating: 4.2, lastVisit: "2025-04-22" },
        { userId: 4, fullName: "Ольга Смирнова", email: "olga@example.com", totalSpent: 43000, ordersCount: 7, averageRating: 4.0, lastVisit: "2025-04-27" },
        { userId: 5, fullName: "Николай Козлов", email: "nikolay@example.com", totalSpent: 40000, ordersCount: 6, averageRating: 4.7, lastVisit: "2025-04-26" }
      ],
      period: defaultDateRange
    },
    
    operational: {
      averageOrderPreparationTime: 20.5,
      averageTableTurnoverTime: 62.0,
      tablesCount: 15,
      averageTableUtilization: 72,
      averageOrdersPerTable: 24,
      tableUtilization: {
        1: 85,
        2: 90,
        3: 75,
        4: 80,
        5: 95,
        6: 70,
        7: 65,
        8: 75,
        9: 80,
        10: 85,
        11: 55,
        12: 60,
        13: 45,
        14: 50,
        15: 65
      },
      peakHours: {
        '12:00': 100,
        '13:00': 95,
        '14:00': 90,
        '19:00': 85,
        '20:00': 80
      },
      staffEfficiency: {
        1: { name: "Анна", role: "Официант", averageServiceTime: 12.5, customersServed: 35, rating: 4.8 },
        2: { name: "Иван", role: "Официант", averageServiceTime: 14.8, customersServed: 28, rating: 4.5 },
        3: { name: "Мария", role: "Официант", averageServiceTime: 11.2, customersServed: 32, rating: 4.9 },
        4: { name: "Алексей", role: "Официант", averageServiceTime: 15.5, customersServed: 25, rating: 4.2 },
        5: { name: "Елена", role: "Официант", averageServiceTime: 13.0, customersServed: 30, rating: 4.6 },
        6: { name: "Дмитрий", role: "Повар", averageServiceTime: 18.5, dishesCooked: 60, rating: 4.7 },
        7: { name: "Светлана", role: "Повар", averageServiceTime: 17.0, dishesCooked: 55, rating: 4.8 },
        8: { name: "Николай", role: "Повар", averageServiceTime: 20.5, dishesCooked: 45, rating: 4.3 }
      },
      orderCompletionRates: {
        'В ожидании': 15.2,
        'В обработке': 22.8,
        'Готовится': 18.5,
        'Готов к выдаче': 12.0,
        'Завершён': 26.3,
        'Отменен': 5.2
      },
      period: defaultDateRange
    },
    
    predictive: {
      salesForecast: Array.from({ length: 7 }, (_, i) => {
        const date = new Date();
        date.setDate(date.getDate() + i);
        const isWeekend = date.getDay() === 0 || date.getDay() === 6;
        const baseValue = 350000;
        const randomFactor = Math.random() * 50000 - 25000;
        const weekendBonus = isWeekend ? 100000 : 0;
        
        return {
          date: date.toISOString().split('T')[0],
          value: Math.round(baseValue + randomFactor + weekendBonus)
        };
      }),
      
      inventoryForecast: {
        ingredients: [
          { name: 'Мясо', currentStock: 50, recommendedStock: 75, reorderPoint: 30 },
          { name: 'Овощи', currentStock: 80, recommendedStock: 100, reorderPoint: 40 },
          { name: 'Молочные продукты', currentStock: 60, recommendedStock: 80, reorderPoint: 35 }
        ],
        recommendations: [
          'Увеличить запас мяса на 25 кг',
          'Текущий запас овощей оптимален',
          'Заказать молочные продукты в течение 2 дней'
        ]
      },
      
      staffingNeeds: {
        'Понедельник': { 
          '10:00-14:00': { waiters: 3, cooks: 2 },
          '14:00-18:00': { waiters: 4, cooks: 3 },
          '18:00-22:00': { waiters: 5, cooks: 4 }
        },
        'Вторник': {
          '10:00-14:00': { waiters: 3, cooks: 2 },
          '14:00-18:00': { waiters: 4, cooks: 3 },
          '18:00-22:00': { waiters: 5, cooks: 4 }
        },
        'Среда': {
          '10:00-14:00': { waiters: 3, cooks: 2 },
          '14:00-18:00': { waiters: 4, cooks: 3 },
          '18:00-22:00': { waiters: 5, cooks: 4 }
        },
        'Четверг': {
          '10:00-14:00': { waiters: 4, cooks: 3 },
          '14:00-18:00': { waiters: 5, cooks: 4 },
          '18:00-22:00': { waiters: 6, cooks: 5 }
        },
        'Пятница': {
          '10:00-14:00': { waiters: 5, cooks: 4 },
          '14:00-18:00': { waiters: 6, cooks: 5 },
          '18:00-22:00': { waiters: 7, cooks: 6 }
        },
        'Суббота': {
          '10:00-14:00': { waiters: 6, cooks: 5 },
          '14:00-18:00': { waiters: 7, cooks: 6 },
          '18:00-22:00': { waiters: 8, cooks: 7 }
        },
        'Воскресенье': {
          '10:00-14:00': { waiters: 5, cooks: 4 },
          '14:00-18:00': { waiters: 6, cooks: 5 },
          '18:00-22:00': { waiters: 6, cooks: 5 }
        }
      },
      
      peakTimePrediction: {
        weekday: {
          'lunch': { start: '12:00', end: '14:00', expectedGuests: 80 },
          'dinner': { start: '18:00', end: '20:00', expectedGuests: 120 }
        },
        weekend: {
          'lunch': { start: '13:00', end: '15:00', expectedGuests: 100 },
          'dinner': { start: '19:00', end: '21:00', expectedGuests: 150 }
        }
      },
      
      suggestedPromotions: [
        {
          dishId: 5,
          dishName: "Стейк Рибай",
          suggestedDiscount: 15,
          potentialRevenue: 85000,
          reason: "Низкие продажи в будние дни"
        },
        {
          dishId: 12,
          dishName: "Салат Греческий",
          suggestedDiscount: 10,
          potentialRevenue: 42000,
          reason: "Повышение спроса на здоровую пищу"
        },
        {
          dishId: 8,
          dishName: "Суши-сет",
          suggestedDiscount: 20,
          potentialRevenue: 65000,
          reason: "Высокая конкуренция в сегменте"
        }
      ],
      
      period: getDefaultDateRange()
    }
  };
  
  // Пробуем получить данные по типу, иначе возвращаем финансовые данные как запасной вариант
  return mockData[endpoint] || 
         mockData['financial'] || 
         mockData['menu'] || 
         mockData['customers'] || 
         mockData['operational'] || 
         mockData['predictive'] || 
         mockData['dashboard'];
}

// API для аналитики
const analyticsApi = {
  async getFinancialMetrics(filters?: AnalyticsFilters): Promise<FinancialMetrics> {
    console.log('Запрашиваем финансовые метрики с фильтрами:', filters);
    return fetchAnalytics<FinancialMetrics>('financial', filters);
  },
  
  async getMenuMetrics(filters?: AnalyticsFilters): Promise<MenuMetrics> {
    console.log('Запрашиваем метрики меню с фильтрами:', filters);
    return fetchAnalytics<MenuMetrics>('menu', filters);
  },
  
  async getCustomerMetrics(filters?: AnalyticsFilters): Promise<CustomerMetrics> {
    try {
      // Запрашиваем базовые метрики клиентов
      const baseCustomerData = await fetchAnalytics<CustomerMetrics>('customers', filters);
      
      // Запрашиваем дополнительные данные из dashboard-stats
      let dashboardData: any = {};
      try {
        const response = await fetch('/api/admin/dashboard-stats', {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        });
        
        if (response.ok) {
          dashboardData = await response.json();
        }
      } catch (dashboardError) {
        console.error('Ошибка при получении данных dashboard-stats:', dashboardError);
      }
      
      // Обогащаем данные клиентов демографической информацией из dashboard-stats
      const enrichedCustomerData: CustomerMetrics = {
        ...baseCustomerData,
        customerDemographics: {
          ...baseCustomerData.customerDemographics,
          age_groups: dashboardData.customerDemographics?.age_groups || baseCustomerData.customerDemographics?.age_groups,
          total_customers: dashboardData.customerDemographics?.total_customers || baseCustomerData.customerDemographics?.total_customers
        },
        visitFrequency: dashboardData.visitFrequency || baseCustomerData.visitFrequency
      };
      
      return enrichedCustomerData;
    } catch (error) {
      console.error('Ошибка при получении метрик клиентов:', error);
      throw error;
    }
  },
  
  async getOperationalMetrics(filters?: AnalyticsFilters): Promise<OperationalMetrics> {
    console.log('Запрашиваем операционные метрики с фильтрами:', filters);
    return fetchAnalytics<OperationalMetrics>('operational', filters);
  },
  
  async getPredictiveMetrics(filters?: AnalyticsFilters): Promise<PredictiveMetrics> {
    console.log('Запрашиваем предиктивные метрики с фильтрами:', filters);
    return fetchAnalytics<PredictiveMetrics>('predictive', filters);
  },
  
  async getDashboardStats(): Promise<any> {
    return fetchAnalytics<any>('dashboard');
  },
  
  async getTopDishes(limit: number = 10): Promise<any> {
    return fetchAnalytics<any>('menu/top', { limit });
  },
  
  async getSalesStatistics(startDate?: string, endDate?: string): Promise<any> {
    return fetchAnalytics<any>('sales', { startDate, endDate });
  },
  
  async getRevenueByCategory(startDate?: string, endDate?: string): Promise<any> {
    return fetchAnalytics<any>('revenue/category', { startDate, endDate });
  }
};

export default analyticsApi; 