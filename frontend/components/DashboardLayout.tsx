import React, { ReactNode } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { 
  HomeIcon, 
  ChartBarIcon,
  UsersIcon,
  CogIcon,
  CalendarIcon,
  DocumentTextIcon,
  ShoppingBagIcon
} from '@heroicons/react/24/outline';

interface DashboardLayoutProps {
  children: ReactNode;
  title?: string;
  showBackButton?: boolean;
}

/**
 * Компонент макета для административных страниц
 */
const DashboardLayout: React.FC<DashboardLayoutProps> = ({ 
  children, 
  title = 'Панель управления',
  showBackButton = false
}) => {
  const router = useRouter();

  // Навигационные элементы для боковой панели
  const navItems = [
    { 
      name: 'Обзор', 
      href: '/admin', 
      icon: HomeIcon, 
      current: router.pathname === '/admin' 
    },
    { 
      name: 'Аналитика', 
      href: '/admin/analytics', 
      icon: ChartBarIcon, 
      current: router.pathname === '/admin/analytics' 
    },
    { 
      name: 'Меню', 
      href: '/admin/menu', 
      icon: ShoppingBagIcon, 
      current: router.pathname.startsWith('/admin/menu') 
    },
    { 
      name: 'Персонал', 
      href: '/admin/staff', 
      icon: UsersIcon, 
      current: router.pathname.startsWith('/admin/staff') 
    },
    { 
      name: 'Заказы', 
      href: '/admin/orders', 
      icon: DocumentTextIcon, 
      current: router.pathname.startsWith('/admin/orders') 
    },
    { 
      name: 'Бронирования', 
      href: '/admin/reservations', 
      icon: CalendarIcon, 
      current: router.pathname.startsWith('/admin/reservations') 
    },
    { 
      name: 'Настройки', 
      href: '/admin/settings', 
      icon: CogIcon, 
      current: router.pathname.startsWith('/admin/settings') 
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Боковая панель */}
      <div className="fixed inset-y-0 left-0 w-64 bg-white dark:bg-gray-800 shadow-md overflow-y-auto">
        <div className="flex flex-col h-full">
          <div className="flex-shrink-0 px-4 py-5 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-xl font-semibold text-gray-800 dark:text-white">
              Администрирование
            </h2>
          </div>
          <nav className="mt-5 px-2 flex-1">
            <div className="space-y-1">
              {navItems.map((item) => (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`group flex items-center px-3 py-2 text-sm font-medium rounded-md ${
                    item.current 
                      ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300' 
                      : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700'
                  }`}
                >
                  <item.icon
                    className={`mr-3 h-5 w-5 ${
                      item.current ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-500 dark:text-gray-400'
                    }`}
                    aria-hidden="true"
                  />
                  {item.name}
                </Link>
              ))}
            </div>
          </nav>
        </div>
      </div>

      {/* Основное содержимое */}
      <div className="pl-64">
        <header className="bg-white dark:bg-gray-800 shadow">
          <div className="px-4 py-6 sm:px-6 lg:px-8 flex items-center">
            {showBackButton && (
              <button
                onClick={() => router.back()}
                className="mr-4 p-1 rounded-full text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-700"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            )}
            <h1 className="text-2xl font-semibold text-gray-800 dark:text-white">{title}</h1>
          </div>
        </header>
        <main className="px-4 py-6 sm:px-6 lg:px-8">
          {children}
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout; 