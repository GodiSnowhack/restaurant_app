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
import { 
  analyticsApi 
} from '../../lib/api/analytics-api';
import { 
  FinancialMetrics, 
  MenuMetrics, 
  CustomerMetrics, 
  OperationalMetrics,
  PredictiveMetrics
} from '../../types/analytics';
import { useTheme } from '@/lib/theme-context';

type TimeRange = 'today' | 'week' | 'month' | 'quarter';
type AnalyticsView = 'dashboard' | 'predictions' | 'recommendations' | 'operations' | 'finance' | 'menu' | 'customers';

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

const AdminAnalyticsPage: NextPage = () => {
  const router = useRouter();
  const { user, isAuthenticated, isLoading } = useAuth();
  const { isDark } = useTheme();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<TimeRange>('month');
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

  useEffect(() => {
    // Проверка прав админа
    checkAdmin();
    
    // Загрузка данных аналитики
    loadAnalyticsData();
  }, [timeRange]);

  // Функция для проверки прав администратора
  const checkAdmin = async () => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login?from=/admin/analytics');
      return;
    }

    if (!isLoading && isAuthenticated && user?.role !== 'admin') {
      router.push('/');
      return;
    }
  };

  // Функция для загрузки данных аналитики
  const loadAnalyticsData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Определение временного диапазона для фильтров
      const today = new Date();
      let startDate = new Date();
      
      switch (timeRange) {
        case 'today':
          startDate = new Date(today.setHours(0, 0, 0, 0));
          break;
        case 'week':
          startDate = new Date(today);
          startDate.setDate(today.getDate() - 7);
          break;
        case 'month':
          startDate = new Date(today);
          startDate.setMonth(today.getMonth() - 1);
          break;
        case 'quarter':
          startDate = new Date(today);
          startDate.setMonth(today.getMonth() - 3);
          break;
      }
      
      const filters = {
        startDate: startDate.toISOString().split('T')[0],
        endDate: new Date().toISOString().split('T')[0]
      };
      
      // Параллельная загрузка необходимых данных
      const [financial, menu, customers, operational, predictive] = await Promise.all([
        analyticsApi.getFinancialMetrics(filters),
        analyticsApi.getMenuMetrics(filters),
        analyticsApi.getCustomerMetrics(filters),
        analyticsApi.getOperationalMetrics(filters),
        analyticsApi.getPredictiveMetrics(filters)
      ]);
      
      setFinancialMetrics(financial);
      setMenuMetrics(menu);
      setCustomerMetrics(customers);
      setOperationalMetrics(operational);
      setPredictiveMetrics(predictive);
      
      // Генерация бизнес-рекомендаций на основе полученных данных
      generateBusinessRecommendations(financial, menu, customers, operational, predictive);
      
      // Генерация бизнес-алертов на основе полученных данных
      generateBusinessAlerts(financial, menu, customers, operational);
      
      // Создание сценариев "что если"
      generateWhatIfScenarios(financial, menu, customers, operational, predictive);
      
    } catch (err) {
      console.error('Ошибка при загрузке данных аналитики:', err);
      setError('Произошла ошибка при загрузке данных аналитики. Пожалуйста, попробуйте позже.');
    } finally {
      setLoading(false);
    }
  };

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
    const today = new Date().toISOString();
    
    // Проверка маржи прибыли
    if (financial.profitMargin < 30) {
      alerts.push({
        id: 1,
        title: 'Низкая маржа прибыли',
        description: `Текущая маржа прибыли (${financial.profitMargin}%) ниже целевого показателя в 30%. Необходимо пересмотреть стоимость блюд или оптимизировать расходы.`,
        severity: 'warning',
        category: 'finance',
        timestamp: today,
        resolved: false
      });
    }
    
    // Проверка удовлетворенности клиентов
    if (customers.customerSatisfaction < 4.5) {
      alerts.push({
        id: 2,
        title: 'Снижение удовлетворенности клиентов',
        description: `Средний рейтинг удовлетворенности клиентов (${customers.customerSatisfaction}) ниже целевого показателя в 4.5. Необходимо улучшить качество обслуживания.`,
        severity: 'warning',
        category: 'operations',
        timestamp: today,
        resolved: false
      });
    }
    
    // Проверка времени приготовления
    if (operational.averageOrderPreparationTime > 25) {
      alerts.push({
        id: 3,
        title: 'Увеличение времени приготовления',
        description: `Среднее время приготовления заказа (${operational.averageOrderPreparationTime} мин) выше целевого показателя в 25 минут. Необходимо оптимизировать работу кухни.`,
        severity: 'critical',
        category: 'operations',
        timestamp: today,
        resolved: false
      });
    }
    
    // Проверка процента отмененных заказов
    if (operational.orderCompletionRates['Отменен'] > 10) {
      alerts.push({
        id: 4,
        title: 'Высокий процент отмененных заказов',
        description: `Процент отмененных заказов (${operational.orderCompletionRates['Отменен']}%) превышает допустимый порог в 10%. Требуется анализ причин отмены.`,
        severity: 'critical',
        category: 'operations',
        timestamp: today,
        resolved: false
      });
    }
    
    // Проверка оборачиваемости столов
    if (operational.averageTableTurnoverTime > 100) {
      alerts.push({
        id: 5,
        title: 'Низкая оборачиваемость столов',
        description: `Среднее время оборота столов (${operational.averageTableTurnoverTime} мин) выше оптимального в 100 минут. Это снижает потенциальную выручку заведения.`,
        severity: 'warning',
        category: 'operations',
        timestamp: today,
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
          targetCategories: [2, 4, 7]
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
  const handleChangeTimeRange = (newRange: TimeRange) => {
    setTimeRange(newRange);
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

  if (loading) {
    return (
      <Layout title="Система поддержки принятия решений | Админ-панель">
        <div className="container mx-auto px-4 py-8">
          <div className="flex justify-center items-center h-64">
            <div className={`animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 ${isDark ? 'border-primary-400' : 'border-primary'}`}></div>
          </div>
        </div>
      </Layout>
    );
  }

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

  // Фильтрация статусов заказов (удаление статуса "Доставлен")
  const filteredOrderStatuses = Object.entries(operationalMetrics.orderCompletionRates)
    .filter(([status]) => status !== 'Доставлен')
    .reduce((acc, [status, value]) => {
      acc[status] = value;
      return acc;
    }, {} as Record<string, number>);

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
              onClick={() => handleChangeView('operations')}
              className={`px-4 py-2 rounded-md text-sm font-medium ${
                currentView === 'operations' 
                  ? isDark ? 'bg-primary-700 text-white' : 'bg-primary text-white'
                  : isDark ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
              }`}
            >
              Операции
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

          {/* Переключатель временного диапазона */}
          <div className={`flex flex-wrap gap-2 ${isDark ? 'bg-gray-800' : 'bg-white'} p-4 rounded-lg shadow-md`}>
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
                    <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{timeRange === 'today' ? 'Сегодня' : timeRange === 'week' ? 'За неделю' : timeRange === 'month' ? 'За месяц' : 'За квартал'}</p>
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
                    <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{timeRange === 'today' ? 'Сегодня' : timeRange === 'week' ? 'За неделю' : timeRange === 'month' ? 'За месяц' : 'За квартал'}</p>
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
                    <p className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{customerMetrics.customerSatisfaction} / 5.0</p>
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
                  {menuMetrics.topSellingDishes.slice(0, 5).map((dish) => (
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

              {/* Прогноз продаж */}
              <div className={`${isDark ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow-md p-6`}>
                <h3 className={`text-lg font-medium mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  <div className="flex items-center">
                    <ArrowTrendingUpIcon className={`h-5 w-5 mr-2 ${isDark ? 'text-primary-400' : 'text-primary'}`} />
                    <span>Прогноз продаж на ближайшую неделю</span>
                  </div>
                </h3>
                {predictiveMetrics?.salesForecast ? (
            <div className="h-64 flex items-end space-x-2">
                    {predictiveMetrics.salesForecast.slice(-7).map((item, index) => {
                      const maxValue = Math.max(...predictiveMetrics.salesForecast.map(i => i.value));
                      const percentage = (item.value / maxValue) * 100;
                
                return (
                  <div key={index} className="flex flex-col items-center flex-1">
                    <div 
                            className={`w-full ${isDark ? 'bg-primary-700' : 'bg-primary'} rounded-t`} 
                      style={{ height: `${percentage}%` }}
                    ></div>
                          <div className={`text-xs mt-2 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                            {new Date(item.date).getDate()}
                          </div>
                  </div>
                );
              })}
            </div>
                ) : (
                  <div className={`h-64 flex items-center justify-center ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                    <p>Нет данных для прогноза</p>
          </div>
                )}
              </div>
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
                  <div className="h-64 flex items-end space-x-1">
                    {predictiveMetrics.salesForecast.slice(-14).map((item, index) => {
                      const maxValue = Math.max(...predictiveMetrics.salesForecast.map(i => i.value));
                      const percentage = (item.value / maxValue) * 100;
                      
                      return (
                        <div key={index} className="flex flex-col items-center flex-1">
                          <div 
                            className={`w-full ${isDark ? 'bg-primary-700' : 'bg-primary'} rounded-t`} 
                            style={{ height: `${percentage}%` }}
                          ></div>
                          <div className={`text-xs mt-2 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                            {new Date(item.date).getDate()}
                          </div>
                        </div>
                      );
                    })}
                  </div>
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
                            
                            <div>
                              <div className="flex justify-between items-center mb-1">
                                <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Удовлетворенность клиентов</span>
                                <span className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                  {activeScenario.outcomes.customerSatisfaction.toFixed(1)} / 5.0
                                </span>
                              </div>
                              <div className="w-full bg-gray-200 rounded-full h-2">
                                <div 
                                  className={`h-2 rounded-full ${isDark ? 'bg-blue-600' : 'bg-blue-500'}`}
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
                  {financialMetrics.revenueChange > 0 ? (
                    <p className="text-sm text-green-500 flex items-center mt-2">
                      <ArrowTrendingUpIcon className="h-4 w-4 mr-1" />
                      +{financialMetrics.revenueChange}% по сравнению с пред. периодом
                    </p>
                  ) : (
                    <p className="text-sm text-red-500 flex items-center mt-2">
                      <ArrowTrendingDownIcon className="h-4 w-4 mr-1" />
                      {financialMetrics.revenueChange}% по сравнению с пред. периодом
                    </p>
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
                  
                  {financialMetrics.revenueByMonth && (
                    <div className="h-64 relative">
                      {/* Здесь должен быть график, имитируем его */}
                      <div className="absolute bottom-0 left-0 right-0 h-64 flex items-end space-x-1">
                        {Object.entries(financialMetrics.revenueByMonth).map(([month, revenue], index) => {
                          const expense = financialMetrics.expensesByMonth[month] || 0;
                          const maxValue = Math.max(
                            ...Object.values(financialMetrics.revenueByMonth),
                            ...Object.values(financialMetrics.expensesByMonth)
                          );
                          const revenueHeight = (revenue / maxValue) * 100;
                          const expenseHeight = (expense / maxValue) * 100;
                  
                  return (
                            <div key={month} className="flex-1 flex flex-col space-y-1 items-center">
                              <div className="w-full flex items-end justify-center space-x-1">
                                <div 
                                  className={`w-2/5 ${isDark ? 'bg-primary-600' : 'bg-primary'} rounded-t`} 
                                  style={{ height: `${revenueHeight}%` }}
                                ></div>
                                <div 
                                  className={`w-2/5 ${isDark ? 'bg-red-600' : 'bg-red-500'} rounded-t`} 
                                  style={{ height: `${expenseHeight}%` }}
                                ></div>
                              </div>
                              <div className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                {month}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      
                      {/* Легенда */}
                      <div className="absolute top-0 right-0 flex items-center space-x-4">
                        <div className="flex items-center">
                          <div className={`h-3 w-3 ${isDark ? 'bg-primary-600' : 'bg-primary'} mr-1`}></div>
                          <span className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Доходы</span>
                        </div>
                        <div className="flex items-center">
                          <div className={`h-3 w-3 ${isDark ? 'bg-red-600' : 'bg-red-500'} mr-1`}></div>
                          <span className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Расходы</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                
                <div className={`p-6 rounded-lg ${isDark ? 'bg-gray-700' : 'bg-gray-50'}`}>
                  <h4 className={`font-medium mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>Средний чек и количество заказов</h4>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="text-center">
                      <p className={`text-sm uppercase font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'} mb-2`}>Средний чек</p>
                      <p className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{formatCurrency(financialMetrics.averageOrderValue)} ₸</p>
                      {financialMetrics.averageOrderValueChange > 0 ? (
                        <p className="text-sm text-green-500 flex items-center justify-center mt-2">
                          <ArrowTrendingUpIcon className="h-4 w-4 mr-1" />
                          +{financialMetrics.averageOrderValueChange}%
                        </p>
                      ) : (
                        <p className="text-sm text-red-500 flex items-center justify-center mt-2">
                          <ArrowTrendingDownIcon className="h-4 w-4 mr-1" />
                          {financialMetrics.averageOrderValueChange}%
                        </p>
                      )}
                    </div>
                    
                    <div className="text-center">
                      <p className={`text-sm uppercase font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'} mb-2`}>Количество заказов</p>
                      <p className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{financialMetrics.orderCount}</p>
                      {financialMetrics.orderCountChange > 0 ? (
                        <p className="text-sm text-green-500 flex items-center justify-center mt-2">
                          <ArrowTrendingUpIcon className="h-4 w-4 mr-1" />
                          +{financialMetrics.orderCountChange}%
                        </p>
                      ) : (
                        <p className="text-sm text-red-500 flex items-center justify-center mt-2">
                          <ArrowTrendingDownIcon className="h-4 w-4 mr-1" />
                          {financialMetrics.orderCountChange}%
                        </p>
                      )}
                    </div>
                  </div>
                  
                  {/* Тренд среднего чека - имитация графика */}
                  <div className="h-32 mt-6 flex items-end space-x-1">
                    {Object.entries(financialMetrics.averageOrderValueByDay || {}).map(([day, value], index) => {
                      const values = Object.values(financialMetrics.averageOrderValueByDay || {});
                      const maxValue = Math.max(...values);
                      const height = (value / maxValue) * 100;
                      
                      return (
                        <div key={day} className="flex-1 flex flex-col items-center">
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
                    {Object.entries(financialMetrics.expensesByCategory || {}).map(([category, amount]) => {
                      const percentage = (amount / financialMetrics.totalCost) * 100;
                      
                      return (
                        <div key={category} className="mb-4">
                          <div className="flex justify-between items-center mb-1">
                            <span className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{category}</span>
                            <span className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{formatCurrency(amount)} ₸ ({percentage.toFixed(1)}%)</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                              className="h-2 rounded-full bg-gradient-to-r from-blue-500 to-indigo-500" 
                          style={{ width: `${percentage}%` }}
                        ></div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  
                  <div className="flex items-center justify-center">
                    {/* Здесь должна быть круговая диаграмма, имитируем ее */}
                    <div className="h-48 w-48 rounded-full bg-gradient-to-r from-blue-500 via-purple-500 to-indigo-500 flex items-center justify-center">
                      <div className={`h-32 w-32 rounded-full ${isDark ? 'bg-gray-700' : 'bg-gray-50'} flex items-center justify-center`}>
                        <span className={`text-lg font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                          Расходы
                        </span>
                      </div>
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
                        <td className={`px-6 py-4 whitespace-nowrap text-sm ${financialMetrics.revenueChange >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                          {financialMetrics.revenueChange >= 0 ? '+' : ''}{financialMetrics.revenueChange}%
                        </td>
                      </tr>
                      <tr>
                        <td className={`px-6 py-4 whitespace-nowrap text-sm ${isDark ? 'text-white' : 'text-gray-900'}`}>Прибыль</td>
                        <td className={`px-6 py-4 whitespace-nowrap text-sm ${isDark ? 'text-gray-300' : 'text-gray-500'}`}>{formatCurrency(financialMetrics.grossProfit)} ₸</td>
                        <td className={`px-6 py-4 whitespace-nowrap text-sm ${isDark ? 'text-gray-300' : 'text-gray-500'}`}>{formatCurrency(financialMetrics.previousProfit)} ₸</td>
                        <td className={`px-6 py-4 whitespace-nowrap text-sm ${financialMetrics.profitChange >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                          {financialMetrics.profitChange >= 0 ? '+' : ''}{financialMetrics.profitChange}%
                        </td>
                      </tr>
                      <tr>
                        <td className={`px-6 py-4 whitespace-nowrap text-sm ${isDark ? 'text-white' : 'text-gray-900'}`}>Средний чек</td>
                        <td className={`px-6 py-4 whitespace-nowrap text-sm ${isDark ? 'text-gray-300' : 'text-gray-500'}`}>{formatCurrency(financialMetrics.averageOrderValue)} ₸</td>
                        <td className={`px-6 py-4 whitespace-nowrap text-sm ${isDark ? 'text-gray-300' : 'text-gray-500'}`}>{formatCurrency(financialMetrics.previousAverageOrderValue)} ₸</td>
                        <td className={`px-6 py-4 whitespace-nowrap text-sm ${financialMetrics.averageOrderValueChange >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                          {financialMetrics.averageOrderValueChange >= 0 ? '+' : ''}{financialMetrics.averageOrderValueChange}%
                        </td>
                      </tr>
                      <tr>
                        <td className={`px-6 py-4 whitespace-nowrap text-sm ${isDark ? 'text-white' : 'text-gray-900'}`}>Количество заказов</td>
                        <td className={`px-6 py-4 whitespace-nowrap text-sm ${isDark ? 'text-gray-300' : 'text-gray-500'}`}>{financialMetrics.orderCount}</td>
                        <td className={`px-6 py-4 whitespace-nowrap text-sm ${isDark ? 'text-gray-300' : 'text-gray-500'}`}>{financialMetrics.previousOrderCount}</td>
                        <td className={`px-6 py-4 whitespace-nowrap text-sm ${financialMetrics.orderCountChange >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                          {financialMetrics.orderCountChange >= 0 ? '+' : ''}{financialMetrics.orderCountChange}%
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
                          <p className={`font-medium ${isDark ? 'text-green-300' : 'text-green-600'}`}>Звезды (высокий спрос, высокая маржа)</p>
                          <p className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>Блюда с высоким спросом и высокой маржинальностью - приоритетные позиции.</p>
                        </div>
                      </li>
                      <li className="flex items-start">
                        <div className={`p-1 rounded-full ${isDark ? 'bg-yellow-900' : 'bg-yellow-100'} mr-3 mt-0.5`}>
                          <LightBulbIcon className={`h-5 w-5 ${isDark ? 'text-yellow-300' : 'text-yellow-600'}`} />
                        </div>
                        <div>
                          <p className={`font-medium ${isDark ? 'text-yellow-300' : 'text-yellow-600'}`}>Загадки (низкий спрос, высокая маржа)</p>
                          <p className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>Блюда с низким спросом, но высокой маржинальностью - требуют продвижения.</p>
                        </div>
                      </li>
                      <li className="flex items-start">
                        <div className={`p-1 rounded-full ${isDark ? 'bg-blue-900' : 'bg-blue-100'} mr-3 mt-0.5`}>
                          <CurrencyDollarIcon className={`h-5 w-5 ${isDark ? 'text-blue-300' : 'text-blue-600'}`} />
                        </div>
                        <div>
                          <p className={`font-medium ${isDark ? 'text-blue-300' : 'text-blue-600'}`}>Рабочие лошадки (высокий спрос, низкая маржа)</p>
                          <p className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>Блюда с высоким спросом, но низкой маржинальностью - можно повысить цену.</p>
                        </div>
                      </li>
                      <li className="flex items-start">
                        <div className={`p-1 rounded-full ${isDark ? 'bg-red-900' : 'bg-red-100'} mr-3 mt-0.5`}>
                          <ExclamationTriangleIcon className={`h-5 w-5 ${isDark ? 'text-red-300' : 'text-red-600'}`} />
                        </div>
                        <div>
                          <p className={`font-medium ${isDark ? 'text-red-300' : 'text-red-600'}`}>Проблемные (низкий спрос, низкая маржа)</p>
                          <p className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>Блюда с низким спросом и низкой маржинальностью - кандидаты на удаление.</p>
                        </div>
                      </li>
                    </ul>
                  </div>
                  
                  <div className="relative h-80">
                    {/* Визуализация матрицы популярность/маржинальность */}
                    <div className="absolute inset-0">
                      {/* Оси координат */}
                      <div className="absolute left-0 bottom-0 h-full w-px bg-gray-400"></div>
                      <div className="absolute left-0 bottom-0 w-full h-px bg-gray-400"></div>
                      
                      {/* Подписи осей */}
                      <div className="absolute left-0 top-0 transform -translate-y-6 text-xs text-center w-full">
                        <span className={`${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Маржинальность</span>
                      </div>
                      <div className="absolute left-0 bottom-0 transform -translate-x-6 rotate-270 origin-bottom-left text-xs">
                        <span className={`${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Популярность</span>
                      </div>
                      
                      {/* Квадранты */}
                      <div className="absolute left-1/2 bottom-1/2 transform translate-x-px translate-y-px w-1/2 h-1/2 bg-green-500/10 border-green-500/30 border"></div>
                      <div className="absolute left-0 bottom-1/2 transform translate-y-px w-1/2 h-1/2 bg-yellow-500/10 border-yellow-500/30 border"></div>
                      <div className="absolute left-1/2 bottom-0 transform translate-x-px w-1/2 h-1/2 bg-blue-500/10 border-blue-500/30 border"></div>
                      <div className="absolute left-0 bottom-0 w-1/2 h-1/2 bg-red-500/10 border-red-500/30 border"></div>
                      
                      {/* Точки для блюд */}
                      {(menuMetrics.menuItemPerformance || []).slice(0, 15).map((item, index) => {
                        // Нормализация координат для матрицы
                        const x = (item.profitMargin / 100) * 100; // от 0 до 100%
                        const y = Math.min(item.salesCount / (menuMetrics.topSellingDishes[0]?.salesCount || 1) * 100, 100); // от 0 до 100%
                        
                        // Определение цвета точки на основе квадранта
                        let color;
                        if (x >= 50 && y >= 50) color = isDark ? 'bg-green-600' : 'bg-green-500'; // Звезды
                        else if (x >= 50 && y < 50) color = isDark ? 'bg-yellow-600' : 'bg-yellow-500'; // Загадки
                        else if (x < 50 && y >= 50) color = isDark ? 'bg-blue-600' : 'bg-blue-500'; // Рабочие лошадки
                        else color = isDark ? 'bg-red-600' : 'bg-red-500'; // Проблемные
                        
                        return (
                          <div 
                            key={item.dishId} 
                            className={`absolute w-4 h-4 rounded-full ${color} shadow-lg transform -translate-x-1/2 -translate-y-1/2 cursor-pointer hover:ring-2 ring-white`}
                            style={{
                              left: `${x}%`,
                              bottom: `${y}%`,
                            }}
                            title={`${item.dishName}: Маржа ${item.profitMargin}%, Продажи ${item.salesCount} шт.`}
                          ></div>
                        );
                      })}
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
                        {menuMetrics.topSellingDishes.slice(0, 10).map((dish, index) => (
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
                  
                  {/* Популярность категорий */}
                  {(menuMetrics.categoryPerformance && Object.entries(menuMetrics.categoryPerformance).length > 0) ? (
                    <div className="space-y-4">
                      {Object.entries(menuMetrics.categoryPerformance).map(([categoryId, performance]: [string, any]) => {
                        const percentage = performance?.salesPercentage || 0;
                        const categoryName = getCategoryName(parseInt(categoryId));
                        
                        return (
                          <div key={categoryId} className="mb-4">
                            <div className="flex justify-between items-center mb-1">
                              <span className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{categoryName}</span>
                              <span className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{percentage.toFixed(1)}%</span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2">
                              <div 
                                className="h-2 rounded-full bg-gradient-to-r from-primary-500 to-primary-300" 
                                style={{ width: `${percentage}%` }}
                              ></div>
                            </div>
                            <div className="flex justify-between text-xs mt-1">
                              <span className={`${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Ср. чек: {formatCurrency(performance?.averageOrderValue || 0)} ₸</span>
                              <span className={`${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Маржа: {performance?.averageProfitMargin || 0}%</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className={`text-center p-6 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                      <p>Нет данных о категориях</p>
                    </div>
                  )}
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
                        {menuMetrics.leastSellingDishes.slice(0, 5).map((dish, index) => (
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
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                <div className={`p-6 rounded-lg ${isDark ? 'bg-gray-700' : 'bg-gray-50'} text-center`}>
                  <h4 className={`text-sm uppercase font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'} mb-2`}>Новые клиенты</h4>
                  <p className={`text-3xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{customerMetrics.newCustomers}</p>
                  <p className={`text-sm mt-2 ${customerMetrics.newCustomersChange >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                    {customerMetrics.newCustomersChange >= 0 ? '+' : ''}{customerMetrics.newCustomersChange}%
                  </p>
                </div>
                
                <div className={`p-6 rounded-lg ${isDark ? 'bg-gray-700' : 'bg-gray-50'} text-center`}>
                  <h4 className={`text-sm uppercase font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'} mb-2`}>Удовлетворенность</h4>
                  <p className={`text-3xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{customerMetrics.customerSatisfaction} / 5.0</p>
                  <div className="flex justify-center mt-2">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <svg key={star} className={`h-5 w-5 ${star <= Math.round(customerMetrics.customerSatisfaction) ? isDark ? 'text-yellow-400' : 'text-yellow-500' : isDark ? 'text-gray-600' : 'text-gray-300'}`} fill="currentColor" viewBox="0 0 20 20">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118l-2.8-2.034c-.783-.57-.38-1.81.588-1.81h3.462a1 1 0 00.95-.69l1.07-3.292z" />
                      </svg>
                    ))}
                  </div>
                </div>
                
                <div className={`p-6 rounded-lg ${isDark ? 'bg-gray-700' : 'bg-gray-50'} text-center`}>
                  <h4 className={`text-sm uppercase font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'} mb-2`}>Процент возврата</h4>
                  <p className={`text-3xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{customerMetrics.returnRate}%</p>
                  <p className={`text-sm mt-2 ${customerMetrics.returnRateChange >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                    {customerMetrics.returnRateChange >= 0 ? '+' : ''}{customerMetrics.returnRateChange}%
                  </p>
                </div>
                
                <div className={`p-6 rounded-lg ${isDark ? 'bg-gray-700' : 'bg-gray-50'} text-center`}>
                  <h4 className={`text-sm uppercase font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'} mb-2`}>Средний чек</h4>
                  <p className={`text-3xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{formatCurrency(customerMetrics.averageOrderValue)} ₸</p>
                  <p className={`text-sm mt-2 ${customerMetrics.averageOrderValueChange >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                    {customerMetrics.averageOrderValueChange >= 0 ? '+' : ''}{customerMetrics.averageOrderValueChange}%
                  </p>
                </div>
              </div>
              
              {/* Демография клиентов */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                <div className={`p-6 rounded-lg ${isDark ? 'bg-gray-700' : 'bg-gray-50'}`}>
                  <h4 className={`font-medium mb-6 ${isDark ? 'text-white' : 'text-gray-900'}`}>Возрастные группы</h4>
                  
                  <div className="space-y-4">
                    {(customerMetrics.customerDemographics?.age && Object.entries(customerMetrics.customerDemographics.age).length > 0) ? (
                      Object.entries(customerMetrics.customerDemographics.age).map(([ageGroup, percentage]) => (
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
                  <h4 className={`font-medium mb-6 ${isDark ? 'text-white' : 'text-gray-900'}`}>Гендерное распределение</h4>
                  
                  <div className="flex items-center justify-center h-64">
                    {/* Имитация круговой диаграммы */}
                    <div className="relative h-48 w-48">
                      {customerMetrics.customerDemographics?.gender && Object.entries(customerMetrics.customerDemographics.gender).length > 0 ? (
                        Object.entries(customerMetrics.customerDemographics.gender).map(([gender, percentage], index) => {
                          const colors = {
                            'Мужчины': 'bg-blue-500',
                            'Женщины': 'bg-pink-500',
                            'Не указано': 'bg-gray-500'
                          };
                          const color = colors[gender as keyof typeof colors] || 'bg-gray-500';
                          
                          // Преобразуем процент в градусы для круговой диаграммы
                          const degrees = (percentage as number / 100) * 360;
                          
                          return (
                            <div key={gender} className="absolute inset-0 flex items-center justify-center">
                              <div 
                                className={`h-48 w-48 rounded-full absolute ${color} opacity-80`}
                                style={{ 
                                  clipPath: `polygon(50% 50%, 50% 0%, ${50 + 50 * Math.cos(degrees * Math.PI / 180)}% ${50 - 50 * Math.sin(degrees * Math.PI / 180)}%, 50% 50%)`,
                                  transform: `rotate(${index * 120}deg)` 
                                }}
                              ></div>
                              <div className="z-10 bg-white opacity-70 rounded-full h-24 w-24 flex items-center justify-center">
                                <div className="text-center">
                                  <p className="text-sm font-medium text-gray-800">{gender}</p>
                                  <p className="text-lg font-bold text-gray-900">{percentage as number}%</p>
                                </div>
                      </div>
                    </div>
                  );
                })
                      ) : (
                        <div className={`text-center p-6 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                          <p>Нет данных о гендерных группах</p>
            </div>
                      )}
          </div>
        </div>
                </div>
              </div>
              
              {/* Возрастная группа */}
              <div className={`p-6 rounded-lg ${isDark ? 'bg-gray-700' : 'bg-gray-50'}`}>
                <h4 className={`font-medium mb-6 ${isDark ? 'text-white' : 'text-gray-900'}`}>Распределение по возрастным группам</h4>
                
                <div className="mt-4">
                  {customerMetrics?.customerDemographics?.age && Object.entries(customerMetrics.customerDemographics.age).length > 0 ? (
                    Object.entries(customerMetrics.customerDemographics.age).map(([ageGroup, percentage]) => (
                      <div key={ageGroup} className="mb-3">
                        <div className="flex justify-between mb-1">
                          <span className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{ageGroup}</span>
                          <span className={`text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{Number(percentage)}%</span>
                        </div>
                        <div className={`h-2.5 rounded-full ${isDark ? 'bg-gray-600' : 'bg-gray-200'}`}>
                          <div 
                            className="h-2.5 rounded-full bg-blue-600" 
                            style={{ width: `${Number(percentage)}%` }}
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
              
              {/* Частота посещений и лояльность */}
              <div className={`p-6 rounded-lg ${isDark ? 'bg-gray-700' : 'bg-gray-50'}`}>
                <h4 className={`font-medium mb-6 ${isDark ? 'text-white' : 'text-gray-900'}`}>Распределение по времени посещений</h4>
                
                <div className="mt-4">
                  {customerMetrics.visitTimes && Object.entries(customerMetrics.visitTimes).length > 0 ? (
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
                      <p>Нет данных о времени посещений</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </Layout>
  );
};

export default AdminAnalyticsPage; 