'use client';

import React, { ReactNode } from 'react';
import { useTheme } from '../../lib/theme-context';

type ContainerVariant = 'primary' | 'secondary' | 'card' | 'transparent';

interface ThemedContainerProps {
  children: ReactNode;
  variant?: ContainerVariant;
  className?: string;
}

export const ThemedContainer: React.FC<ThemedContainerProps> = ({
  children,
  variant = 'primary',
  className = ''
}) => {
  const { isDark } = useTheme();
  
  const getContainerClasses = (): string => {
    switch (variant) {
      case 'primary':
        return isDark
          ? 'bg-gray-900 text-white'
          : 'bg-white text-gray-900';
      case 'secondary':
        return isDark
          ? 'bg-gray-800 text-white'
          : 'bg-gray-50 text-gray-900';
      case 'card':
        return isDark
          ? 'bg-gray-800 text-white border border-gray-700 shadow-md'
          : 'bg-white text-gray-900 border border-gray-200 shadow-md';
      case 'transparent':
        return isDark
          ? 'bg-transparent text-white'
          : 'bg-transparent text-gray-900';
      default:
        return '';
    }
  };
  
  return (
    <div className={`${getContainerClasses()} ${className}`}>
      {children}
    </div>
  );
};

export default ThemedContainer; 