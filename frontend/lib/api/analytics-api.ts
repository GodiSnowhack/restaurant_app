import axios from 'axios';
import { 
  FinancialMetrics, 
  MenuMetrics, 
  CustomerMetrics, 
  OperationalMetrics, 
  PredictiveMetrics,
  AnalyticsFilters
} from '../../types/analytics';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// API сервис для аналитики ресторана
export const analyticsApi = {
  // Получение финансовых метрик
  async getFinancialMetrics(filters?: AnalyticsFilters): Promise<FinancialMetrics> {
    try {
      const response = await axios.get(`${API_URL}/api/v1/analytics/financial`, { params: filters });
      return response.data;
    } catch (error) {
      console.error('Ошибка при получении финансовых метрик:', error);
      // Возвращаем мок-данные для демонстрации
      return {
        totalRevenue: 1250000,
        totalCost: 750000,
        grossProfit: 500000,
        profitMargin: 40,
        averageOrderValue: 1500,
        revenueByCategory: {
          1: 300000,
          2: 450000,
          3: 250000,
          4: 150000,
          5: 100000
        },
        revenueByTimeOfDay: {
          '12-14': 250000,
          '14-16': 150000,
          '16-18': 200000,
          '18-20': 350000,
          '20-22': 300000
        },
        revenueByDayOfWeek: {
          'Понедельник': 150000,
          'Вторник': 120000,
          'Среда': 180000,
          'Четверг': 200000,
          'Пятница': 250000,
          'Суббота': 300000,
          'Воскресенье': 250000
        },
        revenueTrend: generateTimeSeriesData(30, 10000, 20000)
      };
    }
  },

  // Получение метрик по меню
  async getMenuMetrics(filters?: AnalyticsFilters): Promise<MenuMetrics> {
    try {
      const response = await axios.get(`${API_URL}/api/v1/analytics/menu`, { params: filters });
      return response.data;
    } catch (error) {
      console.error('Ошибка при получении метрик меню:', error);
      // Возвращаем мок-данные для демонстрации
      return {
        topSellingDishes: [
          { dishId: 1, dishName: 'Борщ', salesCount: 350, revenue: 105000, percentage: 15 },
          { dishId: 2, dishName: 'Стейк Рибай', salesCount: 280, revenue: 196000, percentage: 12 },
          { dishId: 3, dishName: 'Цезарь с курицей', salesCount: 250, revenue: 75000, percentage: 10 },
          { dishId: 4, dishName: 'Паста Карбонара', salesCount: 230, revenue: 69000, percentage: 9 },
          { dishId: 5, dishName: 'Тирамису', salesCount: 200, revenue: 60000, percentage: 8 }
        ],
        mostProfitableDishes: [
          { dishId: 2, dishName: 'Стейк Рибай', salesCount: 280, revenue: 196000, percentage: 12, costPrice: 98000, profit: 98000, profitMargin: 50 },
          { dishId: 7, dishName: 'Устрицы', salesCount: 150, revenue: 90000, percentage: 6, costPrice: 36000, profit: 54000, profitMargin: 60 },
          { dishId: 9, dishName: 'Лобстер на гриле', salesCount: 100, revenue: 110000, percentage: 4, costPrice: 55000, profit: 55000, profitMargin: 50 },
          { dishId: 8, dishName: 'Утка по-пекински', salesCount: 120, revenue: 72000, percentage: 5, costPrice: 36000, profit: 36000, profitMargin: 50 },
          { dishId: 12, dishName: 'Чизкейк Нью-Йорк', salesCount: 180, revenue: 54000, percentage: 7, costPrice: 16200, profit: 37800, profitMargin: 70 }
        ],
        leastSellingDishes: [
          { dishId: 20, dishName: 'Суп Том Ям', salesCount: 50, revenue: 15000, percentage: 2 },
          { dishId: 21, dishName: 'Паэлья', salesCount: 45, revenue: 18000, percentage: 1.8 },
          { dishId: 22, dishName: 'Гаспачо', salesCount: 40, revenue: 12000, percentage: 1.6 },
          { dishId: 23, dishName: 'Осьминог на гриле', salesCount: 35, revenue: 24500, percentage: 1.4 },
          { dishId: 24, dishName: 'Запеченный камамбер', salesCount: 30, revenue: 12000, percentage: 1.2 }
        ],
        averageCookingTime: 18,
        categoryPopularity: {
          1: 25, // Супы
          2: 30, // Основные блюда
          3: 15, // Салаты
          4: 20, // Десерты
          5: 10  // Напитки
        },
        menuItemSalesTrend: {
          1: generateTimeSeriesData(30, 8, 16),  // Борщ
          2: generateTimeSeriesData(30, 6, 12),  // Стейк Рибай
          3: generateTimeSeriesData(30, 5, 11),  // Цезарь с курицей
          4: generateTimeSeriesData(30, 5, 10),  // Паста Карбонара
          5: generateTimeSeriesData(30, 4, 9)    // Тирамису
        }
      };
    }
  },

  // Получение метрик по клиентам
  async getCustomerMetrics(filters?: AnalyticsFilters): Promise<CustomerMetrics> {
    try {
      const response = await axios.get(`${API_URL}/api/v1/analytics/customers`, { params: filters });
      return response.data;
    } catch (error) {
      console.error('Ошибка при получении метрик клиентов:', error);
      // Возвращаем мок-данные для демонстрации
      return {
        totalCustomers: 3500,
        newCustomers: 450,
        returningCustomers: 3050,
        customerRetentionRate: 87,
        averageVisitsPerCustomer: 3.5,
        customerSegmentation: {
          'Новые': 15,
          'Случайные': 25,
          'Регулярные': 45,
          'Лояльные': 15
        },
        topCustomers: [
          { userId: 101, fullName: 'Иван Петров', email: 'ivan@example.com', totalSpent: 45000, ordersCount: 25, averageRating: 4.8, lastVisit: '2023-05-10' },
          { userId: 102, fullName: 'Анна Сидорова', email: 'anna@example.com', totalSpent: 38000, ordersCount: 20, averageRating: 4.9, lastVisit: '2023-05-12' },
          { userId: 103, fullName: 'Петр Иванов', email: 'petr@example.com', totalSpent: 35000, ordersCount: 18, averageRating: 4.7, lastVisit: '2023-05-11' },
          { userId: 104, fullName: 'Елена Смирнова', email: 'elena@example.com', totalSpent: 32000, ordersCount: 16, averageRating: 4.6, lastVisit: '2023-05-05' },
          { userId: 105, fullName: 'Алексей Козлов', email: 'alexey@example.com', totalSpent: 30000, ordersCount: 15, averageRating: 4.8, lastVisit: '2023-05-08' }
        ],
        customerSatisfaction: 4.7
      };
    }
  },

  // Получение операционных метрик
  async getOperationalMetrics(filters?: AnalyticsFilters): Promise<OperationalMetrics> {
    try {
      const response = await axios.get(`${API_URL}/api/v1/analytics/operational`, { params: filters });
      return response.data;
    } catch (error) {
      console.error('Ошибка при получении операционных метрик:', error);
      // Возвращаем мок-данные для демонстрации
      return {
        averageOrderPreparationTime: 22,
        averageTableTurnoverTime: 95,
        peakHours: {
          '12-13': 70,
          '13-14': 85,
          '14-15': 75,
          '18-19': 80,
          '19-20': 95,
          '20-21': 90,
          '21-22': 65
        },
        staffEfficiency: {
          1: { userId: 1, userName: 'Сергей Иванов', ordersServed: 450, averageOrderValue: 1800, averageServiceTime: 35, customerRating: 4.8 },
          2: { userId: 2, userName: 'Ольга Петрова', ordersServed: 420, averageOrderValue: 1750, averageServiceTime: 38, customerRating: 4.7 },
          3: { userId: 3, userName: 'Алексей Сидоров', ordersServed: 410, averageOrderValue: 1950, averageServiceTime: 32, customerRating: 4.9 },
          4: { userId: 4, userName: 'Мария Кузнецова', ordersServed: 380, averageOrderValue: 1700, averageServiceTime: 40, customerRating: 4.6 },
          5: { userId: 5, userName: 'Дмитрий Соколов', ordersServed: 360, averageOrderValue: 1600, averageServiceTime: 42, customerRating: 4.5 }
        },
        tableUtilization: {
          1: 85,
          2: 80,
          3: 75,
          4: 90,
          5: 95,
          6: 70,
          7: 65,
          8: 85,
          9: 80,
          10: 70
        },
        orderCompletionRates: {
          'Принят': 100,
          'Готовится': 95,
          'Готов': 92,
          'Доставлен': 90,
          'Оплачен': 88,
          'Отменен': 12
        }
      };
    }
  },

  // Получение предиктивных метрик
  async getPredictiveMetrics(filters?: AnalyticsFilters): Promise<PredictiveMetrics> {
    try {
      const response = await axios.get(`${API_URL}/api/v1/analytics/predictive`, { params: filters });
      return response.data;
    } catch (error) {
      console.error('Ошибка при получении предиктивных метрик:', error);
      // Возвращаем мок-данные для демонстрации
      return {
        salesForecast: generateTimeSeriesData(30, 15000, 25000),
        inventoryForecast: {
          101: 50,  // Говядина (кг)
          102: 30,  // Свинина (кг)
          103: 25,  // Курица (кг)
          104: 20,  // Лосось (кг)
          105: 15,  // Креветки (кг)
          106: 40,  // Картофель (кг)
          107: 25,  // Помидоры (кг)
          108: 15   // Сыр (кг)
        },
        staffingNeeds: {
          'Понедельник': {
            '10-12': 3,
            '12-14': 5,
            '14-16': 4,
            '16-18': 3,
            '18-20': 6,
            '20-22': 5
          },
          'Вторник': {
            '10-12': 3,
            '12-14': 4,
            '14-16': 4,
            '16-18': 3,
            '18-20': 5,
            '20-22': 4
          },
          'Среда': {
            '10-12': 3,
            '12-14': 5,
            '14-16': 4,
            '16-18': 3,
            '18-20': 6,
            '20-22': 5
          },
          'Четверг': {
            '10-12': 4,
            '12-14': 5,
            '14-16': 4,
            '16-18': 4,
            '18-20': 7,
            '20-22': 6
          },
          'Пятница': {
            '10-12': 4,
            '12-14': 6,
            '14-16': 5,
            '16-18': 5,
            '18-20': 8,
            '20-22': 7
          },
          'Суббота': {
            '10-12': 5,
            '12-14': 7,
            '14-16': 6,
            '16-18': 6,
            '18-20': 9,
            '20-22': 8
          },
          'Воскресенье': {
            '10-12': 5,
            '12-14': 7,
            '14-16': 6,
            '16-18': 5,
            '18-20': 8,
            '20-22': 7
          }
        },
        peakTimePrediction: {
          'Понедельник': ['13:00-14:00', '19:00-20:00'],
          'Вторник': ['13:00-14:00', '19:00-20:00'],
          'Среда': ['13:00-14:00', '19:00-20:00'],
          'Четверг': ['13:00-14:00', '19:00-21:00'],
          'Пятница': ['13:00-14:00', '19:00-22:00'],
          'Суббота': ['13:00-15:00', '18:00-22:00'],
          'Воскресенье': ['12:00-15:00', '18:00-21:00']
        },
        suggestedPromotions: [
          { dishId: 20, dishName: 'Суп Том Ям', reason: 'Низкие продажи, высокая маржа', suggestedDiscount: 15, potentialRevenue: 25000 },
          { dishId: 21, dishName: 'Паэлья', reason: 'Низкие продажи, высокая маржа', suggestedDiscount: 10, potentialRevenue: 22000 },
          { dishId: 5, dishName: 'Тирамису', reason: 'Высокий спрос, возможность увеличения среднего чека', suggestedDiscount: 5, potentialRevenue: 35000 },
          { dishId: 12, dishName: 'Чизкейк Нью-Йорк', reason: 'Высокая маржа, комплиментарное предложение', suggestedDiscount: 10, potentialRevenue: 28000 },
          { dishId: 15, dishName: 'Домашнее вино', reason: 'Увеличение среднего чека', suggestedDiscount: 15, potentialRevenue: 40000 }
        ]
      };
    }
  }
};

// Вспомогательная функция для генерации временных рядов
function generateTimeSeriesData(days: number, min: number, max: number) {
  const data = [];
  const today = new Date();
  
  for (let i = 0; i < days; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() - (days - i));
    
    const value = Math.floor(Math.random() * (max - min + 1)) + min;
    
    data.push({
      date: date.toISOString().split('T')[0],
      value
    });
  }
  
  return data;
} 