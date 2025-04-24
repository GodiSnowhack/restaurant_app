"use client";

import { createContext, useContext, useEffect, useState } from 'react';

// Тип для темы
type Theme = 'light' | 'dark';

// Интерфейс для контекста темы
interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  isDark: boolean;
  themeClass: (lightClass: string, darkClass: string) => string;
}

// Создаем контекст темы
const ThemeContext = createContext<ThemeContextType | null>(null);

// Провайдер темы
export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  // Состояние темы
  const [theme, setTheme] = useState<Theme>('light');
  
  // При инициализации проверяем localStorage или системные настройки
  useEffect(() => {
    // Проверяем сохраненную тему в localStorage
    const storedTheme = localStorage.getItem('theme') as Theme | null;
    
    // Если тема была сохранена, используем ее
    if (storedTheme) {
      setTheme(storedTheme);
    } 
    // Иначе проверяем системные предпочтения
    else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      setTheme('dark');
    }
  }, []);
  
  // Применяем тему к документу при ее изменении
  useEffect(() => {
    // Применяем тему к документу
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    
    // Сохраняем выбор пользователя
    localStorage.setItem('theme', theme);
  }, [theme]);
  
  // Функция переключения темы
  const toggleTheme = () => {
    setTheme(prevTheme => prevTheme === 'light' ? 'dark' : 'light');
  };

  // Функция-помощник для применения разных классов в зависимости от темы
  const themeClass = (lightClass: string, darkClass: string) => {
    return theme === 'light' ? lightClass : darkClass;
  };
  
  // Возвращаем провайдер с контекстом
  return (
    <ThemeContext.Provider value={{ 
      theme, 
      toggleTheme, 
      isDark: theme === 'dark',
      themeClass
    }}>
      {children}
    </ThemeContext.Provider>
  );
};

// Хук для использования темы в компонентах
export const useTheme = () => {
  const context = useContext(ThemeContext);
  
  if (!context) {
    throw new Error('useTheme должен использоваться внутри ThemeProvider');
  }
  
  return context;
}; 