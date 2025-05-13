'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { menuApi } from '@/lib/api/menu';
import { isMobileDevice } from '@/lib/utils';
import { Dish, ApiDish, Category, CartItem } from '@/types';
import { useRouter } from 'next/router';
import useCartStore from '@/lib/cart-store';
import { useSettings } from '@/settings-context';
import { useTheme } from '@/lib/theme-context';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { Spinner } from '@/components/ui/spinner';
import DishCard from '@/components/ui/dish-card';

// Добавляем функцию для безопасного парсинга JSON
const safeJsonParse = (jsonString: string | null | undefined, defaultValue: any) => {
  if (!jsonString) return defaultValue;
  try {
    return JSON.parse(jsonString);
  } catch (error) {
    console.warn('Ошибка парсинга JSON:', error);
    return defaultValue;
  }
};

export default function MenuPage() {
  const router = useRouter();
  const { addItem, removeItem, items } = useCartStore();
  const { settings } = useSettings();
  const { isDark } = useTheme();
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [isMobile, setIsMobile] = useState(false);
  const [networkStatus, setNetworkStatus] = useState<'online' | 'offline' | 'error'>('online');
  const maxRetries = 3;

  // Определяем, является ли устройство мобильным
  useEffect(() => {
    setIsMobile(isMobileDevice());
  }, []);

  // Отслеживаем статус сети
  useEffect(() => {
    const handleOnline = () => setNetworkStatus('online');
    const handleOffline = () => setNetworkStatus('offline');
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    setNetworkStatus(navigator.onLine ? 'online' : 'offline');
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Загрузка категорий
  useEffect(() => {
    const loadCategories = async () => {
      try {
        setCategoriesLoading(true);
        const data = await menuApi.getCategories();
        // Преобразуем данные категорий
        const mappedCategories = data.map((category): Category => ({
          id: category.id,
          name: category.name,
          description: category.description || '',
          image_url: category.image_url,
          is_active: category.is_active,
          order: category.order,
          created_at: category.created_at,
          updated_at: category.updated_at,
          dish_count: category.dish_count
        }));
        setCategories(mappedCategories);
      } catch (error) {
        console.error('Ошибка при загрузке категорий:', error);
        setError('Не удалось загрузить категории');
      } finally {
        setCategoriesLoading(false);
      }
    };

    loadCategories();
  }, []);

  // Загрузка блюд
  useEffect(() => {
    const loadDishes = async () => {
      try {
        setLoading(true);
        setError(null);
        
        console.log('Загрузка блюд...');
        const data = await menuApi.getDishes();
        console.log('Получены данные от API:', data);
        
        // Преобразуем данные для соответствия интерфейсу
        const mappedDishes = (data as ApiDish[]).map((dish): Dish => {
          console.log('Обработка блюда:', dish);
          return {
            id: dish.id,
            name: dish.name,
            description: dish.description || '',
            price: typeof dish.price === 'string' ? parseFloat(dish.price) : dish.price,
            image_url: dish.image_url || null,
            is_available: dish.is_available ?? true,
            category_id: dish.category_id || 0,
            is_vegetarian: dish.is_vegetarian ?? false,
            is_vegan: dish.is_vegan ?? false,
            calories: dish.calories !== undefined ? parseInt(dish.calories.toString()) : null,
            cooking_time: dish.cooking_time !== undefined ? parseInt(dish.cooking_time.toString()) : null
          };
        });
        
        console.log('Преобразованные данные:', mappedDishes);
        
        // Фильтруем блюда по категории, если она выбрана
        const filteredDishes = selectedCategory 
          ? mappedDishes.filter(dish => dish.category_id === selectedCategory)
          : mappedDishes;
        
        console.log('Отфильтрованные блюда:', filteredDishes);
        setDishes(filteredDishes);
        setRetryCount(0);
      } catch (error) {
        console.error('Ошибка при загрузке блюд:', error);
        if (retryCount < maxRetries) {
          setRetryCount(prev => prev + 1);
          setTimeout(loadDishes, 2000 * Math.pow(2, retryCount));
        } else {
          setError('Не удалось загрузить меню. Пожалуйста, попробуйте позже.');
        }
      } finally {
        setLoading(false);
      }
    };

    if (networkStatus === 'online') {
      loadDishes();
    }
  }, [selectedCategory, networkStatus, retryCount]);

  const handleAddToCart = useCallback((dish: Dish) => {
    addItem({
      dish_id: dish.id,
      name: dish.name,
      price: dish.price,
      quantity: 1,
      image_url: dish.image_url || undefined,
      comment: undefined
    });
  }, [addItem]);

  const handleRemoveFromCart = useCallback((cartItemId: string) => {
    removeItem(cartItemId);
  }, [removeItem]);

  return (
    <>
      <Header />
      <div className={`
        min-h-screen py-8 px-4 sm:px-6 lg:px-8
        ${isDark ? 'bg-gray-900 text-gray-100' : 'bg-gray-50 text-gray-900'}
      `}>
        {/* Заголовок и описание */}
        <div className="max-w-7xl mx-auto text-center mb-8">
          <h1 className={`
            text-3xl font-bold mb-4
            ${isDark ? 'text-gray-100' : 'text-gray-900'}
          `}>
            Меню
          </h1>
          <p className={`
            text-lg max-w-2xl mx-auto
            ${isDark ? 'text-gray-400' : 'text-gray-600'}
          `}>
            Откройте для себя наши изысканные блюда, приготовленные с любовью и заботой о каждой детали
          </p>
          </div>

        {/* Фильтр категорий */}
        {!categoriesLoading && categories.length > 0 && (
          <div className="max-w-7xl mx-auto mb-8">
            <div className="flex flex-wrap justify-center gap-2">
                <button
                onClick={() => setSelectedCategory(null)}
                className={`
                  px-4 py-2 rounded-full text-sm font-medium transition-all duration-200
                  ${selectedCategory === null
                    ? isDark
                      ? 'bg-primary text-white shadow-lg shadow-primary/50'
                      : 'bg-primary text-white'
                    : isDark
                      ? 'bg-gray-800 text-gray-300 hover:bg-gray-700 hover:text-white'
                      : 'bg-white text-gray-600 hover:bg-gray-100'
                  }
                `}
                >
                  Все блюда
                </button>
                {categories.map((category) => (
                  <button
                    key={category.id}
                  onClick={() => setSelectedCategory(category.id)}
                  className={`
                    px-4 py-2 rounded-full text-sm font-medium transition-all duration-200
                    ${selectedCategory === category.id
                      ? isDark
                        ? 'bg-primary text-white shadow-lg shadow-primary/50'
                        : 'bg-primary text-white'
                      : isDark
                        ? 'bg-gray-800 text-gray-300 hover:bg-gray-700 hover:text-white'
                        : 'bg-white text-gray-600 hover:bg-gray-100'
                    }
                  `}
                  >
                    {category.name}
                  </button>
                ))}
        </div>
          </div>
        )}

        {/* Состояние загрузки */}
        {loading && dishes.length === 0 && (
          <div className="flex flex-col justify-center items-center py-12">
            <Spinner size="lg" />
            <p className={`mt-4 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
              Загрузка меню...
            </p>
          </div>
        )}

        {/* Сетка блюд */}
        {dishes.length > 0 && (
          <div className="max-w-7xl mx-auto">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {dishes.map((dish) => {
                const cartItem = items.find(item => item.dish_id === dish.id);
                return (
                  <DishCard
                    key={dish.id}
                    {...dish}
                    cartItem={cartItem}
                    onAddToCart={() => handleAddToCart(dish)}
                    onRemoveFromCart={() => cartItem && handleRemoveFromCart(cartItem.id)}
                  />
                );
              })}
            </div>
          </div>
        )}

        {/* Сообщение об ошибке */}
        {error && (
          <div className={`
            max-w-md mx-auto mt-8 p-4 rounded-lg text-center
            ${isDark ? 'bg-red-900 text-red-100' : 'bg-red-100 text-red-800'}
          `}>
            <p>{error}</p>
                        <button
              onClick={() => {
                setError(null);
                setRetryCount(0);
              }}
              className={`
                mt-2 px-4 py-2 rounded-md text-sm font-medium
                ${isDark
                  ? 'bg-red-800 text-white hover:bg-red-700'
                  : 'bg-red-200 text-red-900 hover:bg-red-300'
                }
              `}
                        >
              Попробовать снова
                        </button>
          </div>
        )}

        {/* Сообщение, если блюд нет */}
        {!loading && !error && dishes.length === 0 && (
          <div className={`
            text-center py-12
            ${isDark ? 'text-gray-400' : 'text-gray-500'}
          `}>
            <p>В данной категории пока нет блюд</p>
          </div>
        )}
      </div>
      <Footer />
    </>
  );
} 