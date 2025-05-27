import React, { createContext, useContext, useEffect, useState } from 'react';
import useSettingsStore from './lib/settings-store';
import { RestaurantSettings } from './lib/api/types';
import { PublicSettings } from './lib/api/settings';
import { Alert, Snackbar } from '@mui/material';

interface SettingsContextType {
  settings: RestaurantSettings;
  publicSettings: PublicSettings | null;
  isLoading: boolean;
  error: string | null;
  loadSettings: () => Promise<void>;
  loadPublicSettings: () => Promise<void>;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
};

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { settings, publicSettings, isLoading, error, loadSettings, loadPublicSettings } = useSettingsStore();
  const [initialized, setInitialized] = useState(false);
  const [showError, setShowError] = useState(false);

  useEffect(() => {
    // Загружаем настройки только один раз при монтировании компонента
    if (!initialized) {
      // Сначала загружаем публичные настройки
      loadPublicSettings().then(() => {
        // Затем загружаем полные настройки, если пользователь авторизован
        if (typeof window !== 'undefined' && localStorage.getItem('token')) {
          loadSettings();
        }
      });
      setInitialized(true);
    }
  }, [loadSettings, loadPublicSettings, initialized]);

  useEffect(() => {
    // Показываем ошибку, если она есть
    if (error) {
      setShowError(true);
    }
  }, [error]);

  const handleCloseError = () => {
    setShowError(false);
  };

  const value = {
    settings,
    publicSettings,
    isLoading,
    error,
    loadSettings,
    loadPublicSettings
  };

  return (
    <SettingsContext.Provider value={value}>
      {children}
      <Snackbar 
        open={showError && !!error} 
        autoHideDuration={6000} 
        onClose={handleCloseError}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={handleCloseError} severity="error" sx={{ width: '100%' }}>
          {error}
        </Alert>
      </Snackbar>
    </SettingsContext.Provider>
  );
}; 