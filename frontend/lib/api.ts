import axios, { AxiosRequestConfig } from 'axios';

const baseURL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

export const api = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
  withCredentials: true, // Включаем отправку куки для поддержки авторизации
  timeout: 30000, // Увеличиваем таймаут для мобильных устройств
});

// Проверка, не истёк ли токен
const isTokenExpired = (token: string): boolean => {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
      return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));

    const { exp } = JSON.parse(jsonPayload);
    const expired = Date.now() >= exp * 1000;
    
    return expired;
  } catch (e) {
    return false; // Если ошибка при декодировании, считаем что токен не истёк
  }
};

// Interceptor для добавления токена в заголовки
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token && !isTokenExpired(token)) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    // Проверяем, является ли запрос регистрацией
    if (config.url === '/auth/register' && config.method === 'post') {
      // Если это запрос на регистрацию, проверяем, что роль установлена как 'guest'
      if (config.data && typeof config.data === 'object') {
        // Если роль не указана или указана как 'user', устанавливаем её как 'guest'
        if (!config.data.role || config.data.role === 'user') {
          config.data.role = 'guest';
          console.log('API Interceptor: Установлена роль "guest" для запроса регистрации');
        }
      }
    }
    
    return config;
  },
  (error) => {
    console.error('Ошибка запроса API:', error);
    return Promise.reject(error);
  }
);

// Добавляем обработчик ответов для централизованной обработки ошибок
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    if (error.response) {
      // Сервер вернул статус отличный от 2xx
      console.error('API Response Error:', {
        message: error.message,
        status: error.response.status,
        data: error.response.data
      });
      
      // Преобразуем ошибку в строку, если это объект
      if (error.response.data && typeof error.response.data === 'object') {
        if (error.response.data.detail) {
          if (typeof error.response.data.detail === 'string') {
            error.response.data.detail = error.response.data.detail;
          } else if (Array.isArray(error.response.data.detail)) {
            error.response.data.detail = error.response.data.detail.map((err: any) => {
              if (err.loc && err.msg) {
                const field = err.loc.slice(1).join('.') || 'значение';
                return `Поле "${field}": ${err.msg}`;
              }
              return typeof err === 'string' ? err : JSON.stringify(err);
            }).join('\n');
          } else {
            error.response.data.detail = JSON.stringify(error.response.data.detail);
          }
        } else {
          error.response.data.detail = JSON.stringify(error.response.data);
        }
      }
      
      // Обрабатываем ошибку авторизации
      if (error.response.status === 401) {
        console.warn('Получена ошибка 401, возможно токен истек');
        localStorage.removeItem('token');
        // Если не находимся на странице авторизации, перенаправляем
        if (typeof window !== 'undefined' && window.location.pathname !== '/auth/login') {
          window.location.href = '/auth/login';
        }
      }
    } else if (error.request) {
      // Запрос был создан, но ответ не получен (ошибка сети)
      console.error('API Response Error:', {
        message: error.message,
        response: 'No response',
        request: 'Request was sent',
      });
      error.response = { data: { detail: 'Ошибка сети. Пожалуйста, проверьте подключение к интернету.' } };
    } else {
      // Произошла ошибка во время создания запроса
      console.error('API Error:', error.message);
      error.response = { data: { detail: error.message } };
    }
    
    // Дополнительное логирование для сетевых ошибок
    if (error.code === 'ECONNABORTED' || error.message.includes('Network Error')) {
      console.error('Ошибка сети или таймаут запроса', error);
      error.response = { data: { detail: 'Ошибка сети или таймаут запроса. Пожалуйста, попробуйте позже.' } };
    }
    
    return Promise.reject(error);
  }
);

// Типы для API запросов
export interface LoginCredentials {
  username: string;
  password: string;
}

export interface RegisterCredentials {
  email: string;
  password: string;
  full_name: string;
  phone?: string;
  role?: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
}

export interface UserProfile {
  id: number;
  email: string;
  full_name: string;
  phone?: string;
  role: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface FileUploadResponse {
  success: boolean;
  fileUrl: string;
  filename: string;
  originalFilename: string;
}

export interface DashboardStats {
  ordersToday: number;
  ordersTotal: number;
  revenue: number;
  reservationsToday: number;
  users: number;
  dishes: number;
}

// API функции для аутентификации
export const authApi = {
  login: async (credentials: LoginCredentials) => {
    const formData = new FormData();
    formData.append('username', credentials.username);
    formData.append('password', credentials.password);
    
    const response = await api.post<AuthResponse>('/auth/login', formData, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });
    
    // Сохраняем токен в localStorage
    if (response.data.access_token) {
      localStorage.setItem('token', response.data.access_token);
    }
    
    return response.data;
  },
  
  register: async (credentials: RegisterCredentials) => {
    console.log('API: Отправляем запрос на регистрацию с данными:', credentials);
    const response = await api.post<UserProfile>('/auth/register', credentials);
    console.log('API: Получен ответ на регистрацию:', response.data);
    return response.data;
  },
  
  logout: () => {
    localStorage.removeItem('token');
  },
  
  getProfile: async () => {
    const response = await api.get<UserProfile>('/users/me');
    return response.data;
  },
};

// API функции для работы с меню
export const menuApi = {
  _cachedCategories: null as any[] | null,
  _cachedDishes: null as any[] | null,
  _lastCategoriesUpdate: 0,
  _lastDishesUpdate: 0,
  _cacheTimeout: 5 * 60 * 1000, // 5 минут

  getCategories: async () => {
    try {
      // Проверяем кэш
      const now = Date.now();
      if (menuApi._cachedCategories && (now - menuApi._lastCategoriesUpdate) < menuApi._cacheTimeout) {
        return menuApi._cachedCategories;
      }

      const response = await api.get('/menu/categories');
      menuApi._cachedCategories = response.data;
      menuApi._lastCategoriesUpdate = now;
      return response.data;
    } catch (error) {
      console.error('Ошибка при получении категорий:', error);
      // Возвращаем кэшированные данные в случае ошибки
      if (menuApi._cachedCategories) {
        return menuApi._cachedCategories;
      }
      throw error;
    }
  },
  
  getDishes: async (params?: { 
    category_id?: number, 
    is_vegetarian?: boolean,
    is_vegan?: boolean,
    available_only?: boolean 
  }) => {
    try {
      // Проверяем кэш только если нет параметров фильтрации
      const now = Date.now();
      if (!params && menuApi._cachedDishes && (now - menuApi._lastDishesUpdate) < menuApi._cacheTimeout) {
        return menuApi._cachedDishes;
      }

      const response = await api.get('/menu/dishes', { 
        params,
        timeout: 30000, // Увеличенный таймаут для мобильных устройств
      });
      
      // Обновляем кэш только если нет параметров фильтрации
      if (!params) {
        menuApi._cachedDishes = response.data;
        menuApi._lastDishesUpdate = now;
      }
      
      return response.data;
    } catch (error) {
      console.error('Ошибка при получении блюд:', error);
      // Возвращаем кэшированные данные в случае ошибки
      if (menuApi._cachedDishes) {
        return menuApi._cachedDishes;
      }
      throw error;
    }
  },
  
  getDishById: async (id: number) => {
    try {
      const response = await api.get(`/menu/dishes/${id}`, {
        timeout: 30000, // Увеличенный таймаут для мобильных устройств
      });
      return response.data;
    } catch (error) {
      console.error(`Ошибка при получении блюда с ID ${id}:`, error);
      throw error;
    }
  },
  
  createDish: async (dishData: any) => {
    try {
      const response = await api.post('/menu/dishes', dishData);
      // Инвалидируем кэш блюд
      menuApi._cachedDishes = null;
      return response.data;
    } catch (error) {
      console.error('Ошибка при создании блюда:', error);
      throw error;
    }
  },
  
  updateDish: async (id: number, dishData: any) => {
    try {
      const response = await api.put(`/menu/dishes/${id}`, dishData);
      // Инвалидируем кэш блюд
      menuApi._cachedDishes = null;
      return response.data;
    } catch (error) {
      console.error(`Ошибка при обновлении блюда с ID ${id}:`, error);
      throw error;
    }
  },
  
  deleteDish: async (id: number) => {
    try {
      const response = await api.delete(`/menu/dishes/${id}`);
      // Инвалидируем кэш блюд
      menuApi._cachedDishes = null;
      return response.data;
    } catch (error) {
      console.error(`Ошибка при удалении блюда с ID ${id}:`, error);
      throw error;
    }
  },
  
  createCategory: async (categoryData: any) => {
    const response = await api.post('/menu/categories', categoryData);
    return response.data;
  },
  
  updateCategory: async (id: number, categoryData: any) => {
    const response = await api.put(`/menu/categories/${id}`, categoryData);
    return response.data;
  },
  
  deleteCategory: async (id: number) => {
    const response = await api.delete(`/menu/categories/${id}`);
    return response.data;
  },
  
  uploadDishImage: async (file: File) => {
    try {
      console.log('API uploadDishImage - Загрузка изображения:', file.name);
      
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        throw new Error(`Ошибка загрузки изображения: ${response.statusText}`);
      }
      
      const data = await response.json() as FileUploadResponse;
      console.log('API uploadDishImage - Успешный ответ:', data);
      
      if (!data.success) {
        throw new Error(data.message || 'Неизвестная ошибка при загрузке изображения');
      }
      
      return data;
    } catch (error: any) {
      console.error('API uploadDishImage - Ошибка:', error);
      throw error;
    }
  },
  
  deleteDishImage: async (filename: string) => {
    try {
      console.log('API deleteDishImage - Удаление изображения:', filename);
      
      // Извлекаем только имя файла из URL, если передан полный URL
      const filenamePart = filename.includes('/') 
        ? filename.split('/').pop() 
        : filename;
        
      if (!filenamePart) {
        throw new Error('Невозможно определить имя файла из URL');
      }
      
      const response = await fetch(`/api/delete-image?filename=${encodeURIComponent(filenamePart)}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        throw new Error(`Ошибка удаления изображения: ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log('API deleteDishImage - Успешный ответ:', data);
      
      if (!data.success) {
        throw new Error(data.message || 'Неизвестная ошибка при удалении изображения');
      }
      
      return true;
    } catch (error: any) {
      console.error('API deleteDishImage - Ошибка:', error);
      throw error;
    }
  }
};

// API функции для работы с заказами
export const ordersApi = {
  getOrders: async (params?: { status?: string, start_date?: string, end_date?: string }) => {
    try {
      console.log('API getOrders - Отправка запроса с параметрами:', params);
      const response = await api.get('/orders', { params });
      console.log('API getOrders - Успешный ответ:', response.data);
      
      if (!Array.isArray(response.data)) {
        console.warn('API getOrders - Ответ не является массивом:', response.data);
        return [];
      }
      
      return response.data;
    } catch (error: any) {
      console.error('API getOrders - Ошибка:', error);
      // Возвращаем пустой массив вместо выбрасывания исключения,
      // чтобы интерфейс мог корректно отображаться
      return [];
    }
  },
  
  getOrderById: async (id: number) => {
    try {
      const response = await api.get(`/orders/${id}`);
      return response.data;
    } catch (error) {
      console.error(`Ошибка при получении заказа ${id}:`, error);
      throw error;
    }
  },
  
  createOrder: async (orderData: any) => {
    try {
      console.log('API createOrder - Отправка данных:', orderData);
      const response = await api.post('/orders', orderData);
      console.log('API createOrder - Успешный ответ:', response.data);
      return response.data;
    } catch (error: any) {
      console.error('API createOrder - Ошибка:', error);
      console.error('API createOrder - Детали ошибки:', 
        error.response ? {
          status: error.response.status,
          data: error.response.data
        } : 'Нет данных ответа'
      );
      throw error;
    }
  },
  
  updateOrderStatus: async (id: number, status: string) => {
    try {
      console.log(`API updateOrderStatus - Отправка запроса: заказ ${id}, новый статус: ${status}`);
      const response = await api.put(`/orders/${id}`, { status });
      console.log('API updateOrderStatus - Успешный ответ:', response.data);
      return response.data;
    } catch (error: any) {
      console.error(`API updateOrderStatus - Ошибка при обновлении статуса заказа ${id} на ${status}:`, error);
      console.error('API updateOrderStatus - Детали ошибки:', 
        error.response ? {
          status: error.response.status,
          data: error.response.data
        } : 'Нет данных ответа'
      );
      throw error;
    }
  },

  updateOrderPaymentStatus: async (id: number, paymentStatus: string) => {
    try {
      console.log(`API updateOrderPaymentStatus - Отправка запроса: заказ ${id}, новый статус оплаты: ${paymentStatus}`);
      const response = await api.put(`/orders/${id}`, { payment_status: paymentStatus });
      console.log('API updateOrderPaymentStatus - Успешный ответ:', response.data);
      return response.data;
    } catch (error: any) {
      console.error(`API updateOrderPaymentStatus - Ошибка при обновлении статуса оплаты заказа ${id} на ${paymentStatus}:`, error);
      console.error('API updateOrderPaymentStatus - Детали ошибки:', 
        error.response ? {
          status: error.response.status,
          data: error.response.data
        } : 'Нет данных ответа'
      );
      throw error;
    }
  },
  
  cancelOrder: async (id: number) => {
    try {
      console.log(`API cancelOrder - Отправка запроса на отмену заказа ${id}`);
      const response = await api.put(`/orders/${id}`, { status: 'cancelled' });
      console.log('API cancelOrder - Успешный ответ:', response.data);
      return response.data;
    } catch (error: any) {
      console.error(`API cancelOrder - Ошибка при отмене заказа ${id}:`, error);
      console.error('API cancelOrder - Детали ошибки:', 
        error.response ? {
          status: error.response.status,
          data: error.response.data
        } : 'Нет данных ответа'
      );
      throw error;
    }
  },
};

// API функции для работы с пользователями
export const usersApi = {
  getUsers: async (params?: { role?: string, query?: string }) => {
    const response = await api.get('/users', { params });
    return response.data;
  },
  
  getUserById: async (id: number) => {
    const response = await api.get(`/users/${id}`);
    return response.data;
  },
  
  updateUser: async (id: number, userData: Partial<UserProfile>) => {
    const response = await api.put(`/users/${id}`, userData);
    return response.data;
  },
  
  toggleUserStatus: async (id: number, isActive: boolean) => {
    const response = await api.put(`/users/${id}/status`, { is_active: isActive });
    return response.data;
  },
  
  deleteUser: async (id: number) => {
    const response = await api.delete(`/users/${id}`);
    return response.data;
  }
};

// API функции для работы с бронированиями
export const reservationsApi = {
  getReservations: async (params?: { status?: string, date?: string }) => {
    const response = await api.get('/reservations', { params });
    return response.data;
  },
  
  getReservationById: async (id: number) => {
    const response = await api.get(`/reservations/${id}`);
    return response.data;
  },
  
  createReservation: async (reservationData: any) => {
    const response = await api.post('/reservations', reservationData);
    return response.data;
  },
  
  updateReservationStatus: async (id: number, status: string) => {
    const response = await api.put(`/reservations/${id}`, { status });
    return response.data;
  },
  
  deleteReservation: async (id: number) => {
    const response = await api.delete(`/reservations/${id}`);
    return response.data;
  }
};

// API функции для работы с настройками ресторана
export const settingsApi = {
  _cachedSettings: null as RestaurantSettings | null,

  getDefaultSettings: (): RestaurantSettings => {
    return {
      restaurant_name: 'Ресторан',
      email: 'info@restaurant.com',
      phone: '+7 (123) 456-78-90',
      address: 'г. Москва, ул. Примерная, д. 1',
      website: 'https://restaurant.com',
      working_hours: {
        monday: { open: '09:00', close: '22:00', is_closed: false },
        tuesday: { open: '09:00', close: '22:00', is_closed: false },
        wednesday: { open: '09:00', close: '22:00', is_closed: false },
        thursday: { open: '09:00', close: '22:00', is_closed: false },
        friday: { open: '09:00', close: '23:00', is_closed: false },
        saturday: { open: '10:00', close: '23:00', is_closed: false },
        sunday: { open: '10:00', close: '22:00', is_closed: false },
      },
      currency: 'KZT',
      currency_symbol: '₸',
      tax_percentage: 20,
      min_order_amount: 500,
      delivery_fee: 200,
      free_delivery_threshold: 2000,
      table_reservation_enabled: true,
      delivery_enabled: true,
      pickup_enabled: true,
      privacy_policy: '',
      terms_of_service: '',
      tables: [],
    };
  },

  getLocalSettings: (): RestaurantSettings | null => {
    if (typeof window === 'undefined') return null;
    
    try {
      const storedSettings = localStorage.getItem('restaurant_settings');
      if (storedSettings) {
        // Проверяем время последнего обновления локальных настроек
        const lastUpdateTime = localStorage.getItem('settings_last_updated');
        if (lastUpdateTime) {
          const timeDifference = Date.now() - parseInt(lastUpdateTime);
          // Если данные старше 30 минут, считаем их устаревшими
          if (timeDifference > 30 * 60 * 1000) {
            console.log('Локальные настройки устарели и требуют обновления с сервера');
            return null;
          }
        }
        
        return JSON.parse(storedSettings);
      }
    } catch (error) {
      console.error('Ошибка при чтении настроек из localStorage:', error);
      localStorage.removeItem('restaurant_settings');
    }
    return null;
  },

  saveSettingsLocally: (settings: RestaurantSettings): void => {
    if (typeof window === 'undefined') return;
    
    try {
      localStorage.setItem('restaurant_settings', JSON.stringify(settings));
      localStorage.setItem('settings_last_updated', Date.now().toString());
    } catch (error) {
      console.error('Ошибка при сохранении настроек в localStorage:', error);
    }
  },

  getSettings: async (): Promise<RestaurantSettings | null> => {
    // Если есть кэшированные данные и они не старше 5 минут, возвращаем их
    if (settingsApi._cachedSettings && typeof window !== 'undefined') {
      const cachedTime = localStorage.getItem('settings_cache_time');
      if (cachedTime) {
        const timeDifference = Date.now() - parseInt(cachedTime);
        // Если кэш не старше 5 минут, возвращаем его
        if (timeDifference < 5 * 60 * 1000) {
          return settingsApi._cachedSettings;
        }
      }
    }

    try {
      const response = await fetch('/api/settings');
      if (response.ok) {
        const data = await response.json();
        settingsApi._cachedSettings = data;
        
        // Обновляем время кэша
        if (typeof window !== 'undefined') {
          localStorage.setItem('settings_cache_time', Date.now().toString());
        }
        
        return data;
      } else {
        console.error('Ошибка при загрузке настроек с сервера:', response.statusText);
        return null;
      }
    } catch (error) {
      console.error('Ошибка при загрузке настроек с сервера:', error);
      return null;
    }
  },

  updateSettings: async (settings: RestaurantSettings): Promise<RestaurantSettings | null> => {
    try {
      const response = await fetch('/api/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(settings),
      });

      if (response.ok) {
        const updatedSettings = await response.json();
        // Обновляем кэш и возвращаем данные от сервера
        settingsApi._cachedSettings = updatedSettings;
        
        // Обновляем время кэша
        if (typeof window !== 'undefined') {
          localStorage.setItem('settings_cache_time', Date.now().toString());
        }
        
        console.log('Настройки успешно обновлены на сервере:', updatedSettings);
        return updatedSettings;
      } else {
        console.error('Ошибка при обновлении настроек на сервере:', response.statusText);
        return null;
      }
    } catch (error) {
      console.error('Ошибка при обновлении настроек на сервере:', error);
      return null;
    }
  },
  
  // Принудительное обновление настроек с сервера (игнорирует кэш)
  forceRefreshSettings: async (): Promise<RestaurantSettings | null> => {
    try {
      const response = await fetch('/api/settings?force=true');
      if (response.ok) {
        const data = await response.json();
        settingsApi._cachedSettings = data;
        
        // Обновляем время кэша
        if (typeof window !== 'undefined') {
          localStorage.setItem('settings_cache_time', Date.now().toString());
        }
        
        return data;
      } else {
        console.error('Ошибка при принудительном обновлении настроек:', response.statusText);
        return null;
      }
    } catch (error) {
      console.error('Ошибка при принудительном обновлении настроек:', error);
      return null;
    }
  }
};

// API функции для работы с кодами заказов
export const orderCodesApi = {
  // Получение списка кодов заказов
  getCodes: async (params?: { is_used?: boolean }) => {
    const response = await api.get('/order-codes', { params });
    return response.data;
  },
  
  // Создание нового кода заказа
  createCode: async (tableNumber?: number) => {
    const response = await api.post('/order-codes', null, { 
      params: { table_number: tableNumber } 
    });
    return response.data;
  },
  
  // Удаление кода заказа
  deleteCode: async (codeId: number) => {
    const response = await api.delete(`/order-codes/${codeId}`);
    return response.data;
  },
  
  // Проверка кода заказа
  verifyCode: async (code: string) => {
    const response = await api.post('/order-codes/verify', { code });
    return response.data;
  }
};

export const adminApi = {
  getDashboardStats: async () => {
    const response = await api.get<DashboardStats>('/admin/dashboard/stats');
    return response.data;
  }
};

export const waiterApi = {
  getOrders: async (): Promise<Order[]> => {
    const response = await api.get('/waiter/orders');
    return response.data;
  },

  takeOrder: async (orderId: number): Promise<void> => {
    await api.post(`/waiter/orders/${orderId}/take`);
  },

  confirmPayment: async (orderId: number): Promise<void> => {
    await api.post(`/waiter/orders/${orderId}/confirm-payment`);
  },

  completeOrder: async (orderId: number): Promise<void> => {
    await api.post(`/waiter/orders/${orderId}/complete`);
  }
}; 