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
  ClipboardDocumentListIcon as ClipboardListIcon
} from '@heroicons/react/24/outline';
import {usersApi} from '../../lib/api';
import {useTheme} from '../../lib/theme-context';

// Функция для отложенного запуска поиска
const useDebounce = (value: any, delay: number) => {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
};

// Типы данных
type AgeGroup = 'YOUNG' | 'MIDDLE' | 'OLD' | null;

interface User {
  id: number;
  full_name: string;
  email: string;
  phone: string | null;
  role: string;
  created_at: string;
  updated_at: string;
  is_active: boolean;
  birthday: string | null;
  age_group: AgeGroup;
  orders_count?: number;
  reservations_count?: number;
}

// Объекты для визуализации данных пользователей
const roleDisplayNames: Record<string, string> = {
  admin: 'Администратор',
  client: 'Клиент',
  waiter: 'Официант'
};

const roleColors: Record<string, string> = {
  admin: 'purple',
  client: 'blue',
  waiter: 'green'
};

const roleIcons: Record<string, JSX.Element> = {
  admin: <IdentificationIcon className="h-3 w-3 mr-1" />,
  client: <UserIcon className="h-3 w-3 mr-1" />,
  waiter: <ClipboardListIcon className="h-3 w-3 mr-1" />
};

const AdminUsersPage: NextPage = () => {
  const router = useRouter();
  const {user, isAuthenticated} = useAuthStore();
  const {isDark} = useTheme();
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showRoleFilter, setShowRoleFilter] = useState<string>('all');
  const [error, setError] = useState<string | null>(null);
  
  // Дебаунс для поисковых запросов
  const debouncedSearchQuery = useDebounce(searchQuery, 500);

  useEffect(() => {
    const loadUsers = async () => {
      try {
        setIsLoading(true);
        setError(null);
        console.log('Запрос пользователей с параметрами:', {
          role: showRoleFilter !== 'all' ? showRoleFilter : undefined,
          query: debouncedSearchQuery || undefined
        });
        
        // Загружаем пользователей из API с учетом фильтров
        const response = await usersApi.getUsers({
          role: showRoleFilter !== 'all' ? showRoleFilter : undefined,
          query: debouncedSearchQuery || undefined
        });
        
        console.log('Получены пользователи:', response);
        
        // Преобразуем полученные данные, чтобы age_group соответствовал типу AgeGroup
        const typedUsers = response.map(user => ({
          ...user,
          age_group: (user.age_group === 'YOUNG' || user.age_group === 'MIDDLE' || user.age_group === 'OLD' || user.age_group === null) 
            ? user.age_group as AgeGroup 
            : null
        }));
        
        setUsers(typedUsers);
        setIsLoading(false);
      } catch (error: any) {
        console.error('Ошибка при получении списка пользователей:', error);
        setError(`Не удалось загрузить пользователей: ${error.message}`);
        setUsers([]);
        setIsLoading(false);
      }
    };

    loadUsers();
  }, [debouncedSearchQuery, showRoleFilter]);

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-';
    try {
      return new Date(dateString).toLocaleDateString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (error) {
      return dateString;
    }
  };

  const handleRoleChange = (newRole: string) => {
    setShowRoleFilter(newRole);
  };

  const changeUserRole = async (userId: number, newRole: string) => {
    if (!confirm(`Вы уверены, что хотите изменить роль пользователя на "${roleDisplayNames[newRole] || newRole}"?`)) {
      return;
    }

    try {
      // Обновляем роль пользователя через API
      await usersApi.updateUser(userId, {role: newRole});
      
      // Обновляем локальный список пользователей
      setUsers(prevUsers => prevUsers.map(u => 
        u.id === userId ? {...u, role: newRole} : u
      ));
    } catch (error) {
      console.error('Ошибка при изменении роли пользователя:', error);
      alert('Не удалось изменить роль пользователя');
    }
  };

  const deleteUser = async (userId: number) => {
    if (!confirm('Вы уверены, что хотите удалить этого пользователя? Это действие нельзя отменить.')) {
      return;
    }

    try {
      await usersApi.deleteUser(userId);
      setUsers(prevUsers => prevUsers.filter(u => u.id !== userId));
    } catch (error) {
      console.error('Ошибка при удалении пользователя:', error);
      alert('Не удалось удалить пользователя');
    }
  };

  // Фильтрация пользователей по заданным критериям
  const filteredUsers = users.filter(user => {
    // Если задана роль для фильтрации и она не совпадает с ролью пользователя
    if (showRoleFilter !== 'all' && user.role !== showRoleFilter) {
      return false;
    }
    
    // Если задан поисковый запрос
    if (debouncedSearchQuery) {
      const query = debouncedSearchQuery.toLowerCase();
      return (
        user.full_name.toLowerCase().includes(query) ||
        user.email.toLowerCase().includes(query) ||
        (user.phone && user.phone.includes(query))
      );
    }
    
    return true;
  });

  const translateAgeGroup = (ageGroup: string | null): string => {
    if (!ageGroup) return '-';
    
    const groups: Record<string, string> = {
      'YOUNG': 'Молодой',
      'MIDDLE': 'Средний',
      'OLD': 'Пожилой'
    };
    return groups[ageGroup] || ageGroup;
  };

  if (isLoading) {
    return (
      <Layout title="Загрузка... | Админ-панель">
        <div className="flex justify-center items-center h-screen">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="Пользователи | Админ-панель">
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Link href="/admin" className={`inline-flex items-center px-3 py-2 border ${isDark ? 'border-gray-700 text-gray-300 hover:bg-gray-700' : 'border-gray-300 text-gray-700 hover:bg-gray-100'} rounded-md`}>
              <ArrowLeftIcon className="h-5 w-5 mr-2" />
              Назад к панели
            </Link>
            <h1 className={`text-2xl font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>Управление пользователями</h1>
          </div>
          
          <Link href="/admin/users/create" className={`inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium ${isDark ? 'text-black bg-primary-400 hover:bg-primary-300' : 'text-white bg-primary hover:bg-primary-dark'} focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary`}>
            <UserAddIcon className="h-5 w-5 mr-2" />
            Добавить пользователя
          </Link>
        </div>
        
        <div className="mb-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="w-full md:w-auto flex items-center">
              <div className={`w-full md:w-80 relative ${isDark ? 'text-white' : ''}`}>
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <SearchIcon className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  placeholder="Поиск пользователей..."
                  className={`block w-full pl-10 pr-3 py-2 rounded-md ${
                    isDark 
                      ? 'border-gray-700 bg-gray-800 text-white focus:border-primary-400 focus:ring-primary-400' 
                      : 'border-gray-300 focus:border-primary focus:ring-primary'
                  } border focus:outline-none focus:ring-1`}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>
            
            <div className="flex items-center space-x-2 overflow-x-auto">
              <button
                onClick={() => handleRoleChange('all')}
                className={`px-3 py-2 text-sm font-medium rounded-md ${
                  showRoleFilter === 'all'
                    ? isDark ? 'bg-gray-700 text-white' : 'bg-gray-200 text-gray-900'
                    : isDark ? 'text-gray-300 hover:bg-gray-700' : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <span className="flex items-center">Все пользователи</span>
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

        {error && (
          <div className={`rounded-md p-4 mb-6 ${isDark ? 'bg-red-900 text-red-300' : 'bg-red-50 text-red-700'}`}>
            <div className="flex">
              <svg className="h-5 w-5 text-red-400 mr-3" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              <p>{error}</p>
            </div>
          </div>
        )}
        
        {filteredUsers.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-12 text-center">
            <UserIcon className={`mx-auto h-12 w-12 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
            <h3 className={`mt-2 text-lg font-medium ${isDark ? 'text-gray-300' : 'text-gray-900'}`}>Нет пользователей</h3>
            <p className={`${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
              {searchQuery ? 
                `Пользователи не найдены по запросу "${searchQuery}"` : 
                `Пользователи с ролью "${showRoleFilter !== 'all' ? roleDisplayNames[showRoleFilter] || showRoleFilter : 'все'}" не найдены`}
            </p>
            <p className={`${isDark ? 'text-gray-400' : 'text-gray-500'} mt-2`}>
              Попробуйте изменить параметры поиска или добавьте новых пользователей
            </p>
          </div>
        ) : (
          <div className="flex flex-col">
            <div className="-my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
              <div className="py-2 align-middle inline-block min-w-full sm:px-6 lg:px-8">
                <div className={`shadow overflow-hidden border-b sm:rounded-lg ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
                  <table className={`min-w-full divide-y ${isDark ? 'bg-gray-800 divide-gray-700' : 'bg-white divide-gray-200'}`}>
                    <thead className={isDark ? 'bg-gray-900/50' : 'bg-gray-50'}>
                      <tr>
                        <th scope="col" className={`px-6 py-3 text-left text-xs font-medium ${isDark ? 'text-gray-300' : 'text-gray-500'} uppercase tracking-wider`}>
                          ID
                        </th>
                        <th scope="col" className={`px-6 py-3 text-left text-xs font-medium ${isDark ? 'text-gray-300' : 'text-gray-500'} uppercase tracking-wider`}>
                          Пользователь
                        </th>
                        <th scope="col" className={`px-6 py-3 text-left text-xs font-medium ${isDark ? 'text-gray-300' : 'text-gray-500'} uppercase tracking-wider`}>
                          Контакты
                        </th>
                        <th scope="col" className={`px-6 py-3 text-left text-xs font-medium ${isDark ? 'text-gray-300' : 'text-gray-500'} uppercase tracking-wider`}>
                          Роль
                        </th>
                        <th scope="col" className={`px-6 py-3 text-left text-xs font-medium ${isDark ? 'text-gray-300' : 'text-gray-500'} uppercase tracking-wider`}>
                          Возрастная группа
                        </th>
                        <th scope="col" className={`px-6 py-3 text-left text-xs font-medium ${isDark ? 'text-gray-300' : 'text-gray-500'} uppercase tracking-wider`}>
                          Статус
                        </th>
                        <th scope="col" className={`px-6 py-3 text-left text-xs font-medium ${isDark ? 'text-gray-300' : 'text-gray-500'} uppercase tracking-wider`}>
                          Создан
                        </th>
                        <th scope="col" className={`px-6 py-3 text-left text-xs font-medium ${isDark ? 'text-gray-300' : 'text-gray-500'} uppercase tracking-wider`}>
                          Обновлен
                        </th>
                        <th scope="col" className={`px-6 py-3 text-left text-xs font-medium ${isDark ? 'text-gray-300' : 'text-gray-500'} uppercase tracking-wider`}>
                          Действия
                        </th>
                      </tr>
                    </thead>
                    <tbody className={`divide-y ${isDark ? 'divide-gray-700' : 'divide-gray-200'}`}>
                      {filteredUsers.map((user) => (
                        <tr 
                          key={user.id} 
                          className={isDark ? 'hover:bg-gray-750' : 'hover:bg-gray-50'} 
                          onClick={() => router.push(`/admin/users/${user.id}`)}
                          style={{ cursor: 'pointer' }}
                        >
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-900'}`}>{user.id}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className={`flex items-center`}>
                              <div className={`flex-shrink-0 h-10 w-10 bg-gray-200 ${isDark ? 'bg-gray-700' : ''} rounded-full flex items-center justify-center`}>
                                <UserIcon className="h-6 w-6 text-gray-400" />
                              </div>
                              <div className="ml-4">
                                <div className={`text-sm font-medium ${isDark ? 'text-gray-200' : 'text-gray-900'}`}>{user.full_name}</div>
                                <div className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{user.email}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className={`text-sm ${isDark ? 'text-gray-200' : 'text-gray-900'}`}>
                              {user.phone || '-'}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <div className="relative group">
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-${roleColors[user.role] || 'gray'}-${isDark ? '900/50' : '100'} text-${roleColors[user.role] || 'gray'}-${isDark ? '200' : '800'} cursor-pointer`}>
                                  {roleIcons[user.role] || <UserIcon className="h-3 w-3 mr-1" />}
                                  {roleDisplayNames[user.role] || user.role}
                                </span>
                                
                                <div className={`absolute z-10 left-0 mt-2 w-48 rounded-md shadow-lg py-1 bg-white ring-1 ring-black ring-opacity-5 focus:outline-none scale-0 group-hover:scale-100 transition-transform origin-top-left ${isDark ? 'bg-gray-800 text-white' : ''}`} role="menu" aria-orientation="vertical" aria-labelledby="role-menu">
                                  {Object.entries(roleDisplayNames).map(([role, name]) => (
                                    <button
                                      key={role}
                                      className={`block w-full text-left px-4 py-2 text-sm ${isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-100'} ${role === user.role ? isDark ? 'bg-gray-700' : 'bg-gray-100' : ''}`}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        changeUserRole(user.id, role);
                                      }}
                                    >
                                      <span className="flex items-center">
                                        {roleIcons[role] || <UserIcon className="h-3 w-3 mr-1" />} {name}
                                      </span>
                                    </button>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className={`text-sm ${isDark ? 'text-gray-200' : 'text-gray-900'}`}>
                              {translateAgeGroup(user.age_group)}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                              user.is_active 
                                ? isDark ? 'bg-green-900/50 text-green-200' : 'bg-green-100 text-green-800'
                                : isDark ? 'bg-red-900/50 text-red-200' : 'bg-red-100 text-red-800'
                            }`}>
                              {user.is_active ? 'Активен' : 'Неактивен'}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className={`text-sm ${isDark ? 'text-gray-200' : 'text-gray-900'}`}>{formatDate(user.created_at)}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className={`text-sm ${isDark ? 'text-gray-200' : 'text-gray-900'}`}>{formatDate(user.updated_at)}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <div className="flex items-center space-x-2">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  router.push(`/admin/users/${user.id}/edit`);
                                }}
                                className={`text-indigo-600 hover:text-indigo-900 ${isDark ? 'text-indigo-400 hover:text-indigo-300' : ''}`}
                              >
                                <PencilIcon className="h-4 w-4" />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  deleteUser(user.id);
                                }}
                                className={`text-red-600 hover:text-red-900 ${isDark ? 'text-red-400 hover:text-red-300' : ''}`}
                              >
                                <TrashIcon className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default AdminUsersPage; 