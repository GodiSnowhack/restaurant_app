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
      const response = await api.get(`/menu/categories/${id}`);
      return response.data;
    } catch (error) {
      console.error(`API: Ошибка при получении категории ${id}:`, error);
      return null;
    }
  },
  
  // Создание новой категории
  createCategory: async (category: Omit<Category, 'id' | 'created_at' | 'updated_at'>): Promise<Category> => {
    const response = await api.post('/menu/categories', category);
    return response.data;
  },
  
  // Обновление категории
  updateCategory: async (id: number, category: Partial<Category>): Promise<Category> => {
    const response = await api.put(`/menu/categories/${id}`, category);
    return response.data;
  },
  
  // Удаление категории
  deleteCategory: async (id: number): Promise<void> => {
    await api.delete(`/menu/categories/${id}`);
  },
  
  // Получение всех блюд
  getDishes: async (): Promise<Dish[]> => {
    try {
      console.log('API: Получение блюд...');
      const response = await api.get('/menu/dishes');
      
      if (!response.data) {
        throw new Error('Данные не получены');
      }
      
      // Сохраняем в кеш
      try {
        localStorage.setItem('cached_dishes', JSON.stringify(response.data));
        localStorage.setItem('dishes_cache_timestamp', Date.now().toString());
      } catch (cacheError) {
        console.error('API: Ошибка при кешировании блюд:', cacheError);
      }
      
      return response.data;
    } catch (error) {
      console.error('API: Ошибка при получении блюд:', error);
      
      // Пробуем получить из кеша
      try {
        const cachedDishes = localStorage.getItem('cached_dishes');
        if (cachedDishes) {
          console.log('API: Используем кешированные блюда');
          return JSON.parse(cachedDishes);
        }
      } catch (cacheError) {
        console.error('API: Ошибка при чтении кеша блюд:', cacheError);
      }
      
      return [];
    }
  },
  
  // Получение блюд по категории
  getDishesByCategory: async (categoryId: number): Promise<Dish[]> => {
    try {
      console.log(`API: Получение блюд для категории ${categoryId}...`);
      const response = await api.get(`/menu/categories/${categoryId}/dishes`);
      return response.data;
    } catch (error) {
      console.error(`API: Ошибка при получении блюд для категории ${categoryId}:`, error);
      return [];
    }
  },
  
  // Получение блюда по ID
  getDishById: async (id: number): Promise<Dish | null> => {
    try {
      const response = await api.get(`/menu/dishes/${id}`);
      return response.data;
    } catch (error) {
      console.error(`API: Ошибка при получении блюда ${id}:`, error);
      return null;
    }
  },
  
  // Создание нового блюда
  createDish: async (dish: Omit<Dish, 'id' | 'created_at' | 'updated_at'>): Promise<Dish> => {
    const response = await api.post('/menu/dishes', dish);
    return response.data;
  },
  
  // Обновление блюда
  updateDish: async (id: number, dish: Partial<Dish>): Promise<Dish> => {
    const response = await api.put(`/menu/dishes/${id}`, dish);
    return response.data;
  },
  
  // Удаление блюда
  deleteDish: async (id: number): Promise<void> => {
    await api.delete(`/menu/dishes/${id}`);
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
      localStorage.removeItem('categories_cache_timestamp');
      localStorage.removeItem('dishes_cache_timestamp');
      console.log('API: Кеш меню успешно очищен');
      return true;
    } catch (error) {
      console.error('API: Ошибка при очистке кеша меню:', error);
      return false;
    }
  },

  // Загрузка изображения блюда
  uploadDishImage: async (file: File): Promise<{ success: boolean; fileUrl: string }> => {
    try {
      const formData = new FormData();
      formData.append('image', file);

      const response = await api.post('/dishes/upload-image', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      return {
        success: true,
        fileUrl: response.data.url,
      };
    } catch (error) {
      console.error('API: Ошибка при загрузке изображения:', error);
      throw new Error('Не удалось загрузить изображение');
    }
  },

  // Удаление изображения блюда
  deleteDishImage: async (filename: string): Promise<void> => {
    try {
      await api.delete(`/api/images/${encodeURIComponent(filename)}`);
    } catch (error) {
      console.error('API: Ошибка при удалении изображения:', error);
      throw error;
    }
  }
}; 