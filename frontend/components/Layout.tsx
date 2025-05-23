import React, { ReactNode, useEffect } from 'react';
import Head from 'next/head';
import Header from './Header';
import Footer from './Footer';
import { useTheme } from '@/lib/theme-context';
import { useRouter } from 'next/router';
import { Toaster } from 'react-hot-toast';

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
}

const Layout: React.FC<LayoutProps> = ({ 
  children, 
  title = 'Ресторан', 
  section, 
  showFooter = true, 
  description = 'Лучший ресторан в городе'
}) => {
  const { isDark } = useTheme();
  const router = useRouter();
  
  useEffect(() => {
    // Применяем dark mode в соответствии с настройками пользователя
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDark]);

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
    <>
      <Head>
        <title>{title}</title>
        <meta name="description" content={description} />
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0" />
        <meta name="theme-color" content={isDark ? '#1f2937' : '#f9fafb'} />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <Header />

        <main className="flex-grow" suppressHydrationWarning>
          <div className={section ? getSectionStyles() : 'w-full'} suppressHydrationWarning>
            {children}
          </div>
        </main>

        {showFooter && <Footer />}
      </div>

      <Toaster
        position="top-right"
        toastOptions={{
          duration: 3000,
          style: {
            background: '#333',
            color: '#fff',
          },
          success: {
            duration: 3000,
            style: {
              background: '#68D391',
              color: '#fff',
            },
          },
          error: {
            duration: 4000,
            style: {
              background: '#FC8181',
              color: '#fff',
            },
          },
        }}
      />
    </>
  );
};

export default Layout; 