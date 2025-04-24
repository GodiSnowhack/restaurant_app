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

  // Устанавливаем флаг клиентского рендеринга
  useEffect(() => {
    setIsMounted(true);
  }, []);

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
  if (isMounted && isAuthenticated && user) {
    if (user.role === 'waiter' || user.role === 'admin') {
      navItems.push({ label: 'Панель официанта', href: '/waiter' });
    }
    if (user.role === 'admin') {
      navItems.push({ label: 'Администрирование', href: '/admin' });
    }
  }

  return (
    <header className="bg-white shadow-md dark:bg-gray-800 dark:text-white">
      <div className="container mx-auto px-4 md:px-6 lg:px-8 max-w-[1400px]">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center space-x-4 flex-shrink-0">
            <Link href="/" className="flex items-center" onClick={handleLogoClick}>
              {settings.logo_url ? (
                <Image
                  src={settings.logo_url}
                  alt={settings.restaurant_name || 'Ресторан'}
                  width={40}
                  height={40}
                  className="rounded-md"
                />
              ) : (
                <div className="text-primary font-bold text-xl uppercase dark:text-primary">
                  {settings.restaurant_name || 'RESTAURANT'}
                </div>
              )}
            </Link>
          </div>

          <nav className="hidden md:flex space-x-1 lg:space-x-4">
            {navItems.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className={`px-2 lg:px-3 py-2 rounded-md text-sm font-medium ${
                  router.pathname === item.href
                    ? 'bg-primary-light text-primary dark:bg-primary/20'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-primary dark:text-gray-200 dark:hover:bg-gray-700'
                } ${item.label === 'Администрирование' ? 'min-w-[160px] text-center' : ''}`}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center space-x-2 md:space-x-4 flex-shrink-0">
            {/* Переключатель темы */}
            <ThemeToggle />

            <Link 
              href="/cart" 
              className="relative p-1 text-gray-700 hover:text-primary dark:text-gray-200 dark:hover:text-primary"
            >
              <ShoppingCartIcon className="h-6 w-6" />
              {isMounted && cartCount > 0 && (
                <span className="absolute -top-2 -right-2 bg-primary text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
                  {cartCount}
                </span>
              )}
            </Link>
            
            {isAuthenticated ? (
              <div className="relative" ref={profileDropdownRef}>
                <button
                  onClick={() => setIsProfileDropdownOpen(!isProfileDropdownOpen)}
                  className="flex items-center text-sm font-medium text-gray-700 hover:text-primary focus:outline-none dark:text-gray-200"
                >
                  <span className="hidden sm:block mr-1">{user?.full_name}</span>
                  <UserCircleIcon className="h-8 w-8 text-gray-400 dark:text-gray-300" />
                </button>
                
                {isProfileDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-48 rounded-md shadow-lg py-1 bg-white ring-1 ring-black ring-opacity-5 z-50 dark:bg-gray-800 dark:ring-gray-700">
                    <div className="px-4 py-2 text-xs text-gray-500 border-b dark:text-gray-400 dark:border-gray-700">
                      Вы вошли как <span className="font-medium">{user?.role}</span>
                    </div>
                    
                    <Link
                      href="/profile"
                      className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
                      onClick={() => setIsProfileDropdownOpen(false)}
                    >
                      Мой профиль
                    </Link>
                    
                    <Link
                      href="/orders"
                      className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
                      onClick={() => setIsProfileDropdownOpen(false)}
                    >
                      Мои заказы
                    </Link>
                    
                    {(user?.role === 'admin' || user?.role === 'manager') && (
                      <Link
                        href="/admin"
                        className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
                        onClick={() => setIsProfileDropdownOpen(false)}
                      >
                        Админ-панель
                      </Link>
                    )}
                    
                    <button
                      onClick={handleLogout}
                      className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-100 dark:hover:bg-gray-700"
                    >
                      Выйти
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <Link
                href="/auth/login"
                className="text-sm text-gray-700 hover:text-primary font-medium flex items-center dark:text-gray-200"
              >
                <UserCircleIcon className="h-8 w-8 text-gray-400 mr-1 dark:text-gray-300" />
                <span className="hidden sm:block">Войти</span>
              </Link>
            )}
            
            <button
              type="button"
              className="md:hidden inline-flex items-center justify-center p-2 rounded-md text-gray-500 hover:text-primary hover:bg-gray-100 focus:outline-none dark:text-gray-400 dark:hover:bg-gray-700"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            >
              <span className="sr-only">Открыть меню</span>
              {isMobileMenuOpen ? (
                <XIcon className="block h-6 w-6" />
              ) : (
                <MenuIcon className="block h-6 w-6" />
              )}
            </button>
          </div>
        </div>
        
        {/* Мобильное меню */}
        {isMobileMenuOpen && (
          <div className="md:hidden border-t border-gray-200 pt-2 pb-3 space-y-1 dark:border-gray-700">
            {navItems.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className={`block px-3 py-2 rounded-md text-base font-medium ${
                  router.pathname === item.href
                    ? 'bg-primary-light text-primary dark:bg-primary/20'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-primary dark:text-gray-200 dark:hover:bg-gray-700'
                }`}
                onClick={() => setIsMobileMenuOpen(false)}
              >
                {item.label}
              </Link>
            ))}
            
            {/* Переключатель темы в мобильном меню */}
            <ThemeToggle withText={true} className="flex items-center w-full px-3 py-2 text-base font-medium text-gray-600 hover:bg-gray-50 hover:text-primary dark:text-gray-200 dark:hover:bg-gray-700" />
          </div>
        )}
      </div>
    </header>
  );
};

export default Header; 