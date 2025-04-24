'use client';

import React from 'react';
import { SunIcon, MoonIcon } from '@heroicons/react/24/outline';
import { useTheme } from '../../lib/theme-context';

interface ThemeToggleProps {
  className?: string;
  withText?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({ 
  className = '', 
  withText = false,
  size = 'md' 
}) => {
  const { theme, toggleTheme } = useTheme();
  
  const iconSizes = {
    sm: 'h-4 w-4',
    md: 'h-6 w-6',
    lg: 'h-8 w-8'
  };
  
  const isDark = theme === 'dark';
  
  return (
    <button 
      onClick={toggleTheme} 
      className={`
        inline-flex items-center justify-center
        ${withText ? 'px-3 py-2' : 'p-2'}
        rounded-full
        transition-all duration-300 ease-in-out
        ${isDark 
          ? 'bg-gray-800 text-yellow-400 hover:bg-gray-700 hover:text-yellow-300' 
          : 'bg-gray-100 text-gray-700 hover:bg-gray-200 hover:text-gray-900'
        }
        focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2
        dark:focus:ring-offset-gray-800
        ${className}
      `}
      aria-label="Переключить тему"
    >
      <div className="flex items-center">
        {isDark ? (
          <>
            <SunIcon 
              className={`
                ${iconSizes[size]}
                transition-transform duration-300
                transform hover:rotate-45
                animate-[spin_1s_ease-in-out]
              `}
            />
            {withText && (
              <span className="ml-2 text-sm font-medium">
                Светлая тема
              </span>
            )}
          </>
        ) : (
          <>
            <MoonIcon 
              className={`
                ${iconSizes[size]}
                transition-transform duration-300
                transform hover:-rotate-12
                animate-[bounce_1s_ease-in-out]
              `}
            />
            {withText && (
              <span className="ml-2 text-sm font-medium">
                Темная тема
              </span>
            )}
          </>
        )}
      </div>
    </button>
  );
};

export default ThemeToggle; 