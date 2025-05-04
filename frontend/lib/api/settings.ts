import { RestaurantSettings } from './types';

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
      delivery_fee: 500,
      free_delivery_threshold: 5000,
      table_reservation_enabled: true,
      delivery_enabled: true,
      pickup_enabled: true,
      privacy_policy: 'Политика конфиденциальности ресторана',
      terms_of_service: 'Условия использования сервиса',
      tables: [
        { id: 1, number: 1, capacity: 2, status: 'available' },
        { id: 2, number: 2, capacity: 4, status: 'available' },
        { id: 3, number: 3, capacity: 6, status: 'available' }
      ]
    };
    
    return defaultSettings;
  },
  
  // Получение настроек с сервера
  getSettings: async () => {
    try {
      const response = await fetch('/api/settings');
        
      if (!response.ok) {
        throw new Error(`Ошибка при получении настроек: ${response.status}`);
      }
        
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Ошибка при получении настроек:', error);
      // Возвращаем настройки по умолчанию в случае ошибки
      return settingsApi.getLocalSettings() || settingsApi.getDefaultSettings();
    }
  },

  // Обновление настроек на сервере
  updateSettings: async (settings: RestaurantSettings) => {
    try {
      const response = await fetch('/api/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(settings)
      });
      
      if (!response.ok) {
        throw new Error(`Ошибка при обновлении настроек: ${response.status}`);
      }
      
      const data = await response.json();
      // Сохраняем обновленные настройки локально
      settingsApi.saveSettingsLocally(data);
      return data;
    } catch (error) {
      console.error('Ошибка при обновлении настроек:', error);
      throw error;
    }
  },
  
  // Принудительное обновление настроек с сервера (игнорируя кеш)
  forceRefreshSettings: async () => {
    try {
      const response = await fetch('/api/settings?force=1');
        
      if (!response.ok) {
        throw new Error(`Ошибка при обновлении настроек: ${response.status}`);
      }
        
      const data = await response.json();
      // Сохраняем обновленные настройки локально
      settingsApi.saveSettingsLocally(data);
      return data;
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
      } catch (error) {
        console.error('Ошибка при сохранении настроек в localStorage:', error);
      }
    }
  }
}; 