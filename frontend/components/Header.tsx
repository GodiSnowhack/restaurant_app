'use client';

import {useState, useEffect, useRef} from 'react';
import Link from 'next/link';
import {useRouter} from 'next/router';
import {Bars3Icon as MenuIcon, XMarkIcon as XIcon, ShoppingCartIcon, UserIcon, HomeIcon, ClipboardDocumentListIcon as ClipboardIcon, CalendarIcon, Cog6ToothIcon as CogIcon, ArrowRightOnRectangleIcon as LogoutIcon, SunIcon, MoonIcon} from '@heroicons/react/24/outline';
import useAuthStore from '../lib/auth-store';
import useCartStore from '../lib/cart-store';
import {useSettings} from '../settings-context';
import {useTheme} from '../lib/theme-context';
import Image from 'next/image';
import {UserCircleIcon} from '@heroicons/react/24/outline';
import ThemeToggle from './ui/theme-toggle';

// Определение типа для данных пользователя
interface UserType {
  id?: number;
  full_name?: string;
  email?: string;
  role?: string;
  is_staff?: boolean;
}

// Определение типа для состояния авторизации
interface AuthStateType {
  isAuthenticated: boolean;
  user: UserType | null;
}

const Header = () => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [cartCount, setCartCount] = useState(0);
  const [isMounted, setIsMounted] = useState(false);
  const router = useRouter();
  const { isAuthenticated, user, logout } = useAuthStore();
  const { items } = useCartStore();
  const { settings } = useSettings();
  const { theme } = useTheme();
  const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const profileDropdownRef = useRef<HTMLDivElement>(null);
  const [authState, setAuthState] = useState<AuthStateType>({ isAuthenticated: false, user: null });

  // Устанавливаем флаг клиентского рендеринга и инициализируем состояние авторизации
  useEffect(() => {
    setIsMounted(true);
    
    // Проверяем наличие токена вручную
    const hasToken = typeof window !== 'undefined' && !!localStorage.getItem('token');
    
    // Устанавливаем состояние авторизации только после монтирования компонента
    if (hasToken) {
      setAuthState({ isAuthenticated: true, user: user as UserType });
    } else {
      setAuthState({ isAuthenticated: false, user: null });
    }
    
    console.log('Header: состояние аутентификации:', { isAuthenticated, user });
  }, []);
  
  // Обновляем состояние авторизации при изменении isAuthenticated или user
  useEffect(() => {
    if (isMounted) {
      setAuthState({ isAuthenticated, user: user as UserType });
    }
  }, [isAuthenticated, user, isMounted]);

  // Обновляем количество товаров в корзине
  useEffect(() => {
    setCartCount(items.length);
  }, [items]);

  const toggleMenu = () => {
    setMenuOpen(!menuOpen);
  };

  const handleLogout = async () => {
    await logout();
    // После логаута перенаправляем на страницу логина вместо домашней страницы
    router.push('/auth/login');
    setMenuOpen(false);
  };

  // Добавляем обработчик клика на логотип с проверкой текущего пути
  const handleLogoClick = (e: React.MouseEvent) => {
    // Если мы уже на главной странице, предотвращаем переход
    if (router.pathname === '/') {
      e.preventDefault();
      return;
    }
  };

  const navItems = [
    { label: 'Главная', href: '/' },
    { label: 'Меню', href: '/menu' },
    { label: 'Бронирование', href: '/reservations' }
  ];

  // Дополнительные пункты меню в зависимости от роли пользователя
  if (isMounted && authState.isAuthenticated && authState.user) {
    if (authState.user.role === 'waiter' || authState.user.role === 'admin') {
      navItems.push({ label: 'Панель официанта', href: '/waiter' });
    }
    if (authState.user.role === 'admin') {
      navItems.push({ label: 'Администрирование', href: '/admin' });
    }
  }

  return (
    <header className="bg-white shadow-md dark:bg-gray-800 dark:text-white transition-colors duration-300">
      <div className="container mx-auto px-4 md:px-6 lg:px-8 max-w-[1400px]">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center space-x-4 flex-shrink-0">
            <Link href="/" className="flex items-center" onClick={handleLogoClick}>
              {settings?.logo_url ? (
                <Image
                  src={settings.logo_url}
                  alt={settings?.restaurant_name || 'Ресторан'}
                  width={40}
                  height={40}
                  className="rounded-full"
                />
              ) : (
                <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center">
                  <span className="text-white font-bold text-xl">
                    {settings?.restaurant_name?.[0] || 'Р'}
                  </span>
                </div>
              )}
              <span className="ml-2 text-xl font-bold text-gray-900 dark:text-white">
                {settings?.restaurant_name || 'Ресторан'}
              </span>
            </Link>
          </div>

          <nav className="hidden md:flex space-x-1 lg:space-x-4">
            {navItems.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className={`px-2 lg:px-3 py-2 rounded-md text-sm font-medium transition-colors duration-200 ${
                  router.pathname === item.href
                    ? 'bg-primary-light text-primary dark:bg-primary/20 dark:text-primary'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-primary dark:text-gray-200 dark:hover:bg-gray-700 dark:hover:text-primary'
                } ${item.label === 'Администрирование' ? 'min-w-[160px] text-center' : ''}`}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center space-x-2 md:space-x-4 flex-shrink-0">
            {/* Переключатель темы */}
            <ThemeToggle className="transition-transform duration-200 hover:scale-105" />

            <Link 
              href="/cart" 
              className="relative p-1 text-gray-700 hover:text-primary dark:text-gray-200 dark:hover:text-primary transition-colors duration-200"
            >
              <ShoppingCartIcon className="h-6 w-6" />
              <span suppressHydrationWarning>
                {isMounted && cartCount > 0 && (
                  <span className="absolute -top-2 -right-2 bg-primary text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center transition-all duration-200">
                    {cartCount}
                  </span>
                )}
              </span>
            </Link>
            
            <div suppressHydrationWarning>
              {isMounted && authState.isAuthenticated ? (
                <div className="relative" ref={profileDropdownRef}>
                  <button
                    onClick={() => setIsProfileDropdownOpen(!isProfileDropdownOpen)}
                    className="flex items-center text-sm font-medium text-gray-700 hover:text-primary dark:text-gray-200 dark:hover:text-primary transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 dark:focus:ring-offset-gray-800 rounded-full"
                  >
                    <span className="hidden sm:block mr-1">{authState.user?.full_name}</span>
                    <UserCircleIcon className="h-8 w-8 text-gray-400 dark:text-gray-300" />
                  </button>
                  
                  {isProfileDropdownOpen && (
                    <div className="absolute right-0 mt-2 w-48 rounded-md shadow-lg py-1 bg-white dark:bg-gray-800 ring-1 ring-black ring-opacity-5 focus:outline-none z-50 transition-all duration-200">
                      {/* Профиль */}
                      <Link
                        href="/profile"
                        className="flex px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 items-center"
                        onClick={() => setIsProfileDropdownOpen(false)}
                      >
                        <UserIcon className="mr-3 h-5 w-5" />
                        Профиль
                      </Link>
                      
                      {/* Заказы */}
                      <Link
                        href="/orders"
                        className="flex px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 items-center"
                        onClick={() => setIsProfileDropdownOpen(false)}
                      >
                        <ClipboardIcon className="mr-3 h-5 w-5" />
                        Мои заказы
                      </Link>
                      
                      {/* Бронирования */}
                      <Link
                        href="/reservations"
                        className="flex px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 items-center"
                        onClick={() => setIsProfileDropdownOpen(false)}
                      >
                        <CalendarIcon className="mr-3 h-5 w-5" />
                        Бронирования
                      </Link>

                      {/* Администрирование (если пользователь админ) */}
                      {authState.user?.is_staff && (
                        <Link
                          href="/admin"
                          className="flex px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 items-center"
                          onClick={() => setIsProfileDropdownOpen(false)}
                        >
                          <CogIcon className="mr-3 h-5 w-5" />
                          Администрирование
                        </Link>
                      )}
                      
                      {/* Разделитель */}
                      <div className="border-t border-gray-200 dark:border-gray-600 my-1"></div>

                      {/* Выход */}
                      <button
                        onClick={handleLogout}
                        className="flex w-full px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 items-center"
                      >
                        <LogoutIcon className="mr-3 h-5 w-5" />
                        Выйти
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <Link
                  href="/auth/login"
                  className="text-sm font-medium text-gray-700 hover:text-primary dark:text-gray-200 dark:hover:text-primary transition-colors duration-200"
                >
                  Войти
                </Link>
              )}
            </div>
          </div>
        </div>
        
        {/* Мобильное меню */}
        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="md:hidden p-2 rounded-md text-gray-700 hover:text-primary dark:text-gray-200 dark:hover:text-primary transition-colors duration-200"
        >
          {isMobileMenuOpen ? (
            <XIcon className="h-6 w-6" />
          ) : (
            <MenuIcon className="h-6 w-6" />
          )}
        </button>

        <div suppressHydrationWarning>
          {isMobileMenuOpen && (
            <div className="md:hidden border-t border-gray-200 dark:border-gray-700 pt-2 pb-3 space-y-1">
              {navItems.map((item) => (
                <Link
                  key={item.label}
                  href={item.href}
                  className={`block px-3 py-2 rounded-md text-base font-medium transition-colors duration-200 ${
                    router.pathname === item.href
                      ? 'bg-primary-light text-primary dark:bg-primary/20 dark:text-primary'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-primary dark:text-gray-200 dark:hover:bg-gray-700 dark:hover:text-primary'
                  }`}
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  {item.label}
                </Link>
              ))}
              
              {/* Переключатель темы в мобильном меню */}
              <div className="px-3 py-2">
                <ThemeToggle withText={true} className="flex items-center w-full text-gray-600 dark:text-gray-200" />
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header; 