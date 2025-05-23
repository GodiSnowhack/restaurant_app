import { RestaurantSettings } from './types';
import { api } from '../api/api';

interface ApiResponse<T> {
  data: T;
}

// API функции для работы с настройками ресторана
export const settingsApi = {
  // Получение настроек по умолчанию для первоначальной инициализации
  getDefaultSettings: () => {
    const defaultSettings: RestaurantSettings = {
      restaurant_name: 'Ресторан',
      email: 'info@restaurant.com',
      phone: '+7 (777) 777-77-77',
      address: 'Адрес ресторана',
      website: 'restaurant.com',
      working_hours: {
        monday: { open: '09:00', close: '22:00', is_closed: false },
        tuesday: { open: '09:00', close: '22:00', is_closed: false },
        wednesday: { open: '09:00', close: '22:00', is_closed: false },
        thursday: { open: '09:00', close: '22:00', is_closed: false },
        friday: { open: '09:00', close: '23:00', is_closed: false },
        saturday: { open: '10:00', close: '23:00', is_closed: false },
        sunday: { open: '10:00', close: '22:00', is_closed: false }
      },
      currency: 'KZT',
      currency_symbol: '₸',
      tax_percentage: 12,
      min_order_amount: 1000,
      table_reservation_enabled: true,
      privacy_policy: 'Политика конфиденциальности ресторана',
      terms_of_service: 'Условия использования сервиса',
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
      payment_methods: ['cash', 'card']
    };
    
    return defaultSettings;
  },
  
  // Получение настроек с сервера
  getSettings: async (): Promise<RestaurantSettings> => {
    try {
      // Проверяем кэш
      const cachedSettings = settingsApi.getLocalSettings();
      const timestamp = localStorage.getItem('restaurant_settings_timestamp');
      
      if (cachedSettings && timestamp) {
        const age = Date.now() - parseInt(timestamp);
        if (age < 30 * 60 * 1000) { // 30 минут
          console.log('Используем кэшированные настройки');
          return cachedSettings;
        }
      }
      
      // Если кэш устарел или отсутствует, делаем запрос к API
      const response = await api.get<ApiResponse<RestaurantSettings>>('/api/v1/settings');
      const settings = response.data.data;
      
      if (settings) {
        // Обновляем кэш
        settingsApi.saveSettingsLocally(settings);
        return settings;
      }
      
      // Если с сервера пришли пустые данные, возвращаем кэш или дефолтные настройки
      return cachedSettings || settingsApi.getDefaultSettings();
    } catch (error) {
      console.error('Ошибка при получении настроек:', error);
      
      // В случае ошибки возвращаем кэш или дефолтные настройки
      const cachedSettings = settingsApi.getLocalSettings();
      if (cachedSettings) {
        console.log('Используем кэшированные настройки после ошибки');
        return cachedSettings;
      }
      
      console.log('Используем дефолтные настройки');
      return settingsApi.getDefaultSettings();
    }
  },

  // Обновление настроек на сервере
  updateSettings: async (settings: Partial<RestaurantSettings>): Promise<RestaurantSettings> => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('Не найден токен авторизации');
      }

      const response = await api.put<ApiResponse<RestaurantSettings>>('/api/v1/settings', settings, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      
      const updatedSettings = response.data.data;
      
      if (updatedSettings) {
        // Обновляем кэш
        settingsApi.saveSettingsLocally(updatedSettings);
        return updatedSettings;
      }
      
      throw new Error('Не удалось обновить настройки');
    } catch (error) {
      console.error('Ошибка при обновлении настроек:', error);
      throw error;
    }
  },
  
  // Получение настроек из localStorage
  getLocalSettings: () => {
    if (typeof window !== 'undefined') {
      try {
        const localSettings = localStorage.getItem('restaurant_settings');
        if (localSettings) {
          return JSON.parse(localSettings);
        }
      } catch (error) {
        console.error('Ошибка при чтении настроек из localStorage:', error);
      }
    }
    return null;
  },
  
  // Сохранение настроек в localStorage
  saveSettingsLocally: (settings: RestaurantSettings) => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('restaurant_settings', JSON.stringify(settings));
        localStorage.setItem('restaurant_settings_timestamp', Date.now().toString());
      } catch (error) {
        console.error('Ошибка при сохранении настроек в localStorage:', error);
      }
    }
  }
}; 