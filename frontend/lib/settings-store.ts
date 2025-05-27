import { create } from 'zustand';
import { settingsApi, PublicSettings } from './api/settings';
import { RestaurantTable, RestaurantSettings } from './api/types';

interface SettingsState {
  settings: RestaurantSettings;
  publicSettings: PublicSettings | null;
  isLoading: boolean;
  error: string | null;
  lastUpdated: number | null;
  loadPublicSettings: () => Promise<void>;
  updateSettings: (newSettings: Partial<RestaurantSettings>) => Promise<RestaurantSettings>;
  updateTables: (tables: RestaurantTable[]) => Promise<void>;
  addTable: (table: Omit<RestaurantTable, 'id'>) => Promise<void>;
  removeTable: (tableId: number) => Promise<void>;
  updateTableStatus: (tableId: number, status: 'available' | 'reserved' | 'occupied') => Promise<void>;
}

const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: {} as RestaurantSettings,
  publicSettings: null,
  isLoading: false,
  error: null,
  lastUpdated: null,

  loadPublicSettings: async () => {
    try {
      // Проверяем, нужно ли загружать настройки
      const { lastUpdated } = get();
      const now = Date.now();
      const CACHE_DURATION = 5 * 60 * 1000; // 5 минут

      // Если настройки уже загружены и не устарели, не делаем новый запрос
      if (lastUpdated && now - lastUpdated < CACHE_DURATION) {
        return;
      }

      set({ isLoading: true, error: null });
      console.log('Запрос публичных настроек...');
      const publicSettings = await settingsApi.getPublicSettings();
      
      // Если пользователь авторизован, загружаем полные настройки
      if (typeof window !== 'undefined' && localStorage.getItem('token')) {
        console.log('Запрос полных настроек...');
        const settings = await settingsApi.getSettings();
        set({ settings, publicSettings, isLoading: false, lastUpdated: now });
      } else {
        set({ publicSettings, isLoading: false, lastUpdated: now });
      }
    } catch (error) {
      console.error('Ошибка при загрузке настроек:', error);
      set({ error: 'Ошибка при загрузке настроек', isLoading: false });
    }
  },

  updateSettings: async (newSettings: Partial<RestaurantSettings>) => {
    try {
      set({ isLoading: true, error: null });
      const updatedSettings = await settingsApi.updateSettings(newSettings);
      set({ settings: updatedSettings, isLoading: false, lastUpdated: Date.now() });
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
  }
}));

export default useSettingsStore; 