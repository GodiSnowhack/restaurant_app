import type { NextPage } from 'next';
import { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { 
  FinancialMetrics, 
  CustomerMetrics, 
  OperationalMetrics,
  MenuMetrics,
  PredictiveMetrics,
  AnalyticsFilters 
} from '../../types/analytics';
import { useTheme } from '@/lib/theme-context';
import LoadingSpinner from '../../components/LoadingSpinner';
import { api } from '../../lib/api';

interface AnalyticsPageProps {
  // Добавьте необходимые пропсы, если они есть
}

const AnalyticsPage: NextPage<AnalyticsPageProps> = () => {
  const [timeRange, setTimeRange] = useState<string>('week');
  const [menuMetrics, setMenuMetrics] = useState<MenuMetrics | null>(null);
  const [predictiveMetrics, setPredictiveMetrics] = useState<PredictiveMetrics | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Функция для получения диапазона дат из временного диапазона
  const getDateRangeFromTimeRange = (timeRange: string) => {
    const now = new Date();
    const endDate = now.toISOString().split('T')[0];
    let startDate: string;

    switch (timeRange) {
      case 'day':
        startDate = new Date(now.setDate(now.getDate() - 1)).toISOString().split('T')[0];
        break;
      case 'week':
        startDate = new Date(now.setDate(now.getDate() - 7)).toISOString().split('T')[0];
        break;
      case 'month':
        startDate = new Date(now.setMonth(now.getMonth() - 1)).toISOString().split('T')[0];
        break;
      case 'year':
        startDate = new Date(now.setFullYear(now.getFullYear() - 1)).toISOString().split('T')[0];
        break;
      default:
        startDate = endDate;
    }

    return { startDate, endDate };
  };

  const processMenuData = (menuData: any): MenuMetrics | null => {
    try {
      if (
        'topSellingDishes' in menuData &&
        'mostProfitableDishes' in menuData &&
        'leastSellingDishes' in menuData &&
        'averageCookingTime' in menuData &&
        'categoryPopularity' in menuData &&
        Array.isArray(menuData.topSellingDishes)
      ) {
        const typedMenuData: MenuMetrics = {
          ...menuData,
          topSellingDishes: menuData.topSellingDishes.map((dish: any) => {
            if (
              typeof dish.dishId !== 'number' ||
              typeof dish.dishName !== 'string' ||
              typeof dish.salesCount !== 'number' ||
              typeof dish.revenue !== 'number' ||
              typeof dish.percentage !== 'number'
            ) {
              throw new Error('Некорректный формат данных блюда');
            }
    return {
              dishId: dish.dishId,
              dishName: dish.dishName,
              salesCount: dish.salesCount,
              revenue: dish.revenue,
              percentage: dish.percentage,
              categoryId: typeof dish.categoryId === 'number' ? dish.categoryId : undefined,
              categoryName: typeof dish.categoryName === 'string' ? dish.categoryName : undefined
            };
          })
        };
        return typedMenuData;
      }
    } catch (error) {
      console.error('Ошибка при обработке данных меню:', error);
    }
    return null;
  };

  const processPredictiveData = (predictiveData: any): PredictiveMetrics | null => {
    try {
      if (
        'salesForecast' in predictiveData &&
        'suggestedPromotions' in predictiveData &&
        Array.isArray(predictiveData.suggestedPromotions)
      ) {
        const typedPredictiveData: PredictiveMetrics = {
          ...predictiveData,
          suggestedPromotions: predictiveData.suggestedPromotions.map((promo: any) => {
            if (
              typeof promo.dishId !== 'number' ||
              typeof promo.dishName !== 'string' ||
              typeof promo.reason !== 'string' ||
              typeof promo.suggestedDiscount !== 'number' ||
              typeof promo.potentialRevenue !== 'number'
            ) {
              throw new Error('Некорректный формат данных акции');
            }
            return {
              dishId: promo.dishId,
              dishName: promo.dishName,
              reason: promo.reason,
              suggestedDiscount: promo.suggestedDiscount,
              potentialRevenue: promo.potentialRevenue
            };
          })
        };
        return typedPredictiveData;
      }
    } catch (error) {
      console.error('Ошибка при обработке предиктивных данных:', error);
    }
    return null;
  };

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        const { startDate, endDate } = getDateRangeFromTimeRange(timeRange);
        
        // Запросы к API
        const results = await Promise.allSettled([
          api.get('/analytics/menu', { params: { startDate, endDate } }),
          api.get('/analytics/predictive', { params: { startDate, endDate } })
        ]);

        // Явно указываем тип для результатов
        const [menuResult, predictiveResult] = results as [
          PromiseSettledResult<{ data: any }>,
          PromiseSettledResult<{ data: any }>
        ];

        if (menuResult?.status === 'fulfilled') {
          const processedMenuData = processMenuData(menuResult.value.data);
          if (processedMenuData) {
            setMenuMetrics(processedMenuData);
          } else {
            setError(prev => (prev ? `${prev}\nНекорректный формат данных меню.` : 'Некорректный формат данных меню.'));
          }
        } else if (menuResult?.status === 'rejected') {
          console.error('Ошибка при загрузке метрик меню:', menuResult.reason);
          setError(prev => (prev ? `${prev}\nОшибка загрузки метрик меню.` : 'Ошибка загрузки метрик меню.'));
        }

        if (predictiveResult?.status === 'fulfilled') {
          const processedPredictiveData = processPredictiveData(predictiveResult.value.data);
          if (processedPredictiveData) {
            setPredictiveMetrics(processedPredictiveData);
          } else {
            setError(prev => (prev ? `${prev}\nНекорректный формат предиктивных данных.` : 'Некорректный формат предиктивных данных.'));
          }
        } else if (predictiveResult?.status === 'rejected') {
          console.error('Ошибка при загрузке предиктивных метрик:', predictiveResult.reason);
          setError(prev => (prev ? `${prev}\nОшибка загрузки предиктивных метрик.` : 'Ошибка загрузки предиктивных метрик.'));
        }
      } catch (error) {
        console.error('Ошибка при загрузке данных:', error);
        setError('Произошла ошибка при загрузке данных.');
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [timeRange]);
                          
                          return (
                  <div>
      {isLoading && <LoadingSpinner />}
      {error && <div className="error">{error}</div>}
      {/* Остальной JSX код */}
                        </div>
  );
};

export default AnalyticsPage; 