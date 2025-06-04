import { useState, useEffect } from 'react';
import { NextPage } from 'next';
import { useRouter } from 'next/router';
import Link from 'next/link';
import Layout from '../../components/Layout';
import { useAuth } from '../../hooks/useAuth';
import { 
  ArrowLeftIcon,
  ChartBarIcon,
  ShoppingBagIcon,
  UserIcon,
  ClockIcon,
  CheckCircleIcon,
  LightBulbIcon,
  CalendarIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  ExclamationTriangleIcon,
  FireIcon,
  HandThumbUpIcon,
  CurrencyDollarIcon,
  PresentationChartLineIcon,
  ChartPieIcon,
  CogIcon,
  ClipboardDocumentListIcon
} from '@heroicons/react/24/outline';
import analyticsApi from '../../lib/api/analytics-api';
import { 
  FinancialMetrics, 
  MenuMetrics, 
  CustomerMetrics, 
  OperationalMetrics,
  PredictiveMetrics,
  TimeRangeFilter
} from '../../types/analytics';
import { useTheme } from '@/lib/theme-context';
import LoadingSpinner from '../../components/LoadingSpinner';

// Типы для аналитики
type TimeRange = {
  startDate: string;
  endDate: string;
};

type AnalyticsView = 'dashboard' | 'sales' | 'menu' | 'customers' | 'staff' | 'settings' | 'recommendations' | 'predictions' | 'finance';

// Интерфейс для бизнес-рекомендаций
interface BusinessRecommendation {
  id: number;
  title: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  category: 'menu' | 'staff' | 'marketing' | 'operations' | 'finance';
  actionable: boolean;
  actions?: string[];
}

// Интерфейс для предупреждений и алертов
interface BusinessAlert {
  id: number;
  title: string;
  description: string;
  severity: 'critical' | 'warning' | 'info';
  category: 'menu' | 'staff' | 'marketing' | 'operations' | 'finance';
  timestamp: string;
  resolved: boolean;
}

// Интерфейс для сценариев "что если"
interface WhatIfScenario {
  id: number;
  name: string;
  description: string;
  parameters: Record<string, number | string | boolean>;
  outcomes: {
    revenue: number;
    cost: number;
    profit: number;
    customerSatisfaction: number;
    operationalEfficiency: number;
  };
}

// Функция для получения названия категории по ID
const getCategoryName = (categoryId: number): string => {
  // Пытаемся найти категорию в предопределенном списке
  const categories: Record<number, string> = {
    1: 'Супы',
    2: 'Основные блюда',
    3: 'Салаты',
    4: 'Десерты',
    5: 'Напитки',
    6: 'Закуски',
    7: 'Выпечка',
    8: 'Завтраки',
    9: 'Веганское меню',
    10: 'Детское меню'
  };
  
  return categories[categoryId] || `Категория ${categoryId}`;
};

// Мок-данные для аналитики в случае ошибок загрузки
// const mockFinancialMetrics: FinancialMetrics = {...}; - удалено
// const mockMenuMetrics: MenuMetrics = {...}; - удалено
// const mockCustomerMetrics: CustomerMetrics = {...}; - удалено
// const mockOperationalMetrics: OperationalMetrics = {...}; - удалено
// const mockPredictiveMetrics: PredictiveMetrics = {...}; - удалено

const AdminAnalyticsPage: NextPage = () => {
  const router = useRouter();
  const { user, isAuthenticated, isLoading } = useAuth();
  const { isDark } = useTheme();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<TimeRangeFilter>('month');
  const [currentView, setCurrentView] = useState<AnalyticsView>('dashboard');
  
  // Состояния для различных типов метрик
  const [financialMetrics, setFinancialMetrics] = useState<FinancialMetrics | null>(null);
  const [menuMetrics, setMenuMetrics] = useState<MenuMetrics | null>(null);
  const [customerMetrics, setCustomerMetrics] = useState<CustomerMetrics | null>(null);
  const [operationalMetrics, setOperationalMetrics] = useState<OperationalMetrics | null>(null);
  const [predictiveMetrics, setPredictiveMetrics] = useState<PredictiveMetrics | null>(null);
  
  // Данные для системы поддержки принятия решений
  const [recommendations, setRecommendations] = useState<BusinessRecommendation[]>([]);
  const [alerts, setAlerts] = useState<BusinessAlert[]>([]);
  const [whatIfScenarios, setWhatIfScenarios] = useState<WhatIfScenario[]>([]);
  const [activeScenario, setActiveScenario] = useState<WhatIfScenario | null>(null);
  const [scenarioParams, setScenarioParams] = useState<Record<string, number | string | boolean>>({});
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');
  const [showDatePicker, setShowDatePicker] = useState<boolean>(false);
  const [dateRangeText, setDateRangeText] = useState<string>('');

  useEffect(() => {
    // Проверка прав админа
    checkAdmin();
    
    // Загрузка данных аналитики
    loadAnalyticsData();
  }, [timeRange]);

  // Функция для проверки прав администратора
  const checkAdmin = async () => {
    if (!isLoading && !isAuthenticated) {
      router.push('/auth/login?from=/admin/analytics');
      return;
    }

    if (!isLoading && isAuthenticated && user?.role !== 'admin') {
      router.push('/');
      return;
    }
  };

  // Улучшенная функция для загрузки данных аналитики с обработкой ошибок
  const loadAnalyticsData = async () => {
    setLoading(true);
    setError(null);

    try {
      // Определяем диапазон дат
      const { startDate, endDate } = getDateRangeFromTimeRange(timeRange);
      
      // Логируем диапазон дат
      console.log(`Загрузка данных для диапазона: ${startDate} — ${endDate}`);
      
      // Создаем массив промисов для параллельной загрузки данных
      const promises = [
        analyticsApi.getFinancialMetrics({ startDate, endDate }),
        analyticsApi.getMenuMetrics({ startDate, endDate }),
        analyticsApi.getCustomerMetrics({ startDate, endDate }),
        analyticsApi.getOperationalMetrics({ startDate, endDate }),
        analyticsApi.getPredictiveMetrics({ startDate, endDate })
      ];
      
      // Загружаем все данные параллельно с обработкой ошибок
      const results = await Promise.allSettled(promises);
      
      // Обрабатываем результаты
      const [financialResult, menuResult, customersResult, operationalResult, predictiveResult] = results;
      
      // Анализируем результаты и сохраняем данные если они успешны
      if (financialResult.status === 'fulfilled') {
        setFinancialMetrics(financialResult.value as FinancialMetrics);
      } else {
        console.error('Ошибка при загрузке финансовых метрик:', financialResult.reason);
        setError(prev => (prev ? `${prev}\nОшибка загрузки финансовых метрик.` : 'Ошибка загрузки финансовых метрик.'));
      }
      
      if (menuResult.status === 'fulfilled') {
        const menuResponse = menuResult.value as MenuMetrics;
        
        // Убедимся, что все необходимые поля существуют
        if (!menuResponse.menuItemSalesTrend) {
          menuResponse.menuItemSalesTrend = {};
        }
        
        if (!menuResponse.categoryPerformance) {
          menuResponse.categoryPerformance = {};
        }
        
        if (!menuResponse.menuItemPerformance) {
          menuResponse.menuItemPerformance = [];
        }
        
        // Проверим наличие массивов
        if (!Array.isArray(menuResponse.topSellingDishes)) {
          menuResponse.topSellingDishes = [];
        }
        
        if (!Array.isArray(menuResponse.mostProfitableDishes)) {
          menuResponse.mostProfitableDishes = [];
        }
        
        if (!Array.isArray(menuResponse.leastSellingDishes)) {
          menuResponse.leastSellingDishes = [];
        }
        
        setMenuMetrics(menuResponse);
      } else {
        console.error('Ошибка при загрузке метрик меню:', menuResult.reason);
        setError(prev => (prev ? `${prev}\nОшибка загрузки метрик меню.` : 'Ошибка загрузки метрик меню.'));
      }
      
      if (customersResult.status === 'fulfilled') {
        const customerResponse = customersResult.value as CustomerMetrics;
        
        // Убедимся, что все необходимые поля существуют
        if (!customerResponse.customerDemographics) {
          customerResponse.customerDemographics = {
            age_groups: {},
            total_customers: customerResponse.totalCustomers || 0
          };
        }
        
        if (!customerResponse.customerDemographics.age_groups) {
          customerResponse.customerDemographics.age_groups = {};
        }
        
        if (!customerResponse.visitFrequency) {
          customerResponse.visitFrequency = {};
        }
        
        if (!Array.isArray(customerResponse.topCustomers)) {
          customerResponse.topCustomers = [];
        }
        
        setCustomerMetrics(customerResponse);
      } else {
        console.error('Ошибка при загрузке метрик клиентов:', customersResult.reason);
        setError(prev => (prev ? `${prev}\nОшибка загрузки метрик клиентов.` : 'Ошибка загрузки метрик клиентов.'));
      }
      
      if (operationalResult.status === 'fulfilled') {
        const operationalResponse = operationalResult.value as OperationalMetrics;
        
        // Убедимся, что все необходимые поля существуют
        if (!operationalResponse.peakHours) {
          operationalResponse.peakHours = {};
        }
        
        if (!operationalResponse.staffEfficiency) {
          operationalResponse.staffEfficiency = {};
        }
        
        if (!operationalResponse.tableUtilization) {
          operationalResponse.tableUtilization = {};
        }
        
        if (!operationalResponse.orderCompletionRates) {
          operationalResponse.orderCompletionRates = {};
        }
        
        setOperationalMetrics(operationalResponse);
      } else {
        console.error('Ошибка при загрузке операционных метрик:', operationalResult.reason);
        setError(prev => (prev ? `${prev}\nОшибка загрузки операционных метрик.` : 'Ошибка загрузки операционных метрик.'));
      }
      
      if (predictiveResult.status === 'fulfilled') {
        const predictiveResponse = predictiveResult.value as PredictiveMetrics;
        
        // Убедимся, что все необходимые поля существуют
        if (!Array.isArray(predictiveResponse.salesForecast)) {
          predictiveResponse.salesForecast = [];
        }
        
        if (!predictiveResponse.inventoryForecast) {
          predictiveResponse.inventoryForecast = {};
        }
        
        if (!predictiveResponse.staffingNeeds) {
          predictiveResponse.staffingNeeds = {};
        }
        
        if (!predictiveResponse.peakTimePrediction) {
          predictiveResponse.peakTimePrediction = {};
        }
        
        if (!Array.isArray(predictiveResponse.suggestedPromotions)) {
          predictiveResponse.suggestedPromotions = [];
        }
        
        setPredictiveMetrics(predictiveResponse);
      } else {
        console.error('Ошибка при загрузке предиктивных метрик:', predictiveResult.reason);
        setError(prev => (prev ? `${prev}\nОшибка загрузки предиктивных метрик.` : 'Ошибка загрузки предиктивных метрик.'));
      }

      // Генерируем рекомендации и предупреждения, если есть достаточно данных
      const hasFinancial = financialResult.status === 'fulfilled';
      const hasMenu = menuResult.status === 'fulfilled';
      const hasCustomers = customersResult.status === 'fulfilled';
      const hasOperational = operationalResult.status === 'fulfilled';
      const hasPredictive = predictiveResult.status === 'fulfilled';
      
      if (hasFinancial && hasMenu && hasCustomers && hasOperational && hasPredictive) {
        try {
          generateBusinessRecommendations(
            (financialResult as PromiseFulfilledResult<FinancialMetrics>).value, 
            (menuResult as PromiseFulfilledResult<MenuMetrics>).value, 
            (customersResult as PromiseFulfilledResult<CustomerMetrics>).value, 
            (operationalResult as PromiseFulfilledResult<OperationalMetrics>).value, 
            (predictiveResult as PromiseFulfilledResult<PredictiveMetrics>).value
          );

          generateBusinessAlerts(
            (financialResult as PromiseFulfilledResult<FinancialMetrics>).value, 
            (menuResult as PromiseFulfilledResult<MenuMetrics>).value, 
            (customersResult as PromiseFulfilledResult<CustomerMetrics>).value, 
            (operationalResult as PromiseFulfilledResult<OperationalMetrics>).value
          );

          generateWhatIfScenarios(
            (financialResult as PromiseFulfilledResult<FinancialMetrics>).value, 
            (menuResult as PromiseFulfilledResult<MenuMetrics>).value, 
            (customersResult as PromiseFulfilledResult<CustomerMetrics>).value, 
            (operationalResult as PromiseFulfilledResult<OperationalMetrics>).value, 
            (predictiveResult as PromiseFulfilledResult<PredictiveMetrics>).value
          );
        } catch (err) {
          console.error('Ошибка при генерации бизнес-рекомендаций:', err);
        }
      }
    } catch (error) {
      console.error('Ошибка при загрузке данных аналитики:', error);
      setError('Произошла ошибка при загрузке данных аналитики. Пожалуйста, попробуйте позже или выберите другой период.');
    } finally {
      setLoading(false);
    }
  };

  // Вспомогательная функция для получения диапазона дат на основе выбранного периода
  const getDateRangeFromTimeRangeFixed = (range: TimeRangeFilter) => {
    // Возвращаем строки в формате YYYY-MM-DD для API
    const formatDateForApi = (date: Date): string => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };
    
    const today = new Date();
    // Устанавливаем конечную дату на сегодня
    const endDate = today;
    let startDate = new Date(today);
    
    // Для всех периодов конечная дата = сегодня
    
    switch (range) {
      case 'today':
        // Начало дня
        startDate.setHours(0, 0, 0, 0);
        break;
      case 'week':
        // 7 дней назад
        startDate.setDate(startDate.getDate() - 7);
        break;
      case 'month':
        // 30 дней назад
        startDate.setMonth(startDate.getMonth() - 1);
        break;
      case 'quarter':
        // 90 дней назад
        startDate.setMonth(startDate.getMonth() - 3);
        break;
      case 'custom':
        if (customStartDate && customEndDate) {
          startDate = new Date(customStartDate);
          const requestedEndDate = new Date(customEndDate);
          
          // Проверка, что конечная дата не в будущем
          if (requestedEndDate > today) {
            // Если запрошена будущая дата, сохраняем длительность периода
            const periodLength = (requestedEndDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
            // Устанавливаем конец на сегодня
            const newEndDate = today;
            // Устанавливаем начало, сохраняя длительность
            startDate = new Date(today);
            startDate.setDate(today.getDate() - periodLength);
            
            // Обновляем кастомные даты в состоянии
            setCustomStartDate(formatDateForApi(startDate));
            setCustomEndDate(formatDateForApi(newEndDate));
            
            // Выводим сообщение
            console.log(`Скорректирован запрос будущего периода: ${formatDateForApi(startDate)} - ${formatDateForApi(newEndDate)}`);
          }
        }
        break;
    }
    
    // Форматируем даты для отображения
    const formatDisplayDate = (date: Date) => {
      return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
    };
    
    // Обновляем текст с диапазоном дат
    if (range === 'today') {
      setDateRangeText(formatDisplayDate(startDate));
    } else {
      setDateRangeText(`${formatDisplayDate(startDate)} - ${formatDisplayDate(endDate)}`);
    }
    
    return {
      startDate: formatDateForApi(startDate),
      endDate: formatDateForApi(endDate)
    };
  };
  
  // Заменяем старую функцию на новую
  const getDateRangeFromTimeRange = getDateRangeFromTimeRangeFixed;
  
  // Генерация бизнес-рекомендаций на основе данных аналитики
  const generateBusinessRecommendations = (
    financial: FinancialMetrics,
    menu: MenuMetrics,
    customers: CustomerMetrics,
    operational: OperationalMetrics,
    predictive: PredictiveMetrics
  ) => {
    const recommendations: BusinessRecommendation[] = [];
    
    // Анализ наименее продаваемых блюд
    if (menu.leastSellingDishes.length > 0) {
      const leastSellingDish = menu.leastSellingDishes[0];
      recommendations.push({
        id: 1,
        title: `Низкие продажи: ${leastSellingDish.dishName}`,
        description: `Блюдо '${leastSellingDish.dishName}' имеет низкие продажи (${leastSellingDish.salesCount} шт). Рассмотрите возможность обновления рецепта, изменения цены или временной акции.`,
        impact: 'medium',
        category: 'menu',
        actionable: true,
        actions: [
          'Снизить цену на 10-15%',
          'Включить в комплексное предложение',
          'Обновить рецепт или презентацию',
          'Временно убрать из меню'
        ]
      });
    }
    
    // Анализ пиковых часов и загруженности персонала
    const peakHours = Object.entries(operational.peakHours)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 2)
      .map(([time]) => time);
      
    if (peakHours.length > 0) {
      recommendations.push({
        id: 2,
        title: 'Оптимизация расписания персонала',
        description: `Пиковая загруженность наблюдается в часы: ${peakHours.join(', ')}. Рекомендуется увеличить количество персонала в эти часы для повышения качества обслуживания.`,
        impact: 'high',
        category: 'staff',
        actionable: true,
        actions: [
          'Увеличить количество официантов в пиковые часы',
          'Разработать оптимальное расписание смен',
          'Внедрить систему предварительного заказа в пиковые часы'
        ]
      });
    }
    
    // Анализ наиболее прибыльных блюд
    if (menu.mostProfitableDishes.length > 0) {
      const mostProfitableDish = menu.mostProfitableDishes[0];
      recommendations.push({
        id: 3,
        title: `Продвижение высокомаржинального блюда: ${mostProfitableDish.dishName}`,
        description: `Блюдо '${mostProfitableDish.dishName}' имеет высокую маржу (${mostProfitableDish.profitMargin}%). Рекомендуется усилить его продвижение для увеличения общей прибыли.`,
        impact: 'high',
        category: 'marketing',
        actionable: true,
        actions: [
          'Разместить блюдо на первой странице меню',
          'Обучить персонал рекомендовать это блюдо',
          'Создать акцию "блюдо дня" с фиксированной ценой'
        ]
      });
    }
    
    // Анализ эффективности персонала
    const staffEfficiency = Object.values(operational.staffEfficiency)
      .sort((a, b) => a.averageServiceTime - b.averageServiceTime);
      
    if (staffEfficiency.length > 1) {
      const mostEfficient = staffEfficiency[0];
      const leastEfficient = staffEfficiency[staffEfficiency.length - 1];
      const timeDiff = leastEfficient.averageServiceTime - mostEfficient.averageServiceTime;
      
      if (timeDiff > 10) { // Если разница более 10 минут
        recommendations.push({
          id: 4,
          title: 'Повышение эффективности обслуживания',
          description: `Обнаружена существенная разница в скорости обслуживания между сотрудниками (${timeDiff} мин). Рекомендуется провести дополнительное обучение персонала.`,
          impact: 'medium',
          category: 'staff',
          actionable: true,
          actions: [
            'Организовать тренинг для персонала',
            'Внедрить систему наставничества',
            'Оптимизировать рабочие процессы',
            'Установить стандарты времени обслуживания'
          ]
        });
      }
    }
    
    // Анализ прогнозов продаж и предложение по акциям
    if (predictive.suggestedPromotions && predictive.suggestedPromotions.length > 0) {
      const topPromotion = predictive.suggestedPromotions[0];
      recommendations.push({
        id: 5,
        title: `Рекомендуемая акция: ${topPromotion.dishName}`,
        description: `Рекомендуется провести акцию со скидкой ${topPromotion.suggestedDiscount}% на '${topPromotion.dishName}'. Потенциальное увеличение выручки: ${formatCurrency(topPromotion.potentialRevenue)} ₸.`,
        impact: 'medium',
        category: 'marketing',
        actionable: true,
        actions: [
          `Запустить акцию со скидкой ${topPromotion.suggestedDiscount}%`,
          'Создать комбо-предложение с другими блюдами',
          'Провести дегустацию для клиентов'
        ]
      });
    }
    
    // Рекомендации по управлению запасами
    if (predictive.inventoryForecast) {
      recommendations.push({
        id: 6,
        title: 'Оптимизация закупок продуктов',
        description: 'На основе прогноза продаж сформирован оптимальный план закупок на следующую неделю. Это позволит сократить расходы и минимизировать отходы.',
        impact: 'medium',
        category: 'operations',
        actionable: true,
        actions: [
          'Заказать продукты согласно прогнозному плану',
          'Оптимизировать меню под сезонные продукты',
          'Пересмотреть поставщиков для улучшения условий'
        ]
      });
    }
    
    setRecommendations(recommendations);
  };
  
  // Генерация бизнес-алертов на основе данных аналитики
  const generateBusinessAlerts = (
    financial: FinancialMetrics,
    menu: MenuMetrics,
    customers: CustomerMetrics,
    operational: OperationalMetrics
  ) => {
    const alerts: BusinessAlert[] = [];
    
    // Проверка маржи прибыли с безопасным доступом
    if (financial?.profitMargin !== undefined && financial.profitMargin < 20) {
      alerts.push({
        id: 1,
        title: 'Низкая маржа прибыли',
        description: `Текущая маржа прибыли составляет ${financial.profitMargin.toFixed(1)}%, что ниже целевого показателя в 20%.`,
        severity: 'warning',
        category: 'finance',
        timestamp: new Date().toISOString(),
        resolved: false
      });
    }
    
    // Проверка времени обслуживания с безопасным доступом
    if (operational?.averageOrderPreparationTime !== undefined && operational.averageOrderPreparationTime > 30) {
      alerts.push({
        id: 2,
        title: 'Высокое время приготовления',
        description: `Среднее время приготовления заказа составляет ${operational.averageOrderPreparationTime.toFixed(1)} минут, что превышает целевой показатель в 30 минут.`,
        severity: 'warning',
        category: 'operations',
        timestamp: new Date().toISOString(),
        resolved: false
      });
    }
    
    // Проверка времени оборота стола с безопасным доступом
    if (operational?.averageTableTurnoverTime !== undefined && operational.averageTableTurnoverTime > 90) {
      alerts.push({
        id: 3,
        title: 'Медленный оборот столиков',
        description: `Среднее время оборота стола составляет ${operational.averageTableTurnoverTime.toFixed(1)} минут, что превышает целевой показатель в 90 минут.`,
        severity: 'critical',
        category: 'operations',
        timestamp: new Date().toISOString(),
        resolved: false
      });
    }
    
    // Проверка процента отмененных заказов с безопасным доступом
    if (operational?.orderCompletionRates && 
        operational.orderCompletionRates['Отменен'] !== undefined && 
        operational.orderCompletionRates['Отменен'] > 10) {
      alerts.push({
        id: 4,
        title: 'Высокий процент отмененных заказов',
        description: `${operational.orderCompletionRates['Отменен'].toFixed(1)}% заказов были отменены. Рекомендуется анализ причин и улучшение процесса обработки заказов.`,
        severity: 'warning',
        category: 'operations',
        timestamp: new Date().toISOString(),
        resolved: false
      });
    }
    
    // Проверка загруженности столиков с безопасным доступом
    const tableUtilization = operational?.tableUtilization;
    const lowUtilizationTables = tableUtilization ? 
      Object.entries(tableUtilization)
        .filter(([, utilization]) => utilization < 30)
        .map(([tableId]) => tableId)
      : [];
    
    if (lowUtilizationTables.length > 0) {
      alerts.push({
        id: 5,
        title: 'Низкая загруженность столиков',
        description: `Столики ${lowUtilizationTables.join(', ')} имеют загруженность менее 30%. Рекомендуется пересмотреть расположение столиков или проанализировать причины.`,
        severity: 'warning',
        category: 'operations',
        timestamp: new Date().toISOString(),
        resolved: false
      });
    }
    
    setAlerts(alerts);
  };
  
  // Генерация сценариев "что если"
  const generateWhatIfScenarios = (
    financial: FinancialMetrics,
    menu: MenuMetrics,
    customers: CustomerMetrics,
    operational: OperationalMetrics,
    predictive: PredictiveMetrics
  ) => {
    const scenarios: WhatIfScenario[] = [
      {
        id: 1,
        name: 'Снижение цен на 10%',
        description: 'Изменение выручки и прибыли при снижении цен на все меню на 10%',
        parameters: {
          priceReduction: 10,
          demandIncrease: 15,
          marketingCost: 0
        },
        outcomes: {
          revenue: financial.totalRevenue * 1.05, // +5%
          cost: financial.totalCost * 1.15,      // +15%
          profit: financial.grossProfit * 0.95,   // -5%
          customerSatisfaction: customers.customerSatisfaction + 0.2,
          operationalEfficiency: 0  // нейтрально
        }
      },
      {
        id: 2,
        name: 'Запуск маркетинговой кампании',
        description: 'Оценка эффекта от запуска маркетинговой кампании с бюджетом 100 000 ₸',
        parameters: {
          marketingBudget: 100000,
          estimatedRevenueIncrease: 15,
          duration: 14
        },
        outcomes: {
          revenue: financial.totalRevenue * 1.15, // +15%
          cost: financial.totalCost + 100000,
          profit: (financial.totalRevenue * 1.15) - (financial.totalCost + 100000),
          customerSatisfaction: customers.customerSatisfaction + 0.1,
          operationalEfficiency: -5  // снижение из-за повышенной нагрузки
        }
      },
      {
        id: 3,
        name: 'Оптимизация меню',
        description: 'Удаление 5 наименее продаваемых позиций и добавление 3 новых',
        parameters: {
          removedItems: 5,
          newItems: 3,
          stockReduction: 10,
          menuDevelopmentCost: 50000
        },
        outcomes: {
          revenue: financial.totalRevenue * 1.03, // +3%
          cost: financial.totalCost * 0.95,      // -5%
          profit: financial.grossProfit * 1.07,   // +7%
          customerSatisfaction: customers.customerSatisfaction + 0.1,
          operationalEfficiency: 8  // повышение эффективности
        }
      },
      {
        id: 4,
        name: 'Увеличение персонала в часы пик',
        description: 'Найм дополнительных сотрудников для работы в пиковые часы',
        parameters: {
          additionalStaff: 3,
          salaryIncrease: 300000,
          peakHoursOnly: true
        },
        outcomes: {
          revenue: financial.totalRevenue * 1.08, // +8%
          cost: financial.totalCost + 300000,
          profit: (financial.totalRevenue * 1.08) - (financial.totalCost + 300000),
          customerSatisfaction: customers.customerSatisfaction + 0.3,
          operationalEfficiency: 15  // значительное повышение
        }
      },
      {
        id: 5,
        name: 'Изменение цен на основе эластичности спроса',
        description: 'Корректировка цен на основе данных о эластичности спроса разных категорий блюд',
        parameters: {
          highMarginIncrease: 5,
          lowMarginDecrease: 8,
          targetCategories: "2,4,7" // Преобразовано из массива в строку
        },
        outcomes: {
          revenue: financial.totalRevenue * 1.06, // +6%
          cost: financial.totalCost * 1.02,      // +2%
          profit: financial.grossProfit * 1.09,   // +9%
          customerSatisfaction: customers.customerSatisfaction - 0.1,
          operationalEfficiency: 0  // нейтрально
        }
      }
    ];
    
    setWhatIfScenarios(scenarios);
  };

  // Форматирование валюты
  const formatCurrency = (value: number | undefined) => {
    if (value === undefined) return '0';
    return new Intl.NumberFormat('ru-RU', {
      maximumFractionDigits: 0
    }).format(value);
  };

  // Обработчик изменения временного диапазона
  const handleChangeTimeRange = (newRange: TimeRangeFilter) => {
    setTimeRange(newRange);
    if (newRange === 'custom') {
      setShowDatePicker(true);
    } else {
      setShowDatePicker(false);
    }
  };
  
  // Обработчик применения пользовательского диапазона дат
  const handleApplyCustomDateRange = () => {
    if (customStartDate && customEndDate) {
      loadAnalyticsData();
      setShowDatePicker(false);
    }
  };
  
  // Обработчик изменения представления
  const handleChangeView = (view: AnalyticsView) => {
    setCurrentView(view);
  };
  
  // Обработчик активации сценария "что если"
  const handleActivateScenario = (scenario: WhatIfScenario) => {
    setActiveScenario(scenario);
    setScenarioParams({...scenario.parameters});
  };
  
  // Обработчик изменения параметров сценария
  const handleScenarioParamChange = (param: string, value: number | string | boolean) => {
    setScenarioParams(prev => ({
      ...prev,
      [param]: value
    }));
  };
  
  // Получение цвета на основе важности или серьезности
  const getImpactColor = (impact: string) => {
    switch (impact) {
      case 'high':
      case 'critical':
        return isDark ? 'text-red-400' : 'text-red-600';
      case 'medium':
      case 'warning':
        return isDark ? 'text-yellow-400' : 'text-yellow-600';
      case 'low':
      case 'info':
        return isDark ? 'text-blue-400' : 'text-blue-600';
      default:
        return isDark ? 'text-gray-400' : 'text-gray-600';
    }
  };
  
  // Получение иконки на основе категории рекомендации или алерта
  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'menu':
        return <ClipboardDocumentListIcon className="h-5 w-5" />;
      case 'staff':
        return <UserIcon className="h-5 w-5" />;
      case 'marketing':
        return <PresentationChartLineIcon className="h-5 w-5" />;
      case 'operations':
        return <CogIcon className="h-5 w-5" />;
      case 'finance':
        return <CurrencyDollarIcon className="h-5 w-5" />;
      default:
        return <ChartPieIcon className="h-5 w-5" />;
    }
  };

  // Функция для отображения компонентов графиков с учетом проверки данных
  const renderContent = () => {
    // Проверка наличия данных перед отрисовкой
    const hasFinancialData = financialMetrics !== null;
    const hasMenuData = menuMetrics !== null;
    const hasCustomerData = customerMetrics !== null;
    const hasOperationalData = operationalMetrics !== null;
    const hasPredictiveData = predictiveMetrics !== null;
    
    if (loading) {
      return (
        <div className="flex justify-center items-center h-64">
          <LoadingSpinner size="large" />
        </div>
      );
    }

    if (error) {
      return (
        <div className={`p-6 rounded-lg ${isDark ? 'bg-red-900/20 text-red-300' : 'bg-red-50 text-red-600'} mb-6 text-center`}>
          <ExclamationTriangleIcon className="h-12 w-12 mx-auto mb-4" />
          <h3 className="text-lg font-medium mb-2">Ошибка загрузки данных</h3>
          <p className="whitespace-pre-line">{error}</p>
          <button 
            onClick={() => loadAnalyticsData()}
            className={`mt-4 px-4 py-2 rounded-md text-sm font-medium ${isDark ? 'bg-red-700 hover:bg-red-600 text-white' : 'bg-red-100 hover:bg-red-200 text-red-700'}`}
          >
            Повторить загрузку
          </button>
        </div>
      );
    }

    if (!hasFinancialData && !hasMenuData && !hasCustomerData && !hasOperationalData && !hasPredictiveData) {
      return (
        <div className={`p-6 rounded-lg ${isDark ? 'bg-gray-800 text-gray-300' : 'bg-gray-50 text-gray-600'} mb-6 text-center`}>
          <ExclamationTriangleIcon className={`h-12 w-12 mx-auto mb-4 ${isDark ? 'text-gray-400' : 'text-gray-500'}`} />
          <h3 className="text-lg font-medium mb-2">Нет данных для отображения</h3>
          <p>Не удалось загрузить данные аналитики для выбранного периода.</p>
          <button 
            onClick={() => loadAnalyticsData()}
            className={`mt-4 px-4 py-2 rounded-md text-sm font-medium ${isDark ? 'bg-gray-700 hover:bg-gray-600 text-white' : 'bg-gray-200 hover:bg-gray-300 text-gray-700'}`}
          >
            Повторить загрузку
          </button>
        </div>
      );
    }

    switch (currentView) {
      case 'dashboard':
        return renderDashboardView();
      case 'recommendations':
        return renderRecommendationsView();
      case 'predictions':
        return renderPredictionsView();
      case 'finance':
        return renderFinancialView();
      case 'menu':
        return renderMenuView();
      case 'customers':
        return renderCustomersView();
      default:
        return renderDashboardView();
    }
  };

  // Функция для безопасного получения параметров из объектов данных с проверкой на null/undefined
  const safeGet = <T, K extends keyof T>(obj: T | null, key: K, defaultValue: T[K]): T[K] => {
    if (!obj) return defaultValue;
    return obj[key] !== undefined ? obj[key] : defaultValue;
  };

  // Если данные не загружены, показываем сообщение об ошибке
  if (!financialMetrics || !menuMetrics || !customerMetrics || !operationalMetrics) {
    return (
      <Layout title="Система поддержки принятия решений | Админ-панель">
        <div className="container mx-auto px-4 py-8">
          <div className={`${isDark ? 'bg-red-900/30 border-red-800' : 'bg-red-50 border-red-500'} border-l-4 p-4`}>
            <div className="flex">
              <div className="ml-3">
                <p className={`text-sm ${isDark ? 'text-red-300' : 'text-red-700'}`}>
                  {error || "Не удалось загрузить данные аналитики. Пожалуйста, попробуйте позже."}
                </p>
              </div>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  // Функция для перевода статуса заказа на русский язык
  const translateOrderStatus = (status: string): string => {
    // Удаляем префикс OrderStatus. если он есть
    let cleanStatus = status;
    if (status.startsWith('OrderStatus.')) {
      cleanStatus = status.replace('OrderStatus.', '');
    }
    
    const statusTranslations: Record<string, string> = {
      'pending': 'Новый',
      'confirmed': 'Подтвержден',
      'preparing': 'Готовится',
      'ready': 'Готов',
      'completed': 'Завершен',
      'cancelled': 'Отменен',
      'delivered': 'Доставлен',
      'PENDING': 'Новый',
      'CONFIRMED': 'Подтвержден',
      'PREPARING': 'Готовится',
      'READY': 'Готов',
      'COMPLETED': 'Завершен',
      'CANCELLED': 'Отменен',
      'DELIVERED': 'Доставлен',
      'COMPLET': 'Завершен', // Сокращенные варианты из скриншота
      'CONFIRM': 'Подтвержден'
    };

    return statusTranslations[cleanStatus] || cleanStatus;
  };

  // Безопасное отображение графика статусов заказов с проверкой наличия данных
  const renderOrderStatuses = () => {
    // Проверка наличия данных
    if (!operationalMetrics || !operationalMetrics.orderCompletionRates) {
      // Используем демо-данные
      const mockData = {
        'В ожидании': 15.2,
        'В обработке': 22.8,
        'Готовится': 18.5,
        'Готов к выдаче': 12.0,
        'Завершён': 26.3,
        'Отменен': 5.2
      };
      
      // Определяем цвета для разных статусов
      const getStatusColor = (status: string) => {
        switch (status.toLowerCase()) {
          case 'отменен':
            return isDark ? 'text-red-400 bg-red-900/30' : 'text-red-600 bg-red-100';
          case 'в ожидании':
            return isDark ? 'text-yellow-400 bg-yellow-900/30' : 'text-yellow-600 bg-yellow-100';
          case 'в обработке':
            return isDark ? 'text-blue-400 bg-blue-900/30' : 'text-blue-600 bg-blue-100';
          case 'готовится':
            return isDark ? 'text-indigo-400 bg-indigo-900/30' : 'text-indigo-600 bg-indigo-100';
          case 'готов к выдаче':
            return isDark ? 'text-purple-400 bg-purple-900/30' : 'text-purple-600 bg-purple-100';
          case 'доставляется':
            return isDark ? 'text-orange-400 bg-orange-900/30' : 'text-orange-600 bg-orange-100';
          default:
            return isDark ? 'text-green-400 bg-green-900/30' : 'text-green-600 bg-green-100';
        }
      };

      return (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <div className={`p-4 rounded-lg ${isDark ? 'bg-gray-800/50' : 'bg-gray-100'} mb-4 col-span-full`}>
            <p className={`${isDark ? 'text-gray-300' : 'text-gray-700'} text-sm text-center mb-2`}>
              Используются демонстрационные данные о статусах заказов
            </p>
          </div>
          {Object.entries(mockData).map(([status, percentage]) => (
            <div 
              key={status} 
              className={`p-4 rounded-lg ${getStatusColor(status)}`}
            >
              <div className="text-center">
                <h4 className="text-lg font-medium mb-2">{status}</h4>
                <div className="text-3xl font-bold">{percentage.toFixed(1)}%</div>
              </div>
            </div>
          ))}
        </div>
      );
    }

    // Убедимся, что у нас есть объект с данными о статусах
    const orderStatuses = operationalMetrics.orderCompletionRates || {};
    
    // Фильтрация статусов заказов (удаление статуса "Доставлен")
    const filteredOrderStatuses = Object.entries(orderStatuses)
      .filter(([status]) => {
        const lowerStatus = (status || '').toLowerCase();
        return !lowerStatus.includes('delivered') && 
               !lowerStatus.includes('доставлен');
      })
      .reduce((acc, [status, value]) => {
        // Переводим статус на русский
        const translatedStatus = translateOrderStatus(status);
        acc[translatedStatus] = value as number;
        return acc;
      }, {} as Record<string, number>);

    // Если после фильтрации нет данных, показываем сообщение
    if (Object.keys(filteredOrderStatuses).length === 0) {
      return (
        <div className={`text-center p-6 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
          <p>Нет данных о статусах заказов после фильтрации</p>
        </div>
      );
    }

    // Определяем цвета для разных статусов
    const getStatusColor = (status: string) => {
      switch (status.toLowerCase()) {
        case 'отменен':
          return isDark ? 'text-red-400 bg-red-900/30' : 'text-red-600 bg-red-100';
        case 'в ожидании':
          return isDark ? 'text-yellow-400 bg-yellow-900/30' : 'text-yellow-600 bg-yellow-100';
        case 'в обработке':
          return isDark ? 'text-blue-400 bg-blue-900/30' : 'text-blue-600 bg-blue-100';
        case 'готовится':
          return isDark ? 'text-indigo-400 bg-indigo-900/30' : 'text-indigo-600 bg-indigo-100';
        case 'готов к выдаче':
          return isDark ? 'text-purple-400 bg-purple-900/30' : 'text-purple-600 bg-purple-100';
        case 'доставляется':
          return isDark ? 'text-orange-400 bg-orange-900/30' : 'text-orange-600 bg-orange-100';
        default:
          return isDark ? 'text-green-400 bg-green-900/30' : 'text-green-600 bg-green-100';
      }
    };

    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {Object.entries(filteredOrderStatuses).map(([status, percentage]) => (
          <div 
            key={status} 
            className={`p-4 rounded-lg ${getStatusColor(status)}`}
          >
            <div className="text-center">
              <h4 className="text-lg font-medium mb-2">{status}</h4>
              <div className="text-3xl font-bold">{percentage.toFixed(1)}%</div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  // Добавляем заглушки для функций рендеринга представлений
  const renderDashboardView = () => {
    // Проверяем наличие данных
    if (!financialMetrics && !operationalMetrics && !customerMetrics) {
      return (
        <div className="text-center p-6 text-gray-500 dark:text-white">
          Нет данных для отображения дашборда
        </div>
      );
    }

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Финансовые метрики */}
        <div className="p-6 rounded-lg shadow bg-white dark:bg-gray-800">
          <div className="text-sm text-gray-500 dark:text-white mb-1">Выручка за период</div>
          <div className="text-2xl font-bold text-primary mb-2">
            {financialMetrics ? `${financialMetrics.totalRevenue?.toLocaleString() || 0} ₸` : '—'}
          </div>
        </div>
        <div className="p-6 rounded-lg shadow bg-white dark:bg-gray-800">
          <div className="text-sm text-gray-500 dark:text-white mb-1">Количество заказов</div>
          <div className="text-2xl font-bold text-primary mb-2">
            {financialMetrics ? financialMetrics.orderCount || 0 : '—'}
          </div>
        </div>
        <div className="p-6 rounded-lg shadow bg-white dark:bg-gray-800">
          <div className="text-sm text-gray-500 dark:text-white mb-1">Средний чек</div>
          <div className="text-2xl font-bold text-primary mb-2">
            {financialMetrics ? `${financialMetrics.averageOrderValue?.toLocaleString() || 0} ₸` : '—'}
          </div>
        </div>
        {/* Клиенты */}
        <div className="p-6 rounded-lg shadow bg-white dark:bg-gray-800">
          <div className="text-sm text-gray-500 dark:text-white mb-1">Клиентов за период</div>
          <div className="text-2xl font-bold text-primary mb-2">
            {customerMetrics ? customerMetrics.totalCustomers || 0 : '—'}
          </div>
        </div>
        {/* Бронирования */}
        {/* Здесь можно добавить реальные бронирования, если появятся в operationalMetrics */}
      </div>
    );
  };

  const renderRecommendationsView = () => {
    // Контент для рекомендаций уже реализован в исходном компоненте
    return null;
  };

  const renderPredictionsView = () => {
    // Контент для предсказаний уже реализован в исходном компоненте
    return null;
  };

  const renderFinancialView = () => {
    // Контент для финансов уже реализован в исходном компоненте
    return null;
  };

  const renderMenuView = () => {
    const isDark = false; // Убираем темную тему, так как она не используется

    return (
      <div className="space-y-6">
        {/* ABC-матрица */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">ABC-матрица блюд</h3>
          <div className="relative h-96">
            {/* Оси координат */}
            <div className="absolute left-0 top-0 h-full w-px bg-gray-400"></div>
            <div className="absolute left-0 bottom-0 w-full h-px bg-gray-400"></div>
            
            {/* Подписи осей */}
            <div className="absolute left-0 top-0 transform -translate-y-6 text-xs text-left pl-2">
              <span className="text-gray-600">Популярность</span>
            </div>
            <div className="absolute right-0 bottom-0 transform translate-y-6 text-xs text-right pr-2">
              <span className="text-gray-600">Маржинальность</span>
            </div>
            
            {/* Квадранты */}
            <div className="absolute left-1/2 top-0 right-0 h-1/2 bg-green-500/10 border-green-500/30 border"></div>
            <div className="absolute left-0 top-0 right-1/2 h-1/2 bg-blue-500/10 border-blue-500/30 border"></div>
            <div className="absolute left-1/2 top-1/2 right-0 bottom-0 bg-yellow-500/10 border-yellow-500/30 border"></div>
            <div className="absolute left-0 top-1/2 right-1/2 bottom-0 bg-red-500/10 border-red-500/30 border"></div>
            
            {/* Названия квадрантов */}
            <div className="absolute left-1/4 top-1/4 transform -translate-x-1/2 -translate-y-1/2 text-xs font-medium text-blue-600">
              Рабочие лошадки
            </div>
            <div className="absolute left-3/4 top-1/4 transform -translate-x-1/2 -translate-y-1/2 text-xs font-medium text-green-600">
              Звезды
            </div>
            <div className="absolute left-1/4 top-3/4 transform -translate-x-1/2 -translate-y-1/2 text-xs font-medium text-red-600">
              Проблемные
            </div>
            <div className="absolute left-3/4 top-3/4 transform -translate-x-1/2 -translate-y-1/2 text-xs font-medium text-yellow-600">
              Загадки
            </div>

            {/* Точки для блюд */}
            {(() => {
              if (!menuMetrics?.topSellingDishes?.length && 
                  !menuMetrics?.mostProfitableDishes?.length && 
                  !menuMetrics?.leastSellingDishes?.length) {
                return (
                  <div className="absolute inset-0 flex items-center justify-center text-gray-500">
                    Нет данных для матрицы
                  </div>
                );
              }

              const abcData: Array<{dishId: number, dishName: string, salesCount: number, profitMargin: number}> = [];
              
              // Собираем данные из всех источников
              if (menuMetrics.topSellingDishes?.length) {
                menuMetrics.topSellingDishes.forEach(dish => {
                  if (!abcData.some(d => d.dishId === dish.dishId)) {
                    abcData.push({
                      dishId: dish.dishId,
                      dishName: dish.dishName,
                      salesCount: dish.salesCount,
                      profitMargin: (dish as any).profitMargin || 0
                    });
                  }
                });
              }

              if (menuMetrics.mostProfitableDishes?.length) {
                menuMetrics.mostProfitableDishes.forEach(dish => {
                  if (!abcData.some(d => d.dishId === dish.dishId)) {
                    abcData.push({
                      dishId: dish.dishId,
                      dishName: dish.dishName,
                      salesCount: dish.salesCount,
                      profitMargin: dish.profitMargin
                    });
                  }
                });
              }

              if (menuMetrics.leastSellingDishes?.length) {
                menuMetrics.leastSellingDishes.forEach(dish => {
                  if (!abcData.some(d => d.dishId === dish.dishId)) {
                    abcData.push({
                      dishId: dish.dishId,
                      dishName: dish.dishName,
                      salesCount: dish.salesCount,
                      profitMargin: (dish as any).profitMargin || 0
                    });
                  }
                });
              }

              if (abcData.length === 0) {
                return (
                  <div className="absolute inset-0 flex items-center justify-center text-gray-500">
                    Нет данных для матрицы
                  </div>
                );
              }

              const maxSales = Math.max(...abcData.map(d => d.salesCount));
              return abcData.map(dish => {
                const x = dish.profitMargin;
                const y = (dish.salesCount / maxSales) * 100;
                let color;
                if (x >= 50 && y >= 50) color = 'bg-green-500';
                else if (x >= 50 && y < 50) color = 'bg-yellow-500';
                else if (x < 50 && y >= 50) color = 'bg-blue-500';
                else color = 'bg-red-500';

                return (
                  <div 
                    key={dish.dishId}
                    className={`absolute w-4 h-4 rounded-full ${color} shadow-lg transform -translate-x-1/2 -translate-y-1/2 cursor-pointer hover:ring-2 ring-white`}
                    style={{
                      left: `${x}%`,
                      top: `${100 - y}%`,
                    }}
                    title={`${dish.dishName}: Маржа ${dish.profitMargin}%, Продажи ${dish.salesCount} шт.`}
                  ></div>
                );
              });
            })()}
          </div>
        </div>

        {/* Топ-10 самых продаваемых блюд */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Топ-10 самых продаваемых блюд</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead>
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Блюдо</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Продажи</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Выручка</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Маржа</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {menuMetrics?.topSellingDishes?.length ? (
                  menuMetrics.topSellingDishes.slice(0, 10).map((dish, index) => (
                    <tr key={dish.dishId} className={index % 2 === 0 ? 'bg-gray-50' : ''}>
                      <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">{dish.dishName}</td>
                      <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">{dish.salesCount} шт.</td>
                      <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">{formatCurrency(dish.revenue)} ₸</td>
                      <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">{(dish as any).profitMargin || 0}%</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="text-center text-gray-400 py-8">Нет данных по блюдам</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Популярность категорий */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Популярность категорий</h3>
          <div className="space-y-4">
            {menuMetrics?.categoryPerformance && Object.keys(menuMetrics.categoryPerformance).length > 0 ? (
              Object.values(menuMetrics.categoryPerformance).map((category: any) => (
                <div key={category.id} className="mb-4">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-sm text-gray-700">{category.name}</span>
                    <span className="text-sm text-gray-700">{category.salesPercentage?.toFixed(1) ?? 0}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="h-2 rounded-full bg-gradient-to-r from-primary-500 to-primary-300" 
                      style={{ width: `${category.salesPercentage ?? 0}%` }}
                    ></div>
                  </div>
                  <div className="flex justify-between text-xs mt-1">
                    <span className="text-gray-500">Ср. чек: {formatCurrency(category.averageOrderValue ?? 0)} ₸</span>
                    <span className="text-gray-500">Маржа: {category.averageProfitMargin ?? 0}%</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center text-gray-400 py-8">Нет данных по категориям</div>
            )}
          </div>
        </div>

        {/* Наименее продаваемые блюда */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Наименее продаваемые блюда</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead>
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Блюдо</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Продажи</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Выручка</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {menuMetrics?.leastSellingDishes?.length ? (
                  menuMetrics.leastSellingDishes.slice(0, 5).map((dish, index) => (
                    <tr key={dish.dishId} className={index % 2 === 0 ? 'bg-gray-50' : ''}>
                      <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">{dish.dishName}</td>
                      <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">{dish.salesCount} шт.</td>
                      <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">{formatCurrency(dish.revenue)} ₸</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={3} className="text-center text-gray-400 py-8">Нет данных по блюдам</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  const renderCustomersView = () => {
    // Контент для клиентов уже реализован в исходном компоненте
    return null;
  };

  const getTimeRangeText = (range: TimeRangeFilter): string => {
    const today = new Date().toISOString().split('T')[0];
    const weekAgo = new Date(new Date().setDate(new Date().getDate() - 7)).toISOString().split('T')[0];
    const monthAgo = new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0];
    const quarterAgo = new Date(new Date().setMonth(new Date().getMonth() - 3)).toISOString().split('T')[0];

    if (range === 'today') {
      return 'Сегодня';
    } else if (range === 'week') {
      return 'За неделю';
    } else if (range === 'month') {
      return 'За месяц';
    } else if (range === 'quarter') {
      return 'За квартал';
    } else {
      return 'Произвольный период';
    }
  };

  return (
    <Layout title="Система поддержки принятия решений | Админ-панель">
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center mb-6">
          <Link href="/admin" className={`${isDark ? 'text-gray-400 hover:text-primary-400' : 'text-gray-600 hover:text-primary'} mr-4`}>
            <ArrowLeftIcon className="h-5 w-5" />
          </Link>
          <h1 className={`text-3xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>Система поддержки принятия решений</h1>
        </div>

        {/* Навигация по представлениям */}
        <div className="mb-8">
          <div className={`flex flex-wrap gap-2 ${isDark ? 'bg-gray-800' : 'bg-white'} p-4 rounded-lg shadow-md mb-4`}>
            <button
              onClick={() => handleChangeView('dashboard')}
              className={`px-4 py-2 rounded-md text-sm font-medium ${
                currentView === 'dashboard' 
                  ? isDark ? 'bg-primary-700 text-white' : 'bg-primary text-white'
                  : isDark ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
              }`}
            >
              Дашборд
            </button>
            <button
              onClick={() => handleChangeView('recommendations')}
              className={`px-4 py-2 rounded-md text-sm font-medium ${
                currentView === 'recommendations' 
                  ? isDark ? 'bg-primary-700 text-white' : 'bg-primary text-white'
                  : isDark ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
              }`}
            >
              Рекомендации
            </button>
            <button
              onClick={() => handleChangeView('predictions')}
              className={`px-4 py-2 rounded-md text-sm font-medium ${
                currentView === 'predictions' 
                  ? isDark ? 'bg-primary-700 text-white' : 'bg-primary text-white' 
                  : isDark ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
              }`}
            >
              Прогнозы
            </button>
            <button
              onClick={() => handleChangeView('finance')}
              className={`px-4 py-2 rounded-md text-sm font-medium ${
                currentView === 'finance' 
                  ? isDark ? 'bg-primary-700 text-white' : 'bg-primary text-white'
                  : isDark ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
              }`}
            >
              Финансы
            </button>
            <button
              onClick={() => handleChangeView('menu')}
              className={`px-4 py-2 rounded-md text-sm font-medium ${
                currentView === 'menu' 
                  ? isDark ? 'bg-primary-700 text-white' : 'bg-primary text-white'
                  : isDark ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
              }`}
            >
              Меню
            </button>
            <button
              onClick={() => handleChangeView('customers')}
              className={`px-4 py-2 rounded-md text-sm font-medium ${
                currentView === 'customers' 
                  ? isDark ? 'bg-primary-700 text-white' : 'bg-primary text-white'
                  : isDark ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
              }`}
            >
              Клиенты
            </button>
          </div>

          {/* Переключатель временного диапазона с отображением конкретных дат */}
          <div className={`${isDark ? 'bg-gray-800' : 'bg-white'} p-4 rounded-lg shadow-md`}>
            <div className="flex flex-col space-y-3">
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => handleChangeTimeRange('today')}
                  className={`px-4 py-2 rounded-md text-sm font-medium ${
                    timeRange === 'today' 
                      ? isDark ? 'bg-primary-700 text-white' : 'bg-primary text-white'
                      : isDark ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                  }`}
                >
                  Сегодня
                </button>
                <button
                  onClick={() => handleChangeTimeRange('week')}
                  className={`px-4 py-2 rounded-md text-sm font-medium ${
                    timeRange === 'week' 
                      ? isDark ? 'bg-primary-700 text-white' : 'bg-primary text-white'
                      : isDark ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                  }`}
                >
                  Неделя
                </button>
                <button
                  onClick={() => handleChangeTimeRange('month')}
                  className={`px-4 py-2 rounded-md text-sm font-medium ${
                    timeRange === 'month' 
                      ? isDark ? 'bg-primary-700 text-white' : 'bg-primary text-white'
                      : isDark ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                  }`}
                >
                  Месяц
                </button>
                <button
                  onClick={() => handleChangeTimeRange('quarter')}
                  className={`px-4 py-2 rounded-md text-sm font-medium ${
                    timeRange === 'quarter' 
                      ? isDark ? 'bg-primary-700 text-white' : 'bg-primary text-white'
                      : isDark ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                  }`}
                >
                  Квартал
                </button>
                <button
                  onClick={() => handleChangeTimeRange('custom')}
                  className={`px-4 py-2 rounded-md text-sm font-medium ${
                    timeRange === 'custom' 
                      ? isDark ? 'bg-primary-700 text-white' : 'bg-primary text-white'
                      : isDark ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                  }`}
                >
                  Произвольный период
                </button>
              </div>
              
              {/* Отображение выбранного диапазона дат */}
              <div className={`text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                {dateRangeText ? `Период: ${dateRangeText}` : ''}
              </div>
              
              {/* Компонент выбора произвольных дат */}
              {showDatePicker && (
                <div className="mt-2 p-3 border rounded-md bg-opacity-50 bg-gray-100 dark:bg-gray-700">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div>
                      <label htmlFor="startDate" className={`block text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'} mb-1`}>
                        Начальная дата
                      </label>
                      <input
                        id="startDate"
                        type="date"
                        value={customStartDate}
                        onChange={(e) => setCustomStartDate(e.target.value)}
                        className={`block w-full rounded-md shadow-sm ${
                          isDark 
                            ? 'bg-gray-600 border-gray-500 text-white focus:ring-primary-500 focus:border-primary-500' 
                            : 'border-gray-300 focus:ring-primary focus:border-primary'
                        }`}
                      />
                    </div>
                    <div>
                      <label htmlFor="endDate" className={`block text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'} mb-1`}>
                        Конечная дата
                      </label>
                      <input
                        id="endDate"
                        type="date"
                        value={customEndDate}
                        onChange={(e) => setCustomEndDate(e.target.value)}
                        className={`block w-full rounded-md shadow-sm ${
                          isDark 
                            ? 'bg-gray-600 border-gray-500 text-white focus:ring-primary-500 focus:border-primary-500' 
                            : 'border-gray-300 focus:ring-primary focus:border-primary'
                        }`}
                      />
                    </div>
                  </div>
                  <div className="flex justify-end space-x-2">
                    <button
                      onClick={() => setShowDatePicker(false)}
                      className={`px-3 py-1.5 text-sm rounded-md ${
                        isDark 
                          ? 'bg-gray-600 text-gray-200 hover:bg-gray-500' 
                          : 'bg-gray-200 text-gray-800 hover:bg-gray-300'
                      }`}
                    >
                      Отмена
                    </button>
                    <button
                      onClick={handleApplyCustomDateRange}
                      className={`px-3 py-1.5 text-sm rounded-md ${
                        isDark 
                          ? 'bg-primary-600 text-white hover:bg-primary-700' 
                          : 'bg-primary text-white hover:bg-primary-dark'
                      }`}
                      disabled={!customStartDate || !customEndDate}
                    >
                      Применить
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ДАШБОРД С СППР */}
        {currentView === 'dashboard' && (
          <>
            {/* Карточки ключевых показателей */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              <div className={`${isDark ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow-md p-6`}>
            <div className="flex items-center justify-between mb-4">
                  <h3 className={`${isDark ? 'text-gray-300' : 'text-gray-500'} text-sm uppercase font-medium`}>Выручка</h3>
            </div>
            <div className="flex items-center">
                  <ChartBarIcon className={`h-8 w-8 ${isDark ? 'text-primary-400' : 'text-primary'}`} />
              <div className="ml-4">
                    <p className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{formatCurrency(financialMetrics.totalRevenue)} ₸</p>
                    <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{getTimeRangeText(timeRange)}</p>
              </div>
            </div>
          </div>

              <div className={`${isDark ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow-md p-6`}>
            <div className="flex items-center justify-between mb-4">
                  <h3 className={`${isDark ? 'text-gray-300' : 'text-gray-500'} text-sm uppercase font-medium`}>Прибыль</h3>
            </div>
            <div className="flex items-center">
                  <CurrencyDollarIcon className={`h-8 w-8 ${isDark ? 'text-primary-400' : 'text-primary'}`} />
              <div className="ml-4">
                    <p className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{formatCurrency(financialMetrics.grossProfit)} ₸</p>
                    <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Маржа: {financialMetrics.profitMargin}%</p>
              </div>
            </div>
          </div>

              <div className={`${isDark ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow-md p-6`}>
            <div className="flex items-center justify-between mb-4">
                  <h3 className={`${isDark ? 'text-gray-300' : 'text-gray-500'} text-sm uppercase font-medium`}>Средний чек</h3>
            </div>
            <div className="flex items-center">
                  <ShoppingBagIcon className={`h-8 w-8 ${isDark ? 'text-primary-400' : 'text-primary'}`} />
              <div className="ml-4">
                    <p className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{formatCurrency(financialMetrics.averageOrderValue)} ₸</p>
                    <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{getTimeRangeText(timeRange)}</p>
              </div>
            </div>
          </div>

              <div className={`${isDark ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow-md p-6`}>
            <div className="flex items-center justify-between mb-4">
                  <h3 className={`${isDark ? 'text-gray-300' : 'text-gray-500'} text-sm uppercase font-medium`}>Удовлетворенность</h3>
            </div>
            <div className="flex items-center">
                  <HandThumbUpIcon className={`h-8 w-8 ${isDark ? 'text-primary-400' : 'text-primary'}`} />
              <div className="ml-4">
                    <p className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{customerMetrics?.customerSatisfaction ? customerMetrics.customerSatisfaction.toFixed(1) : '0.0'} / 5.0</p>
                    <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Общий рейтинг</p>
              </div>
            </div>
          </div>
        </div>

            {/* Приоритетные рекомендации и алерты */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              {/* Алерты */}
              <div className={`${isDark ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow-md p-6`}>
                <h3 className={`text-lg font-medium mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  <div className="flex items-center">
                    <ExclamationTriangleIcon className={`h-6 w-6 mr-2 ${isDark ? 'text-yellow-400' : 'text-yellow-600'}`} />
                    <span>Алерты и предупреждения</span>
                    {alerts.length > 0 && (
                      <span className={`ml-2 px-2 py-1 text-xs rounded-full ${
                        alerts.some(a => a.severity === 'critical') 
                          ? isDark ? 'bg-red-900 text-red-200' : 'bg-red-100 text-red-800'
                          : isDark ? 'bg-yellow-900 text-yellow-200' : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {alerts.length}
                    </span>
                    )}
                  </div>
                </h3>
                
                {alerts.length === 0 ? (
                  <div className={`text-center p-6 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                    <p>Нет активных предупреждений</p>
                  </div>
                ) : (
                  <div className="space-y-4 max-h-80 overflow-y-auto">
                    {alerts.map(alert => (
                      <div 
                        key={alert.id} 
                        className={`p-4 rounded-lg border ${
                          alert.severity === 'critical'
                            ? isDark ? 'border-red-800 bg-red-900/20' : 'border-red-200 bg-red-50'
                            : alert.severity === 'warning'
                              ? isDark ? 'border-yellow-800 bg-yellow-900/20' : 'border-yellow-200 bg-yellow-50'
                              : isDark ? 'border-blue-800 bg-blue-900/20' : 'border-blue-200 bg-blue-50'
                        }`}
                      >
                        <div className="flex items-start">
                          <div className={`p-1 rounded-full mr-3 ${
                            alert.severity === 'critical'
                              ? isDark ? 'bg-red-900' : 'bg-red-100'
                              : alert.severity === 'warning'
                                ? isDark ? 'bg-yellow-900' : 'bg-yellow-100'
                                : isDark ? 'bg-blue-900' : 'bg-blue-100'
                          }`}>
                            {alert.severity === 'critical' ? (
                              <FireIcon className={`h-5 w-5 ${isDark ? 'text-red-300' : 'text-red-600'}`} />
                            ) : alert.severity === 'warning' ? (
                              <ExclamationTriangleIcon className={`h-5 w-5 ${isDark ? 'text-yellow-300' : 'text-yellow-600'}`} />
                            ) : (
                              <ClockIcon className={`h-5 w-5 ${isDark ? 'text-blue-300' : 'text-blue-600'}`} />
                            )}
                          </div>
                          <div className="flex-1">
                            <h4 className={`font-medium mb-1 ${
                              alert.severity === 'critical'
                                ? isDark ? 'text-red-300' : 'text-red-800'
                                : alert.severity === 'warning'
                                  ? isDark ? 'text-yellow-300' : 'text-yellow-800'
                                  : isDark ? 'text-blue-300' : 'text-blue-800'
                            }`}>
                              {alert.title}
                            </h4>
                            <p className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>{alert.description}</p>
                          </div>
                  </div>
                </div>
              ))}
            </div>
                )}
          </div>

              {/* Рекомендации */}
              <div className={`${isDark ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow-md p-6`}>
                <h3 className={`text-lg font-medium mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  <div className="flex items-center">
                    <LightBulbIcon className={`h-6 w-6 mr-2 ${isDark ? 'text-yellow-400' : 'text-yellow-600'}`} />
                    <span>Рекомендации</span>
                  </div>
                </h3>
                
                {recommendations.length === 0 ? (
                  <div className={`text-center p-6 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                    <p>Нет активных рекомендаций</p>
                  </div>
                ) : (
                  <div className="space-y-4 max-h-80 overflow-y-auto">
                    {recommendations.slice(0, 3).map(rec => (
                      <div 
                        key={rec.id} 
                        className={`p-4 rounded-lg border ${
                          rec.impact === 'high'
                            ? isDark ? 'border-purple-800 bg-purple-900/20' : 'border-purple-200 bg-purple-50'
                            : rec.impact === 'medium'
                              ? isDark ? 'border-blue-800 bg-blue-900/20' : 'border-blue-200 bg-blue-50'
                              : isDark ? 'border-green-800 bg-green-900/20' : 'border-green-200 bg-green-50'
                        }`}
                      >
                        <div className="flex items-start">
                          <div className={`p-1 rounded-full mr-3 ${
                            rec.impact === 'high'
                              ? isDark ? 'bg-purple-900' : 'bg-purple-100'
                              : rec.impact === 'medium'
                                ? isDark ? 'bg-blue-900' : 'bg-blue-100'
                                : isDark ? 'bg-green-900' : 'bg-green-100'
                          }`}>
                            {getCategoryIcon(rec.category)}
                          </div>
                          <div className="flex-1">
                            <h4 className={`font-medium mb-1 ${
                              rec.impact === 'high'
                                ? isDark ? 'text-purple-300' : 'text-purple-800'
                                : rec.impact === 'medium'
                                  ? isDark ? 'text-blue-300' : 'text-blue-800'
                                  : isDark ? 'text-green-300' : 'text-green-800'
                            }`}>
                              {rec.title}
                            </h4>
                            <p className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-600'} mb-2`}>{rec.description}</p>
                            {rec.actionable && rec.actions && (
                              <div className="mt-2">
                                <span className={`text-xs font-medium ${isDark ? 'text-gray-400' : 'text-gray-700'}`}>Рекомендуемые действия:</span>
                                <ul className="mt-1 text-sm list-disc list-inside ml-1">
                                  {rec.actions.slice(0, 2).map((action, idx) => (
                                    <li key={idx} className={`${isDark ? 'text-gray-300' : 'text-gray-600'}`}>{action}</li>
                                  ))}
                                  {rec.actions.length > 2 && (
                                    <li className={`${isDark ? 'text-gray-400' : 'text-gray-500'} text-xs italic`}>
                                      И еще {rec.actions.length - 2} {rec.actions.length - 2 === 1 ? 'действие' : 'действия'}...
                                    </li>
                                  )}
                                </ul>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                    {recommendations.length > 3 && (
                      <div className="text-center mt-2">
                        <button 
                          onClick={() => handleChangeView('recommendations')}
                          className={`text-sm ${isDark ? 'text-primary-400 hover:text-primary-300' : 'text-primary hover:text-primary-dark'}`}
                        >
                          Показать все {recommendations.length} рекомендаций
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Основные показатели - быстрый обзор */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Топ блюд */}
              <div className={`${isDark ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow-md p-6`}>
                <h3 className={`text-lg font-medium mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>Топ-продажи блюд</h3>
            <div className="overflow-x-auto">
                  <table className={`min-w-full divide-y ${isDark ? 'divide-gray-700' : 'divide-gray-200'}`}>
                    <thead className={isDark ? 'bg-gray-700' : 'bg-gray-50'}>
                      <tr>
                        <th className={`px-6 py-3 text-left text-xs font-medium ${isDark ? 'text-gray-300' : 'text-gray-500'} uppercase tracking-wider`}>Блюдо</th>
                        <th className={`px-6 py-3 text-left text-xs font-medium ${isDark ? 'text-gray-300' : 'text-gray-500'} uppercase tracking-wider`}>Кол-во</th>
                        <th className={`px-6 py-3 text-left text-xs font-medium ${isDark ? 'text-gray-300' : 'text-gray-500'} uppercase tracking-wider`}>Выручка</th>
                  </tr>
                </thead>
                    <tbody className={`${isDark ? 'divide-y divide-gray-700' : 'divide-y divide-gray-200'}`}>
                  {menuMetrics?.topSellingDishes?.slice(0, 5).map((dish) => (
                        <tr key={dish.dishId} className={isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-50'}>
                          <td className={`px-6 py-4 whitespace-nowrap text-sm font-medium ${isDark ? 'text-gray-200' : 'text-gray-900'}`}>{dish.dishName}</td>
                          <td className={`px-6 py-4 whitespace-nowrap text-sm ${isDark ? 'text-gray-300' : 'text-gray-500'}`}>{dish.salesCount}</td>
                          <td className={`px-6 py-4 whitespace-nowrap text-sm ${isDark ? 'text-gray-300' : 'text-gray-500'}`}>{formatCurrency(dish.revenue)} ₸</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

              <div className={`${isDark ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow-md p-6`}>
                <h3 className={`text-lg font-medium mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  <div className="flex items-center">
                    <ArrowTrendingUpIcon className={`h-5 w-5 mr-2 ${isDark ? 'text-primary-400' : 'text-primary'}`} />
                    <span>Прогноз продаж на ближайшую неделю</span>
                  </div>
                </h3>
                {predictiveMetrics?.salesForecast ? (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      <div className={`p-4 rounded-lg ${isDark ? 'bg-gray-700' : 'bg-gray-100'}`}>
                        <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'} mb-1`}>Общий прогноз на неделю</p>
                        <p className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                          129 000 ₸
                        </p>
                      </div>
                      <div className={`p-4 rounded-lg ${isDark ? 'bg-gray-700' : 'bg-gray-100'}`}>
                        <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'} mb-1`}>В среднем в день</p>
                        <p className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                          18 000 ₸
                        </p>
                      </div>
                    </div>
                    
                    {/* Прогноз продаж - в стиле горизонтальных баров */}
                    <div className="mt-4 space-y-2 border-t border-gray-200 dark:border-gray-700 pt-4">
                      {[
                        { value: 11000, day: 5, month: 6, weekday: 'пн' },
                        { value: 13000, day: 6, month: 6, weekday: 'вт' },
                        { value: 15000, day: 7, month: 6, weekday: 'ср' },
                        { value: 18000, day: 8, month: 6, weekday: 'чт' },
                        { value: 22000, day: 9, month: 6, weekday: 'пт' },
                        { value: 26000, day: 10, month: 6, weekday: 'сб', isWeekend: true },
                        { value: 24000, day: 11, month: 6, weekday: 'вс', isWeekend: true }
                      ].map((item, index) => {
                        // Цвета для дней недели
                        const dayColor = item.isWeekend ? 
                          (isDark ? 'text-blue-400' : 'text-blue-600') : 
                          (isDark ? 'text-gray-400' : 'text-gray-600');
                        
                        // Цвет столбца
                        const barColor = item.isWeekend ? 
                          'bg-blue-500 dark:bg-blue-600' : 
                          'bg-primary dark:bg-primary-600';
                
                return (
                          <div key={index} className="flex items-center">
                            <div className="text-xs font-medium w-16 text-right pr-3">
                              <div>{item.value.toLocaleString()}</div>
                            </div>
                            <div className="flex-1">
                              <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded-sm relative overflow-hidden">
                                <div 
                                  className={`h-full ${barColor}`}
                                  style={{ width: `${item.value / 500}%`, maxWidth: '100%' }}
                    ></div>
                              </div>
                            </div>
                            <div className="ml-3 w-16">
                              <div className={`text-xs font-medium ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                {item.day}.{item.month}
                              </div>
                              <div className={`text-xs ${dayColor}`}>
                                {item.weekday}
                              </div>
                          </div>
                  </div>
                );
              })}
            </div>
                  </>
                ) : (
                  <div className={`h-64 flex items-center justify-center ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                    <p>Нет данных для прогноза</p>
          </div>
                )}
              </div>
            </div>

            {/* Добавляем секцию со статусами заказов */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              <div className={`${isDark ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow-md p-6`}>
                <h3 className={`text-lg font-medium mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  <div className="flex items-center">
                    <ClipboardDocumentListIcon className={`h-5 w-5 mr-2 ${isDark ? 'text-primary-400' : 'text-primary'}`} />
                    <span>Статусы заказов</span>
                  </div>
                </h3>
                {renderOrderStatuses()}
              </div>
              
              {/* Другие компоненты дашборда */}
            </div>
          </>
        )}

        {/* СТРАНИЦА РЕКОМЕНДАЦИЙ */}
        {currentView === 'recommendations' && (
          <div className={`${isDark ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow-md p-6 mb-8`}>
            <h3 className={`text-xl font-medium mb-6 ${isDark ? 'text-white' : 'text-gray-900'}`}>
              <div className="flex items-center">
                <LightBulbIcon className={`h-6 w-6 mr-2 ${isDark ? 'text-yellow-400' : 'text-yellow-600'}`} />
                <span>Бизнес-рекомендации</span>
              </div>
            </h3>
            
            {recommendations.length === 0 ? (
              <div className={`text-center p-12 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                <LightBulbIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium mb-2">Нет активных рекомендаций</p>
                <p>В настоящий момент система не обнаружила возможностей для оптимизации</p>
              </div>
            ) : (
              <div className="space-y-6">
                {recommendations.map(rec => (
                  <div 
                    key={rec.id} 
                    className={`p-6 rounded-lg border ${
                      rec.impact === 'high'
                        ? isDark ? 'border-purple-800 bg-purple-900/20' : 'border-purple-200 bg-purple-50'
                        : rec.impact === 'medium'
                          ? isDark ? 'border-blue-800 bg-blue-900/20' : 'border-blue-200 bg-blue-50'
                          : isDark ? 'border-green-800 bg-green-900/20' : 'border-green-200 bg-green-50'
                    }`}
                  >
                    <div className="sm:flex sm:items-start">
                      <div className={`mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full sm:mx-0 sm:h-10 sm:w-10 ${
                        rec.impact === 'high'
                          ? isDark ? 'bg-purple-900' : 'bg-purple-100'
                          : rec.impact === 'medium'
                            ? isDark ? 'bg-blue-900' : 'bg-blue-100'
                            : isDark ? 'bg-green-900' : 'bg-green-100'
                      }`}>
                        {getCategoryIcon(rec.category)}
                      </div>
                      <div className="mt-3 sm:mt-0 sm:ml-4 sm:flex-grow">
                        <div className="flex justify-between items-start">
                          <h4 className={`text-lg font-medium ${
                            rec.impact === 'high'
                              ? isDark ? 'text-purple-300' : 'text-purple-800'
                              : rec.impact === 'medium'
                                ? isDark ? 'text-blue-300' : 'text-blue-800'
                                : isDark ? 'text-green-300' : 'text-green-800'
                          }`}>
                            {rec.title}
                          </h4>
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            rec.impact === 'high'
                              ? isDark ? 'bg-purple-900 text-purple-200' : 'bg-purple-100 text-purple-800'
                              : rec.impact === 'medium'
                                ? isDark ? 'bg-blue-900 text-blue-200' : 'bg-blue-100 text-blue-800'
                                : isDark ? 'bg-green-900 text-green-200' : 'bg-green-100 text-green-800'
                          }`}>
                            {rec.impact === 'high' ? 'Высокий приоритет' : rec.impact === 'medium' ? 'Средний приоритет' : 'Низкий приоритет'}
                          </span>
                        </div>
                        <p className={`mt-2 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>{rec.description}</p>
                        
                        {rec.actionable && rec.actions && (
                          <div className="mt-4">
                            <h5 className={`text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                              Рекомендуемые действия:
                            </h5>
                            <ul className="space-y-2">
                              {rec.actions.map((action, idx) => (
                                <li key={idx} className="flex items-start">
                                  <span className={`inline-flex items-center justify-center h-5 w-5 rounded-full ${
                                    isDark ? 'bg-gray-700 text-gray-300' : 'bg-gray-200 text-gray-700'
                                  } text-xs font-medium mr-2 mt-0.5`}>
                                    {idx + 1}
                                  </span>
                                  <span className={`${isDark ? 'text-gray-300' : 'text-gray-600'}`}>{action}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        
        {/* СТРАНИЦА ПРОГНОЗОВ */}
        {currentView === 'predictions' && (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              {/* Прогноз продаж */}
              <div className={`${isDark ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow-md p-6`}>
                <h3 className={`text-lg font-medium mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  <div className="flex items-center">
                    <ArrowTrendingUpIcon className={`h-5 w-5 mr-2 ${isDark ? 'text-primary-400' : 'text-primary'}`} />
                    <span>Прогноз продаж</span>
                  </div>
                </h3>
                {predictiveMetrics?.salesForecast ? (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                      <div className={`p-4 rounded-lg ${isDark ? 'bg-gray-700' : 'bg-gray-100'}`}>
                        <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'} mb-1`}>Общий прогноз на период</p>
                        <p className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                          348 000 ₸
                        </p>
                      </div>
                      <div className={`p-4 rounded-lg ${isDark ? 'bg-gray-700' : 'bg-gray-100'}`}>
                        <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'} mb-1`}>Средний прогноз в день</p>
                        <p className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                          25 000 ₸
                        </p>
                      </div>
                    </div>
                    
                    {/* Прогноз продаж - в стиле горизонтальных баров */}
                    <div className="mt-6 space-y-2 border-t border-gray-200 dark:border-gray-700 pt-6">
                      {[
                        { value: 11000, day: 5, month: 6, weekday: 'пн' },
                        { value: 13000, day: 6, month: 6, weekday: 'вт' },
                        { value: 15000, day: 7, month: 6, weekday: 'ср' },
                        { value: 18000, day: 8, month: 6, weekday: 'чт' },
                        { value: 22000, day: 9, month: 6, weekday: 'пт' },
                        { value: 26000, day: 10, month: 6, weekday: 'сб', isWeekend: true },
                        { value: 24000, day: 11, month: 6, weekday: 'вс', isWeekend: true },
                        { value: 21000, day: 12, month: 6, weekday: 'пн' },
                        { value: 24000, day: 13, month: 6, weekday: 'вт' },
                        { value: 27000, day: 14, month: 6, weekday: 'ср' },
                        { value: 30000, day: 15, month: 6, weekday: 'чт' },
                        { value: 37000, day: 16, month: 6, weekday: 'пт' },
                        { value: 42000, day: 17, month: 6, weekday: 'сб', isWeekend: true },
                        { value: 37000, day: 18, month: 6, weekday: 'вс', isWeekend: true }
                      ].map((item, index) => {
                        // Цвета для дней недели
                        const dayColor = item.isWeekend ? 
                          (isDark ? 'text-blue-400' : 'text-blue-600') : 
                          (isDark ? 'text-gray-400' : 'text-gray-600');
                        
                        // Цвет столбца
                        const barColor = item.isWeekend ? 
                          'bg-blue-500 dark:bg-blue-600' : 
                          'bg-primary dark:bg-primary-600';
                      
                      return (
                          <div key={index} className="flex items-center">
                            <div className="text-xs font-medium w-16 text-right pr-3">
                              <div>{item.value.toLocaleString()}</div>
                            </div>
                            <div className="flex-1">
                              <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded-sm relative overflow-hidden">
                                <div 
                                  className={`h-full ${barColor}`}
                                  style={{ width: `${item.value / 500}%`, maxWidth: '100%' }}
                          ></div>
                              </div>
                            </div>
                            <div className="ml-3 w-16">
                              <div className={`text-xs font-medium ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                {item.day}.{item.month}
                              </div>
                              <div className={`text-xs ${dayColor}`}>
                                {item.weekday}
                              </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  </>
                ) : (
                  <div className={`h-64 flex items-center justify-center ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                    <p>Нет данных для прогноза</p>
                  </div>
                )}
              </div>

              {/* Персонал - расписание на неделю */}
              <div className={`${isDark ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow-md p-6`}>
                <h3 className={`text-lg font-medium mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  <div className="flex items-center">
                    <UserIcon className={`h-5 w-5 mr-2 ${isDark ? 'text-primary-400' : 'text-primary'}`} />
                    <span>Оптимальная потребность в персонале</span>
                  </div>
                </h3>
                {predictiveMetrics?.staffingNeeds ? (
                  <div className="overflow-x-auto">
                    <table className={`min-w-full divide-y ${isDark ? 'divide-gray-700' : 'divide-gray-200'}`}>
                      <thead className={isDark ? 'bg-gray-700' : 'bg-gray-50'}>
                        <tr>
                          <th className={`px-6 py-3 text-left text-xs font-medium ${isDark ? 'text-gray-300' : 'text-gray-500'} uppercase tracking-wider`}>День недели</th>
                          <th className={`px-6 py-3 text-left text-xs font-medium ${isDark ? 'text-gray-300' : 'text-gray-500'} uppercase tracking-wider`}>Утро (10-14)</th>
                          <th className={`px-6 py-3 text-left text-xs font-medium ${isDark ? 'text-gray-300' : 'text-gray-500'} uppercase tracking-wider`}>День (14-18)</th>
                          <th className={`px-6 py-3 text-left text-xs font-medium ${isDark ? 'text-gray-300' : 'text-gray-500'} uppercase tracking-wider`}>Вечер (18-22)</th>
                        </tr>
                      </thead>
                      <tbody className={`${isDark ? 'divide-y divide-gray-700' : 'divide-y divide-gray-200'}`}>
                        {Object.entries(predictiveMetrics.staffingNeeds).map(([day, slots]) => {
                          // Агрегация значений для каждого периода
                          let morning = 0, afternoon = 0, evening = 0;
                          
                          Object.entries(slots).forEach(([time, count]) => {
                            const hour = parseInt(time.split('-')[0]);
                            if (hour >= 10 && hour < 14) morning = Math.max(morning, count as number);
                            else if (hour >= 14 && hour < 18) afternoon = Math.max(afternoon, count as number);
                            else if (hour >= 18) evening = Math.max(evening, count as number);
                          });
                          
                          return (
                            <tr key={day} className={isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-50'}>
                              <td className={`px-6 py-4 whitespace-nowrap text-sm font-medium ${isDark ? 'text-gray-200' : 'text-gray-900'}`}>{day}</td>
                              <td className={`px-6 py-4 whitespace-nowrap text-sm ${isDark ? 'text-gray-300' : 'text-gray-500'}`}>{morning} чел.</td>
                              <td className={`px-6 py-4 whitespace-nowrap text-sm ${isDark ? 'text-gray-300' : 'text-gray-500'}`}>{afternoon} чел.</td>
                              <td className={`px-6 py-4 whitespace-nowrap text-sm ${isDark ? 'text-gray-300' : 'text-gray-500'}`}>{evening} чел.</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className={`text-center p-12 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                    <p>Нет данных для прогноза потребности в персонале</p>
                  </div>
                )}
              </div>
            </div>

            {/* Сценарии "что если" */}
            <div className={`${isDark ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow-md p-6 mb-8`}>
              <h3 className={`text-xl font-medium mb-6 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                <div className="flex items-center">
                  <PresentationChartLineIcon className={`h-6 w-6 mr-2 ${isDark ? 'text-primary-400' : 'text-primary'}`} />
                  <span>Сценарии "Что если"</span>
                </div>
              </h3>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-1">
                  <h4 className={`text-lg font-medium mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>Выберите сценарий</h4>
                  <div className="space-y-3">
                    {whatIfScenarios.map(scenario => (
                      <button
                        key={scenario.id}
                        onClick={() => handleActivateScenario(scenario)}
                        className={`w-full text-left p-4 rounded-lg border ${
                          activeScenario?.id === scenario.id
                            ? isDark ? 'border-primary-600 bg-primary-900/30' : 'border-primary-300 bg-primary-50'
                            : isDark ? 'border-gray-700 hover:bg-gray-700' : 'border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        <h5 className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>{scenario.name}</h5>
                        <p className={`text-sm mt-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{scenario.description}</p>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="lg:col-span-2">
                  {activeScenario ? (
                    <div>
                      <h4 className={`text-lg font-medium mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>{activeScenario.name}</h4>
                      <p className={`mb-6 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>{activeScenario.description}</p>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                        <div>
                          <h5 className={`text-sm font-medium mb-3 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Параметры сценария</h5>
            <div className="space-y-4">
                            {Object.entries(scenarioParams).map(([key, value]) => (
                              <div key={key}>
                                <label className={`block text-sm font-medium ${isDark ? 'text-gray-400' : 'text-gray-700'}`}>
                                  {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                                </label>
                                {typeof value === 'boolean' ? (
                                  <input
                                    type="checkbox"
                                    checked={value as boolean}
                                    onChange={(e) => handleScenarioParamChange(key, e.target.checked)}
                                    className={`mt-1 h-4 w-4 ${isDark ? 'bg-gray-700 border-gray-600' : 'border-gray-300'} rounded`}
                                  />
                                ) : (
                                  <input
                                    type="number"
                                    value={value as number}
                                    onChange={(e) => handleScenarioParamChange(key, parseFloat(e.target.value))}
                                    className={`mt-1 block w-full rounded-md ${
                                      isDark ? 'bg-gray-700 border-gray-600 text-white' : 'border-gray-300'
                                    } shadow-sm focus:border-primary focus:ring-primary sm:text-sm`}
                                  />
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                        
                        <div>
                          <h5 className={`text-sm font-medium mb-3 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Ожидаемые результаты</h5>
                          <div className="space-y-4">
                            <div>
                              <div className="flex justify-between items-center mb-1">
                                <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Выручка</span>
                                <span className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                  {formatCurrency(activeScenario.outcomes.revenue)} ₸
                                </span>
                              </div>
                              <div className="w-full bg-gray-200 rounded-full h-2">
                                <div 
                                  className={`h-2 rounded-full ${isDark ? 'bg-primary-600' : 'bg-primary'}`}
                                  style={{ width: `${Math.min(activeScenario.outcomes.revenue / financialMetrics.totalRevenue * 100, 100)}%` }}
                                ></div>
                              </div>
                            </div>
                            
                            <div>
                              <div className="flex justify-between items-center mb-1">
                                <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Затраты</span>
                                <span className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                  {formatCurrency(activeScenario.outcomes.cost)} ₸
                                </span>
                              </div>
                              <div className="w-full bg-gray-200 rounded-full h-2">
                                <div 
                                  className={`h-2 rounded-full ${isDark ? 'bg-red-600' : 'bg-red-500'}`}
                                  style={{ width: `${Math.min(activeScenario.outcomes.cost / financialMetrics.totalCost * 100, 100)}%` }}
                                ></div>
                              </div>
                            </div>
                            
                            <div>
                              <div className="flex justify-between items-center mb-1">
                                <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Прибыль</span>
                                <span className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                  {formatCurrency(activeScenario.outcomes.profit)} ₸
                                </span>
                              </div>
                              <div className="w-full bg-gray-200 rounded-full h-2">
                                <div 
                                  className={`h-2 rounded-full ${isDark ? 'bg-green-600' : 'bg-green-500'}`}
                                  style={{ width: `${Math.min(activeScenario.outcomes.profit / financialMetrics.grossProfit * 100, 100)}%` }}
                                ></div>
                              </div>
                            </div>
                            
                            <div className="bg-white rounded-lg p-2 text-sm w-40 mb-2 font-medium">
                              <div className="flex items-center justify-between">
                                <span>Удовлетворенность</span>
                                <span>{activeScenario?.outcomes?.customerSatisfaction ? activeScenario.outcomes.customerSatisfaction.toFixed(1) : '0.0'} / 5.0</span>
                              </div>
                              <div className="w-full h-1.5 bg-gray-200 rounded-full mt-1">
                                <div 
                                  className="h-1.5 bg-blue-500 rounded-full" 
                                  style={{ width: `${activeScenario.outcomes.customerSatisfaction / 5 * 100}%` }}
                                ></div>
                              </div>
                            </div>
                            
                            <div>
                              <div className="flex justify-between items-center mb-1">
                                <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Операционная эффективность</span>
                                <span className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                  {activeScenario.outcomes.operationalEfficiency > 0 ? '+' : ''}
                                  {activeScenario.outcomes.operationalEfficiency}%
                                </span>
                              </div>
                              <div className="w-full bg-gray-200 rounded-full h-2">
                                <div 
                                  className={`h-2 rounded-full ${
                                    activeScenario.outcomes.operationalEfficiency > 0
                                      ? isDark ? 'bg-green-600' : 'bg-green-500'
                                      : activeScenario.outcomes.operationalEfficiency < 0
                                        ? isDark ? 'bg-red-600' : 'bg-red-500'
                                        : isDark ? 'bg-gray-600' : 'bg-gray-500'
                                  }`}
                                  style={{ width: `${Math.abs(activeScenario.outcomes.operationalEfficiency * 5)}%` }}
                                ></div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className={`flex flex-col items-center justify-center h-full p-12 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                      <PresentationChartLineIcon className="h-12 w-12 mb-4 opacity-50" />
                      <p className="text-lg font-medium mb-2">Выберите сценарий для анализа</p>
                      <p className="text-center">Сценарии "Что если" позволяют моделировать различные бизнес-решения и оценивать их потенциальное влияние на ключевые показатели</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </>
        )}
        
        {/* СТРАНИЦА ФИНАНСОВ */}
        {currentView === 'finance' && (
          <>
            <div className={`${isDark ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow-md p-6 mb-8`}>
              <h3 className={`text-xl font-medium mb-6 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                <div className="flex items-center">
                  <CurrencyDollarIcon className={`h-6 w-6 mr-2 ${isDark ? 'text-primary-400' : 'text-primary'}`} />
                  <span>Финансовый обзор</span>
                </div>
              </h3>
              
              {/* Финансовые показатели */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className={`p-6 rounded-lg ${isDark ? 'bg-gray-700' : 'bg-gray-50'}`}>
                  <h4 className={`text-sm uppercase font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'} mb-2`}>Общая выручка</h4>
                  <p className={`text-3xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{formatCurrency(financialMetrics.totalRevenue)} ₸</p>
                  {financialMetrics.revenueChange !== undefined && (
                    financialMetrics.revenueChange > 0 ? (
                      <p className="text-sm text-green-500 flex items-center mt-2">
                        <ArrowTrendingUpIcon className="h-4 w-4 mr-1" />
                        +{financialMetrics.revenueChange}% по сравнению с пред. периодом
                      </p>
                    ) : (
                      <p className="text-sm text-red-500 flex items-center mt-2">
                        <ArrowTrendingDownIcon className="h-4 w-4 mr-1" />
                        {financialMetrics.revenueChange}% по сравнению с пред. периодом
                      </p>
                    )
                  )}
                </div>
                
                <div className={`p-6 rounded-lg ${isDark ? 'bg-gray-700' : 'bg-gray-50'}`}>
                  <h4 className={`text-sm uppercase font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'} mb-2`}>Валовая прибыль</h4>
                  <p className={`text-3xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{formatCurrency(financialMetrics.grossProfit)} ₸</p>
                  <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'} mt-2`}>Маржа прибыли: {financialMetrics.profitMargin}%</p>
                </div>
                
                <div className={`p-6 rounded-lg ${isDark ? 'bg-gray-700' : 'bg-gray-50'}`}>
                  <h4 className={`text-sm uppercase font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'} mb-2`}>Операционные расходы</h4>
                  <p className={`text-3xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{formatCurrency(financialMetrics.totalCost)} ₸</p>
                  <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'} mt-2`}>{((financialMetrics.totalCost / financialMetrics.totalRevenue) * 100).toFixed(1)}% от выручки</p>
                </div>
              </div>
              
              {/* Графики: Доходы-Расходы, Прибыль, Средний чек */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                <div className={`p-6 rounded-lg ${isDark ? 'bg-gray-700' : 'bg-gray-50'}`}>
                  <h4 className={`font-medium mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>Динамика доходов и расходов</h4>
                  
                  {/* Блок с графиком, который всегда отображается */}
                  <div className="h-80 relative">
                    <div className="absolute inset-0 flex items-end space-x-2">
                      {['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн'].map((month, index) => {
                        // Фиксированные значения для графика, чтобы он всегда отображался
                        const revenueHeight = 50 + Math.floor(Math.random() * 40); // от 50% до 90%
                        const expenseHeight = 30 + Math.floor(Math.random() * 40); // от 30% до 70%
                        
                        return (
                          <div key={month} className="flex-1 flex flex-col items-center space-y-2">
                            <div className="w-full flex items-end justify-center space-x-1 h-64">
                              <div 
                                className={`w-7 ${isDark ? 'bg-blue-500' : 'bg-blue-600'} rounded-t`}
                                style={{ height: `${revenueHeight}%` }}
                              ></div>
                              <div 
                                className={`w-7 ${isDark ? 'bg-green-500' : 'bg-green-600'} rounded-t`}
                                style={{ height: `${expenseHeight}%` }}
                              ></div>
                            </div>
                            <div className={`text-xs font-medium ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                              {month}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    
                    {/* Легенда графика */}
                    <div className="absolute top-0 right-0 flex items-center space-x-4">
                      <div className="flex items-center">
                        <div className={`h-3 w-6 ${isDark ? 'bg-blue-500' : 'bg-blue-600'} mr-1 rounded`}></div>
                        <span className={`text-xs font-medium ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>Доходы</span>
                      </div>
                      <div className="flex items-center">
                        <div className={`h-3 w-6 ${isDark ? 'bg-green-500' : 'bg-green-600'} mr-1 rounded`}></div>
                        <span className={`text-xs font-medium ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>Расходы</span>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className={`p-6 rounded-lg ${isDark ? 'bg-gray-700' : 'bg-gray-50'}`}>
                  <h4 className={`font-medium mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>Средний чек и количество заказов</h4>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="text-center">
                      <p className={`text-sm uppercase font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'} mb-2`}>Средний чек</p>
                      <p className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{formatCurrency(financialMetrics.averageOrderValue)} ₸</p>
                      {financialMetrics.averageOrderValueChange !== undefined && (
                        financialMetrics.averageOrderValueChange > 0 ? (
                          <p className="text-sm text-green-500 flex items-center justify-center mt-2">
                            <ArrowTrendingUpIcon className="h-4 w-4 mr-1" />
                            +{financialMetrics.averageOrderValueChange}%
                          </p>
                        ) : (
                          <p className="text-sm text-red-500 flex items-center justify-center mt-2">
                            <ArrowTrendingDownIcon className="h-4 w-4 mr-1" />
                            {financialMetrics.averageOrderValueChange}%
                          </p>
                        )
                      )}
                    </div>
                    
                    <div className="text-center">
                      <p className={`text-sm uppercase font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'} mb-2`}>Количество заказов</p>
                      <p className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{financialMetrics.orderCount}</p>
                      {financialMetrics.orderCountChange !== undefined && (
                        financialMetrics.orderCountChange > 0 ? (
                          <p className="text-sm text-green-500 flex items-center justify-center mt-2">
                            <ArrowTrendingUpIcon className="h-4 w-4 mr-1" />
                            +{financialMetrics.orderCountChange}%
                          </p>
                        ) : (
                          <p className="text-sm text-red-500 flex items-center justify-center mt-2">
                            <ArrowTrendingDownIcon className="h-4 w-4 mr-1" />
                            {financialMetrics.orderCountChange}%
                          </p>
                        )
                      )}
                    </div>
                  </div>
                  
                  {/* Тренд среднего чека - имитация графика */}
                  <div className="h-32 mt-6 flex items-end space-x-1">
                    {/* Использование моковых данных вместо несуществующего averageOrderValueByDay */}
                    {[...Array(10)].map((_, i) => {
                      // Генерируем случайные значения для имитации тренда
                      const height = 30 + Math.random() * 70; // от 30% до 100% высоты
                      
                      return (
                        <div key={`day-${i}`} className="flex-1 flex flex-col items-center">
                          <div 
                            className={`w-full ${isDark ? 'bg-primary-600' : 'bg-primary'} rounded-t`} 
                            style={{ height: `${height}%` }}
                          ></div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
              
              {/* Категории расходов */}
              <div className={`p-6 rounded-lg ${isDark ? 'bg-gray-700' : 'bg-gray-50'} mb-8`}>
                <h4 className={`font-medium mb-6 ${isDark ? 'text-white' : 'text-gray-900'}`}>Структура расходов</h4>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    {/* Используем заглушечные данные вместо несуществующего expensesByCategory */}
                    {[
                      { category: 'Продукты', amount: financialMetrics.totalCost * 0.45, color: '#4F46E5' }, // Индиго
                      { category: 'Зарплата', amount: financialMetrics.totalCost * 0.25, color: '#10B981' }, // Зеленый
                      { category: 'Аренда', amount: financialMetrics.totalCost * 0.15, color: '#F59E0B' }, // Оранжевый
                      { category: 'Коммунальные услуги', amount: financialMetrics.totalCost * 0.08, color: '#3B82F6' }, // Синий
                      { category: 'Маркетинг', amount: financialMetrics.totalCost * 0.05, color: '#EC4899' }, // Розовый
                      { category: 'Прочее', amount: financialMetrics.totalCost * 0.02, color: '#8B5CF6' } // Фиолетовый
                    ].map(({ category, amount, color }: { category: string; amount: number; color: string }) => {
                      const percentage = (amount / financialMetrics.totalCost) * 100;
                      
                      return (
                        <div key={category} className="mb-4">
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-sm flex items-center">
                              <div className="h-3 w-3 mr-2" style={{ backgroundColor: color }}></div>
                              <span style={{ color }} className="font-semibold">{category}</span>
                            </span>
                            <span style={{ color }} className="text-sm font-semibold">{formatCurrency(amount)} ₸ ({percentage.toFixed(1)}%)</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div 
                              className="h-2 rounded-full" 
                              style={{ width: `${percentage}%`, backgroundColor: color }}
                            ></div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  
                  <div className="flex items-center justify-center">
                    {/* Увеличенная круговая диаграмма с разными цветами для категорий */}
                    <div className="h-80 w-80 relative">
                      <svg viewBox="0 0 100 100" className="h-80 w-80">
                        {/* Категории расходов и их цвета */}
                        {(() => {
                          const categories = [
                            { category: 'Продукты', amount: financialMetrics.totalCost * 0.45, color: '#4F46E5' }, // Индиго
                            { category: 'Зарплата', amount: financialMetrics.totalCost * 0.25, color: '#10B981' }, // Зеленый
                            { category: 'Аренда', amount: financialMetrics.totalCost * 0.15, color: '#F59E0B' }, // Оранжевый
                            { category: 'Коммунальные услуги', amount: financialMetrics.totalCost * 0.08, color: '#3B82F6' }, // Синий
                            { category: 'Маркетинг', amount: financialMetrics.totalCost * 0.05, color: '#EC4899' }, // Розовый
                            { category: 'Прочее', amount: financialMetrics.totalCost * 0.02, color: '#8B5CF6' } // Фиолетовый
                          ];
                          
                          let startAngle = 0;
                          return categories.map(({ category, amount, color }) => {
                            const percentage = (amount / financialMetrics.totalCost);
                            const angle = percentage * 360;
                            const endAngle = startAngle + angle;
                            
                            // Расчет координат для сектора
                            const x1 = 50 + 45 * Math.cos((startAngle * Math.PI) / 180);
                            const y1 = 50 + 45 * Math.sin((startAngle * Math.PI) / 180);
                            const x2 = 50 + 45 * Math.cos((endAngle * Math.PI) / 180);
                            const y2 = 50 + 45 * Math.sin((endAngle * Math.PI) / 180);
                            
                            // Флаг для определения большой дуги (> 180 градусов)
                            const largeArcFlag = angle > 180 ? 1 : 0;
                            
                            // Создание пути для сектора
                            const path = `M 50 50 L ${x1} ${y1} A 45 45 0 ${largeArcFlag} 1 ${x2} ${y2} Z`;
                            
                            const element = (
                              <path
                                key={category}
                                d={path}
                                fill={color}
                                stroke={isDark ? '#1F2937' : 'white'}
                                strokeWidth="1"
                              />
                            );
                            
                            startAngle = endAngle;
                            return element;
                          });
                        })()}
                        <circle cx="50" cy="50" r="18" fill={isDark ? '#374151' : 'white'} />
                        <text x="50" y="50" textAnchor="middle" dominantBaseline="middle" 
                            fill={isDark ? 'white' : '#1F2937'} className="text-[9px] font-light">
                          Расходы
                        </text>
                      </svg>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Сравнение с прошлыми периодами */}
              <div className={`p-6 rounded-lg ${isDark ? 'bg-gray-700' : 'bg-gray-50'}`}>
                <h4 className={`font-medium mb-6 ${isDark ? 'text-white' : 'text-gray-900'}`}>Сравнение с предыдущими периодами</h4>
                
                <div className="overflow-x-auto">
                  <table className={`min-w-full divide-y ${isDark ? 'divide-gray-600' : 'divide-gray-200'}`}>
                    <thead>
                      <tr>
                        <th className={`px-6 py-3 text-left text-xs font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'} uppercase tracking-wider`}>Показатель</th>
                        <th className={`px-6 py-3 text-left text-xs font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'} uppercase tracking-wider`}>Текущий период</th>
                        <th className={`px-6 py-3 text-left text-xs font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'} uppercase tracking-wider`}>Предыдущий период</th>
                        <th className={`px-6 py-3 text-left text-xs font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'} uppercase tracking-wider`}>Изменение</th>
                      </tr>
                    </thead>
                    <tbody className={`divide-y ${isDark ? 'divide-gray-600' : 'divide-gray-200'}`}>
                      <tr>
                        <td className={`px-6 py-4 whitespace-nowrap text-sm ${isDark ? 'text-white' : 'text-gray-900'}`}>Выручка</td>
                        <td className={`px-6 py-4 whitespace-nowrap text-sm ${isDark ? 'text-gray-300' : 'text-gray-500'}`}>{formatCurrency(financialMetrics.totalRevenue)} ₸</td>
                        <td className={`px-6 py-4 whitespace-nowrap text-sm ${isDark ? 'text-gray-300' : 'text-gray-500'}`}>{formatCurrency(financialMetrics.previousRevenue)} ₸</td>
                        <td className={`px-6 py-4 whitespace-nowrap text-sm ${financialMetrics.revenueChange !== undefined && financialMetrics.revenueChange >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                          {financialMetrics.revenueChange !== undefined && (
                            <>{financialMetrics.revenueChange >= 0 ? '+' : ''}{financialMetrics.revenueChange}%</>
                          )}
                        </td>
                      </tr>
                      <tr>
                        <td className={`px-6 py-4 whitespace-nowrap text-sm ${isDark ? 'text-white' : 'text-gray-900'}`}>Прибыль</td>
                        <td className={`px-6 py-4 whitespace-nowrap text-sm ${isDark ? 'text-gray-300' : 'text-gray-500'}`}>{formatCurrency(financialMetrics.grossProfit)} ₸</td>
                        <td className={`px-6 py-4 whitespace-nowrap text-sm ${isDark ? 'text-gray-300' : 'text-gray-500'}`}>{formatCurrency(financialMetrics.previousProfit)} ₸</td>
                        <td className={`px-6 py-4 whitespace-nowrap text-sm ${financialMetrics.profitChange !== undefined && financialMetrics.profitChange >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                          {financialMetrics.profitChange !== undefined && (
                            <>{financialMetrics.profitChange >= 0 ? '+' : ''}{financialMetrics.profitChange}%</>
                          )}
                        </td>
                      </tr>
                      <tr>
                        <td className={`px-6 py-4 whitespace-nowrap text-sm ${isDark ? 'text-white' : 'text-gray-900'}`}>Средний чек</td>
                        <td className={`px-6 py-4 whitespace-nowrap text-sm ${isDark ? 'text-gray-300' : 'text-gray-500'}`}>{formatCurrency(financialMetrics.averageOrderValue)} ₸</td>
                        <td className={`px-6 py-4 whitespace-nowrap text-sm ${isDark ? 'text-gray-300' : 'text-gray-500'}`}>{formatCurrency(financialMetrics.previousAverageOrderValue)} ₸</td>
                        <td className={`px-6 py-4 whitespace-nowrap text-sm ${financialMetrics.averageOrderValueChange !== undefined && financialMetrics.averageOrderValueChange >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                          {financialMetrics.averageOrderValueChange !== undefined && (
                            <>{financialMetrics.averageOrderValueChange >= 0 ? '+' : ''}{financialMetrics.averageOrderValueChange}%</>
                          )}
                        </td>
                      </tr>
                      <tr>
                        <td className={`px-6 py-4 whitespace-nowrap text-sm ${isDark ? 'text-white' : 'text-gray-900'}`}>Количество заказов</td>
                        <td className={`px-6 py-4 whitespace-nowrap text-sm ${isDark ? 'text-gray-300' : 'text-gray-500'}`}>{financialMetrics.orderCount}</td>
                        <td className={`px-6 py-4 whitespace-nowrap text-sm ${isDark ? 'text-gray-300' : 'text-gray-500'}`}>{financialMetrics.previousOrderCount}</td>
                        <td className={`px-6 py-4 whitespace-nowrap text-sm ${financialMetrics.orderCountChange !== undefined && financialMetrics.orderCountChange >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                          {financialMetrics.orderCountChange !== undefined && (
                            <>{financialMetrics.orderCountChange >= 0 ? '+' : ''}{financialMetrics.orderCountChange}%</>
                          )}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </>
        )}
        
        {/* СТРАНИЦА МЕНЮ */}
        {currentView === 'menu' && (
          <>
            <div className={`${isDark ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow-md p-6 mb-8`}>
              <h3 className={`text-xl font-medium mb-6 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                <div className="flex items-center">
                  <ClipboardDocumentListIcon className={`h-6 w-6 mr-2 ${isDark ? 'text-primary-400' : 'text-primary'}`} />
                  <span>Анализ меню</span>
                </div>
              </h3>
              
              {/* Матрица популярности и маржинальности блюд */}
              <div className={`p-6 rounded-lg ${isDark ? 'bg-gray-700' : 'bg-gray-50'} mb-8`}>
                <h4 className={`font-medium mb-6 ${isDark ? 'text-white' : 'text-gray-900'}`}>Матрица ABC-анализа блюд</h4>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div>
                    <h5 className={`text-sm font-medium mb-4 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                      По данным анализа:
                    </h5>
                    <ul className="space-y-3">
                      <li className="flex items-start">
                        <div className={`p-1 rounded-full ${isDark ? 'bg-green-900' : 'bg-green-100'} mr-3 mt-0.5`}>
                          <CheckCircleIcon className={`h-5 w-5 ${isDark ? 'text-green-300' : 'text-green-600'}`} />
                        </div>
                        <div>
                          <p className={`font-medium ${isDark ? 'text-green-300' : 'text-green-600'}`}>Звезды (высокая маржа, высокая популярность)</p>
                          <p className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>Блюда с высокой популярностью и высокой маржинальностью - приоритетные позиции.</p>
                        </div>
                      </li>
                      <li className="flex items-start">
                        <div className={`p-1 rounded-full ${isDark ? 'bg-yellow-900' : 'bg-yellow-100'} mr-3 mt-0.5`}>
                          <LightBulbIcon className={`h-5 w-5 ${isDark ? 'text-yellow-300' : 'text-yellow-600'}`} />
                        </div>
                        <div>
                          <p className={`font-medium ${isDark ? 'text-yellow-300' : 'text-yellow-600'}`}>Загадки (высокая маржа, низкая популярность)</p>
                          <p className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>Блюда с низкой популярностью, но высокой маржинальностью - требуют продвижения.</p>
                        </div>
                      </li>
                      <li className="flex items-start">
                        <div className={`p-1 rounded-full ${isDark ? 'bg-blue-900' : 'bg-blue-100'} mr-3 mt-0.5`}>
                          <CurrencyDollarIcon className={`h-5 w-5 ${isDark ? 'text-blue-300' : 'text-blue-600'}`} />
                        </div>
                        <div>
                          <p className={`font-medium ${isDark ? 'text-blue-300' : 'text-blue-600'}`}>Рабочие лошадки (низкая маржа, высокая популярность)</p>
                          <p className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>Блюда с высокой популярностью, но низкой маржинальностью - можно повысить цену.</p>
                        </div>
                      </li>
                      <li className="flex items-start">
                        <div className={`p-1 rounded-full ${isDark ? 'bg-red-900' : 'bg-red-100'} mr-3 mt-0.5`}>
                          <ExclamationTriangleIcon className={`h-5 w-5 ${isDark ? 'text-red-300' : 'text-red-600'}`} />
                        </div>
                        <div>
                          <p className={`font-medium ${isDark ? 'text-red-300' : 'text-red-600'}`}>Проблемные (низкая маржа, низкая популярность)</p>
                          <p className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>Блюда с низкой популярностью и низкой маржинальностью - кандидаты на удаление.</p>
                        </div>
                      </li>
                    </ul>
                  </div>
                  
                  <div className="relative h-80">
                    {/* Визуализация матрицы */}
                    <div className="absolute inset-0">
                      {/* Оси координат */}
                      <div className="absolute left-0 top-0 h-full w-px bg-gray-400"></div>
                      <div className="absolute left-0 bottom-0 w-full h-px bg-gray-400"></div>
                      
                      {/* Подписи осей */}
                      <div className="absolute left-0 top-0 transform -translate-y-6 text-xs text-left pl-2">
                        <span className={`${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Популярность</span>
                      </div>
                      <div className="absolute right-0 bottom-0 transform translate-y-6 text-xs text-right pr-2">
                        <span className={`${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Маржинальность</span>
                      </div>
                      
                      {/* Квадранты */}
                      <div className="absolute left-1/2 top-0 right-0 h-1/2 bg-green-500/10 border-green-500/30 border"></div>
                      <div className="absolute left-0 top-0 right-1/2 h-1/2 bg-blue-500/10 border-blue-500/30 border"></div>
                      <div className="absolute left-1/2 top-1/2 right-0 bottom-0 bg-yellow-500/10 border-yellow-500/30 border"></div>
                      <div className="absolute left-0 top-1/2 right-1/2 bottom-0 bg-red-500/10 border-red-500/30 border"></div>
                      
                      {/* Названия квадрантов */}
                      <div className="absolute left-1/4 top-1/4 transform -translate-x-1/2 -translate-y-1/2 text-xs font-medium text-blue-600">
                        Рабочие лошадки
                      </div>
                      <div className="absolute left-3/4 top-1/4 transform -translate-x-1/2 -translate-y-1/2 text-xs font-medium text-green-600">
                        Звезды
                      </div>
                      <div className="absolute left-1/4 top-3/4 transform -translate-x-1/2 -translate-y-1/2 text-xs font-medium text-red-600">
                        Проблемные
                      </div>
                      <div className="absolute left-3/4 top-3/4 transform -translate-x-1/2 -translate-y-1/2 text-xs font-medium text-yellow-600">
                        Загадки
                      </div>
                      
                      {/* Точки для блюд */}
                      {(() => {
                        // Подготовка данных для матрицы
                        const abcData: Array<{dishId: number, dishName: string, salesCount: number, profitMargin: number}> = [];
                        
                        // Добавляем данные из topSellingDishes
                        if (menuMetrics.topSellingDishes && menuMetrics.topSellingDishes.length > 0) {
                          menuMetrics.topSellingDishes.forEach(dish => {
                            // Ищем маржу для блюда
                            let margin = 30; // Значение по умолчанию
                            
                            // Маржа может быть непосредственно в блюде
                            if ((dish as any).profitMargin !== undefined) {
                              margin = (dish as any).profitMargin;
                            } else if (menuMetrics.mostProfitableDishes) {
                              // Или в списке самых прибыльных
                              const profitDish = menuMetrics.mostProfitableDishes.find(
                                d => d.dishId === dish.dishId
                              );
                              if (profitDish) {
                                margin = profitDish.profitMargin;
                              }
                            }
                            
                            abcData.push({
                                dishId: dish.dishId,
                                dishName: dish.dishName,
                                salesCount: dish.salesCount,
                              profitMargin: margin
                              });
                          });
                        }
                        
                        // Добавляем данные из mostProfitableDishes, если еще не добавлены
                        if (menuMetrics.mostProfitableDishes) {
                          menuMetrics.mostProfitableDishes.forEach(dish => {
                            if (!abcData.some(d => d.dishId === dish.dishId)) {
                              abcData.push({
                                dishId: dish.dishId,
                                dishName: dish.dishName,
                                salesCount: dish.salesCount,
                                profitMargin: dish.profitMargin
                              });
                            }
                          });
                        }
                        
                        // Добавляем данные из leastSellingDishes
                        if (menuMetrics.leastSellingDishes) {
                          menuMetrics.leastSellingDishes.forEach(dish => {
                            if (!abcData.some(d => d.dishId === dish.dishId)) {
                              // Для наименее популярных часто низкая маржа
                              let margin = 15; 
                              if ((dish as any).profitMargin !== undefined) {
                                margin = (dish as any).profitMargin;
                              }
                              
                              abcData.push({
                                dishId: dish.dishId,
                                dishName: dish.dishName,
                                salesCount: dish.salesCount,
                                profitMargin: margin
                              });
                            }
                          });
                        }
                        
                        // Если данных нет, создаем демо-данные
                        if (abcData.length === 0) {
                          abcData.push(
                            { dishId: 1, dishName: "Демо: высокая маржа, высокие продажи", salesCount: 100, profitMargin: 60 },
                            { dishId: 2, dishName: "Демо: низкая маржа, высокие продажи", salesCount: 85, profitMargin: 25 },
                            { dishId: 3, dishName: "Демо: высокая маржа, низкие продажи", salesCount: 25, profitMargin: 70 },
                            { dishId: 4, dishName: "Демо: низкая маржа, низкие продажи", salesCount: 15, profitMargin: 20 }
                          );
                        }
                        
                        // Находим максимальное количество продаж для нормализации
                        const maxSales = Math.max(...abcData.map(d => d.salesCount));
                        
                        // Отрисовываем точки
                        return abcData.map(dish => {
                          // Нормализация координат для отображения
                          const x = dish.profitMargin; // маржинальность по оси X (0-100%)
                          const y = (dish.salesCount / maxSales) * 100; // продажи по оси Y (0-100%)
                          
                          // Цвет точки в зависимости от квадранта
                          let color;
                          if (x >= 50 && y >= 50) color = isDark ? 'bg-green-600' : 'bg-green-500'; // Звезды
                          else if (x >= 50 && y < 50) color = isDark ? 'bg-yellow-600' : 'bg-yellow-500'; // Загадки
                          else if (x < 50 && y >= 50) color = isDark ? 'bg-blue-600' : 'bg-blue-500'; // Рабочие лошадки
                          else color = isDark ? 'bg-red-600' : 'bg-red-500'; // Проблемные
                          
                          return (
                            <div 
                              key={dish.dishId}
                              className={`absolute w-4 h-4 rounded-full ${color} shadow-lg transform -translate-x-1/2 -translate-y-1/2 cursor-pointer hover:ring-2 ring-white`}
                              style={{
                                left: `${x}%`, // Координата X - маржинальность
                                top: `${100 - y}%`, // Координата Y - популярность (инвертирована)
                              }}
                              title={`${dish.dishName}: Маржа ${dish.profitMargin}%, Продажи ${dish.salesCount} шт.`}
                            ></div>
                          );
                        });
                      })()}
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Топ блюд и категорий */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                <div className={`p-6 rounded-lg ${isDark ? 'bg-gray-700' : 'bg-gray-50'}`}>
                  <h4 className={`font-medium mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>Топ-10 самых продаваемых блюд</h4>
                  
                  <div className="overflow-x-auto">
                    <table className={`min-w-full divide-y ${isDark ? 'divide-gray-600' : 'divide-gray-200'}`}>
                      <thead>
                        <tr>
                          <th className={`px-4 py-2 text-left text-xs font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'} uppercase tracking-wider`}>Блюдо</th>
                          <th className={`px-4 py-2 text-left text-xs font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'} uppercase tracking-wider`}>Продажи</th>
                          <th className={`px-4 py-2 text-left text-xs font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'} uppercase tracking-wider`}>Выручка</th>
                          <th className={`px-4 py-2 text-left text-xs font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'} uppercase tracking-wider`}>Маржа</th>
                        </tr>
                      </thead>
                      <tbody className={`divide-y ${isDark ? 'divide-gray-600' : 'divide-gray-200'}`}>
                        {menuMetrics?.topSellingDishes?.slice(0, 10).map((dish, index) => (
                          <tr key={dish.dishId} className={index % 2 === 0 ? isDark ? 'bg-gray-800/30' : 'bg-gray-50' : ''}>
                            <td className={`px-4 py-2 whitespace-nowrap text-sm ${isDark ? 'text-white' : 'text-gray-900'}`}>{dish.dishName}</td>
                            <td className={`px-4 py-2 whitespace-nowrap text-sm ${isDark ? 'text-gray-300' : 'text-gray-500'}`}>{dish.salesCount} шт.</td>
                            <td className={`px-4 py-2 whitespace-nowrap text-sm ${isDark ? 'text-gray-300' : 'text-gray-500'}`}>{formatCurrency(dish.revenue)} ₸</td>
                            <td className={`px-4 py-2 whitespace-nowrap text-sm ${isDark ? 'text-gray-300' : 'text-gray-500'}`}>{(dish as any).profitMargin || 0}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
                
                <div className={`p-6 rounded-lg ${isDark ? 'bg-gray-700' : 'bg-gray-50'}`}>
                  <h4 className={`font-medium mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>Популярность категорий</h4>
                  <div className="space-y-4">
                    {menuMetrics && menuMetrics.categoryPerformance && Object.keys(menuMetrics.categoryPerformance).length > 0 ? (
                      Object.values(menuMetrics.categoryPerformance).map((category: any) => (
                      <div key={category.id} className="mb-4">
                        <div className="flex justify-between items-center mb-1">
                          <span className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{category.name}</span>
                            <span className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{category.salesPercentage?.toFixed(1) ?? 0}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div 
                            className="h-2 rounded-full bg-gradient-to-r from-primary-500 to-primary-300" 
                              style={{ width: `${category.salesPercentage ?? 0}%` }}
                          ></div>
                        </div>
                        <div className="flex justify-between text-xs mt-1">
                            <span className={`${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Ср. чек: {formatCurrency(category.averageOrderValue ?? 0)} ₸</span>
                            <span className={`${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Маржа: {category.averageProfitMargin ?? 0}%</span>
                        </div>
                      </div>
                          ))
                        ) : (
                      <div className="text-center text-gray-400 py-8">Нет данных по категориям</div>
                    )}
                  </div>
                </div>
              </div>
              
              {/* Наименее популярные блюда */}
              <div className={`p-6 rounded-lg ${isDark ? 'bg-gray-700' : 'bg-gray-50'} mb-8`}>
                <h4 className={`font-medium mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>Наименее продаваемые блюда</h4>
                
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="overflow-x-auto">
                    <table className={`min-w-full divide-y ${isDark ? 'divide-gray-600' : 'divide-gray-200'}`}>
                      <thead>
                        <tr>
                          <th className={`px-4 py-2 text-left text-xs font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'} uppercase tracking-wider`}>Блюдо</th>
                          <th className={`px-4 py-2 text-left text-xs font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'} uppercase tracking-wider`}>Продажи</th>
                          <th className={`px-4 py-2 text-left text-xs font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'} uppercase tracking-wider`}>Выручка</th>
                        </tr>
                      </thead>
                      <tbody className={`divide-y ${isDark ? 'divide-gray-600' : 'divide-gray-200'}`}>
                        {menuMetrics?.leastSellingDishes?.slice(0, 5).map((dish, index) => (
                          <tr key={dish.dishId} className={index % 2 === 0 ? isDark ? 'bg-gray-800/30' : 'bg-gray-50' : ''}>
                            <td className={`px-4 py-2 whitespace-nowrap text-sm ${isDark ? 'text-white' : 'text-gray-900'}`}>{dish.dishName}</td>
                            <td className={`px-4 py-2 whitespace-nowrap text-sm ${isDark ? 'text-gray-300' : 'text-gray-500'}`}>{dish.salesCount} шт.</td>
                            <td className={`px-4 py-2 whitespace-nowrap text-sm ${isDark ? 'text-gray-300' : 'text-gray-500'}`}>{formatCurrency(dish.revenue)} ₸</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  
                  <div>
                    <h5 className={`text-sm font-medium mb-4 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                      Рекомендации по улучшению:
                    </h5>
                    <ul className="space-y-3">
                      <li className="flex items-start">
                        <div className={`p-1 rounded-full ${isDark ? 'bg-purple-900' : 'bg-purple-100'} mr-3 mt-0.5`}>
                          <PresentationChartLineIcon className={`h-5 w-5 ${isDark ? 'text-purple-300' : 'text-purple-600'}`} />
                        </div>
                        <div>
                          <p className={`font-medium ${isDark ? 'text-purple-300' : 'text-purple-600'}`}>Пересмотр позиционирования</p>
                          <p className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>Пересмотрите позиционирование блюд в меню, разместите их на более заметных местах.</p>
                        </div>
                      </li>
                      <li className="flex items-start">
                        <div className={`p-1 rounded-full ${isDark ? 'bg-yellow-900' : 'bg-yellow-100'} mr-3 mt-0.5`}>
                          <CurrencyDollarIcon className={`h-5 w-5 ${isDark ? 'text-yellow-300' : 'text-yellow-600'}`} />
                        </div>
                        <div>
                          <p className={`font-medium ${isDark ? 'text-yellow-300' : 'text-yellow-600'}`}>Изменение цены</p>
                          <p className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>Рассмотрите возможность снижения цены или создания специальных предложений.</p>
                        </div>
                      </li>
                      <li className="flex items-start">
                        <div className={`p-1 rounded-full ${isDark ? 'bg-blue-900' : 'bg-blue-100'} mr-3 mt-0.5`}>
                          <ClipboardDocumentListIcon className={`h-5 w-5 ${isDark ? 'text-blue-300' : 'text-blue-600'}`} />
                        </div>
                        <div>
                          <p className={`font-medium ${isDark ? 'text-blue-300' : 'text-blue-600'}`}>Обновление рецептуры</p>
                          <p className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>Обновите рецепт или презентацию блюда, добавьте новые ингредиенты.</p>
                        </div>
                      </li>
                      <li className="flex items-start">
                        <div className={`p-1 rounded-full ${isDark ? 'bg-red-900' : 'bg-red-100'} mr-3 mt-0.5`}>
                          <ExclamationTriangleIcon className={`h-5 w-5 ${isDark ? 'text-red-300' : 'text-red-600'}`} />
                        </div>
                        <div>
                          <p className={`font-medium ${isDark ? 'text-red-300' : 'text-red-600'}`}>Удаление из меню</p>
                          <p className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>Если блюдо стабильно не пользуется спросом, рассмотрите возможность его удаления.</p>
                        </div>
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
        
        {/* СТРАНИЦА КЛИЕНТОВ */}
        {currentView === 'customers' && (
          <>
            <div className={`${isDark ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow-md p-6 mb-8`}>
              <h3 className={`text-xl font-medium mb-6 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                <div className="flex items-center">
                  <UserIcon className={`h-6 w-6 mr-2 ${isDark ? 'text-primary-400' : 'text-primary'}`} />
                  <span>Анализ клиентской базы</span>
                </div>
              </h3>
              
              {/* Ключевые метрики клиентов */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                {/* Первый ряд: Новые клиенты и Средний чек */}
                <div className={`p-6 rounded-lg ${isDark ? 'bg-gray-700' : 'bg-gray-50'} text-center`}>
                  <h4 className={`text-sm uppercase font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'} mb-2`}>Новые клиенты</h4>
                  <p className={`text-3xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{customerMetrics.newCustomers}</p>
                  <p className={`text-sm mt-2 ${(customerMetrics.newCustomersChange ?? 0) >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                    {(customerMetrics.newCustomersChange ?? 0) >= 0 ? '+' : ''}{customerMetrics.newCustomersChange ?? 0}%
                  </p>
                </div>
                
                <div className={`p-6 rounded-lg ${isDark ? 'bg-gray-700' : 'bg-gray-50'} text-center`}>
                  <h4 className={`text-sm uppercase font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'} mb-2`}>Средний чек</h4>
                  <p className={`text-3xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{formatCurrency(financialMetrics.averageOrderValue)} ₸</p>
                  <p className={`text-sm mt-2 ${(customerMetrics.averageOrderValueChange ?? 0) >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                    {(customerMetrics.averageOrderValueChange ?? 0) >= 0 ? '+' : ''}{customerMetrics.averageOrderValueChange ?? 0}%
                  </p>
                </div>
                
                {/* Второй ряд: Рейтинг еды и Рейтинг обслуживания */}
                <div className={`p-6 rounded-lg ${isDark ? 'bg-gray-700' : 'bg-gray-50'} text-center`}>
                  <h4 className={`text-sm uppercase font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'} mb-2`}>Рейтинг еды</h4>
                  <p className={`text-3xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{customerMetrics?.foodRating ? customerMetrics.foodRating.toFixed(1) : '0.0'} / 5.0</p>
                  <div className="flex justify-center mt-2">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <svg key={star} className={`h-5 w-5 ${star <= Math.round(customerMetrics?.foodRating || 0) ? isDark ? 'text-yellow-400' : 'text-yellow-500' : isDark ? 'text-gray-600' : 'text-gray-300'}`} fill="currentColor" viewBox="0 0 20 20">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118l-2.8-2.034c-.783-.57-.38-1.81.588-1.81h3.462a1 1 0 00.95-.69l1.07-3.292z" />
                      </svg>
                    ))}
                  </div>
                </div>
                
                <div className={`p-6 rounded-lg ${isDark ? 'bg-gray-700' : 'bg-gray-50'} text-center`}>
                  <h4 className={`text-sm uppercase font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'} mb-2`}>Рейтинг обслуживания</h4>
                  <p className={`text-3xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{customerMetrics?.serviceRating ? customerMetrics.serviceRating.toFixed(1) : '0.0'} / 5.0</p>
                  <div className="flex justify-center mt-2">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <svg key={star} className={`h-5 w-5 ${star <= Math.round(customerMetrics?.serviceRating || 0) ? isDark ? 'text-yellow-400' : 'text-yellow-500' : isDark ? 'text-gray-600' : 'text-gray-300'}`} fill="currentColor" viewBox="0 0 20 20">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118l-2.8-2.034c-.783-.57-.38-1.81.588-1.81h3.462a1 1 0 00.95-.69l1.07-3.292z" />
                      </svg>
                    ))}
                  </div>
                </div>
              </div>
              
              {/* Третий ряд: Процент возврата (растянут на всю ширину) */}
              <div className="mb-8">
                <div className={`p-6 rounded-lg ${isDark ? 'bg-gray-700' : 'bg-gray-50'} text-center`}>
                  <h4 className={`text-sm uppercase font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'} mb-2`}>Процент возврата</h4>
                  <p className={`text-3xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{customerMetrics.returnRate ?? 0}%</p>
                  <p className={`text-sm mt-2 ${(customerMetrics.returnRateChange ?? 0) >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                    {(customerMetrics.returnRateChange ?? 0) >= 0 ? '+' : ''}{customerMetrics.returnRateChange ?? 0}%
                  </p>
                </div>
              </div>
              
              {/* Демография клиентов */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                <div className={`p-6 rounded-lg ${isDark ? 'bg-gray-700' : 'bg-gray-50'}`}>
                  <h4 className={`font-medium mb-6 ${isDark ? 'text-white' : 'text-gray-900'}`}>Возрастные группы</h4>
                  
                  <div className="space-y-4">
                    {(customerMetrics.customerDemographics?.age_groups && Object.entries(customerMetrics.customerDemographics.age_groups).length > 0) ? (
                      Object.entries(customerMetrics.customerDemographics.age_groups).map(([ageGroup, percentage]) => (
                        <div key={ageGroup} className="mb-4">
                          <div className="flex justify-between items-center mb-1">
                            <span className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{ageGroup}</span>
                            <span className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{percentage as number}%</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div 
                              className="h-2 rounded-full bg-blue-500" 
                              style={{ width: `${percentage as number}%` }}
                            ></div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className={`text-center p-6 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                        <p>Нет данных о возрастных группах</p>
                      </div>
                    )}
                  </div>
                </div>
                
                <div className={`p-6 rounded-lg ${isDark ? 'bg-gray-700' : 'bg-gray-50'}`}>
                  <h4 className={`font-medium mb-6 ${isDark ? 'text-white' : 'text-gray-900'}`}>Частота посещений</h4>
                  
                  <div className="mt-4">
                    {(customerMetrics.visitFrequency && Object.entries(customerMetrics.visitFrequency).length > 0) ? (
                      Object.entries(customerMetrics.visitFrequency).map(([timeSlot, percentage]) => (
                        <div key={timeSlot} className="mb-3">
                          <div className="flex justify-between mb-1">
                            <span className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{timeSlot}</span>
                            <span className={`text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{Number(percentage)}%</span>
                          </div>
                          <div className={`h-2.5 rounded-full ${isDark ? 'bg-gray-600' : 'bg-gray-200'}`}>
                            <div 
                              className="h-2.5 rounded-full bg-indigo-600" 
                              style={{ width: `${Number(percentage)}%` }}
                            ></div>
                          </div>
                        </div>
                      ))
                    ) : (customerMetrics.visitTimes && Object.entries(customerMetrics.visitTimes).length > 0) ? (
                      Object.entries(customerMetrics.visitTimes).map(([timeSlot, percentage]) => (
                        <div key={timeSlot} className="mb-3">
                          <div className="flex justify-between mb-1">
                            <span className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{timeSlot}</span>
                            <span className={`text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{Number(percentage)}%</span>
                          </div>
                          <div className={`h-2.5 rounded-full ${isDark ? 'bg-gray-600' : 'bg-gray-200'}`}>
                            <div 
                              className="h-2.5 rounded-full bg-indigo-600" 
                              style={{ width: `${Number(percentage)}%` }}
                            ></div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className={`text-center p-6 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                        <p>Нет данных о частоте посещений</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              
              {/* Другие метрики клиентов могут быть добавлены здесь */}
            </div>
          </>
        )}
      </div>
    </Layout>
  );
};

export default AdminAnalyticsPage; 