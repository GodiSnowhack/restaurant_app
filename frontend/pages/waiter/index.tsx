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
    const checkAccess = async () => {
      // Устанавливаем флаг для использования демо-данных
      try {
        localStorage.setItem('force_demo_data', 'true');
        console.log('WaiterPage: Установлен флаг использования демо-данных');
      } catch (e) {
        console.error('WaiterPage: Ошибка при установке флага демо-данных:', e);
      }
      
      if (!isAuthenticated) {
        console.log('WaiterPage: Пользователь не авторизован, перенаправляем на страницу входа');
        router.push('/auth/login?redirect=/waiter');
        return;
      }
      
      // Проверяем роль пользователя
      checkUserRole();
    };
    
    checkAccess();
  }, [isAuthenticated, router, user]);

  // Функция проверки роли пользователя
  const checkUserRole = () => {
    try {
      // Проверяем объект user из стора
      if (user) {
        console.log('WaiterPage: Роль из auth-store:', user.role);
        if (user.role === 'waiter' || user.role === 'admin') {
          // Роль валидна
          setError(null);
          return true;
        }
      }
      
      // Если объект user недоступен или не содержит валидной роли,
      // проверяем дополнительные источники
      
      // Проверяем роль из localStorage
      const userRole = localStorage.getItem('user_role');
      if (userRole && (userRole === 'waiter' || userRole === 'admin')) {
        console.log('WaiterPage: Роль из user_role:', userRole);
        setError(null);
        return true;
      }
      
      // Проверяем объект user из localStorage
      const userStr = localStorage.getItem('user');
      if (userStr) {
        try {
          const userData = JSON.parse(userStr);
          if (userData.role === 'waiter' || userData.role === 'admin') {
            console.log('WaiterPage: Роль из localStorage.user:', userData.role);
            setError(null);
            return true;
          }
        } catch (e) {
          console.error('WaiterPage: Ошибка при парсинге user из localStorage', e);
        }
      }
      
      // Проверяем объект user_profile из localStorage
      const profileStr = localStorage.getItem('user_profile');
      if (profileStr) {
        try {
          const profileData = JSON.parse(profileStr);
          if (profileData.role === 'waiter' || profileData.role === 'admin') {
            console.log('WaiterPage: Роль из user_profile:', profileData.role);
            setError(null);
            return true;
          }
        } catch (e) {
          console.error('WaiterPage: Ошибка при парсинге user_profile из localStorage', e);
        }
      }
      
      // Если дошли до этой точки, у пользователя нет необходимых прав
      console.error('WaiterPage: У пользователя недостаточно прав');
      setError('У вас нет прав доступа к этой странице. Необходима роль официанта или администратора.');
      return false;
    } catch (e) {
      console.error('WaiterPage: Ошибка при проверке прав доступа', e);
      setError('Произошла ошибка при проверке прав доступа. Пожалуйста, попробуйте еще раз.');
      return false;
    }
  };

  if (!isAuthenticated || !user) {
    return (
      <WaiterLayout title="Загрузка...">
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-primary"></div>
        </div>
      </WaiterLayout>
    );
  }

  // Если есть ошибка прав доступа
  if (error) {
    return (
      <WaiterLayout title="Ошибка доступа">
        <div className="p-4 bg-red-50 border-l-4 border-red-500 text-red-700 rounded mb-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm">{error}</p>
            </div>
          </div>
        </div>
        <div className="text-center">
          <Link href="/" className="inline-block px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors">
            Вернуться на главную
          </Link>
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
          <p className="text-gray-600 dark:text-white mt-1">
            {user.role === 'admin' 
              ? 'Вы находитесь в панели официанта с правами администратора'
              : 'Панель управления официанта'
            }
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