import { useEffect, useState } from 'react';
import type { AppProps } from 'next/app';
import { useRouter } from 'next/router';
import '../styles/globals.css';
import useAuthStore from '../lib/auth-store';
import useSettingsStore from '../lib/settings-store';
import useReservationsStore from '../lib/reservations-store';
import { SettingsProvider } from '../settings-context';
import dynamic from 'next/dynamic';
import { ThemeProvider } from '../lib/theme-context';
import { SessionProvider } from 'next-auth/react';
import Head from 'next/head';

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

// Указываем Next.js использовать динамический рендеринг для всего приложения
export const renderMode = 'force-dynamic';

export default function App({ Component, pageProps }: AppProps) {
  const router = useRouter();
  const { isAuthenticated, user, fetchUserProfile, isMobileDevice, setInitialAuthState } = useAuthStore();
  const { loadSettings } = useSettingsStore();
  const [previousPath, setPreviousPath] = useState<string | null>(null);
  const [showDebugger, setShowDebugger] = useState(false);
  const [isClient, setIsClient] = useState(false);
  
  // Определяем, что мы на клиенте
  useEffect(() => {
    setIsClient(true);
    
    // Сразу устанавливаем начальное состояние авторизации по наличию токена
    if (typeof window !== 'undefined') {
      const token = getAppToken();
      // Если есть токен, считаем пользователя предварительно авторизованным
      if (token) {
        console.log('App: Токен найден, устанавливаем начальное состояние авторизации');
        setInitialAuthState(true, token);
      } else {
        console.log('App: Токен не найден');
      }
    }
  }, [setInitialAuthState]);
  
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
      
      // Инициализируем хранилище бронирований с помощью getState().init()
      if (typeof window !== 'undefined') {
        try {
          const reservationsStore = useReservationsStore.getState();
          if (typeof reservationsStore.init === 'function') {
            reservationsStore.init();
          } else {
            console.log('Метод init не найден в хранилище бронирований');
          }
        } catch (error) {
          console.error('Ошибка при инициализации хранилища бронирований:', error);
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
  }, [isClient, isAuthenticated, fetchUserProfile, loadSettings]);
  
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
    
    const path = router.pathname;
    
    // Проверка разрешения для роли официанта с учетом всех возможных источников
    const hasWaiterPermission = () => {
      try {
        // 1. Проверка из объекта user в стейте
        if (user && (user.role === 'waiter' || user.role === 'admin')) {
          console.log('_app: Доступ разрешен по роли из стейта:', user.role);
          return true;
        }
        
        // 2. Проверка прямого ключа user_role из localStorage
        if (typeof localStorage !== 'undefined') {
          const userRole = localStorage.getItem('user_role');
          if (userRole && (userRole === 'waiter' || userRole === 'admin')) {
            console.log('_app: Доступ разрешен по роли из localStorage (user_role):', userRole);
            return true;
          }
        }
        
        // 3. Проверка из объекта user в localStorage
        if (typeof localStorage !== 'undefined') {
          const userStr = localStorage.getItem('user');
          if (userStr) {
            try {
              const userData = JSON.parse(userStr);
              if (userData && (userData.role === 'waiter' || userData.role === 'admin')) {
                console.log('_app: Доступ разрешен по роли из localStorage (user):', userData.role);
                return true;
              }
            } catch (e) {
              console.error('_app: Ошибка при парсинге user из localStorage', e);
            }
          }
        }
        
        // 4. Проверка из объекта user_profile в localStorage
        if (typeof localStorage !== 'undefined') {
          const profileStr = localStorage.getItem('user_profile');
          if (profileStr) {
            try {
              const profileData = JSON.parse(profileStr);
              if (profileData && (profileData.role === 'waiter' || profileData.role === 'admin')) {
                console.log('_app: Доступ разрешен по роли из localStorage (user_profile):', profileData.role);
                return true;
              }
            } catch (e) {
              console.error('_app: Ошибка при парсинге user_profile из localStorage', e);
            }
          }
        }
        
        return false;
      } catch (e) {
        console.error('_app: Ошибка при проверке прав доступа к панели официанта', e);
        return false;
      }
    };
    
    // Защита роутов админки
    if (isAuthenticated && adminRoutes.includes(path) && user?.role !== 'admin') {
      console.log('Попытка доступа к админке без прав');
      router.push('/');
      return;
    }
    
    // Защита роутов официанта
    if (isAuthenticated && 
        waiterRoutes.some(route => path === route || (route.endsWith('[id]') && path.startsWith(route.replace('[id]', '')))) && 
        !hasWaiterPermission()) {
      console.log('Попытка доступа к панели официанта без прав');
      router.push('/');
      return;
    }
    
    // Перенаправляем на авторизацию только если пользователь пытается открыть защищенный роут
    // и точно не авторизован (нет токена)
    if (!isAuthenticated && 
        !PUBLIC_ROUTES.includes(path) && 
        !path.startsWith('/menu/') && 
        !getAppToken() && 
        path !== '/auth/login' && 
        path !== '/auth/register') {
      console.log('Перенаправление на логин с:', path);
      router.push('/auth/login');
    }
  }, [router.pathname, isAuthenticated, router, user, isClient, previousPath]);
  
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
            {isMobileDevice && process.env.NODE_ENV === 'development' && <MobileDetectorIndicator />}
          </div>
        </SessionProvider>
      </ThemeProvider>
    </SettingsProvider>
  );
} 