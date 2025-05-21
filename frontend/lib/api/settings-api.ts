import { api } from '../api';

interface RestaurantSettings {
  restaurant_name: string;
  email: string;
  phone: string;
  address: string;
  working_hours: {
    [key: string]: {
      open: string;
      close: string;
      is_closed: boolean;
    };
  };
  currency: string;
  currency_symbol: string;
  tax_percentage: number;
  delivery_fee: number;
}

export const settingsApi = {
  async getSettings(): Promise<RestaurantSettings> {
    try {
      const response = await api.get('/settings');
      return response.data;
    } catch (error) {
      console.error('Error fetching settings:', error);
      throw error;
    }
  },

  async updateSettings(settings: Partial<RestaurantSettings>): Promise<RestaurantSettings> {
    try {
      const response = await api.put('/settings', settings);
      return response.data;
    } catch (error) {
      console.error('Error updating settings:', error);
      throw error;
    }
  }
}; 