'use client';

import {useState, useEffect} from 'react';
import {NextPage} from 'next';
import {useRouter} from 'next/router';
import Link from 'next/link';
import Layout from '../../components/Layout';
import WaiterLayout from '../../components/WaiterLayout';
import useAuthStore from '../../lib/auth-store';
import {InformationCircleIcon, PlusCircleIcon} from '@heroicons/react/24/outline';
import { useTheme } from '@/lib/theme-context';
import OrderCodeInput from '../../components/OrderCodeInput';
import WaiterCodeGenerator from '../../components/WaiterCodeGenerator';
import WaiterAssignOrderByCode from '../../components/WaiterAssignOrderByCode';
import { toast } from 'react-hot-toast';

const WaiterPage: NextPage = () => {
  const router = useRouter();
  const { isAuthenticated, user } = useAuthStore();
  const [error, setError] = useState<string | null>(null);
  const { isDark } = useTheme();

  // Перенаправляем на страницу входа, если пользователь не авторизован
  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/auth/login?redirect=/waiter');
    }
  }, [isAuthenticated, router]);

  if (!isAuthenticated || !user) {
    return (
      <WaiterLayout title="Загрузка...">
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-primary"></div>
        </div>
      </WaiterLayout>
    );
  }

  return (
    <WaiterLayout title="Панель официанта" activeTab="dashboard">
      <div className="p-4">
        <header className="mb-6">
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white">
            Добрый день, {user.full_name}!
          </h1>
          <p className="text-gray-600 dark:text-gray-300 mt-1">
            Панель управления официанта
          </p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Генератор кода официанта */}
          <WaiterCodeGenerator className="mb-6" />

          {/* Компонент для привязки заказа по коду */}
          <WaiterAssignOrderByCode 
            className="mb-6" 
            onOrderAssigned={(orderInfo) => {
              console.log('Заказ привязан к официанту:', orderInfo);
              toast.success(`Заказ #${orderInfo.id} успешно привязан к вам`);
            }} 
          />

          {/* Блок быстрых действий */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-lg font-semibold mb-4">Быстрые действия</h2>
            
            <div className="space-y-4">
              <Link href="/waiter/bind" className="block w-full text-left py-3 px-4 rounded-md bg-indigo-50 hover:bg-indigo-100 text-indigo-700 transition-colors cursor-pointer">
                <div className="flex items-center">
                  <InformationCircleIcon className="h-5 w-5 mr-2" />
                  <span>Привязать заказ по коду</span>
                </div>
              </Link>
              
              <Link href="/waiter/create-order" className="block w-full text-left py-3 px-4 rounded-md bg-green-50 hover:bg-green-100 text-green-700 transition-colors cursor-pointer">
                <div className="flex items-center">
                  <PlusCircleIcon className="h-5 w-5 mr-2" />
                  <span>Создать новый заказ</span>
                </div>
              </Link>
              
              <Link href="/waiter/orders" className="block w-full text-left py-3 px-4 rounded-md bg-blue-50 hover:bg-blue-100 text-blue-700 transition-colors cursor-pointer">
                <div className="flex items-center">
                  <svg className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  <span>Мои активные заказы</span>
                </div>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </WaiterLayout>
  );
};

export default WaiterPage; 