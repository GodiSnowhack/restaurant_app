'use client';

import {useState, useEffect} from 'react';
import Link from 'next/link';
import {useRouter} from 'next/router';
import {Bars3Icon as MenuIcon, XMarkIcon as XIcon, ShoppingCartIcon, UserIcon, HomeIcon, ClipboardDocumentListIcon as ClipboardIcon, CalendarIcon, Cog6ToothIcon as CogIcon, ArrowRightOnRectangleIcon as LogoutIcon} from '@heroicons/react/24/outline';
import useAuthStore from '../lib/auth-store';
import useCartStore from '../lib/cart-store';
import {useSettings} from '../settings-context';

const Header = () => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [cartCount, setCartCount] = useState(0);
  const [isMounted, setIsMounted] = useState(false);
  const router = useRouter();
  const { isAuthenticated, user, logout } = useAuthStore();
  const { items } = useCartStore();
  const { settings } = useSettings();

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
    router.push('/');
    setMenuOpen(false);
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
    <header className="bg-white shadow-md">
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <div className="flex items-center">
            <Link href="/" className="flex items-center">
              <img src="/logo.svg" alt="Логотип ресторана" className="h-8 w-auto" />
              <span className="ml-2 text-xl font-bold text-primary">Ресторан</span>
            </Link>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-6">
            {navItems.map((item) => (
              <Link 
                href={item.href} 
                key={item.href}
                className={`text-sm font-medium ${
                  router.pathname === item.href ? 'text-primary font-bold' : 'text-gray-700 hover:text-primary'
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          {/* User Actions */}
          <div className="flex items-center space-x-3">
            {/* Cart */}
            <Link 
              href="/cart" 
              className="relative p-1 text-gray-700 hover:text-primary"
            >
              <ShoppingCartIcon className="h-6 w-6" />
              {isMounted && cartCount > 0 && (
                <span className="absolute -top-2 -right-2 bg-primary text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
                  {cartCount}
                </span>
              )}
            </Link>

            {/* User Menu or Auth Links - рендерится только на клиенте для избежания гидратации */}
            {!isMounted && (
              <div className="hidden md:flex items-center space-x-2">
                <div className="text-sm font-medium text-gray-700">
                  {/* Пустой заполнитель до гидратации */}
                </div>
              </div>
            )}
            
            {isMounted && isAuthenticated && (
              <div className="relative hidden md:block">
                <Link 
                  href="/profile" 
                  className="flex items-center text-sm font-medium text-gray-700 hover:text-primary"
                >
                  <div className="bg-gray-200 rounded-full h-8 w-8 flex items-center justify-center">
                    <UserIcon className="h-5 w-5" />
                  </div>
                  <span className="ml-1 text-sm font-medium hidden sm:block">{user?.full_name || 'Пользователь'}</span>
                </Link>
              </div>
            )}
            
            {isMounted && !isAuthenticated && (
              <div className="hidden md:flex items-center space-x-2">
                <Link 
                  href="/auth/login" 
                  className="text-sm font-medium text-gray-700 hover:text-primary"
                >
                  Войти
                </Link>
                <span className="text-gray-300">|</span>
                <Link 
                  href="/auth/register"
                  className="text-sm font-medium text-primary hover:text-primary-dark"
                >
                  Регистрация
                </Link>
              </div>
            )}

            {/* Mobile menu button */}
            <button
              onClick={toggleMenu}
              className="p-1 md:hidden text-gray-700 hover:text-primary"
            >
              {isMounted ? (menuOpen ? (
                <XIcon className="h-6 w-6" />
              ) : (
                <MenuIcon className="h-6 w-6" />
              )) : (
                <div className="h-6 w-6" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {isMounted && menuOpen && (
        <div className="md:hidden bg-white border-t">
          <div className="container mx-auto px-4 py-3">
            <nav className="flex flex-col space-y-3">
              {navItems.map((item) => (
                <Link 
                  href={item.href} 
                  key={item.href}
                  className={`px-3 py-2 rounded-md ${
                    router.pathname === item.href
                      ? 'bg-gray-100 text-primary'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                  onClick={() => setMenuOpen(false)}>
                    {item.label}
                </Link>
              ))}

              {isAuthenticated ? (
                <>
                  <Link 
                    href="/profile"
                    className="px-3 py-2 rounded-md text-gray-700 hover:bg-gray-50 flex items-center"
                    onClick={() => setMenuOpen(false)}>
                    <UserIcon className="h-5 w-5 mr-2" />
                    Мой профиль
                  </Link>
                  <Link 
                    href="/orders"
                    className="px-3 py-2 rounded-md text-gray-700 hover:bg-gray-50"
                    onClick={() => setMenuOpen(false)}>
                    Мои заказы
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="px-3 py-2 rounded-md text-red-600 hover:bg-gray-50 flex items-center w-full text-left"
                  >
                    <LogoutIcon className="h-5 w-5 mr-2" />
                    Выйти
                  </button>
                </>
              ) : (
                <>
                  <Link 
                    href="/auth/login"
                    className="px-3 py-2 rounded-md text-gray-700 hover:bg-gray-50"
                    onClick={() => setMenuOpen(false)}>
                    Войти
                  </Link>
                  <Link 
                    href="/auth/register"
                    className="px-3 py-2 rounded-md bg-primary text-white"
                    onClick={() => setMenuOpen(false)}>
                    Регистрация
                  </Link>
                </>
              )}
            </nav>
          </div>
        </div>
      )}
    </header>
  );
};

export default Header; 