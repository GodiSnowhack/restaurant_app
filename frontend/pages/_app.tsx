import { useEffect, useState, useCallback } from 'react';
import type { AppProps } from 'next/app';
import { useRouter } from 'next/router';
import '../styles/globals.css';
import useAuthStore, { type AuthStore } from '../lib/auth-store';
import useSettingsStore from '../lib/settings-store';
import useReservationsStore from '../lib/reservations-store';
import { SettingsProvider } from '../settings-context';
import dynamic from 'next/dynamic';
import { ThemeProvider } from '../lib/theme-context';
import { SessionProvider } from 'next-auth/react';
import Head from 'next/head';
import React from 'react';

// Динамический импорт компонента AuthDebugger для отображения только на клиенте
const AuthDebugger = dynamic(() => import('../components/AuthDebugger'), {
  ssr: false,
});

// Динамический импорт компонента MobileDetector для отображения только на клиенте
const MobileDetectorIndicator = dynamic(() => import('../components/MobileDetector').then(mod => mod.MobileDetectorIndicator), {
  ssr: false,
});

// Компонент загрузки без серверного рендеринга
const LoadingIndicator = dynamic(() => Promise.resolve(({ authError }: { authError: string | null }) => (
  <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 p-4">
    <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-primary mb-4"></div>
    <h1 className="text-xl font-semibold text-gray-800 mb-2">Загрузка приложения...</h1>
    <p className="text-gray-600 text-center mb-4">Пожалуйста, подождите</p>
    {authError && (
      <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mt-4">
        <p>{authError}</p>
        <button 
          className="mt-2 bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded"
          onClick={() => window.location.reload()}
        >
          Обновить страницу
        </button>
      </div>
    )}
  </div>
)), { ssr: false });

// Функция получения токена из любого доступного хранилища
const getAppToken = (): string | null => {
  if (typeof window === 'undefined') return null;
  
  try {
    const localToken = localStorage.getItem('token');
    const sessionToken = sessionStorage.getItem('token');
    
    // Если есть токен в localStorage, используем его
    if (localToken) {
      return localToken;
    } else if (sessionToken) {
      // Если токен есть только в sessionStorage, копируем его в localStorage
      try {
        localStorage.setItem('token', sessionToken);
      } catch (e) {
        console.error('Не удалось скопировать токен из sessionStorage в localStorage:', e);
      }
      return sessionToken;
    }
  } catch (e) {
    console.error('Ошибка при получении токена:', e);
  }
  
  return null;
};

// Список публичных маршрутов для гостей (доступны без авторизации)
export const PUBLIC_ROUTES = [
  '/auth/login', 
  '/auth/register', 
  '/', 
  '/menu', 
  '/menu/[id]', 
  '/cart',
  '/reservations',
  '/checkout'
];

// Список маршрутов, где нужно инициализировать бронирования
const RESERVATION_ROUTES = [
  '/reservations',
  '/reservations/[id]',
  '/admin/reservations',
  '/profile/reservations'
];

// Указываем Next.js использовать динамический рендеринг для всего приложения
export const renderMode = 'force-dynamic';

export default function App({ Component, pageProps }: AppProps) {
  const router = useRouter();
  const { isAuthenticated, user, fetchUserProfile, isMobileDevice, initialize } = useAuthStore();
  const { loadSettings } = useSettingsStore();
  const [previousPath, setPreviousPath] = useState<string | null>(null);
  const [showDebugger, setShowDebugger] = useState(false);
  const [isClient, setIsClient] = useState(false);
  
  // Принудительно отключаем демо-режим при каждой загрузке приложения
  React.useEffect(() => {
    try {
      localStorage.removeItem('force_demo_data');
      console.log('App: Демо-режим отключен при инициализации');
    } catch (e) {
      console.error('App: Ошибка при отключении демо-режима:', e);
    }
  }, []);
  
  // Определяем, что мы на клиенте
  useEffect(() => {
    const init = async () => {
      setIsClient(true);
      if (typeof window !== 'undefined') {
        const token = getAppToken();
        if (token) {
          console.log('App: Токен найден, инициализируем состояние авторизации');
          try {
            const store = useAuthStore.getState() as { initialize: () => Promise<void> };
            await store.initialize();
          } catch (error) {
            console.error('Ошибка при инициализации авторизации:', error);
          }
        } else {
          console.log('App: Токен не найден');
        }
      }
    };

    init();
  }, []);
  
  // Отдельный эффект для загрузки профиля пользователя
  useEffect(() => {
    if (!isClient) return;
    
    // Загружаем профиль только если пользователь авторизован, но профиль еще не загружен
    if (isAuthenticated && !user && typeof window !== 'undefined') {
      const token = getAppToken();
      if (token) {
        console.log('App: Загружаем профиль пользователя');
        fetchUserProfile();
      }
    }
  }, [isClient, isAuthenticated, user, fetchUserProfile]);
  
  // Загрузка профиля и настроек без блокировки UI
  useEffect(() => {
    if (!isClient) return;
    
    const loadUserData = async () => {
      // Загружаем настройки без ожидания
      loadSettings();
      
      // Инициализируем хранилище бронирований только на соответствующих страницах
      if (typeof window !== 'undefined') {
        const currentPath = router.pathname;
        const shouldInitReservations = RESERVATION_ROUTES.some(route => {
          // Используем точное совпадение или проверку на динамический маршрут
          if (route.includes('[') && route.includes(']')) {
            const routePattern = new RegExp('^' + route.replace(/\[.*?\]/g, '[^/]+') + '$');
            return routePattern.test(currentPath);
          }
          return currentPath === route;
        });

        if (shouldInitReservations) {
          try {
            const reservationsStore = useReservationsStore.getState();
            if (typeof reservationsStore.init === 'function') {
              reservationsStore.init();
            } else {
              console.log('Метод init не найден в хранилище бронирований');
            }
          } catch (e: unknown) {
            console.error('Ошибка при инициализации хранилища бронирований:', e);
          }
        }
      }
    };
    
    loadUserData();
    
    // Проверка профиля раз в 5 минут, а не каждые 30 секунд
    const intervalCheck = setInterval(() => {
      if (getAppToken() && isAuthenticated) {
        fetchUserProfile().catch(e => {
          console.error('Ошибка фоновой проверки профиля:', e);
        });
      }
    }, 300000); // 5 минут вместо 30 секунд
    
    return () => clearInterval(intervalCheck);
  }, [isClient, isAuthenticated, fetchUserProfile, loadSettings, router.pathname]);
  
  // Проверяем, имеет ли пользователь роль админа для отображения отладчика
  useEffect(() => {
    if (!isClient) return;
    
    // Проверяем не только роль, но и наличие пользователя
    const isAdmin = user && user.role === 'admin';
    setShowDebugger(!!isAdmin);
  }, [user, isClient]);
  
  // Отслеживаем изменения пути
  useEffect(() => {
    if (!isClient) return;
    
    const handleRouteChange = (path: string) => {
      setPreviousPath(router.pathname);
    };
    
    // Перехватываем ошибки маршрутизации
    const handleRouteError = (err: Error, url: string) => {
      console.error(`Ошибка при навигации на ${url}:`, err);
      
      // Проверяем, является ли это ошибкой прерывания загрузки компонента
      if (err.message.includes('Abort fetching component')) {
        console.log('Перехвачена ошибка прерывания загрузки компонента. Продолжаем работу приложения.');
        // Предотвращаем дальнейшее распространение ошибки
        return;
      }
    };
    
    router.events.on('routeChangeStart', handleRouteChange);
    router.events.on('routeChangeError', handleRouteError);
    
    return () => {
      router.events.off('routeChangeStart', handleRouteChange);
      router.events.off('routeChangeError', handleRouteError);
    };
  }, [router, isClient]);
  
  // Проверяем доступ к защищенным маршрутам
  useEffect(() => {
    if (!isClient) return;
    
    const adminRoutes = ['/admin', '/admin/users', '/admin/orders', '/admin/settings', '/admin/menu', '/admin/reservations'];
    const waiterRoutes = ['/waiter', '/waiter/scan', '/waiter/orders', '/waiter/orders/[id]'];
    const publicRoutes = ['/auth/login', '/auth/register', '/menu', '/menu/[id]', '/reservations', '/'];
    
    const path = router.pathname;

    // Если это публичный маршрут, разрешаем доступ
    if (publicRoutes.includes(path) || path.startsWith('/menu/')) {
      return;
    }
    
    // Проверяем права доступа для защищенных маршрутов
    if (!isAuthenticated) {
      console.log('_app: Пользователь не авторизован, перенаправляем на страницу входа');
      router.push('/auth/login');
      return;
    }
    
    // Проверяем роль пользователя
    if (!user) {
      console.log('_app: Нет данных о пользователе, загружаем профиль');
      fetchUserProfile();
      return;
    }
    
    // Защита роутов админки
    if (adminRoutes.includes(path) && user.role !== 'admin') {
      console.log('_app: Попытка доступа к админке без прав');
      router.push('/');
      return;
    }
    
    // Защита роутов официанта
    if (waiterRoutes.some(route => path === route || (route.endsWith('[id]') && path.startsWith(route.replace('[id]', '')))) && 
        user.role !== 'waiter' && user.role !== 'admin') {
      console.log('_app: Попытка доступа к панели официанта без прав');
      router.push('/');
      return;
    }
  }, [isAuthenticated, user, router.pathname, fetchUserProfile]);
  
  // Обернем отображение AuthDebugger в дополнительную проверку
  const renderAuthDebugger = () => {
    if (!isClient) return null;
    
    try {
      if (showDebugger && isAuthenticated && user && user.role === 'admin') {
        return <AuthDebugger />;
      }
    } catch (error) {
      console.error('Ошибка при рендеринге AuthDebugger:', error);
    }
    return null;
  };
  
  // Базовый рендер для сервера
  if (!isClient) {
    return (
      <SettingsProvider>
        <ThemeProvider>
          <SessionProvider session={pageProps.session}>
            <Head>
              <meta name="viewport" content="width=device-width, initial-scale=1" />
            </Head>
            <div suppressHydrationWarning>
              {/* В режиме SSR не рендерим компоненты, которые должны работать только на клиенте */}
              {null}
            </div>
          </SessionProvider>
        </ThemeProvider>
      </SettingsProvider>
    );
  }
  
  return (
    <SettingsProvider>
      <ThemeProvider>
        <SessionProvider session={pageProps.session}>
          <Head>
            <meta name="viewport" content="width=device-width, initial-scale=1" />
          </Head>
          <div suppressHydrationWarning>
            <Component {...pageProps} />
            {renderAuthDebugger()}
            {typeof isMobileDevice === 'function' && isMobileDevice() && process.env.NODE_ENV === 'development' && <MobileDetectorIndicator />}
          </div>
        </SessionProvider>
      </ThemeProvider>
    </SettingsProvider>
  );
} 