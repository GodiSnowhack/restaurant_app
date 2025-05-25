import { api } from '../api';
import { RestaurantSettings, RestaurantTable } from './types';

const SETTINGS_CACHE_KEY = 'restaurant_settings_cache';
const SETTINGS_CACHE_TIMESTAMP = 'restaurant_settings_timestamp';
const CACHE_TTL = 5 * 60 * 1000; // 5 минут

// Дефолтные настройки
const defaultSettings: RestaurantSettings = {
  restaurant_name: 'Godi and Fast',
  email: 'info@restaurant.com',
  phone: '+7 (999) 123-45-66',
  address: 'г. Петропавловск, ул. Жукова, д. 7',
  website: 'https://restaurant.com',
  currency: 'KZT',
  currency_symbol: '₸',
  tax_percentage: 12,
  min_order_amount: 1000,
  table_reservation_enabled: true,
  working_hours: {
    monday: { open: '09:00', close: '23:00', is_closed: false },
    tuesday: { open: '09:00', close: '23:00', is_closed: false },
    wednesday: { open: '09:00', close: '23:00', is_closed: false },
    thursday: { open: '09:00', close: '23:00', is_closed: false },
    friday: { open: '09:00', close: '23:00', is_closed: false },
    saturday: { open: '09:00', close: '22:00', is_closed: false },
    sunday: { open: '09:00', close: '22:00', is_closed: false }
  },
  tables: [
    {
      id: 1,
      number: 1,
      name: 'Стол 1',
      capacity: 2,
      is_active: true,
      position_x: 100,
      position_y: 100,
      status: 'available'
    },
    {
      id: 2,
      number: 2,
      name: 'Стол 2',
      capacity: 4,
      is_active: true,
      position_x: 250,
      position_y: 100,
      status: 'available'
    }
  ],
  payment_methods: ['cash', 'card'],
  smtp_host: '',
  smtp_port: 587,
  smtp_user: '',
  smtp_password: '',
  smtp_from_email: '',
  smtp_from_name: '',
  sms_api_key: '',
  sms_sender: '',
  privacy_policy: 'Политика конфиденциальности',
  terms_of_service: 'Условия использования'
};

export const settingsApi = {
  getDefaultSettings(): RestaurantSettings {
    return defaultSettings;
  },

  async getSettings(): Promise<RestaurantSettings> {
    try {
      // Проверяем кэш
      const cachedData = localStorage.getItem(SETTINGS_CACHE_KEY);
      const timestamp = localStorage.getItem(SETTINGS_CACHE_TIMESTAMP);
      
      if (cachedData && timestamp) {
        const age = Date.now() - parseInt(timestamp);
        if (age < CACHE_TTL) {
          console.log('Используем кэшированные настройки');
          return JSON.parse(cachedData);
        }
      }
      
      console.log('Запрос настроек с сервера...');
      const response = await api.get<RestaurantSettings>('/settings');
      
      if (response.data) {
        const settings = response.data;
        console.log('Получены настройки с сервера:', settings);
        
        // Проверяем наличие всех обязательных полей
        const requiredFields = [
          'restaurant_name',
          'email',
          'phone',
          'address',
          'currency',
          'currency_symbol',
          'tables'
        ] as const;
        
        const missingFields = requiredFields.filter(field => !settings[field]);
        
        if (missingFields.length > 0) {
          console.warn(`Отсутствуют обязательные поля в ответе сервера: ${missingFields.join(', ')}`);
          // Получаем дефолтные настройки
          const defaultSettings = this.getDefaultSettings();
          
          // Заполняем отсутствующие поля дефолтными значениями
          missingFields.forEach(field => {
            if (field === 'tables') {
              settings.tables = [...defaultSettings.tables];
            } else {
              settings[field] = defaultSettings[field];
            }
          });
        }
        
        // Проверяем наличие столов
        if (!settings.tables || !Array.isArray(settings.tables) || settings.tables.length === 0) {
          console.warn('Отсутствуют данные о столах, добавляем дефолтные');
          settings.tables = [...this.getDefaultSettings().tables];
        }
        
        // Сохраняем в кэш
        try {
          localStorage.setItem(SETTINGS_CACHE_KEY, JSON.stringify(settings));
          localStorage.setItem(SETTINGS_CACHE_TIMESTAMP, Date.now().toString());
        } catch (cacheError) {
          console.error('Ошибка при кэшировании настроек:', cacheError);
        }
        
        return settings;
      }
      
      throw new Error('Сервер вернул пустые настройки');
    } catch (error) {
      console.error('Ошибка при загрузке настроек:', error);
      
      // В случае ошибки пробуем использовать кэш
      const cachedData = localStorage.getItem(SETTINGS_CACHE_KEY);
      if (cachedData) {
        console.log('Используем кэшированные настройки после ошибки');
        return JSON.parse(cachedData);
      }
      
      // Если кэш недоступен, возвращаем дефолтные настройки
      return this.getDefaultSettings();
    }
  },

  async forceRefreshSettings(): Promise<RestaurantSettings> {
    try {
      console.log('Принудительное обновление настроек с сервера...');
      const response = await api.get<RestaurantSettings>('/settings');
      const settings = response.data;
      
      // Проверяем наличие всех обязательных полей
      const requiredFields = [
        'restaurant_name',
        'email',
        'phone',
        'address',
        'currency',
        'currency_symbol',
        'tables'
      ] as const;
      
      const missingFields = requiredFields.filter(field => !settings[field]);
      
      if (missingFields.length > 0) {
        console.warn(`Отсутствуют обязательные поля в ответе сервера: ${missingFields.join(', ')}`);
        // Получаем дефолтные настройки
        const defaultSettings = this.getDefaultSettings();
        
        // Заполняем отсутствующие поля дефолтными значениями
        missingFields.forEach(field => {
          if (field === 'tables') {
            settings.tables = [...defaultSettings.tables];
          } else {
            settings[field] = defaultSettings[field];
          }
        });
      }
      
      // Проверяем наличие столов
      if (!settings.tables || !Array.isArray(settings.tables) || settings.tables.length === 0) {
        console.warn('Отсутствуют данные о столах, добавляем дефолтные');
        settings.tables = [...this.getDefaultSettings().tables];
      }
      
      // Сохраняем в кэш
      try {
        localStorage.setItem(SETTINGS_CACHE_KEY, JSON.stringify(settings));
        localStorage.setItem(SETTINGS_CACHE_TIMESTAMP, Date.now().toString());
      } catch (cacheError) {
        console.error('Ошибка при кэшировании настроек:', cacheError);
      }
      
      return settings;
    } catch (error) {
      console.error('Ошибка при принудительном обновлении настроек:', error);
      // При ошибке возвращаем локальные настройки
      const localSettings = this.getLocalSettings();
      if (localSettings) {
        return localSettings;
      }
      return this.getDefaultSettings();
    }
  },

  async updateSettings(settings: Partial<RestaurantSettings>): Promise<RestaurantSettings> {
    try {
      console.log('API: Отправка запроса на обновление настроек');
      
      // Получаем токен из localStorage
      const token = localStorage.getItem('token');
      if (!token) {
        console.error('API: Отсутствует токен авторизации');
        throw new Error('Необходима авторизация');
      }

      // Получаем информацию о пользователе
      const userProfile = localStorage.getItem('user_profile');
      if (!userProfile) {
        throw new Error('Информация о пользователе не найдена');
      }

      const { role } = JSON.parse(userProfile);
      if (role !== 'admin') {
        throw new Error('Недостаточно прав для изменения настроек');
      }
      
      console.log('API: Отправляем настройки на сервер:', settings);
      const response = await api.put<RestaurantSettings>('/settings', settings, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-User-Role': role
        }
      });
      const updatedSettings = response.data;
      
      console.log('API: Получен ответ от сервера:', updatedSettings);
      
      // Обновляем кэш
      try {
        localStorage.setItem(SETTINGS_CACHE_KEY, JSON.stringify(updatedSettings));
        localStorage.setItem(SETTINGS_CACHE_TIMESTAMP, Date.now().toString());
        console.log('API: Кэш обновлен');
      } catch (cacheError) {
        console.error('API: Ошибка при кэшировании обновленных настроек:', cacheError);
      }
      
      return updatedSettings;
    } catch (error) {
      console.error('API: Ошибка при обновлении настроек:', error);
      throw error;
    }
  },

  getLocalSettings(): RestaurantSettings | null {
    try {
      const data = localStorage.getItem(SETTINGS_CACHE_KEY);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('Ошибка при чтении локальных настроек:', error);
      return null;
    }
  },

  saveSettingsLocally(settings: RestaurantSettings): void {
    try {
      localStorage.setItem(SETTINGS_CACHE_KEY, JSON.stringify(settings));
      localStorage.setItem(SETTINGS_CACHE_TIMESTAMP, Date.now().toString());
    } catch (error) {
      console.error('Ошибка при сохранении настроек локально:', error);
    }
  },

  clearCache(): void {
    localStorage.removeItem(SETTINGS_CACHE_KEY);
    localStorage.removeItem(SETTINGS_CACHE_TIMESTAMP);
  }
}; 