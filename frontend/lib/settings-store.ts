import { create } from 'zustand';
import { settingsApi, PublicSettings } from './api/settings';
import { RestaurantTable, RestaurantSettings } from './api/types';

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

// Время жизни кэша (1 час)
const CACHE_TTL = 60 * 60 * 1000;

const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: {} as RestaurantSettings,
  publicSettings: null,
  isLoading: false,
  error: null,
  lastUpdated: null,

  loadSettings: async () => {
    const state = get();
    const now = Date.now();
    
    // Проверяем, есть ли актуальный кэш
    if (state.settings && state.lastUpdated && (now - state.lastUpdated < CACHE_TTL)) {
      return; // Используем кэшированные данные
    }

    try {
      set({ isLoading: true, error: null });
      console.log('Запрос настроек с сервера...');
      const settings = await settingsApi.getSettings();
      set({ settings, isLoading: false, lastUpdated: now });
    } catch (error) {
      console.error('Ошибка при загрузке настроек:', error);
      set({ error: 'Ошибка при загрузке настроек', isLoading: false });
    }
  },

  loadPublicSettings: async () => {
    const state = get();
    const now = Date.now();
    
    // Проверяем, есть ли актуальный кэш публичных настроек
    if (state.publicSettings && state.lastUpdated && (now - state.lastUpdated < CACHE_TTL)) {
      return; // Используем кэшированные данные
    }

    try {
      set({ isLoading: true, error: null });
      console.log('Запрос публичных настроек...');
      const publicSettings = await settingsApi.getPublicSettings();
      set({ publicSettings, isLoading: false, lastUpdated: now });
    } catch (error) {
      console.error('Ошибка при загрузке публичных настроек:', error);
      set({ error: 'Ошибка при загрузке публичных настроек', isLoading: false });
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
  },

  checkForUpdates: async () => {
    const { lastUpdated } = get();
    const now = Date.now();
    
    // Проверяем, прошло ли достаточно времени с последнего обновления
    if (!lastUpdated || now - lastUpdated >= AUTO_UPDATE_INTERVAL) {
      await get().loadSettings();
    }
  }
}));

export default useSettingsStore; 