import React, { createContext, useContext, useState, useEffect } from 'react';
import useSettingsStore from './lib/settings-store';
import { RestaurantSettings } from './types';

interface SettingsContextType {
  settings: RestaurantSettings;
  isLoading: boolean;
  error: string | null;
  loadSettings: () => Promise<void>;
}

const SettingsContext = createContext<SettingsContextType>({
  settings: {} as RestaurantSettings,
  isLoading: true,
  error: null,
  loadSettings: async () => {}
});

export const useSettings = () => useContext(SettingsContext);

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { settings, isLoading, error, loadSettings } = useSettingsStore();
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    // Загружаем настройки только один раз при монтировании компонента
    if (!initialized) {
      loadSettings();
      setInitialized(true);
    }
  }, [loadSettings, initialized]);

  const value = {
    settings,
    isLoading,
    error,
    loadSettings
  };

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
}; 