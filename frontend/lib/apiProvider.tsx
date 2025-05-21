import React, { createContext, useContext, ReactNode, useEffect, useState } from 'react';
import { api } from './api/core';
import { authApi } from './api/auth';
import { menuApi } from './api/menu';
import { ordersApi } from './api/orders';
import { reservationsApi } from './api/reservations-api';
import waiterApi from './api/waiter';
import { settingsApi } from './api/settings';
import { RestaurantSettings, UserProfile } from './api/types';
import * as apiUtils from './api/utils';

interface ApiContextType {
  api: typeof api;
  utils: typeof apiUtils;
  isLoggedIn: boolean;
  isLoading: boolean;
  userProfile: UserProfile | null;
  settings: RestaurantSettings | null;
  refreshUserProfile: () => Promise<UserProfile | null>;
  refreshSettings: () => Promise<RestaurantSettings>;
  logout: () => void;
}

const ApiContext = createContext<ApiContextType | undefined>(undefined);

interface ApiProviderProps {
  children: ReactNode;
}

export const ApiProvider: React.FC<ApiProviderProps> = ({ children }) => {
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [settings, setSettings] = useState<RestaurantSettings | null>(null);

  // Функция для обновления профиля пользователя
  const refreshUserProfile = async (): Promise<UserProfile | null> => {
    try {
      const profile = await authApi.getProfile();
      setUserProfile(profile);
      setIsLoggedIn(true);
      return profile;
    } catch (error) {
      console.error('ApiProvider: Ошибка при получении профиля пользователя:', error);
      setUserProfile(null);
      setIsLoggedIn(false);
      return null;
    }
  };

  // Функция для обновления настроек ресторана
  const refreshSettings = async (): Promise<RestaurantSettings> => {
    try {
      const settings = await settingsApi.getSettings();
      setSettings(settings);
      return settings;
    } catch (error) {
      console.error('ApiProvider: Ошибка при получении настроек ресторана:', error);
      // Используем настройки по умолчанию в случае ошибки
      const defaultSettings = settingsApi.getDefaultSettings();
      if (defaultSettings) {
        setSettings(defaultSettings);
        return defaultSettings;
      }
      throw error; // Если не удалось получить настройки по умолчанию, пробрасываем ошибку
    }
  };

  // Функция для выхода из системы
  const logout = () => {
    authApi.logout();
    setIsLoggedIn(false);
    setUserProfile(null);
  };

  // Инициализация при монтировании компонента
  useEffect(() => {
    const initializeApi = async () => {
      setIsLoading(true);
      try {
        // Загружаем настройки ресторана
        await refreshSettings();
        
        // Пытаемся получить профиль пользователя, если токен существует
        await refreshUserProfile();
      } catch (error) {
        console.error('ApiProvider: Ошибка при инициализации API:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    initializeApi();
  }, []);

  const value = {
    api,
    utils: apiUtils,
    isLoggedIn,
    isLoading,
    userProfile,
    settings,
    refreshUserProfile,
    refreshSettings,
    logout
  };

  return <ApiContext.Provider value={value}>{children}</ApiContext.Provider>;
};

// Хук для использования API в компонентах
export const useApi = (): ApiContextType => {
  const context = useContext(ApiContext);
  if (context === undefined) {
    throw new Error('useApi должен использоваться внутри ApiProvider');
  }
  return context;
};

// Специализированные хуки для различных API
export const useAuthApi = () => {
  const { isLoggedIn, userProfile, refreshUserProfile, logout } = useApi();
  return { 
    api: authApi, 
    isLoggedIn, 
    userProfile, 
    refreshUserProfile, 
    logout 
  };
};

export const useMenuApi = () => {
  const { utils } = useApi();
  return { 
    api: menuApi, 
    utils 
  };
};

export const useOrdersApi = () => {
  const { utils } = useApi();
  return { 
    api: ordersApi, 
    utils
  };
};

export const useWaiterApi = () => {
  const { utils } = useApi();
  return { 
    api: waiterApi, 
    utils 
  };
};

export const useSettingsApi = () => {
  const { settings, refreshSettings } = useApi();
  return { 
    api: settingsApi, 
    settings, 
    refreshSettings 
  };
};

export const useReservationsApi = () => {
  const { utils } = useApi();
  return { 
    api: reservationsApi, 
    utils 
  };
};

// Хук для доступа к утилитам API
export const useApiUtils = () => {
  const { utils } = useApi();
  return utils;
}; 