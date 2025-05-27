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
    const initializeSettings = async () => {
      if (!initialized) {
        try {
          const hasToken = typeof window !== 'undefined' && localStorage.getItem('token');
          
          if (hasToken) {
            // Если пользователь авторизован, загружаем только полные настройки
            // Публичные настройки будут извлечены из полных в store
            await loadSettings();
          } else {
            // Если пользователь не авторизован, загружаем только публичные настройки
            await loadPublicSettings();
          }
          setInitialized(true);
        } catch (error) {
          console.error('Ошибка при инициализации настроек:', error);
          setShowError(true);
        }
      }
    };

    initializeSettings();
  }, [initialized, loadSettings, loadPublicSettings]);

  // Обработка изменения токена авторизации
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'token') {
        const hasToken = e.newValue !== null;
        
        // Перезагружаем настройки при изменении состояния авторизации
        if (hasToken) {
          loadSettings();
        } else {
          loadPublicSettings();
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [loadSettings, loadPublicSettings]);

  useEffect(() => {
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