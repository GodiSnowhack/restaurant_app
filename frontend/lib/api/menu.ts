import { api } from './core';
import type { Dish, Category } from '@/types';

// API функции для работы с меню и блюдами
export const menuApi = {
  // Получение всех категорий
  getCategories: async (): Promise<Category[]> => {
    try {
      console.log('API: Получение категорий...');
      const response = await api.get('/menu/categories');
      
      if (!response.data) {
        throw new Error('Данные не получены');
      }
      
      // Сохраняем в кеш
      try {
        localStorage.setItem('cached_categories', JSON.stringify(response.data));
        localStorage.setItem('categories_cache_timestamp', Date.now().toString());
      } catch (cacheError) {
        console.error('API: Ошибка при кешировании категорий:', cacheError);
      }
      
      return response.data;
    } catch (error) {
      console.error('API: Ошибка при получении категорий:', error);
      
      // Пробуем получить из кеша
      try {
        const cachedCategories = localStorage.getItem('cached_categories');
        if (cachedCategories) {
          console.log('API: Используем кешированные категории');
          return JSON.parse(cachedCategories);
        }
      } catch (cacheError) {
        console.error('API: Ошибка при чтении кеша категорий:', cacheError);
      }
      
      return [];
    }
  },
  
  // Получение категории по ID
  getCategoryById: async (id: number): Promise<Category | null> => {
    try {
      const response = await api.get(`/categories/${id}`);
      return response.data;
    } catch (error) {
      console.error(`API: Ошибка при получении категории ${id}:`, error);
      return null;
    }
  },
  
  // Создание новой категории
  createCategory: async (category: Omit<Category, 'id' | 'created_at' | 'updated_at'>): Promise<Category> => {
    const response = await api.post('/categories', category);
    return response.data;
  },
  
  // Обновление категории
  updateCategory: async (id: number, category: Partial<Category>): Promise<Category> => {
    const response = await api.put(`/categories/${id}`, category);
    return response.data;
  },
  
  // Удаление категории
  deleteCategory: async (id: number): Promise<void> => {
    await api.delete(`/categories/${id}`);
  },
  
  // Получение всех блюд
  getDishes: async (): Promise<Dish[]> => {
    try {
      console.log('API: Получение блюд...');
      const response = await fetch('/api/menu/dishes');
      
      if (!response.ok) {
        throw new Error(`Ошибка HTTP: ${response.status}`);
      }
      
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('API: Ошибка при получении блюд:', error);
      return [];
    }
  },
  
  // Получение блюд по категории
  getDishesByCategory: async (categoryId: number): Promise<Dish[]> => {
    try {
      console.log(`API: Получение блюд для категории ${categoryId}...`);
      
      // Сначала проверяем, есть ли кешированные данные для этой категории
      try {
        const cachedCategoryDishes = localStorage.getItem(`cached_dishes_category_${categoryId}`);
        const cacheTimestamp = localStorage.getItem(`dishes_category_${categoryId}_cache_timestamp`);
        
        // Проверяем, что кеш не устарел (не старше 1 часа)
        if (cachedCategoryDishes && cacheTimestamp) {
          const cacheTime = parseInt(cacheTimestamp, 10);
          const now = Date.now();
          const cacheAge = now - cacheTime;
          
          // Если кеш не старше 1 часа, используем его
          if (cacheAge < 3600000) { // 1 час в миллисекундах
            console.log(`API: Используем кешированные блюда для категории ${categoryId} (возраст кеша: ${cacheAge / 1000}с)`);
            return JSON.parse(cachedCategoryDishes);
          }
        }
      } catch (cacheError) {
        console.error(`API: Ошибка при проверке кеша для категории ${categoryId}:`, cacheError);
      }
      
      // Если кеша нет или он устарел, делаем запрос к API
      try {
        const response = await api.get(`/categories/${categoryId}/dishes`);
        console.log(`API: Успешно получены блюда для категории ${categoryId}, количество:`, response.data.length);
        
        // Кешируем результат
        try {
          localStorage.setItem(`cached_dishes_category_${categoryId}`, JSON.stringify(response.data));
          localStorage.setItem(`dishes_category_${categoryId}_cache_timestamp`, Date.now().toString());
        } catch (cacheError) {
          console.error(`API: Ошибка при кешировании блюд для категории ${categoryId}:`, cacheError);
        }
        
        return response.data;
      } catch (apiError) {
        console.error(`API: Ошибка при получении блюд через API для категории ${categoryId}:`, apiError);
        
        // Пробуем получить через fetch
        try {
          const response = await fetch(`/api/categories/${categoryId}/dishes`);
          
          if (!response.ok) {
            throw new Error(`Ошибка HTTP: ${response.status}`);
          }
          
          const data = await response.json();
          console.log(`API: Успешно получены блюда через fetch для категории ${categoryId}, количество:`, data.length);
          
          // Кешируем результат
          try {
            localStorage.setItem(`cached_dishes_category_${categoryId}`, JSON.stringify(data));
            localStorage.setItem(`dishes_category_${categoryId}_cache_timestamp`, Date.now().toString());
          } catch (cacheError) {
            console.error(`API: Ошибка при кешировании блюд для категории ${categoryId}:`, cacheError);
          }
          
          return data;
        } catch (fetchError) {
          console.error(`API: Ошибка при получении блюд через fetch для категории ${categoryId}:`, fetchError);
          
          // Если обе попытки завершились неудачно, проверяем кеш (даже устаревший)
          const cachedCategoryDishes = localStorage.getItem(`cached_dishes_category_${categoryId}`);
          if (cachedCategoryDishes) {
            console.log(`API: Используем устаревший кеш для категории ${categoryId}`);
            return JSON.parse(cachedCategoryDishes);
          }
          
          // Если совсем нет кеша, попробуем поискать блюда в общем кеше блюд
          const cachedDishes = localStorage.getItem('cached_dishes');
          if (cachedDishes) {
            console.log(`API: Фильтруем блюда для категории ${categoryId} из общего кеша`);
            const allDishes = JSON.parse(cachedDishes);
            return allDishes.filter((dish: Dish) => dish.category_id === categoryId);
          }
          
          // Если и общего кеша нет, возвращаем пустой массив
          return [];
        }
      }
    } catch (error) {
      console.error(`API: Критическая ошибка при получении блюд для категории ${categoryId}:`, error);
      return [];
    }
  },
  
  // Получение блюда по ID
  getDishById: async (id: number): Promise<Dish | null> => {
    try {
      console.log('API getDishById - Получение блюда с ID', id);
      
      // Сначала проверяем кеш
      try {
        const cachedDishes = localStorage.getItem('cached_dishes');
        if (cachedDishes) {
          const dishes = JSON.parse(cachedDishes);
          const cachedDish = dishes.find((d: Dish) => d.id === id);
          if (cachedDish) {
            console.log(`API getDishById - Блюдо с ID ${id} найдено в кеше`);
            return cachedDish;
          }
        }
      } catch (cacheError) {
        console.error('API getDishById - Ошибка при чтении кеша:', cacheError);
      }
      
      // Если в кеше нет, делаем запрос к API
      const response = await api.get(`/menu/dishes/${id}`);
      
      if (!response.data) {
        throw new Error('Данные не получены');
      }
      
      // Преобразуем данные в формат Dish
      const dish: Dish = {
        id: response.data.id,
        name: response.data.name,
        description: response.data.description || '',
        price: response.data.price,
        image_url: response.data.image_url || null,
        is_available: response.data.is_available ?? true,
        category_id: response.data.category_id || 0,
        is_vegetarian: response.data.is_vegetarian ?? false,
        is_vegan: response.data.is_vegan ?? false,
        calories: response.data.calories !== undefined ? parseInt(response.data.calories.toString()) : null,
        cooking_time: response.data.cooking_time !== undefined ? parseInt(response.data.cooking_time.toString()) : null
      };
      
      // Сохраняем в кеш
      try {
        const cachedDishes = localStorage.getItem('cached_dishes');
        const dishes = cachedDishes ? JSON.parse(cachedDishes) : [];
        const dishIndex = dishes.findIndex((d: Dish) => d.id === id);
        
        if (dishIndex !== -1) {
          dishes[dishIndex] = dish;
        } else {
          dishes.push(dish);
        }
        
        localStorage.setItem('cached_dishes', JSON.stringify(dishes));
        console.log(`API getDishById - Блюдо с ID ${id} сохранено в кеш`);
      } catch (cacheError) {
        console.error('API getDishById - Ошибка при сохранении в кеш:', cacheError);
      }
      
      return dish;
    } catch (error: any) {
      console.error(`API getDishById - Ошибка при получении блюда с ID ${id}:`, error);
      
      // Пробуем получить из кеша еще раз в случае ошибки
      try {
        const cachedDishes = localStorage.getItem('cached_dishes');
        if (cachedDishes) {
          const dishes = JSON.parse(cachedDishes);
          const dish = dishes.find((d: Dish) => d.id === id);
          if (dish) {
            console.log(`API getDishById - Блюдо с ID ${id} найдено в кеше после ошибки API`);
            return dish;
          }
        }
      } catch (cacheError) {
        console.error('API getDishById - Ошибка при чтении кеша после ошибки API:', cacheError);
      }
      
      if (error.response?.status === 401) {
        throw new Error('Необходима авторизация');
      } else if (error.response?.status === 403) {
        throw new Error('Недостаточно прав для просмотра блюда');
      } else if (error.response?.status === 404) {
        throw new Error('Блюдо не найдено');
      }
      
      throw new Error('Не удалось загрузить данные блюда. Проверьте подключение к интернету.');
    }
  },
  
  // Создание нового блюда
  createDish: async (dish: Omit<Dish, 'id' | 'created_at' | 'updated_at'>): Promise<Dish> => {
    const response = await api.post('/dishes', dish);
    return response.data;
  },
  
  // Обновление блюда
  updateDish: async (id: number, dish: Partial<Dish>): Promise<Dish> => {
    const response = await api.put(`/dishes/${id}`, dish);
    return response.data;
  },
  
  // Удаление блюда
  deleteDish: async (id: number): Promise<void> => {
    await api.delete(`/dishes/${id}`);
  },
  
  // Получение рекомендуемых блюд
  getFeaturedDishes: async (): Promise<Dish[]> => {
    try {
      const response = await api.get('/dishes/featured');
      return response.data;
    } catch (error) {
      console.error('API: Ошибка при получении рекомендуемых блюд:', error);
      
      // Если не удалось получить рекомендуемые блюда через API,
      // пробуем фильтровать из кеша всех блюд
      try {
        const cachedDishes = localStorage.getItem('cached_dishes');
        if (cachedDishes) {
          const allDishes = JSON.parse(cachedDishes);
          return allDishes.filter((dish: Dish) => dish.is_featured);
        }
      } catch (cacheError) {
        console.error('API: Ошибка при чтении кеша блюд:', cacheError);
      }
      
      return [];
    }
  },
  
  // Получение популярных блюд
  getPopularDishes: async (): Promise<Dish[]> => {
    try {
      const response = await api.get('/dishes/popular');
      return response.data;
    } catch (error) {
      console.error('API: Ошибка при получении популярных блюд:', error);
      
      // Если API недоступен, возвращаем несколько случайных блюд из кеша
      const cachedDishes = localStorage.getItem('cached_dishes');
      if (cachedDishes) {
        const allDishes = JSON.parse(cachedDishes);
        // Выбираем до 5 случайных блюд
        return allDishes
          .sort(() => 0.5 - Math.random())
          .slice(0, Math.min(5, allDishes.length));
      }
      
      return [];
    }
  },
  
  // Очистка кеша меню
  clearMenuCache: () => {
    try {
      localStorage.removeItem('cached_categories');
      localStorage.removeItem('cached_dishes');
      localStorage.removeItem('dishes_cache_timestamp');
      
      // Очищаем кеш блюд по категориям
      const localStorageKeys = Object.keys(localStorage);
      const categoryKeysPattern = /cached_dishes_category_\d+/;
      const categoryTimestampPattern = /dishes_category_\d+_cache_timestamp/;
      
      localStorageKeys.forEach(key => {
        if (categoryKeysPattern.test(key) || categoryTimestampPattern.test(key)) {
          localStorage.removeItem(key);
        }
      });
      
      console.log('API: Кеш меню успешно очищен');
      return true;
    } catch (error) {
      console.error('API: Ошибка при очистке кеша меню:', error);
      return false;
    }
  }
}; 