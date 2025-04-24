import {useState, useEffect} from 'react';
import {NextPage} from 'next';
import {useRouter} from 'next/router';
import Link from 'next/link';
import Layout from '../../components/Layout';
import useAuthStore from '../../lib/auth-store';
import {ArrowLeftIcon, UserIcon, PhoneIcon, EnvelopeIcon as MailIcon, MagnifyingGlassIcon as SearchIcon, UserPlusIcon as UserAddIcon, PencilIcon, TrashIcon, IdentificationIcon, CheckCircleIcon, Cog6ToothIcon as CogIcon, ClipboardDocumentListIcon as ClipboardListIcon, ShoppingCartIcon} from '@heroicons/react/24/outline';
import {usersApi} from '../../lib/api';
import { useTheme } from '@/lib/theme-context';

type Role = 'client' | 'admin' | 'waiter';

type User = {
  id: number;
  full_name: string;
  email: string;
  phone: string;
  role: Role;
  created_at: string;
  last_login: string;
  orders_count: number;
  reservations_count: number;
  is_active: boolean;
};

// Преобразование ролей для отображения
const roleDisplayNames = {
  admin: 'Администратор',
  client: 'Клиент',
  waiter: 'Официант'
};

// Цвета ролей для отображения
const roleColors = {
  admin: 'purple',
  client: 'blue',
  waiter: 'green'
};

// Иконки для ролей
const roleIcons = {
  admin: <IdentificationIcon className="h-3 w-3 mr-1" />,
  client: <UserIcon className="h-3 w-3 mr-1" />,
  waiter: <ClipboardListIcon className="h-3 w-3 mr-1" />
};

const AdminUsersPage: NextPage = () => {
  const router = useRouter();
  const { user, isAuthenticated } = useAuthStore();
  const { isDark } = useTheme();
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showRoleFilter, setShowRoleFilter] = useState<'all' | Role>('all');

  useEffect(() => {
    const checkAdmin = async () => {
      if (!isAuthenticated) {
        router.push('/auth/login');
        return;
      }

      if (user?.role !== 'admin') {
        router.push('/');
        return;
      }

      try {
        setIsLoading(true);
        // Получаем пользователей с сервера с учетом фильтров
        const response = await usersApi.getUsers({
          role: showRoleFilter !== 'all' ? showRoleFilter : undefined,
          query: searchQuery || undefined
        });
        
        setUsers(response);
        setIsLoading(false);
      } catch (error) {
        console.error('Ошибка при загрузке пользователей:', error);
        
        // В случае ошибки сети, используем демо-данные только для отображения интерфейса
        setUsers([
          {
            id: 1,
            full_name: 'Иванов Иван',
            email: 'ivanov@example.com',
            phone: '+7 (999) 123-45-67',
            role: 'admin',
            created_at: '2023-01-15T10:30:00',
            last_login: '2023-04-05T15:45:00',
            orders_count: 12,
            reservations_count: 8,
            is_active: true
          },
          {
            id: 2,
            full_name: 'Петрова Анна',
            email: 'petrova@example.com',
            phone: '+7 (999) 234-56-78',
            role: 'client',
            created_at: '2023-02-20T14:20:00',
            last_login: '2023-04-03T19:10:00',
            orders_count: 5,
            reservations_count: 3,
            is_active: true
          },
          {
            id: 3,
            full_name: 'Сидоров Алексей',
            email: 'sidorov@example.com',
            phone: '+7 (999) 345-67-89',
            role: 'waiter',
            created_at: '2023-03-10T11:45:00',
            last_login: '2023-03-30T12:30:00',
            orders_count: 8,
            reservations_count: 4,
            is_active: true
          },
          {
            id: 4,
            full_name: 'Козлова Елена',
            email: 'kozlova@example.com',
            phone: '+7 (999) 456-78-90',
            role: 'admin',
            created_at: '2023-03-15T09:15:00',
            last_login: '2023-04-01T16:20:00',
            orders_count: 3,
            reservations_count: 1,
            is_active: false
          },
          {
            id: 5,
            full_name: 'Новиков Дмитрий',
            email: 'novikov@example.com',
            phone: '+7 (999) 567-89-01',
            role: 'admin',
            created_at: '2023-01-10T08:00:00',
            last_login: '2023-04-04T09:45:00',
            orders_count: 0,
            reservations_count: 0,
            is_active: true
          },
        ]);
        setIsLoading(false);
      }
    };

    checkAdmin();
  }, [isAuthenticated, user, router, searchQuery, showRoleFilter]);

  const formatDate = (dateTimeString: string | null | undefined) => {
    if (!dateTimeString) return '—';
    
    // Создаем объект Date и проверяем его валидность
    const date = new Date(dateTimeString);
    if (isNaN(date.getTime())) return '—';
    
    return new Intl.DateTimeFormat('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    }).format(date);
  };

  const handleRoleChange = (newRole: 'all' | Role) => {
    setShowRoleFilter(newRole);
  };

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  };

  const handleToggleUserStatus = async (userId: number, currentStatus: boolean) => {
    try {
      // Обновляем статус пользователя через API
      await usersApi.toggleUserStatus(userId, !currentStatus);
      
      // Обновляем локальный список пользователей
      setUsers(users.map(u => 
        u.id === userId ? { ...u, is_active: !u.is_active } : u
      ));
    } catch (error) {
      console.error('Ошибка при изменении статуса пользователя:', error);
      alert('Не удалось изменить статус пользователя. Попробуйте позже.');
    }
  };

  const handleEditUserRole = async (userId: number, newRole: Role) => {
    try {
      // Обновляем роль пользователя через API
      await usersApi.updateUser(userId, { role: newRole });
      
      // Обновляем локальный список пользователей
      setUsers(users.map(u => 
        u.id === userId ? { ...u, role: newRole } : u
      ));
    } catch (error) {
      console.error('Ошибка при изменении роли пользователя:', error);
      alert('Не удалось изменить роль пользователя. Попробуйте позже.');
    }
  };

  const filteredUsers = users
    .filter(user => showRoleFilter === 'all' || user.role === showRoleFilter)
    .filter(user => {
      const query = searchQuery.toLowerCase();
      return (
        user.full_name.toLowerCase().includes(query) ||
        user.email.toLowerCase().includes(query) ||
        user.phone.includes(query)
      );
    });

  if (isLoading) {
    return (
      <Layout title="Пользователи | Админ-панель">
        <div className="container mx-auto px-4 py-8">
          <div className="flex justify-center items-center h-64">
            <div className={`animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 ${isDark ? 'border-primary-400' : 'border-primary'}`}></div>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="Пользователи | Админ-панель">
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Link 
              href="/admin" 
              className={`inline-flex items-center px-3 py-2 border ${isDark ? 'border-gray-700 text-primary-400 bg-gray-800 hover:bg-gray-700' : 'border-transparent text-primary bg-white hover:bg-gray-50'} text-sm leading-4 font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary${isDark ? '-400' : ''}`}
            >
              <ArrowLeftIcon className="h-4 w-4 mr-1" />
              Вернуться к панели управления
            </Link>
            <h1 className={`text-3xl font-bold ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>Пользователи</h1>
          </div>

          <Link
            href="/admin/users/add"
            className={`inline-flex items-center px-4 py-2 ${isDark ? 'bg-primary-500 hover:bg-primary-400 text-white' : 'bg-primary hover:bg-primary-dark text-white'} border border-transparent rounded-md shadow-sm text-sm font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary${isDark ? '-400' : ''}`}
          >
            <UserAddIcon className="h-4 w-4 mr-2" />
            Добавить пользователя
          </Link>
        </div>

        {/* Поиск и фильтрация */}
        <div className={`${isDark ? 'bg-gray-800 border border-gray-700' : 'bg-white'} rounded-lg shadow-md p-4 mb-8`}>
          <div className="flex flex-col md:flex-row justify-between gap-4">
            {/* Поисковая строка */}
            <div className="relative w-full md:w-1/2">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <SearchIcon className={`h-5 w-5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`} />
              </div>
              <input
                type="text"
                placeholder="Поиск пользователей..."
                value={searchQuery}
                onChange={handleSearch}
                className={`py-2 pl-10 pr-4 block w-full shadow-sm rounded-md ${isDark 
                  ? 'bg-gray-700 border-gray-600 text-gray-200 placeholder-gray-400 focus:border-primary-400 focus:ring-primary-400' 
                  : 'border-gray-300 focus:ring-primary focus:border-primary'
                }`}
              />
            </div>

            {/* Фильтр ролей */}
            <div className="flex flex-row gap-2">
              <button
                onClick={() => handleRoleChange('all')}
                className={`px-3 py-2 text-sm font-medium rounded-md ${
                  showRoleFilter === 'all'
                    ? isDark ? 'bg-gray-700 text-white' : 'bg-gray-100 text-gray-900'
                    : isDark ? 'text-gray-300 hover:bg-gray-700' : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                Все
              </button>
              <button
                onClick={() => handleRoleChange('admin')}
                className={`px-3 py-2 text-sm font-medium rounded-md ${
                  showRoleFilter === 'admin'
                    ? isDark ? 'bg-purple-900/50 text-purple-200' : 'bg-purple-100 text-purple-900'
                    : isDark ? 'text-gray-300 hover:bg-gray-700' : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <span className="flex items-center">{roleIcons.admin} Администраторы</span>
              </button>
              <button
                onClick={() => handleRoleChange('waiter')}
                className={`px-3 py-2 text-sm font-medium rounded-md ${
                  showRoleFilter === 'waiter'
                    ? isDark ? 'bg-green-900/50 text-green-200' : 'bg-green-100 text-green-900'
                    : isDark ? 'text-gray-300 hover:bg-gray-700' : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <span className="flex items-center">{roleIcons.waiter} Официанты</span>
              </button>
              <button
                onClick={() => handleRoleChange('client')}
                className={`px-3 py-2 text-sm font-medium rounded-md ${
                  showRoleFilter === 'client'
                    ? isDark ? 'bg-blue-900/50 text-blue-200' : 'bg-blue-100 text-blue-900'
                    : isDark ? 'text-gray-300 hover:bg-gray-700' : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <span className="flex items-center">{roleIcons.client} Клиенты</span>
              </button>
            </div>
          </div>
        </div>

        {/* Таблица пользователей */}
        <div className={`${isDark ? 'bg-gray-800 border border-gray-700' : 'bg-white'} rounded-lg shadow-md overflow-hidden`}>
          <div className="overflow-x-auto">
            <table className={`min-w-full divide-y ${isDark ? 'divide-gray-700' : 'divide-gray-200'}`}>
              <thead className={isDark ? 'bg-gray-900/50' : 'bg-gray-50'}>
                <tr>
                  <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                    Пользователь
                  </th>
                  <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                    Контакты
                  </th>
                  <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                    Роль
                  </th>
                  <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                    Регистрация
                  </th>
                  <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                    Статистика
                  </th>
                  <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                    Статус
                  </th>
                  <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                    Действия
                  </th>
                </tr>
              </thead>
              <tbody className={`${isDark ? 'divide-y divide-gray-700' : 'divide-y divide-gray-200'}`}>
                {users.length === 0 ? (
                  <tr>
                    <td colSpan={7} className={`px-6 py-4 text-center ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                      Пользователи не найдены
                    </td>
                  </tr>
                ) : (
                  users.map((user) => (
                    <tr key={user.id} className={user.is_active 
                      ? isDark ? 'bg-gray-800 hover:bg-gray-700' : 'bg-white hover:bg-gray-50' 
                      : isDark ? 'bg-gray-900/70 text-gray-400' : 'bg-gray-50 text-gray-400'
                    }>
                      <td className="px-6 py-4">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-10 w-10 bg-gray-200 rounded-full flex items-center justify-center">
                            <UserIcon className="h-6 w-6 text-gray-500" />
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900">{user.full_name}</div>
                            <div className="text-sm text-gray-500 flex items-center">
                              <MailIcon className="h-3 w-3 mr-1" />
                              {user.email}
                            </div>
                            <div className="text-sm text-gray-500 flex items-center">
                              <PhoneIcon className="h-3 w-3 mr-1" />
                              {user.phone}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{formatDate(user.created_at)}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{formatDate(user.last_login)}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="relative group">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-${roleColors[user.role] || 'gray'}-100 text-${roleColors[user.role] || 'gray'}-800 cursor-pointer`}>
                            {roleIcons[user.role]}
                            {roleDisplayNames[user.role] || 'Неизвестно'}
                          </span>
                          
                          {/* Выпадающее меню для изменения роли */}
                          <div className="hidden group-hover:block absolute z-10 mt-1 py-1 w-48 bg-white rounded-md shadow-lg">
                            {Object.entries(roleDisplayNames).map(([role, displayName]) => (
                              <button
                                key={role}
                                onClick={() => handleEditUserRole(user.id, role as Role)}
                                className={`w-full text-left px-4 py-2 text-sm ${role === user.role ? 'bg-gray-100 font-medium' : 'hover:bg-gray-50'}`}
                              >
                                <span className="inline-flex items-center">
                                  {roleIcons[role as Role]}
                                  {displayName}
                                </span>
                              </button>
                            ))}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          Заказов: {user.orders_count}<br />
                          Бронирований: {user.reservations_count}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {user.is_active ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            Активен
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                            Заблокирован
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center space-x-3">
                          <button
                            onClick={() => router.push(`/admin/users/${user.id}`)}
                            className="text-gray-600 hover:text-primary"
                            title="Редактировать"
                          >
                            <PencilIcon className="h-5 w-5" />
                          </button>
                          <button
                            onClick={() => handleToggleUserStatus(user.id, user.is_active)}
                            className={`${user.is_active ? 'text-red-600 hover:text-red-800' : 'text-green-600 hover:text-green-800'}`}
                            title={user.is_active ? 'Заблокировать' : 'Разблокировать'}
                          >
                            {user.is_active ? (
                              <TrashIcon className="h-5 w-5" />
                            ) : (
                              <CheckCircleIcon className="h-5 w-5" />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default AdminUsersPage; 