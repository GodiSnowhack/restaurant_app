import { useState, useEffect } from 'react';
import { api } from '../api/core';

interface Settings {
  restaurant_name: string;
  email: string;
  phone: string;
  address: string;
  website: string;
  [key: string]: any;
}

let cachedSettings: Settings | null = null;
let settingsPromise: Promise<Settings> | null = null;

export const useSettings = () => {
  const [settings, setSettings] = useState<Settings | null>(cachedSettings);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(!cachedSettings);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        // Если уже есть кэшированные настройки, используем их
        if (cachedSettings) {
          setSettings(cachedSettings);
          setLoading(false);
          return;
        }

        // Если уже идет запрос настроек, ждем его завершения
        if (settingsPromise) {
          const result = await settingsPromise;
          setSettings(result);
          setLoading(false);
          return;
        }

        // Создаем новый запрос
        settingsPromise = api.get('/settings').then(response => response.data);
        
        const result = await settingsPromise;
        cachedSettings = result;
        setSettings(result);
        setError(null);
      } catch (err) {
        console.error('Ошибка при получении настроек:', err);
        setError(err instanceof Error ? err.message : 'Неизвестная ошибка');
      } finally {
        setLoading(false);
        settingsPromise = null;
      }
    };

    fetchSettings();
  }, []);

  // Функция для принудительного обновления настроек
  const refreshSettings = async () => {
    setLoading(true);
    cachedSettings = null;
    settingsPromise = null;
    try {
      const response = await api.get('/settings');
      cachedSettings = response.data;
      setSettings(cachedSettings);
      setError(null);
    } catch (err) {
      console.error('Ошибка при обновлении настроек:', err);
      setError(err instanceof Error ? err.message : 'Неизвестная ошибка');
    } finally {
      setLoading(false);
    }
  };

  return { settings, loading, error, refreshSettings };
}; 