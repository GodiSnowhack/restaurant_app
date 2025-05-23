import { create } from 'zustand';
import { settingsApi } from './api/settings';
import { RestaurantTable, RestaurantSettings } from './api/types';

interface SettingsState {
  settings: RestaurantSettings | null;
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
  settings: null,
  isLoading: true,
  error: null,
  lastUpdated: null,

  // Загрузка настроек с сервера
  loadSettings: async () => {
    set({ isLoading: true, error: null });
    try {
      // Загружаем актуальные настройки с сервера
      const serverSettings = await settingsApi.getSettings();
      
      if (serverSettings) {
        // Обновляем состояние и локальное хранилище серверными данными
        set({ 
          settings: serverSettings, 
          isLoading: false, 
          lastUpdated: Date.now() 
        });
        settingsApi.saveSettingsLocally(serverSettings);
      } else {
        // Если с сервера не получили данные, пробуем использовать локальный кеш
        const localSettings = settingsApi.getLocalSettings();
        if (localSettings) {
          set({ 
            settings: localSettings,
            isLoading: false,
            lastUpdated: Date.now()
          });
        } else {
          // Если нет ни серверных, ни локальных данных, используем дефолтные
          const defaultSettings = settingsApi.getDefaultSettings();
          set({ 
            settings: defaultSettings,
            isLoading: false,
            lastUpdated: Date.now()
          });
        }
      }
    } catch (error) {
      console.error('Ошибка при загрузке настроек:', error);
      set({ 
        error: 'Ошибка при загрузке настроек',
        isLoading: false 
      });
      
      // В случае ошибки пробуем использовать локальный кеш
      const localSettings = settingsApi.getLocalSettings();
      if (localSettings) {
        set({ 
          settings: localSettings,
          lastUpdated: Date.now()
        });
      }
    }
  },

  // Обновление настроек
  updateSettings: async (newSettings: Partial<RestaurantSettings>) => {
    const currentSettings = get().settings;
    if (!currentSettings) {
      throw new Error('Настройки не инициализированы');
    }

    set({ isLoading: true, error: null });
    try {
      // Объединяем текущие настройки с новыми
      const updatedSettings = { ...currentSettings, ...newSettings };
      
      // Сохраняем на сервере
      const savedSettings = await settingsApi.updateSettings(updatedSettings);
      
      // Обновляем состояние и локальное хранилище
      set({ 
        settings: savedSettings, 
        isLoading: false,
        lastUpdated: Date.now()
      });
      settingsApi.saveSettingsLocally(savedSettings);
    } catch (error) {
      console.error('Ошибка при обновлении настроек:', error);
      set({ 
        error: 'Ошибка при обновлении настроек',
        isLoading: false 
      });
    }
  },

  // Обновление списка столов
  updateTables: async (tables: RestaurantTable[]) => {
    const currentSettings = get().settings;
    if (!currentSettings) {
      throw new Error('Настройки не инициализированы');
    }

    await get().updateSettings({ tables });
  },

  // Добавление нового стола
  addTable: async (table: Omit<RestaurantTable, 'id'>) => {
    const currentSettings = get().settings;
    if (!currentSettings) {
      throw new Error('Настройки не инициализированы');
    }

    const maxId = Math.max(0, ...currentSettings.tables.map(t => t.id));
    const newTable = { ...table, id: maxId + 1 };
    const updatedTables = [...currentSettings.tables, newTable];
    await get().updateSettings({ tables: updatedTables });
  },

  // Удаление стола
  removeTable: async (tableId: number) => {
    const currentSettings = get().settings;
    if (!currentSettings) {
      throw new Error('Настройки не инициализированы');
    }

    const updatedTables = currentSettings.tables.filter(t => t.id !== tableId);
    await get().updateSettings({ tables: updatedTables });
  },

  // Обновление статуса стола
  updateTableStatus: async (tableId: number, status: 'available' | 'reserved' | 'occupied') => {
    const currentSettings = get().settings;
    if (!currentSettings) {
      throw new Error('Настройки не инициализированы');
    }

    const updatedTables = currentSettings.tables.map(t =>
      t.id === tableId ? { ...t, status } : t
    );
    await get().updateSettings({ tables: updatedTables });
  },

  // Проверка обновлений
  checkForUpdates: async () => {
    const lastUpdated = get().lastUpdated;
    if (!lastUpdated || Date.now() - lastUpdated > AUTO_UPDATE_INTERVAL) {
      await get().loadSettings();
    }
  }
}));

export default useSettingsStore; 