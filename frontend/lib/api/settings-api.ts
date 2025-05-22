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
      
      // Если нет кэша, возвращаем дефолтные настройки
      console.log('Возвращаем дефолтные настройки');
      return defaultSettings;
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