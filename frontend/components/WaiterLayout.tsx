import React, { ReactNode, useState, useEffect } from 'react';
import Head from 'next/head';
import Header from './Header';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { ordersApi } from '../lib/api/';
import { 
  HomeIcon, 
  ListBulletIcon,
  PlusCircleIcon
} from '@heroicons/react/24/outline';

interface WaiterLayoutProps {
  children: ReactNode;
  title?: string;
  activeTab?: string;
  showBackButton?: boolean;
  backUrl?: string;
}

const WaiterLayout: React.FC<WaiterLayoutProps> = ({ 
  children, 
  title = 'Панель официанта', 
  activeTab,
  showBackButton = false,
  backUrl = '/waiter'
}) => {
  const router = useRouter();
  const [assignedOrdersCount, setAssignedOrdersCount] = useState(0);
  
  // Определяем активную вкладку на основе текущего маршрута или переданного activeTab
  const getActiveTab = () => {
    if (activeTab) return activeTab;
    
    const path = router.pathname;
    if (path === '/waiter') return 'home';
    if (path.includes('/waiter/orders')) return 'orders';
    if (path.includes('/waiter/create-order')) return 'create-order';
    return '';
  };
  
  // Загрузка количества активных заказов
  useEffect(() => {
    const fetchAssignedOrdersCount = async () => {
      try {
        const orders = await ordersApi.getWaiterOrders();
        // Подсчитываем только активные заказы (не завершенные и не отмененные)
        const activeOrders = orders.filter(
          order => !['completed', 'cancelled'].includes(order.status)
        );
        setAssignedOrdersCount(activeOrders.length);
      } catch (error) {
        console.error('Ошибка при получении назначенных заказов:', error);
        setAssignedOrdersCount(0);
      }
    };

    // Загружаем назначенные заказы при монтировании и периодически
    fetchAssignedOrdersCount();
    
    // Обновляем каждые 60 секунд
    const interval = setInterval(fetchAssignedOrdersCount, 60000);
    
    return () => clearInterval(interval);
  }, []);
  
  const currentTab = getActiveTab();
  
  return (
    <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-gray-900 dark:text-white">
      <Head>
        <title>{title}</title>
        <meta name="description" content="Система управления рестораном - панель официанта" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <Header />

      {/* Основная навигация - только Главная и Заказы */}
      <div className="bg-white shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex space-x-8">
              <Link href="/waiter" className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium ${
                currentTab === 'home' ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
              }`}>
                <HomeIcon className="h-5 w-5 mr-1" />
                <span>Главная</span>
              </Link>
              
              <Link href="/waiter/orders" className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium ${
                currentTab === 'orders' ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
              }`}>
                <ListBulletIcon className="h-5 w-5 mr-1" />
                <span>Заказы</span>
                {assignedOrdersCount > 0 && (
                  <span className="ml-1 px-2 py-0.5 bg-red-500 text-white text-xs rounded-full">
                    {assignedOrdersCount > 9 ? '9+' : assignedOrdersCount}
                  </span>
                )}
              </Link>
              
              <Link href="/waiter/create-order" className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium ${
                currentTab === 'create-order' ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
              }`}>
                <PlusCircleIcon className="h-5 w-5 mr-1" />
                <span>Создать заказ</span>
              </Link>
            </div>
          </div>
        </div>
      </div>

      <main className="flex-grow w-full">
        {/* Заголовок страницы и кнопка возврата */}
        {(showBackButton || title) && (
          <div className="bg-white shadow-sm p-4 mb-4">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex items-center">
                {showBackButton && (
                  <Link href={backUrl} className="text-gray-600 hover:text-gray-900 mr-4">
                    <div className="flex items-center">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                      </svg>
                      <span>Назад</span>
                    </div>
                  </Link>
                )}
                
                <h1 className="text-xl font-semibold">{title}</h1>
              </div>
            </div>
          </div>
        )}
        
        {/* Основной контент */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {children}
        </div>
      </main>

      {/* Футер */}
      <footer className="bg-white mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="border-t border-gray-200 pt-4">
            <p className="text-sm text-gray-500 text-center">
              © {new Date().getFullYear()} Система управления рестораном
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default WaiterLayout; 