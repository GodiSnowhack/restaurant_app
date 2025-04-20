import { useEffect, useState } from 'react';
import type { AppProps } from 'next/app';
import { useRouter } from 'next/router';
import '../styles/globals.css';
import useAuthStore from '../lib/auth-store';
import useSettingsStore from '../lib/settings-store';
import { SettingsProvider } from '../settings-context';

// Указываем Next.js использовать динамический рендеринг для всего приложения
export const dynamic = 'force-dynamic';

export default function App({ Component, pageProps }: AppProps) {
  const router = useRouter();
  const { isAuthenticated, user, fetchUserProfile } = useAuthStore();
  const { loadSettings } = useSettingsStore();
  const [token, setToken] = useState<string | null>(null);
  const [previousPath, setPreviousPath] = useState<string | null>(null);

  useEffect(() => {
    // Получаем токен из localStorage при рендере на клиенте
    const storedToken = localStorage.getItem('token');
    setToken(storedToken);
  }, []);

  useEffect(() => {
    const handleRouteChange = (path: string) => {
      setPreviousPath(router.pathname);
    };

    router.events.on('routeChangeStart', handleRouteChange);

    return () => {
      router.events.off('routeChangeStart', handleRouteChange);
    };
  }, [router]);

  useEffect(() => {
    // Расширяем список публичных маршрутов для гостей
    const publicRoutes = [
      '/auth/login', 
      '/auth/register', 
      '/', 
      '/menu', 
      '/menu/[id]', 
      '/cart', // Разрешаем неавторизованным пользователям просматривать корзину
      '/reservations', // Разрешаем неавторизованным пользователям просматривать страницу бронирования
      '/checkout' // Разрешаем неавторизованным пользователям просматривать страницу оформления заказа
    ];
    
    // Маршруты, требующие авторизации для фактических действий (оформление заказа, бронирование)
    const actionProtectedRoutes = [
      '/checkout/confirm', 
      '/reservations/create', 
      '/orders/create'
    ];
    
    const adminRoutes = ['/admin', '/admin/users', '/admin/orders', '/admin/settings', '/admin/menu', '/admin/reservations'];
    const userRoutes = ['/profile', '/orders']; // Уменьшили список защищенных пользовательских маршрутов
    const chefRoutes = ['/kitchen'];
    
    const path = router.pathname;

    if (path !== '/auth/login' && path !== '/auth/register') {
      // Перенаправляем на авторизацию только если пользователь пытается открыть защищенный роут
      if (!isAuthenticated && 
          !publicRoutes.includes(path) && 
          !path.startsWith('/menu/') && 
          !actionProtectedRoutes.includes(path)) {
        setPreviousPath(path);
        router.push('/auth/login');
      }
      
      // Защита роутов админки
      if (isAuthenticated && adminRoutes.includes(path) && user?.role !== 'admin') {
        router.push('/');
      }
      
      // Защита роутов кухни
      if (isAuthenticated && chefRoutes.includes(path) && user?.role !== 'chef') {
        router.push('/');
      }
    }
  }, [router.pathname, isAuthenticated, router, token, previousPath, user]);

  useEffect(() => {
    // Проверяем, авторизован ли пользователь и загружаем его профиль
    if (token) {
      fetchUserProfile();
    }
    
    // Загружаем настройки ресторана
    loadSettings();
  }, [token, fetchUserProfile, loadSettings]);

  return (
    <SettingsProvider>
      <Component {...pageProps} />
    </SettingsProvider>
  );
} 