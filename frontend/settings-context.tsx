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
  const { settings, publicSettings, isLoading, error, loadPublicSettings } = useSettingsStore();
  const [showError, setShowError] = useState(false);

  useEffect(() => {
    // Загружаем только публичные настройки при монтировании компонента
    loadPublicSettings();
  }, []);

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
    error
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