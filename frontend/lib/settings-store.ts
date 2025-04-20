import { create } from 'zustand';
import { settingsApi } from './api';

export interface RestaurantTable {
  id: number;
  name: string;
  capacity: number;
  is_active: boolean;
  position_x: number;
  position_y: number;
  status: 'available' | 'reserved' | 'occupied';
}

export interface RestaurantSettings {
  restaurant_name: string;
  email: string;
  phone: string;
  address: string;
  website: string;
  working_hours: {
    monday: { open: string; close: string; is_closed: boolean };
    tuesday: { open: string; close: string; is_closed: boolean };
    wednesday: { open: string; close: string; is_closed: boolean };
    thursday: { open: string; close: string; is_closed: boolean };
    friday: { open: string; close: string; is_closed: boolean };
    saturday: { open: string; close: string; is_closed: boolean };
    sunday: { open: string; close: string; is_closed: boolean };
  };
  currency: string;
  currency_symbol: string;
  tax_percentage: number;
  min_order_amount: number;
  delivery_fee: number;
  free_delivery_threshold: number;
  table_reservation_enabled: boolean;
  delivery_enabled: boolean;
  pickup_enabled: boolean;
  privacy_policy: string;
  terms_of_service: string;
  tables: RestaurantTable[];
  [key: string]: any;
}

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
  updateTableStatus: (tableId: number, status: RestaurantTable['status']) => Promise<void>;
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
      // Сначала загружаем локальные настройки для быстрого отображения UI
      const localSettings = settingsApi.getLocalSettings();
      if (localSettings) {
        set({ settings: localSettings });
      }

      // Затем загружаем актуальные настройки с сервера (ВСЕГДА)
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
        set({ isLoading: false });
      }
      
      // Настраиваем периодическую проверку обновлений
      if (typeof window !== 'undefined') {
        const intervalId = setInterval(() => {
          get().checkForUpdates();
        }, AUTO_UPDATE_INTERVAL);
        
        // Очистка при размонтировании
        return () => clearInterval(intervalId);
      }
    } catch (error) {
      console.error('Ошибка при загрузке настроек:', error);
      set({ 
        error: 'Не удалось загрузить настройки с сервера.',
        isLoading: false
      });
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
      ? Math.max(...tables.map(t => t.id)) + 1 
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
  updateTableStatus: async (tableId: number, status: RestaurantTable['status']) => {
    const { settings } = get();
    const tables = settings.tables || [];
    const updatedTables = tables.map(table => 
      table.id === tableId ? { ...table, status } : table
    );
    await get().updateTables(updatedTables);
  }
}));

export default useSettingsStore; 