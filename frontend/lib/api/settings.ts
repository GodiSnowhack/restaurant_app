import { RestaurantSettings } from './types';
import { api } from '../api/api';

interface ApiResponse<T> {
  data: T;
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
  
  // Получение настроек с сервера
  getSettings: async (): Promise<RestaurantSettings> => {
    try {
      console.log('Запрос настроек с сервера...');
      const response = await api.get<ApiResponse<RestaurantSettings>>('/settings');
      
      if (response.data && response.data.data) {
        const settings = response.data.data;
        console.log('Получены настройки с сервера:', settings);
        
        // Проверяем наличие столов
        if (!settings.tables || settings.tables.length === 0) {
          console.warn('Сервер вернул настройки без столов');
          // Добавляем дефолтные столы
          settings.tables = settingsApi.getDefaultSettings().tables;
        }
        
        // Обновляем кэш
        settingsApi.saveSettingsLocally(settings);
        return settings;
      }
      
      throw new Error('Сервер вернул пустые настройки');
    } catch (error) {
      console.error('Ошибка при получении настроек:', error);
      
      // Пробуем получить из кэша
      const cachedSettings = settingsApi.getLocalSettings();
      if (cachedSettings) {
        console.log('Используем кэшированные настройки после ошибки');
        return cachedSettings;
      }
      
      // Если нет в кэше, возвращаем дефолтные
      console.log('Используем дефолтные настройки');
      const defaultSettings = settingsApi.getDefaultSettings();
      // Сохраняем дефолтные настройки в кэш
      settingsApi.saveSettingsLocally(defaultSettings);
      return defaultSettings;
    }
  },

  // Принудительное обновление настроек с сервера
  forceRefreshSettings: async (): Promise<RestaurantSettings> => {
    try {
      console.log('Принудительное обновление настроек с сервера...');
      const response = await api.get<ApiResponse<RestaurantSettings>>('/settings');
      
      if (response.data && response.data.data) {
        const settings = response.data.data;
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
  },

  // Обновление настроек на сервере
  updateSettings: async (settings: UpdateSettingsRequest): Promise<RestaurantSettings> => {
    try {
      // Получаем токен из localStorage
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('Необходима авторизация');
      }

      // Проверяем роль пользователя
      const userProfile = localStorage.getItem('user_profile');
      if (!userProfile) {
        throw new Error('Информация о пользователе не найдена');
      }

      const { role } = JSON.parse(userProfile);
      if (role !== 'admin') {
        throw new Error('Недостаточно прав для изменения настроек');
      }

      // Устанавливаем заголовки авторизации
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      api.defaults.headers.common['X-User-Role'] = role;

      // Удаляем служебное поле перед отправкой
      const { isEditing, ...settingsData } = settings;

      // Отправляем запрос на сервер
      const response = await api.put<ApiResponse<RestaurantSettings>>('/settings', settingsData);
      
      if (!response.data || !response.data.data) {
        throw new Error('Сервер вернул некорректный ответ');
      }

      const updatedSettings = response.data.data;

      // Проверяем наличие всех необходимых полей
      const requiredFields = [
        'restaurant_name',
        'email',
        'phone',
        'address',
        'currency',
        'currency_symbol',
        'tables'
      ] as const;

      const missingFields = requiredFields.filter(field => !updatedSettings[field]);
      if (missingFields.length > 0) {
        throw new Error(`Отсутствуют обязательные поля в ответе сервера: ${missingFields.join(', ')}`);
      }

      // Обновляем кэш только если это не временное сохранение при редактировании
      if (!isEditing) {
        settingsApi.saveSettingsLocally(updatedSettings);
      }

      return updatedSettings;
    } catch (error: any) {
      console.error('Ошибка при обновлении настроек:', error);
      
      // Проверяем тип ошибки и формируем соответствующее сообщение
      if (error.response) {
        // Ошибка от сервера
        const message = error.response.data?.message || 'Ошибка сервера при обновлении настроек';
        throw new Error(message);
      } else if (error.request) {
        // Ошибка сети
        throw new Error('Не удалось связаться с сервером. Проверьте подключение к интернету.');
      }
      
      // Прокидываем исходную ошибку дальше
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