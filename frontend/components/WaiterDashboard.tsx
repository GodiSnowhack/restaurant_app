import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { ordersApi } from '../lib/api';
import { 
  ListBulletIcon,
  PlusCircleIcon
} from '@heroicons/react/24/outline';

type NavigationItem = {
  name: string;
  href: string;
  icon: React.ReactNode;
  count?: number;
};

const WaiterDashboard = ({ children }: { children: React.ReactNode }) => {
  const router = useRouter();
  const [activeNavItem, setActiveNavItem] = useState('');
  const [assignedOrdersCount, setAssignedOrdersCount] = useState(0);
  const [loading, setLoading] = useState(true);

  // Определение активного пункта навигации на основе текущего маршрута
  useEffect(() => {
    const path = router.pathname;
    if (path.includes('/waiter/orders')) {
      setActiveNavItem('orders');
    } else if (path.includes('/waiter/create-order')) {
      setActiveNavItem('create-order');
    }
  }, [router.pathname]);

  // Загрузка количества назначенных заказов
  useEffect(() => {
    const fetchAssignedOrdersCount = async () => {
      try {
        setLoading(true);
        const orders = await ordersApi.getWaiterOrders();
        // Подсчитываем только активные заказы (не завершенные и не отмененные)
        const activeOrders = orders.filter(
          order => !['completed', 'cancelled'].includes(order.status)
        );
        setAssignedOrdersCount(activeOrders.length);
      } catch (error) {
        console.error('Ошибка при получении назначенных заказов:', error);
        setAssignedOrdersCount(0);
      } finally {
        setLoading(false);
      }
    };

    // Загружаем назначенные заказы при монтировании и периодически
    fetchAssignedOrdersCount();
    
    // Обновляем каждые 60 секунд
    const interval = setInterval(fetchAssignedOrdersCount, 60000);
    
    return () => clearInterval(interval);
  }, []);

  // Генерация пунктов навигации
  const getNavigationItems = (): NavigationItem[] => [
    {
      name: 'Заказы',
      href: '/waiter/orders',
      icon: <ListBulletIcon className="h-6 w-6" />,
      count: assignedOrdersCount
    },
    {
      name: 'Создать заказ',
      href: '/waiter/create-order',
      icon: <PlusCircleIcon className="h-6 w-6" />
    }
  ];

  const navigationItems = getNavigationItems();

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      {/* Основной контент */}
      <div className="flex-1 pb-16">
        {children}
      </div>
      
      {/* Нижняя навигация */}
      <div className="bg-white border-t border-gray-200 fixed bottom-0 left-0 right-0 z-10 shadow-up">
        <div className="grid grid-cols-2 h-16">
          {navigationItems.map((item) => (
            <Link href={item.href} key={item.name} className={`flex flex-col items-center justify-center h-full ${
              activeNavItem === item.href.split('/').pop() 
                ? 'text-primary' 
                : 'text-gray-500 hover:text-gray-700'
            }`}>
              <div className="relative">
                {item.icon}
                {item.count && item.count > 0 && (
                  <span className="absolute -top-1 -right-1 h-4 w-4 bg-red-500 rounded-full flex items-center justify-center text-xs text-white">
                    {item.count > 9 ? '9+' : item.count}
                  </span>
                )}
              </div>
              <span className="text-xs mt-1">{item.name}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
};

export default WaiterDashboard; 