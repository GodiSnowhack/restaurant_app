import { create } from 'zustand';
import { settingsApi } from './api/settings';
import { RestaurantTable, RestaurantSettings } from './api/types';

interface SettingsState {
  settings: RestaurantSettings;
  isLoading: boolean;
  error: string | null;
  lastUpdated: number | null;
  loadSettings: () => Promise<void>;
  updateSettings: (newSettings: Partial<RestaurantSettings>) => Promise<RestaurantSettings>;
  updateTables: (tables: RestaurantTable[]) => Promise<void>;
  addTable: (table: Omit<RestaurantTable, 'id'>) => Promise<void>;
  removeTable: (tableId: number) => Promise<void>;
  updateTableStatus: (tableId: number, status: 'available' | 'reserved' | 'occupied') => Promise<void>;
  checkForUpdates: () => Promise<void>;
}

// Интервал автообновления в миллисекундах (5 минут)
const AUTO_UPDATE_INTERVAL = 5 * 60 * 1000;

// Создаем хранилище настроек ресторана
const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: settingsApi.getDefaultSettings(),
  isLoading: true,
  error: null,
  lastUpdated: null,

  // Загрузка настроек с сервера
  loadSettings: async () => {
    set({ isLoading: true, error: null });
    try {
      // Сначала пытаемся получить с сервера
      console.log('Запрашиваем настройки с сервера...');
      const serverSettings = await settingsApi.getSettings();
      
      if (serverSettings && Object.keys(serverSettings).length > 0) {
        console.log('Получены настройки с сервера:', serverSettings);
        
        // Проверяем обязательные поля
        const requiredFields = [
          'restaurant_name',
          'email',
          'phone',
          'address',
          'currency',
          'currency_symbol',
          'tables'
        ] as const;
        
        const missingFields = requiredFields.filter(field => !serverSettings[field]);
        
        if (missingFields.length > 0) {
          console.warn(`Отсутствуют обязательные поля: ${missingFields.join(', ')}`);
          throw new Error(`Сервер вернул неполные данные: отсутствуют поля ${missingFields.join(', ')}`);
        }
        
        set({ 
          settings: serverSettings, 
          isLoading: false, 
          lastUpdated: Date.now(),
          error: null
        });
        settingsApi.saveSettingsLocally(serverSettings);
        return;
      }

      throw new Error('Сервер вернул пустые настройки');
    } catch (error: any) {
      console.error('Ошибка при загрузке настроек:', error);
      
      // При ошибке пробуем использовать локальные настройки
      const localSettings = settingsApi.getLocalSettings();
      if (localSettings && Object.keys(localSettings).length > 0) {
        console.log('Используем локальные настройки после ошибки');
        set({ 
          settings: localSettings,
          isLoading: false,
          error: `Не удалось загрузить настройки с сервера: ${error.message}. Используются локальные настройки.`
        });
        return;
      }

      // Если нет локальных, используем дефолтные
      const defaultSettings = settingsApi.getDefaultSettings();
      set({ 
        settings: defaultSettings,
        isLoading: false,
        error: `Не удалось загрузить настройки с сервера: ${error.message}. Используются настройки по умолчанию.`
      });
      settingsApi.saveSettingsLocally(defaultSettings);
    }
  },

  // Проверка обновлений с сервера
  checkForUpdates: async () => {
    // Пропускаем, если уже идет загрузка
    if (get().isLoading) return;
    
    try {
      // Тихая загрузка настроек с сервера
      const serverSettings = await settingsApi.getSettings();
      
      if (serverSettings && Object.keys(serverSettings).length > 0) {
        // Проверяем обязательные поля
        const requiredFields = [
          'restaurant_name',
          'email',
          'phone',
          'address',
          'currency',
          'currency_symbol',
          'tables'
        ] as const;
        
        const missingFields = requiredFields.filter(field => !serverSettings[field]);
        
        if (missingFields.length > 0) {
          console.warn(`Отсутствуют обязательные поля: ${missingFields.join(', ')}`);
          return;
        }
        
        console.log('Получены обновленные настройки с сервера', new Date().toLocaleTimeString());
        // Обновляем состояние и локальное хранилище
        set({ 
          settings: serverSettings,
          lastUpdated: Date.now(),
          error: null
        });
        settingsApi.saveSettingsLocally(serverSettings);
      }
    } catch (error) {
      console.error('Ошибка при проверке обновлений настроек:', error);
      // Не устанавливаем ошибку в состояние, т.к. это фоновое обновление
    }
  },

  // Обновление настроек
  updateSettings: async (newSettings: Partial<RestaurantSettings>) => {
    set({ isLoading: true, error: null });
    try {
      // Объединяем текущие настройки с новыми
      const currentSettings = get().settings;
      const updatedSettings = {
        ...currentSettings,
        ...newSettings,
        // Убеждаемся, что рабочие часы и столы корректно обновляются
        working_hours: {
          ...currentSettings.working_hours,
          ...(newSettings.working_hours || {})
        },
        tables: newSettings.tables || currentSettings.tables
      };
      
      // Сохраняем на сервере
      const savedSettings = await settingsApi.updateSettings(updatedSettings);
      
      if (!savedSettings) {
        throw new Error('Сервер вернул пустой ответ');
      }

      // Проверяем, что все необходимые поля присутствуют
      const requiredFields = [
        'restaurant_name',
        'email',
        'phone',
        'address',
        'currency',
        'currency_symbol',
        'tables'
      ] as const;

      type RequiredField = typeof requiredFields[number];
      const missingFields = requiredFields.filter(
        (field: RequiredField) => !savedSettings[field as keyof RestaurantSettings]
      );
      
      if (missingFields.length > 0) {
        throw new Error(`Отсутствуют обязательные поля: ${missingFields.join(', ')}`);
      }

      // Обновляем состояние и локальное хранилище
      set({ 
        settings: savedSettings,
        isLoading: false,
        error: null,
        lastUpdated: Date.now()
      });

      return savedSettings;
    } catch (error: any) {
      console.error('Ошибка при обновлении настроек:', error);
      set({ 
        isLoading: false,
        error: error.message || 'Произошла ошибка при обновлении настроек'
      });
      throw error;
    }
  },

  // Обновление списка столов
  updateTables: async (tables: RestaurantTable[]) => {
    set({ isLoading: true, error: null });
    try {
      const currentSettings = get().settings;
      const updatedSettings = { ...currentSettings, tables };
      
      // Сохраняем на сервере
      const savedSettings = await settingsApi.updateSettings(updatedSettings);
      
      // Обновляем состояние и локальное хранилище
      set({ 
        settings: savedSettings || updatedSettings, 
        isLoading: false,
        lastUpdated: Date.now()
      });
      settingsApi.saveSettingsLocally(savedSettings || updatedSettings);
    } catch (error) {
      console.error('Ошибка при обновлении столов:', error);
      
      // Даже при ошибке обновляем локальные настройки (временно)
      const updatedSettings = { ...get().settings, tables };
      set({ 
        settings: updatedSettings,
        error: 'Столы сохранены локально, но возникла ошибка при сохранении на сервере. Изменения будут применены только для вас до перезагрузки страницы.',
        isLoading: false 
      });
      settingsApi.saveSettingsLocally(updatedSettings);
      
      // Запланируем повторную попытку отправки на сервер
      setTimeout(() => {
        get().updateTables(tables);
      }, 10000); // Через 10 секунд
    }
  },

  // Добавление нового стола
  addTable: async (tableData: Omit<RestaurantTable, 'id'>) => {
    const { settings } = get();
    const tables = settings.tables || [];
    
    // Генерируем id для нового стола
    const newId = tables.length > 0 
      ? Math.max(...tables.map(t => t.id || 0)) + 1 
      : 1;
    
    const newTable = { 
      ...tableData, 
      id: newId,
      status: tableData.status || 'available'
    };
    
    const updatedTables = [...tables, newTable];
    await get().updateTables(updatedTables);
  },

  // Удаление стола
  removeTable: async (tableId: number) => {
    const { settings } = get();
    const tables = settings.tables || [];
    const updatedTables = tables.filter(table => table.id !== tableId);
    await get().updateTables(updatedTables);
  },

  // Обновление статуса стола
  updateTableStatus: async (tableId: number, status: 'available' | 'reserved' | 'occupied') => {
    const { settings } = get();
    const tables = settings.tables || [];
    const updatedTables = tables.map(table => 
      table.id === tableId ? { ...table, status } : table
    );
    await get().updateTables(updatedTables);
  }
}));

export default useSettingsStore; 