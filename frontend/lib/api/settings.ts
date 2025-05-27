import { RestaurantSettings, WorkingHours } from './types';
import { api } from '../api/api';

// Интерфейс для публичных настроек
export interface PublicSettings {
  restaurant_name: string;
  email: string;
  phone: string;
  address: string;
  website?: string;
  working_hours: {
    [key: string]: {
      open: string;
      close: string;
      is_closed: boolean;
    };
  };
}

interface UpdateSettingsRequest extends Partial<RestaurantSettings> {
  isEditing?: boolean;
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
      payment_methods: ['cash', 'card'],
      smtp_host: '',
      smtp_port: 587,
      smtp_user: '',
      smtp_password: '',
      smtp_from_email: '',
      smtp_from_name: '',
      sms_api_key: '',
      sms_sender: ''
    };
    
    return defaultSettings;
  },
  
  // Получение публичных настроек
  getPublicSettings: async (): Promise<PublicSettings> => {
    try {
      console.log('Запрос публичных настроек...');
      const response = await api.get<PublicSettings>('/settings/public');
      
      if (response.data) {
        return response.data;
      }
      throw new Error('Не удалось получить публичные настройки');
    } catch (error) {
      console.error('Ошибка при получении публичных настроек:', error);
      throw error;
    }
  },

  // Получение полных настроек
  getSettings: async (): Promise<RestaurantSettings> => {
    try {
      console.log('Запрос настроек с сервера...');
      const response = await api.get<RestaurantSettings>('/settings');
      
      if (response.data) {
        console.log('Получены настройки с сервера:', response.data);
        return response.data;
      }
      throw new Error('Не удалось получить настройки');
    } catch (error) {
      console.error('Ошибка при получении настроек:', error);
      throw error;
    }
  },

  // Обновление настроек
  updateSettings: async (settings: UpdateSettingsRequest): Promise<RestaurantSettings> => {
    try {
      const response = await api.put<RestaurantSettings>('/settings', settings);
      
      if (response.data) {
        return response.data;
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
  },

  // Принудительное обновление настроек с сервера
  forceRefreshSettings: async (): Promise<RestaurantSettings> => {
    try {
      console.log('Принудительное обновление настроек с сервера...');
      const response = await api.get<RestaurantSettings>('/settings');
      
      if (response.data) {
        const settings = response.data;
        // Обновляем кэш
        settingsApi.saveSettingsLocally(settings);
        return settings;
      }
      
      throw new Error('Сервер вернул пустые настройки');
    } catch (error) {
      console.error('Ошибка при принудительном обновлении настроек:', error);
      // При ошибке возвращаем локальные настройки
      const localSettings = settingsApi.getLocalSettings();
      if (localSettings) {
        return localSettings;
      }
      return settingsApi.getDefaultSettings();
    }
  }
}; 