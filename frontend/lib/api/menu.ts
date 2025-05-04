import { api } from './core';

// Тип для категории блюд
export interface Category {
  id: number;
  name: string;
  description?: string;
  image_url?: string;
  is_active: boolean;
  order: number;
  created_at: string;
  updated_at: string;
  dish_count?: number;
}

// Тип для блюда
export interface Dish {
  id: number;
  name: string;
  description: string;
  price: number;
  formatted_price?: string;
  image_url?: string;
  category_id: number;
  is_available: boolean;
  is_featured: boolean;
  ingredients?: string;
  allergens?: string;
  nutritional_info?: string;
  preparation_time?: number;
  is_vegetarian?: boolean;
  is_vegan?: boolean;
  is_gluten_free?: boolean;
  spiciness_level?: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// API функции для работы с меню и блюдами
export const menuApi = {
  // Получение всех категорий
  getCategories: async (): Promise<Category[]> => {
    try {
      console.log('API: Получение категорий...');
      
      // Добавляем дополнительную проверку подключения
      try {
        console.log('API: Проверка подключения к бэкенду...');
        const response = await fetch('/api/ping', { 
          method: 'HEAD',
          cache: 'no-store'
        }).catch(() => ({ ok: false }));
        
        if (!response.ok) {
          console.log('API: Проблема с соединением к бэкенду, попытка использовать кэш');
          // Проверяем, есть ли категории в кэше
          const cachedCategories = localStorage.getItem('cached_categories');
          if (cachedCategories) {
            console.log('API: Используем кэшированные категории');
            return JSON.parse(cachedCategories);
          }
        }
      } catch (connectionError) {
        console.error('API: Ошибка при проверке подключения:', connectionError);
      }
      
      // Сначала пробуем получить категории через API с retry механизмом
      try {
        const response = await api.get('/categories');
        console.log('API: Успешно получены категории через API, количество:', response.data.length);
        
        // Кэшируем результат
        try {
          localStorage.setItem('cached_categories', JSON.stringify(response.data));
        } catch (cacheError) {
          console.error('API: Ошибка при кэшировании категорий:', cacheError);
        }
        
        return response.data;
      } catch (apiError) {
        console.error('API: Ошибка при получении категорий через API:', apiError);
        
        // Пробуем получить категории через fetch с относительным URL
        try {
          console.log('API: Попытка получения категорий через fetch с относительным URL');
          const response = await fetch('/api/categories');
          
          if (!response.ok) {
            console.error('API getCategories - Проблема с соединением: Ошибка соединения:', response.status, response.statusText);
            throw new Error(`Ошибка HTTP: ${response.status}`);
          }
          
          const data = await response.json();
          console.log('API: Успешно получены категории через fetch, количество:', data.length);
          
          // Кэшируем результат
          try {
            localStorage.setItem('cached_categories', JSON.stringify(data));
          } catch (cacheError) {
            console.error('API: Ошибка при кэшировании категорий:', cacheError);
          }
          
          return data;
        } catch (fetchError) {
          console.error('API: Ошибка при получении категорий через fetch:', fetchError);
          
          // Пробуем прямое обращение к API в обход прокси
          try {
            const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
            console.log(`API: Попытка прямого обращения к API: ${backendUrl}/api/v1/categories`);
            
            const directResponse = await fetch(`${backendUrl}/api/v1/categories`, {
              headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
              }
            });
            
            if (!directResponse.ok) {
              console.error('API: Ошибка при прямом обращении к API:', directResponse.status);
              throw new Error(`Ошибка HTTP при прямом обращении: ${directResponse.status}`);
            }
            
            const directData = await directResponse.json();
            console.log('API: Успешно получены категории через прямое обращение, количество:', directData.length);
            
            // Кэшируем результат
            try {
              localStorage.setItem('cached_categories', JSON.stringify(directData));
            } catch (cacheError) {
              console.error('API: Ошибка при кэшировании категорий:', cacheError);
            }
            
            return directData;
          } catch (directError) {
            console.error('API: Ошибка при прямом обращении к API:', directError);
          }
          
          // Если обе попытки завершились неудачно, проверяем кеш
          const cachedCategories = localStorage.getItem('cached_categories');
          if (cachedCategories) {
            console.log('API: Используем кешированные категории');
            return JSON.parse(cachedCategories);
          }
          
          // Если нет кеша, возвращаем пустой массив
          console.log('API: Нет кэша, возвращаем пустой массив категорий');
          return [];
        }
      }
    } catch (error) {
      console.error('API: Ошибка при получении категорий:', error);
      
      // Проверяем, есть ли категории в кэше
      try {
        const cachedCategories = localStorage.getItem('cached_categories');
        if (cachedCategories) {
          console.log('API: Используем кэшированные категории после ошибки');
          return JSON.parse(cachedCategories);
        }
      } catch (cacheError) {
        console.error('API: Ошибка при чтении кэша категорий:', cacheError);
      }
      
      // Возвращаем пустой массив для избежания падения UI
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
      
      // Проверка подключения перед запросом
      try {
        console.log('API: Проверка подключения к бэкенду...');
        const response = await fetch('/api/ping', { 
          method: 'HEAD',
          cache: 'no-store'
        }).catch(() => ({ ok: false }));
        
        if (!response.ok) {
          console.log('API: Проблема с соединением к бэкенду, попытка использовать кэш');
          // Проверяем, есть ли блюда в кэше
          const cachedDishes = localStorage.getItem('cached_dishes');
          if (cachedDishes) {
            console.log('API: Используем кэшированные блюда');
            return JSON.parse(cachedDishes);
          }
        }
      } catch (connectionError) {
        console.error('API: Ошибка при проверке подключения:', connectionError);
      }
      
      // Сначала пробуем получить блюда через API
      try {
        const response = await api.get('/menu/dishes');
        console.log('API: Успешно получены блюда через API, количество:', response.data.length);
        
        // Кешируем блюда для оффлайн доступа
        try {
          localStorage.setItem('cached_dishes', JSON.stringify(response.data));
          localStorage.setItem('dishes_cache_timestamp', Date.now().toString());
        } catch (cacheError) {
          console.error('API: Ошибка при кешировании блюд:', cacheError);
        }
        
        return response.data;
      } catch (apiError) {
        console.error('API: Ошибка при получении блюд через API:', apiError);
        
        // Пробуем получить блюда через fetch как резервный вариант
        try {
          console.log('API: Попытка получения блюд через fetch с относительным URL');
          const response = await fetch('/api/menu?method=dishes');
          
          if (!response.ok) {
            console.error('API getDishes - Проблема с соединением: Ошибка соединения:', response.status, response.statusText);
            throw new Error(`Ошибка HTTP: ${response.status}`);
          }
          
          const data = await response.json();
          console.log('API: Успешно получены блюда через fetch, количество:', data.length);
          
          // Кешируем блюда
          try {
            localStorage.setItem('cached_dishes', JSON.stringify(data));
            localStorage.setItem('dishes_cache_timestamp', Date.now().toString());
          } catch (cacheError) {
            console.error('API: Ошибка при кешировании блюд:', cacheError);
          }
          
          return data;
        } catch (fetchError) {
          console.error('API: Ошибка при получении блюд через fetch:', fetchError);
          
          // Пробуем прямое обращение к API в обход прокси
          try {
            const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
            console.log(`API: Попытка прямого обращения к API для блюд: ${backendUrl}/api/v1/menu/dishes`);
            
            const directResponse = await fetch(`${backendUrl}/api/v1/menu/dishes`, {
              headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
              }
            });
            
            if (!directResponse.ok) {
              console.error('API: Ошибка при прямом обращении к API для блюд:', directResponse.status);
              throw new Error(`Ошибка HTTP при прямом обращении: ${directResponse.status}`);
            }
            
            const directData = await directResponse.json();
            console.log('API: Успешно получены блюда через прямое обращение, количество:', directData.length);
            
            // Кешируем результат
            try {
              localStorage.setItem('cached_dishes', JSON.stringify(directData));
              localStorage.setItem('dishes_cache_timestamp', Date.now().toString());
            } catch (cacheError) {
              console.error('API: Ошибка при кешировании блюд:', cacheError);
            }
            
            return directData;
          } catch (directError) {
            console.error('API: Ошибка при прямом обращении к API для блюд:', directError);
          }
          
          // Если обе попытки завершились неудачно, проверяем кеш
          const cachedDishes = localStorage.getItem('cached_dishes');
          if (cachedDishes) {
            console.log('API: Используем кешированные блюда');
            return JSON.parse(cachedDishes);
          }
          
          // Если нет кеша, возвращаем пустой массив
          console.log('API: Нет кэша, возвращаем пустой массив блюд');
          return [];
        }
      }
    } catch (error) {
      console.error('API: Ошибка при получении блюд:', error);
      
      // Проверяем, есть ли блюда в кэше
      try {
        const cachedDishes = localStorage.getItem('cached_dishes');
        if (cachedDishes) {
          console.log('API: Используем кэшированные блюда после ошибки');
          return JSON.parse(cachedDishes);
        }
      } catch (cacheError) {
        console.error('API: Ошибка при чтении кэша блюд:', cacheError);
      }
      
      // Возвращаем пустой массив для избежания падения UI
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
      const response = await api.get(`/dishes/${id}`);
      return response.data;
    } catch (error) {
      console.error(`API: Ошибка при получении блюда ${id}:`, error);
      return null;
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