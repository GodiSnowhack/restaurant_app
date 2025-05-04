import {useState, useEffect} from 'react';
import {NextPage} from 'next';
import {useRouter} from 'next/router';
import Link from 'next/link';
import Layout from '../components/Layout';
import useAuthStore from '../lib/auth-store';
import {UserIcon, KeyIcon, ArrowRightOnRectangleIcon as LogoutIcon, ShoppingCartIcon, CalendarIcon} from '@heroicons/react/24/outline';
import { toast } from 'react-hot-toast';
import { api } from '../lib/api/';
import { formatDateToDisplay, formatDateToISO } from '../utils/dateFormatter';

const ProfilePage: NextPage = () => {
  const router = useRouter();
  const { user, isAuthenticated, logout, fetchUserProfile, refreshProfile } = useAuthStore();
  const [activeTab, setActiveTab] = useState('profile');
  const [isLoading, setIsLoading] = useState(true);
  const [showSuccess, setShowSuccess] = useState(false);

  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    phone: '',
    birthday: ''
  });

  const [ageGroup, setAgeGroup] = useState<string | null>(null);

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

  useEffect(() => {
    if (user) {
      setFormData({
        full_name: user.full_name || '',
        email: user.email || '',
        phone: user.phone || '',
        birthday: user.birthday ? formatDateToDisplay(user.birthday) : ''
      });
      
      setAgeGroup(user.age_group || null);
    }
  }, [user]);

  const handleLogout = async () => {
    await logout();
    router.push('/');
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    try {
      const updateData = {
        ...formData,
        birthday: formData.birthday ? formatDateToISO(formData.birthday) : null
      };
      
      await api.put('/users/me', updateData);
      
      await refreshProfile();
      
      toast.success('Профиль успешно обновлен');
      setShowSuccess(true);
      
      setTimeout(() => {
        setShowSuccess(false);
      }, 3000);
    } catch (error) {
      console.error('Ошибка при обновлении профиля:', error);
      toast.error('Не удалось обновить профиль');
    } finally {
      setIsLoading(false);
    }
  };

  const getAgeGroupText = (group: string | null): string => {
    if (!group) return 'Не указана';
    
    switch (group) {
      case 'child': return 'Ребенок (до 12 лет)';
      case 'teenager': return 'Подросток (13-17 лет)';
      case 'young': return 'Молодой (18-25 лет)';
      case 'adult': return 'Взрослый (26-45 лет)';
      case 'middle': return 'Средний возраст (46-65 лет)';
      case 'senior': return 'Пожилой (66+ лет)';
      default: return 'Не указана';
    }
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

        {showSuccess && (
          <div className="mb-6 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-md">
            Ваш профиль успешно обновлен
          </div>
        )}

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
                        className="inline-flex items-center px-4 py-2 border text-sm font-medium rounded-md text-primary bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary shadow-sm border-primary"
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
                  
                  <form id="profile-form" onSubmit={handleSubmit}>
                    <div className="space-y-4">
                      <div>
                        <label htmlFor="full_name" className="block text-sm font-medium text-gray-700 mb-1">
                          ФИО
                        </label>
                        <input
                          type="text"
                          id="full_name"
                          name="full_name"
                          value={formData.full_name}
                          onChange={handleInputChange}
                          className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition"
                          required
                        />
                      </div>
                      
                      <div>
                        <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                          E-mail
                        </label>
                        <input
                          type="email"
                          id="email"
                          name="email"
                          value={formData.email}
                          onChange={handleInputChange}
                          className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition"
                          required
                        />
                      </div>
                      
                      <div>
                        <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
                          Телефон
                        </label>
                        <input
                          type="tel"
                          id="phone"
                          name="phone"
                          value={formData.phone}
                          onChange={handleInputChange}
                          className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition"
                        />
                      </div>
                      
                      <div>
                        <label htmlFor="birthday" className="block text-sm font-medium text-gray-700 mb-1">
                          Дата рождения
                        </label>
                        <input
                          type="date"
                          id="birthday"
                          name="birthday"
                          value={formData.birthday}
                          onChange={handleInputChange}
                          className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition"
                        />
                      </div>
                    </div>
                    
                    <div className="mt-6">
                      <button
                        type="submit"
                        className="btn btn-primary"
                        disabled={isLoading}
                      >
                        {isLoading ? 'Сохранение...' : 'Сохранить изменения'}
                      </button>
                    </div>
                  </form>
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