import {useState, useEffect} from 'react';
import {NextPage} from 'next';
import {useRouter} from 'next/router';
import Link from 'next/link';
import Layout from '../components/Layout';
import useAuthStore from '../lib/auth-store';
import {UserIcon, KeyIcon, ArrowRightOnRectangleIcon as LogoutIcon, ShoppingCartIcon, CalendarIcon} from '@heroicons/react/24/outline';

const ProfilePage: NextPage = () => {
  const router = useRouter();
  const { user, isAuthenticated, logout, fetchUserProfile } = useAuthStore();
  const [activeTab, setActiveTab] = useState('profile');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      if (!isAuthenticated) {
        router.push('/auth/login');
        return;
      }

      try {
        setIsLoading(true);
        await fetchUserProfile();
      } catch (error) {
        console.error('Ошибка при загрузке профиля:', error);
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, [isAuthenticated, router, fetchUserProfile]);

  const handleLogout = async () => {
    await logout();
    router.push('/');
  };

  if (isLoading) {
    return (
      <Layout title="Профиль">
        <div className="container mx-auto px-4 py-8">
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="Профиль">
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8">Личный кабинет</h1>

        <div className="flex flex-col md:flex-row gap-6">
          {/* Боковое меню */}
          <div className="md:w-1/4">
            <div className="bg-white rounded-lg shadow-md overflow-hidden">
              <div className="p-6 bg-gray-50 border-b">
                <div className="flex items-center space-x-4">
                  <div className="h-14 w-14 rounded-full bg-primary text-white flex items-center justify-center text-xl font-bold">
                    {user?.full_name?.charAt(0) || 'U'}
                  </div>
                  <div>
                    <h2 className="font-medium">{user?.full_name || 'Пользователь'}</h2>
                    <p className="text-sm text-gray-500">{user?.email}</p>
                  </div>
                </div>
              </div>
              
              <nav className="p-4">
                <ul className="space-y-1">
                  <li>
                    <button
                      onClick={() => setActiveTab('profile')}
                      className={`flex items-center w-full px-4 py-2 rounded-md ${
                        activeTab === 'profile' 
                          ? 'bg-primary text-white' 
                          : 'text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      <UserIcon className="h-5 w-5 mr-3" />
                      Информация
                    </button>
                  </li>
                  <li>
                    <button
                      onClick={() => setActiveTab('password')}
                      className={`flex items-center w-full px-4 py-2 rounded-md ${
                        activeTab === 'password' 
                          ? 'bg-primary text-white' 
                          : 'text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      <KeyIcon className="h-5 w-5 mr-3" />
                      Сменить пароль
                    </button>
                  </li>
                  <li>
                    <div className="flex flex-col md:flex-row space-y-2 md:space-y-0 md:space-x-4 mt-4">
                      <Link 
                        href="/orders" 
                        className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-primary hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
                      >
                        <ShoppingCartIcon className="h-5 w-5 mr-2" />
                        История заказов
                      </Link>
                      <Link 
                        href="/reservations" 
                        className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-primary bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary shadow-sm border-primary"
                      >
                        <CalendarIcon className="h-5 w-5 mr-2" />
                        Мои бронирования
                      </Link>
                    </div>
                  </li>
                  <li className="pt-4 border-t mt-4">
                    <button
                      onClick={handleLogout}
                      className="flex items-center w-full px-4 py-2 rounded-md text-red-600 hover:bg-red-50"
                    >
                      <LogoutIcon className="h-5 w-5 mr-3" />
                      Выйти
                    </button>
                  </li>
                </ul>
              </nav>
            </div>
          </div>

          {/* Основное содержимое */}
          <div className="md:w-3/4">
            <div className="bg-white rounded-lg shadow-md p-6">
              {activeTab === 'profile' ? (
                <div>
                  <h2 className="text-xl font-semibold mb-4">Личная информация</h2>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        ФИО
                      </label>
                      <input
                        type="text"
                        className="input"
                        defaultValue={user?.full_name || ''}
                        readOnly
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        E-mail
                      </label>
                      <input
                        type="email"
                        className="input"
                        defaultValue={user?.email || ''}
                        readOnly
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Телефон
                      </label>
                      <input
                        type="tel"
                        className="input"
                        defaultValue={user?.phone || 'Не указан'}
                        readOnly
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Дата регистрации
                      </label>
                      <input
                        type="text"
                        className="input"
                        defaultValue={user?.created_at ? new Date(user.created_at).toLocaleDateString('ru-RU') : ''}
                        readOnly
                      />
                    </div>
                  </div>
                  
                  <div className="mt-6">
                    <button className="btn btn-primary">
                      Редактировать профиль
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  <h2 className="text-xl font-semibold mb-4">Сменить пароль</h2>
                  
                  <div className="space-y-4">
                    <div>
                      <label htmlFor="current-password" className="block text-sm font-medium text-gray-700 mb-1">
                        Текущий пароль
                      </label>
                      <input
                        id="current-password"
                        type="password"
                        className="input"
                      />
                    </div>
                    
                    <div>
                      <label htmlFor="new-password" className="block text-sm font-medium text-gray-700 mb-1">
                        Новый пароль
                      </label>
                      <input
                        id="new-password"
                        type="password"
                        className="input"
                      />
                    </div>
                    
                    <div>
                      <label htmlFor="confirm-password" className="block text-sm font-medium text-gray-700 mb-1">
                        Подтверждение пароля
                      </label>
                      <input
                        id="confirm-password"
                        type="password"
                        className="input"
                      />
                    </div>
                  </div>
                  
                  <div className="mt-6">
                    <button className="btn btn-primary">
                      Сохранить новый пароль
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default ProfilePage; 