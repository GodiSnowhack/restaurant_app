import { create } from 'zustand';
import { settingsApi, PublicSettings } from './api/settings';
import { RestaurantTable, RestaurantSettings, WorkingHours } from './api/types';

interface SettingsState {
  settings: RestaurantSettings;
  publicSettings: PublicSettings | null;
  isLoading: boolean;
  error: string | null;
  lastUpdated: number | null;
  loadSettings: () => Promise<void>;
  loadPublicSettings: () => Promise<void>;
  updateSettings: (newSettings: Partial<RestaurantSettings>) => Promise<RestaurantSettings>;
  updateTables: (tables: RestaurantTable[]) => Promise<void>;
  addTable: (table: Omit<RestaurantTable, 'id'>) => Promise<void>;
  removeTable: (tableId: number) => Promise<void>;
  updateTableStatus: (tableId: number, status: 'available' | 'reserved' | 'occupied') => Promise<void>;
  checkForUpdates: () => Promise<void>;
}

// Интервал автообновления настроек (5 минут)
const AUTO_UPDATE_INTERVAL = 5 * 60 * 1000;

const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: {} as RestaurantSettings,
  publicSettings: null,
  isLoading: false,
  error: null,
  lastUpdated: null,

  loadSettings: async () => {
    try {
      set({ isLoading: true, error: null });
      console.log('Запрос настроек с сервера...');
      const settings = await settingsApi.getSettings();
      // При получении полных настроек, обновляем и публичные
      const publicSettings: PublicSettings = {
        restaurant_name: settings.restaurant_name,
        email: settings.email,
        phone: settings.phone,
        address: settings.address,
        website: settings.website,
        working_hours: Object.entries(settings.working_hours).reduce((acc, [day, hours]) => ({
          ...acc,
          [day]: {
            open: hours.open,
            close: hours.close,
            is_closed: hours.is_closed
          }
        }), {})
      };
      set({ 
        settings, 
        publicSettings,
        isLoading: false, 
        lastUpdated: Date.now() 
      });
    } catch (error) {
      console.error('Ошибка при загрузке настроек:', error);
      set({ error: 'Ошибка при загрузке настроек', isLoading: false });
      throw error;
    }
  },

  loadPublicSettings: async () => {
    try {
      set({ isLoading: true, error: null });
      console.log('Запрос публичных настроек...');
      const publicSettings = await settingsApi.getPublicSettings();
      set({ 
        publicSettings, 
        isLoading: false, 
        lastUpdated: Date.now() 
      });
    } catch (error) {
      console.error('Ошибка при загрузке публичных настроек:', error);
      set({ error: 'Ошибка при загрузке публичных настроек', isLoading: false });
      throw error;
    }
  },

  updateSettings: async (newSettings: Partial<RestaurantSettings>) => {
    try {
      set({ isLoading: true, error: null });
      const updatedSettings = await settingsApi.updateSettings(newSettings);
      // Обновляем и публичные настройки при обновлении полных
      const publicSettings: PublicSettings = {
        restaurant_name: updatedSettings.restaurant_name,
        email: updatedSettings.email,
        phone: updatedSettings.phone,
        address: updatedSettings.address,
        website: updatedSettings.website,
        working_hours: Object.entries(updatedSettings.working_hours).reduce((acc, [day, hours]) => ({
          ...acc,
          [day]: {
            open: hours.open,
            close: hours.close,
            is_closed: hours.is_closed
          }
        }), {})
      };
      set({ 
        settings: updatedSettings, 
        publicSettings,
        isLoading: false, 
        lastUpdated: Date.now() 
      });
      return updatedSettings;
    } catch (error) {
      console.error('Ошибка при обновлении настроек:', error);
      set({ error: 'Ошибка при обновлении настроек', isLoading: false });
      throw error;
    }
  },

  updateTables: async (tables: RestaurantTable[]) => {
    try {
      set({ isLoading: true, error: null });
      const updatedSettings = await settingsApi.updateSettings({ tables });
      set({ settings: updatedSettings, isLoading: false, lastUpdated: Date.now() });
    } catch (error) {
      console.error('Ошибка при обновлении столов:', error);
      set({ error: 'Ошибка при обновлении столов', isLoading: false });
      throw error;
    }
  },

  addTable: async (table: Omit<RestaurantTable, 'id'>) => {
    try {
      set({ isLoading: true, error: null });
      const { settings } = get();
      const newTables = [...(settings.tables || []), { ...table, id: Date.now() }];
      const updatedSettings = await settingsApi.updateSettings({ tables: newTables });
      set({ settings: updatedSettings, isLoading: false, lastUpdated: Date.now() });
    } catch (error) {
      console.error('Ошибка при добавлении стола:', error);
      set({ error: 'Ошибка при добавлении стола', isLoading: false });
      throw error;
    }
  },

  removeTable: async (tableId: number) => {
    try {
      set({ isLoading: true, error: null });
      const { settings } = get();
      const newTables = settings.tables?.filter(table => table.id !== tableId) || [];
      const updatedSettings = await settingsApi.updateSettings({ tables: newTables });
      set({ settings: updatedSettings, isLoading: false, lastUpdated: Date.now() });
    } catch (error) {
      console.error('Ошибка при удалении стола:', error);
      set({ error: 'Ошибка при удалении стола', isLoading: false });
      throw error;
    }
  },

  updateTableStatus: async (tableId: number, status: 'available' | 'reserved' | 'occupied') => {
    try {
      set({ isLoading: true, error: null });
      const { settings } = get();
      const newTables = settings.tables?.map(table => 
        table.id === tableId ? { ...table, status } : table
      ) || [];
      const updatedSettings = await settingsApi.updateSettings({ tables: newTables });
      set({ settings: updatedSettings, isLoading: false, lastUpdated: Date.now() });
    } catch (error) {
      console.error('Ошибка при обновлении статуса стола:', error);
      set({ error: 'Ошибка при обновлении статуса стола', isLoading: false });
      throw error;
    }
  },

  checkForUpdates: async () => {
    const { lastUpdated } = get();
    const now = Date.now();
    
    if (!lastUpdated || now - lastUpdated >= AUTO_UPDATE_INTERVAL) {
      const hasToken = typeof window !== 'undefined' && localStorage.getItem('token');
      if (hasToken) {
        await get().loadSettings();
      } else {
        await get().loadPublicSettings();
      }
    }
  }
}));

export default useSettingsStore; 