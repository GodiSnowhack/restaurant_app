import {useState, useEffect} from 'react';
import {NextPage} from 'next';
import {useRouter} from 'next/router';
import Link from 'next/link';
import Layout from '../../components/Layout';
import useAuthStore from '../../lib/auth-store';
import {
  ArrowLeftIcon,
  UserIcon,
  PhoneIcon,
  EnvelopeIcon as MailIcon,
  MagnifyingGlassIcon as SearchIcon,
  UserPlusIcon as UserAddIcon,
  PencilIcon,
  TrashIcon,
  IdentificationIcon,
  CheckCircleIcon,
  Cog6ToothIcon as CogIcon,
  ClipboardDocumentListIcon as ClipboardListIcon,
  ShoppingCartIcon
} from '@heroicons/react/24/outline';
import {usersApi} from '../../lib/api';

type Role = 'user' | 'admin' | 'waiter' | 'kitchen' | 'supply' | 'guest';

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
  user: 'Клиент',
  waiter: 'Официант',
  kitchen: 'Повар',
  supply: 'Поставщик',
  guest: 'Гость'
};

// Цвета ролей для отображения
const roleColors = {
  admin: 'purple',
  user: 'blue',
  waiter: 'green',
  kitchen: 'yellow',
  supply: 'orange',
  guest: 'gray'
};

// Иконки для ролей
const roleIcons = {
  admin: <IdentificationIcon className="h-3 w-3 mr-1" />,
  user: <UserIcon className="h-3 w-3 mr-1" />,
  waiter: <ClipboardListIcon className="h-3 w-3 mr-1" />,
  kitchen: <CogIcon className="h-3 w-3 mr-1" />,
  supply: <ShoppingCartIcon className="h-3 w-3 mr-1" />,
  guest: <UserIcon className="h-3 w-3 mr-1" />
};

const AdminUsersPage: NextPage = () => {
  const router = useRouter();
  const { user, isAuthenticated } = useAuthStore();
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
            role: 'user',
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
            role: 'kitchen',
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
            role: 'supply',
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
      <Layout title="Управление пользователями | Админ-панель">
        <div className="container mx-auto px-4 py-8">
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="Управление пользователями | Админ-панель">
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center mb-6">
          <Link href="/admin" className="text-gray-600 hover:text-primary mr-4">
            <ArrowLeftIcon className="h-5 w-5" />
          </Link>
          <h1 className="text-3xl font-bold">Управление пользователями</h1>
        </div>

        {/* Фильтры и поиск */}
        <div className="mb-8">
          <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-4 rounded-lg shadow-md">
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => handleRoleChange('all')}
                className={`px-4 py-2 rounded-md text-sm font-medium ${
                  showRoleFilter === 'all' 
                    ? 'bg-primary text-white' 
                    : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                }`}
              >
                Все пользователи
              </button>
              <button
                onClick={() => handleRoleChange('admin')}
                className={`px-4 py-2 rounded-md text-sm font-medium ${
                  showRoleFilter === 'admin' 
                    ? 'bg-primary text-white' 
                    : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                }`}
              >
                Администраторы
              </button>
              <button
                onClick={() => handleRoleChange('user')}
                className={`px-4 py-2 rounded-md text-sm font-medium ${
                  showRoleFilter === 'user' 
                    ? 'bg-primary text-white' 
                    : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                }`}
              >
                Клиенты
              </button>
              <button
                onClick={() => handleRoleChange('waiter')}
                className={`px-4 py-2 rounded-md text-sm font-medium ${
                  showRoleFilter === 'waiter' 
                    ? 'bg-primary text-white' 
                    : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                }`}
              >
                Официанты
              </button>
              <button
                onClick={() => handleRoleChange('kitchen')}
                className={`px-4 py-2 rounded-md text-sm font-medium ${
                  showRoleFilter === 'kitchen' 
                    ? 'bg-primary text-white' 
                    : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                }`}
              >
                Повара
              </button>
              <button
                onClick={() => handleRoleChange('supply')}
                className={`px-4 py-2 rounded-md text-sm font-medium ${
                  showRoleFilter === 'supply' 
                    ? 'bg-primary text-white' 
                    : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                }`}
              >
                Поставщики
              </button>
            </div>

            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <SearchIcon className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                placeholder="Поиск по имени, email или телефону"
                value={searchQuery}
                onChange={handleSearch}
                className="pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary w-full md:w-80"
              />
            </div>
          </div>
        </div>

        {/* Кнопка добавления нового пользователя */}
        <div className="mb-6">
          <button
            onClick={() => router.push('/admin/users/create')}
            className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-primary hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
          >
            <UserAddIcon className="h-5 w-5 mr-2" />
            Добавить пользователя
          </button>
        </div>

        {/* Список пользователей */}
        {filteredUsers.length === 0 ? (
          <div className="bg-white rounded-lg shadow-md p-8 text-center">
            <div className="flex justify-center mb-4">
              <UserIcon className="h-16 w-16 text-gray-400" />
            </div>
            <h2 className="text-2xl font-medium mb-4">Пользователи не найдены</h2>
            <p className="text-gray-600 mb-6">
              По выбранным фильтрам не найдено ни одного пользователя
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Пользователь
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Дата регистрации
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Последний вход
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Роль
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Статистика
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Статус
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Действия
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredUsers.map((user) => (
                    <tr key={user.id} className="hover:bg-gray-50">
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
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default AdminUsersPage; 