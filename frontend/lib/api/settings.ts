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
          status: 'available',
          is_active: true,
          position_x: 10,
          position_y: 10
        },
        { 
          id: 2, 
          number: 2,
          name: 'Стол 2', 
          capacity: 4, 
          status: 'available',
          is_active: true,
          position_x: 40,
          position_y: 10
        },
        { 
          id: 3, 
          number: 3,
          name: 'Стол 3', 
          capacity: 6, 
          status: 'available',
          is_active: true,
          position_x: 70,
          position_y: 10
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
  
  // Получение настроек с сервера
  getSettings: async (): Promise<RestaurantSettings> => {
    const response = await api.get<ApiResponse<RestaurantSettings>>('/settings');
    return response.data.data;
  },

  // Обновление настроек на сервере
  updateSettings: async (settings: Partial<RestaurantSettings>): Promise<RestaurantSettings> => {
    const response = await api.put<ApiResponse<RestaurantSettings>>('/settings', settings);
    return response.data.data;
  },
  
  // Принудительное обновление настроек с сервера (игнорируя кеш)
  forceRefreshSettings: async (): Promise<RestaurantSettings> => {
    const response = await api.get<ApiResponse<RestaurantSettings>>('/settings/refresh');
    return response.data.data;
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
      } catch (error) {
        console.error('Ошибка при сохранении настроек в localStorage:', error);
      }
    }
  }
}; 