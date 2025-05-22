import { api } from '../api';

interface RestaurantSettings {
  restaurant_name: string;
  email: string;
  phone: string;
  address: string;
  working_hours: {
    [key: string]: {
      open: string;
      close: string;
      is_closed: boolean;
    };
  };
  currency: string;
  currency_symbol: string;
  tax_percentage: number;
  delivery_fee: number;
  tables: Array<{
    id: number;
    name: string;
    capacity: number;
    position_x: number;
    position_y: number;
    is_active: boolean;
    status: string;
  }>;
}

const SETTINGS_CACHE_KEY = 'restaurant_settings_cache';
const SETTINGS_CACHE_TIMESTAMP = 'restaurant_settings_timestamp';
const CACHE_TTL = 5 * 60 * 1000; // 5 минут

export const settingsApi = {
  async getSettings(): Promise<RestaurantSettings> {
    try {
      // Проверяем кэш
      const cachedData = localStorage.getItem(SETTINGS_CACHE_KEY);
      const timestamp = localStorage.getItem(SETTINGS_CACHE_TIMESTAMP);
      
      if (cachedData && timestamp) {
        const age = Date.now() - Number(timestamp);
        if (age < CACHE_TTL) {
          console.log('Возвращаем настройки из кэша');
          return JSON.parse(cachedData);
        }
      }

      // Если кэша нет или он устарел, делаем запрос
      console.log('Запрашиваем настройки с сервера');
      const response = await api.get('/api/v1/settings');
      const settings = response.data;

      // Кэшируем результат
      localStorage.setItem(SETTINGS_CACHE_KEY, JSON.stringify(settings));
      localStorage.setItem(SETTINGS_CACHE_TIMESTAMP, Date.now().toString());

      return settings;
    } catch (error) {
      console.error('Ошибка при получении настроек:', error);
      
      // В случае ошибки пробуем вернуть данные из кэша
      const cachedData = localStorage.getItem(SETTINGS_CACHE_KEY);
      if (cachedData) {
        console.log('Возвращаем настройки из кэша после ошибки');
        return JSON.parse(cachedData);
      }
      
      throw error;
    }
  },

  async updateSettings(settings: Partial<RestaurantSettings>): Promise<RestaurantSettings> {
    try {
      const response = await api.put('/api/v1/settings', settings);
      const updatedSettings = response.data;

      // Обновляем кэш
      localStorage.setItem(SETTINGS_CACHE_KEY, JSON.stringify(updatedSettings));
      localStorage.setItem(SETTINGS_CACHE_TIMESTAMP, Date.now().toString());

      return updatedSettings;
    } catch (error) {
      console.error('Ошибка при обновлении настроек:', error);
      throw error;
    }
  },

  clearCache() {
    localStorage.removeItem(SETTINGS_CACHE_KEY);
    localStorage.removeItem(SETTINGS_CACHE_TIMESTAMP);
  }
}; 