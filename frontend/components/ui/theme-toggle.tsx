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
  
  return (
    <button 
      onClick={toggleTheme} 
      className={`transition-all duration-300 ${withText ? '' : 'rounded-full'} 
        ${theme === 'dark' 
        ? 'text-yellow-300 hover:text-yellow-200 hover:bg-gray-700' 
        : 'text-gray-700 hover:text-gray-900 hover:bg-gray-100'} 
        focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary p-2 ${className}`}
      aria-label="Переключить тему"
    >
      <div className="flex items-center">
        {theme === 'dark' ? (
          <>
            <SunIcon className={`${iconSizes[size]} transition-transform duration-300 transform hover:rotate-45`} />
            {withText && <span className="ml-2">Светлая тема</span>}
          </>
        ) : (
          <>
            <MoonIcon className={`${iconSizes[size]} transition-transform duration-300 transform hover:-rotate-12`} />
            {withText && <span className="ml-2">Темная тема</span>}
          </>
        )}
      </div>
    </button>
  );
};

export default ThemeToggle; 