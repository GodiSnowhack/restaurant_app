import { create } from 'zustand';
import { settingsApi } from './api/settings';
import { RestaurantTable, RestaurantSettings } from './api/types';

interface SettingsState {
  settings: RestaurantSettings;
  isLoading: boolean;
  error: string | null;
  lastUpdated: number | null;
  loadSettings: () => Promise<void>;
  updateSettings: (newSettings: Partial<RestaurantSettings>) => Promise<void>;
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
      
      if (serverSettings && serverSettings.tables && serverSettings.tables.length > 0) {
        console.log('Получены настройки с сервера:', serverSettings);
        set({ 
          settings: serverSettings, 
          isLoading: false, 
          lastUpdated: Date.now(),
          error: null
        });
        settingsApi.saveSettingsLocally(serverSettings);
        return;
      }

      // Если с сервера не получили данные, используем локальные
      console.log('Не удалось получить настройки с сервера, проверяем локальные...');
      const localSettings = settingsApi.getLocalSettings();
      
      if (localSettings && localSettings.tables && localSettings.tables.length > 0) {
        console.log('Используем локальные настройки');
        set({ 
          settings: localSettings,
          isLoading: false,
          lastUpdated: Date.now()
        });
        return;
      }

      // Если нет ни серверных, ни локальных настроек, используем дефолтные
      console.log('Используем дефолтные настройки');
      const defaultSettings = settingsApi.getDefaultSettings();
      set({ 
        settings: defaultSettings,
        isLoading: false,
        lastUpdated: Date.now()
      });
      settingsApi.saveSettingsLocally(defaultSettings);
    } catch (error) {
      console.error('Ошибка при загрузке настроек:', error);
      
      // При ошибке пробуем использовать локальные настройки
      const localSettings = settingsApi.getLocalSettings();
      if (localSettings && localSettings.tables && localSettings.tables.length > 0) {
        console.log('Используем локальные настройки после ошибки');
        set({ 
          settings: localSettings,
          isLoading: false,
          error: 'Не удалось загрузить настройки с сервера. Используются локальные настройки.'
        });
        return;
      }

      // Если нет локальных, используем дефолтные
      const defaultSettings = settingsApi.getDefaultSettings();
      set({ 
        settings: defaultSettings,
        isLoading: false,
        error: 'Не удалось загрузить настройки с сервера. Используются настройки по умолчанию.'
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
      
      if (serverSettings) {
        console.log('Получены обновленные настройки с сервера', new Date().toLocaleTimeString());
        // Обновляем состояние и локальное хранилище
        set({ 
          settings: serverSettings,
          lastUpdated: Date.now() 
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
      const updatedSettings = { ...get().settings, ...newSettings };
      
      // Сохраняем на сервере (ГЛАВНЫЙ ПРИОРИТЕТ)
      const savedSettings = await settingsApi.updateSettings(updatedSettings);
      
      // Обновляем состояние и локальное хранилище
      set({ 
        settings: savedSettings || updatedSettings, 
        isLoading: false,
        lastUpdated: Date.now()
      });
      settingsApi.saveSettingsLocally(savedSettings || updatedSettings);
    } catch (error) {
      console.error('Ошибка при обновлении настроек:', error);
      
      // Даже при ошибке обновляем локальные настройки (временно)
      const updatedSettings = { ...get().settings, ...newSettings };
      set({ 
        settings: updatedSettings,
        error: 'Настройки сохранены локально, но возникла ошибка при сохранении на сервере. Изменения будут применены только для вас до перезагрузки страницы.',
        isLoading: false 
      });
      settingsApi.saveSettingsLocally(updatedSettings);
      
      // Запланируем повторную попытку отправки на сервер
      setTimeout(() => {
        get().updateSettings(newSettings);
      }, 10000); // Через 10 секунд
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