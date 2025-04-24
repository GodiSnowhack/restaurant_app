'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { menuApi, isMobileDevice } from '@/lib/api';
import { Dish, Category } from '@/types';
import { useRouter } from 'next/router';
import Image from 'next/image';
import useCartStore from '@/lib/cart-store';
import { PlusIcon, MinusIcon } from '@heroicons/react/24/solid';
import { useSettings } from '@/settings-context';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { Spinner } from '@/components/ui/spinner';

export default function MenuPage() {
  const router = useRouter();
  const { addItem, removeItem, items } = useCartStore();
  const { settings } = useSettings();
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
    
    // Проверяем сеть при монтировании
    setNetworkStatus(navigator.onLine ? 'online' : 'offline');
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Функция загрузки категорий с обработкой ошибок
  const loadCategories = useCallback(async () => {
    try {
      setCategoriesLoading(true);
      const data = await menuApi.getCategories();
      setCategories(data);
      setCategoriesLoading(false);
    } catch (err) {
      console.error('Ошибка при загрузке категорий:', err);
      
      // Проверяем кэш
      try {
        const cachedCategories = localStorage.getItem('cached_categories');
        if (cachedCategories) {
          const parsedCategories = JSON.parse(cachedCategories);
          setCategories(parsedCategories);
          console.log('Используем кэшированные категории');
        }
      } catch (cacheErr) {
        console.error('Ошибка при получении кэшированных категорий:', cacheErr);
      }
      
      setCategoriesLoading(false);
      
      if (retryCount < maxRetries) {
        setTimeout(() => {
          setRetryCount(prev => prev + 1);
          loadCategories();
        }, 2000 * (retryCount + 1)); // Увеличиваем задержку с каждой попыткой
      }
    }
  }, [retryCount]);

  // Функция загрузки блюд с обработкой ошибок и кэшированием
  const loadDishes = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Если выбрана категория
      const params = selectedCategory ? { category_id: selectedCategory } : undefined;
      
      // Проверяем кэш сначала
      const cacheKey = params ? `cached_dishes_${JSON.stringify(params)}` : 'cached_dishes';
      let cachedData = null;
      
      try {
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
          cachedData = JSON.parse(cached);
          // Показываем кэшированные данные сразу
          setDishes(cachedData);
          setLoading(false);
          console.log('Используем кэшированные блюда временно');
        }
      } catch (cacheErr) {
        console.error('Ошибка при получении кэшированных блюд:', cacheErr);
      }
      
      // Затем делаем запрос для актуальных данных
      const data = await menuApi.getDishes(params);
      setDishes(data);
      setLoading(false);
      
      // Обновляем данные в кэше
      try {
        localStorage.setItem(cacheKey, JSON.stringify(data));
      } catch (cacheErr) {
        console.error('Ошибка при кэшировании блюд:', cacheErr);
      }
    } catch (err: any) {
      console.error('Ошибка при загрузке блюд:', err);
      
      // Если сетевая ошибка
      if (err.message?.includes('internet') || !navigator.onLine) {
        setNetworkStatus('offline');
      } else {
        setNetworkStatus('error');
      }
      
      setError(`Не удалось загрузить меню. ${navigator.onLine ? 'Пожалуйста, попробуйте позже.' : 'Проверьте подключение к интернету.'}`);
      
      // Проверяем кэш для offline fallback
      try {
        const cacheKey = selectedCategory ? `cached_dishes_${JSON.stringify({category_id: selectedCategory})}` : 'cached_dishes';
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
          const cachedData = JSON.parse(cached);
          setDishes(cachedData);
          console.log('Используем кэшированные блюда из-за ошибки');
        }
      } catch (cacheErr) {
        console.error('Ошибка при получении кэшированных блюд:', cacheErr);
      }
      
      setLoading(false);
      
      if (retryCount < maxRetries) {
        setTimeout(() => {
          setRetryCount(prev => prev + 1);
          loadDishes();
        }, 2000 * (retryCount + 1)); // Увеличиваем задержку с каждой попыткой
      }
    }
  }, [selectedCategory, retryCount]);

  // Загружаем категории при монтировании
  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  // Загружаем блюда при изменении категории
  useEffect(() => {
    loadDishes();
  }, [selectedCategory, loadDishes]);

  // Перезагружаем данные при возвращении онлайн
  useEffect(() => {
    if (networkStatus === 'online') {
      setRetryCount(0);
      loadCategories();
      loadDishes();
    }
  }, [networkStatus, loadCategories, loadDishes]);

  const handleCategoryClick = (categoryId: number | null) => {
    setSelectedCategory(categoryId);
    setRetryCount(0); // Сбрасываем счетчик попыток
  };

  const handleRetry = () => {
    setRetryCount(0);
    setError(null);
    loadDishes();
  };

  return (
    <>
      <Header />
      <div className="container mx-auto px-4 md:px-6 lg:px-8 max-w-[1400px] py-8">
        {/* Уведомление об отсутствии сети */}
        {networkStatus === 'offline' && (
          <div className="mb-4 p-3 bg-yellow-50 text-yellow-700 rounded-lg flex items-center">
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <p>Вы находитесь в автономном режиме. Показаны ранее загруженные данные.</p>
          </div>
        )}

        {/* Категории */}
        <div className="mb-8 overflow-x-auto">
          <div className="flex space-x-3 pb-4 min-w-max">
            {categoriesLoading ? (
              <div className="py-2 px-4 flex items-center">
                <Spinner size="sm" className="mr-2" />
                <span className="text-gray-500">Загрузка категорий...</span>
              </div>
            ) : (
              <>
                <button
                  onClick={() => handleCategoryClick(null)}
                  className={`px-4 py-2 rounded-full ${
                    selectedCategory === null
                      ? 'bg-primary text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Все блюда
                </button>
                {categories.map((category) => (
                  <button
                    key={category.id}
                    onClick={() => handleCategoryClick(category.id)}
                    className={`px-4 py-2 rounded-full ${
                      selectedCategory === category.id
                        ? 'bg-primary text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {category.name}
                  </button>
                ))}
              </>
            )}
          </div>
        </div>

        {/* Сообщение об ошибке */}
        {error && (
          <div className="mb-8 p-4 bg-red-50 text-red-700 rounded-lg">
            <p>{error}</p>
            <button
              onClick={handleRetry}
              className="mt-2 text-sm font-medium px-3 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200"
            >
              Попробовать снова
            </button>
          </div>
        )}

        {/* Индикатор загрузки */}
        {loading && dishes.length === 0 && (
          <div className="flex flex-col justify-center items-center py-12">
            <Spinner size="lg" />
            <p className="mt-4 text-gray-600">Загрузка меню...</p>
          </div>
        )}

        {/* Сетка блюд */}
        {dishes.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {dishes.map((dish) => {
              const cartItem = items.find(item => item.dishId === dish.id);
              return (
                <div
                  key={dish.id}
                  className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow duration-300"
                >
                  <div className="relative h-48 w-full">
                    <Image
                      src={dish.image_url || '/images/dishes/default.jpg'}
                      alt={dish.name}
                      layout="fill"
                      objectFit="cover"
                      className="transition-transform duration-300 hover:scale-105"
                    />
                  </div>
                  <div className="p-4 flex flex-col h-[150px]">
                    <h3 className="text-lg font-semibold mb-2 truncate">{dish.name}</h3>
                    <p className="text-gray-600 text-sm mb-2 line-clamp-2 flex-grow">{dish.description}</p>
                    <div className="flex justify-between items-center mt-auto">
                      <span className="text-primary font-bold whitespace-nowrap">
                        {dish.price} {settings.currency_symbol}
                      </span>
                      {cartItem ? (
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => removeItem(cartItem.id)}
                            className="p-1 rounded-full bg-gray-100 hover:bg-gray-200"
                          >
                            <MinusIcon className="h-4 w-4 text-gray-600" />
                          </button>
                          <span className="text-gray-900 font-medium min-w-[20px] text-center">{cartItem.quantity}</span>
                          <button
                            onClick={() => addItem({
                              dishId: dish.id,
                              name: dish.name,
                              price: dish.price,
                              quantity: 1,
                              imageUrl: dish.image_url
                            })}
                            className="p-1 rounded-full bg-gray-100 hover:bg-gray-200"
                          >
                            <PlusIcon className="h-4 w-4 text-gray-600" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => addItem({
                            dishId: dish.id,
                            name: dish.name,
                            price: dish.price,
                            quantity: 1,
                            imageUrl: dish.image_url
                          })}
                          className="px-3 py-1.5 bg-primary text-white rounded-md hover:bg-primary-dark text-sm whitespace-nowrap"
                        >
                          Добавить
                        </button>
                      )}
                    </div>
                    {dish.is_vegetarian && (
                      <span className="text-green-600 text-sm mt-1 inline-block" title="Вегетарианское блюдо">🌱</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Сообщение, если блюд нет */}
        {!loading && !error && dishes.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500">В данной категории пока нет блюд</p>
          </div>
        )}
      </div>
      <Footer />
    </>
  );
} 