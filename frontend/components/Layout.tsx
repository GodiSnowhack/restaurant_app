import React, { ReactNode, useEffect } from 'react';
import Head from 'next/head';
import Header from './Header';
import Footer from './Footer';
import { useTheme } from '@/lib/theme-context';
import useAuthStore from '../lib/auth-store';

// Вспомогательная функция для безопасного получения URL изображений с обработкой ошибок 404
export const getSafeImageUrl = (imageUrl: string | null | undefined): string => {
  if (!imageUrl) return '/images/placeholder-user.jpg';
  
  // Если URL начинается с http или https, возвращаем как есть
  if (imageUrl.startsWith('http:') || imageUrl.startsWith('https:')) {
    return imageUrl;
  }
  
  // Для относительных путей добавляем базовый URL
  if (imageUrl.startsWith('/')) {
    // Проверяем есть ли в URL имя пользователя (userX.jpg)
    if (imageUrl.includes('user') && imageUrl.endsWith('.jpg')) {
      // Заменяем на плейсхолдер, чтобы предотвратить ошибки 404
      return '/images/placeholder-user.jpg';
    }
    return imageUrl;
  }
  
  // Если URL не начинается с /, добавляем его
  return `/${imageUrl}`;
};

interface LayoutProps {
  children: ReactNode;
  title?: string;
  section?: string;
  showFooter?: boolean;
  description?: string;
  keywords?: string;
  noFooter?: boolean;
  noHeader?: boolean;
}

const Layout: React.FC<LayoutProps> = ({ 
  children, 
  title = 'Restaurant App', 
  section, 
  showFooter = true, 
  description = 'Restaurant management application',
  keywords = 'restaurant, food, delivery, menu',
  noFooter = false,
  noHeader = false
}) => {
  const { isDark } = useTheme();
  const { isAuthenticated, user, initialize } = useAuthStore();
  
  useEffect(() => {
    // Применяем dark mode в соответствии с настройками пользователя
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDark]);

  useEffect(() => {
    // Проверяем авторизацию при монтировании компонента
    if (!isAuthenticated) {
      initialize();
    }
  }, []);

  const getSectionStyles = () => {
    switch (section) {
      case 'admin':
        return 'container mx-auto px-4 py-6 max-w-7xl';
      case 'waiter':
        return 'container mx-auto px-4 py-6 max-w-5xl';
      case 'customer':
        return 'container mx-auto px-4 py-6';
      default:
        return 'w-full';
    }
  };

  return (
    <div className={`min-h-screen flex flex-col ${isDark ? 'bg-gray-900 text-gray-100' : 'bg-gray-50 text-gray-900'}`}>
      <Head>
        <title>{title}</title>
        <meta name="description" content={description} />
        <meta name="keywords" content={keywords} />
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0" />
        <meta name="theme-color" content={isDark ? '#1f2937' : '#f9fafb'} />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      {!noHeader && <Header />}

      <main className="flex-grow" suppressHydrationWarning>
        <div className={section ? getSectionStyles() : 'w-full'} suppressHydrationWarning>
          {children}
        </div>
      </main>

      {!noFooter && <Footer />}
    </div>
  );
};

export default Layout; 