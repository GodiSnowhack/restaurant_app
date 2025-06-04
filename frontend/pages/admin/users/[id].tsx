import {useState, useEffect} from 'react';
import {NextPage} from 'next';
import {useRouter} from 'next/router';
import Link from 'next/link';
import Layout from '../../../components/Layout';
import useAuthStore from '../../../lib/auth-store';
import {ArrowLeftIcon, UserIcon, EnvelopeIcon, PhoneIcon, LockClosedIcon, UserGroupIcon, CheckIcon as SaveIcon, XMarkIcon, TrashIcon, ArrowPathIcon as RefreshIcon} from '@heroicons/react/24/solid';
import {usersApi} from '../../../lib/api/users-api.new';

// Типы ролей
type Role = 'client' | 'admin' | 'waiter';

// Данные о ролях для отображения
const roleOptions = [
  { id: 'client', name: 'Клиент', description: 'Обычный пользователь, может делать заказы и бронировать столики' },
  { id: 'admin', name: 'Администратор', description: 'Полный доступ к системе управления рестораном' },
  { id: 'waiter', name: 'Официант', description: 'Обслуживание столиков, прием заказов' }
];

const UserEditPage: NextPage = () => {
  const router = useRouter();
  const { id } = router.query;
  const { user, isAuthenticated } = useAuthStore();
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  
  // Состояние формы
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirm_password: '',
    full_name: '',
    phone: '',
    role: 'client' as Role,
    is_active: true
  });
  
  // Состояние ошибок валидации
  const [formErrors, setFormErrors] = useState({
    email: '',
    password: '',
    confirm_password: '',
    full_name: '',
    phone: ''
  });
  
  // Получение данных пользователя
  useEffect(() => {
    if (!id) return;
    
    const fetchUser = async () => {
      try {
        setIsLoading(true);
        const userData = await usersApi.getUserById(Number(id));
        
        // Проверяем наличие данных и устанавливаем значения по умолчанию
        setFormData({
          email: userData?.email || '',
          password: '',
          confirm_password: '',
          full_name: userData?.full_name || '',
          phone: userData?.phone || '',
          role: (userData?.role as Role) || 'client',
          is_active: userData?.is_active ?? true
        });
        
        setIsLoading(false);
      } catch (err) {
        console.error('Ошибка загрузки пользователя:', err);
        setError('Не удалось загрузить данные пользователя');
        setIsLoading(false);
      }
    };
    
    fetchUser();
  }, [id]);
  
  // Проверка прав администратора
  if (!isAuthenticated || user?.role !== 'admin') {
    if (typeof window !== 'undefined') {
      router.push('/auth/login');
    }
    return null;
  }
  
  // Обработка изменения полей формы
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const checkboxValue = type === 'checkbox' ? (e.target as HTMLInputElement).checked : undefined;
    
    setFormData(prev => ({ 
      ...prev, 
      [name]: checkboxValue !== undefined ? checkboxValue : value 
    }));
    
    // Очищаем ошибку при изменении поля
    if (formErrors[name as keyof typeof formErrors]) {
      setFormErrors(prev => ({ ...prev, [name]: '' }));
    }
    
    // Очищаем общую ошибку при любом изменении
    if (error) setError('');
  };
  
  // Валидация формы
  const validateForm = () => {
    let isValid = true;
    const errors = { ...formErrors };
    
    // Валидация email
    if (!formData.email.trim()) {
      errors.email = 'Email обязателен';
      isValid = false;
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      errors.email = 'Некорректный формат email';
      isValid = false;
    }
    
    // Валидация имени
    if (!formData.full_name.trim()) {
      errors.full_name = 'ФИО обязательно';
      isValid = false;
    }
    
    // Валидация пароля (только если пользователь пытается его изменить)
    if (formData.password) {
      if (formData.password.length < 6) {
        errors.password = 'Пароль должен содержать минимум 6 символов';
        isValid = false;
      }
      
      // Валидация подтверждения пароля
      if (formData.password !== formData.confirm_password) {
        errors.confirm_password = 'Пароли не совпадают';
        isValid = false;
      }
    }
    
    // Валидация телефона (если заполнен)
    if (formData.phone && !/^\+?[0-9\s\-\(\)]{10,}$/.test(formData.phone)) {
      errors.phone = 'Некорректный формат телефона';
      isValid = false;
    }
    
    setFormErrors(errors);
    return isValid;
  };
  
  // Отправка формы
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm() || !id) return;
    
    try {
      setIsSubmitting(true);
      setError('');
      
      // Подготавливаем данные для API
      const userData = {
        email: formData.email,
        full_name: formData.full_name,
        phone: formData.phone || undefined,
        role: formData.role,
        is_active: formData.is_active
      };
      
      // Добавляем пароль только если он был введен
      if (formData.password) {
        Object.assign(userData, { password: formData.password });
      }
      
      // Вызываем API для обновления пользователя
      await usersApi.updateUser(Number(id), userData);
      
      setIsSubmitting(false);
      setSuccess(true);
      
      // Сбрасываем статус успеха через 3 секунды
      setTimeout(() => {
        setSuccess(false);
      }, 3000);
      
    } catch (err: any) {
      setIsSubmitting(false);
      setError(err.response?.data?.detail || 'Произошла ошибка при обновлении пользователя');
      console.error('Ошибка обновления пользователя:', err);
    }
  };
  
  // Обработка удаления пользователя
  const handleDelete = async () => {
    if (!id || !window.confirm('Вы уверены, что хотите удалить этого пользователя? Это действие невозможно отменить.')) {
      return;
    }
    
    try {
      setIsDeleting(true);
      
      // Вызываем API для удаления пользователя
      await usersApi.deleteUser(Number(id));
      
      // Перенаправляем на страницу списка пользователей
      router.push('/admin/users');
      
    } catch (err: any) {
      setIsDeleting(false);
      setError(err.response?.data?.detail || 'Произошла ошибка при удалении пользователя');
      console.error('Ошибка удаления пользователя:', err);
    }
  };
  
  // Обработка изменения статуса пользователя
  const handleToggleStatus = async () => {
    if (!id) return;
    
    try {
      // Обновляем статус в базе данных
      await usersApi.toggleUserStatus(Number(id), !formData.is_active);
      
      // Обновляем локальное состояние
      setFormData(prev => ({
        ...prev,
        is_active: !prev.is_active
      }));
      
      setSuccess(true);
      
      // Сбрасываем статус успеха через 3 секунды
      setTimeout(() => {
        setSuccess(false);
      }, 3000);
      
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Произошла ошибка при изменении статуса пользователя');
      console.error('Ошибка изменения статуса пользователя:', err);
    }
  };
  
  if (isLoading) {
    return (
      <Layout title="Редактирование пользователя | Админ-панель">
        <div className="container mx-auto px-4 py-8">
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
          </div>
        </div>
      </Layout>
    );
  }
  
  return (
    <Layout title="Редактирование пользователя | Админ-панель">
      <div className="container mx-auto px-4 py-8 bg-white dark:bg-gray-900 min-h-screen">
        <div className="flex items-center mb-6">
          <Link href="/admin/users" className="text-gray-600 dark:text-gray-300 hover:text-primary mr-4">
            <ArrowLeftIcon className="h-5 w-5" />
          </Link>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Редактирование пользователя</h1>
        </div>
        
        {success && (
          <div className="bg-green-100 dark:bg-green-900/30 border border-green-400 dark:border-green-600 text-green-700 dark:text-green-200 px-4 py-3 rounded relative mb-6" role="alert">
            <strong className="font-bold">Успешно! </strong>
            <span className="block sm:inline">Данные пользователя обновлены.</span>
          </div>
        )}
        
        <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-800 shadow-md rounded-lg p-6">
          {error && (
            <div className="bg-red-100 dark:bg-red-900/30 border border-red-400 dark:border-red-600 text-red-700 dark:text-red-200 px-4 py-3 rounded relative mb-6" role="alert">
              <strong className="font-bold">Ошибка! </strong>
              <span className="block sm:inline">{error}</span>
              <button 
                className="absolute top-0 bottom-0 right-0 px-4 py-3"
                onClick={() => setError('')}
                type="button"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>
          )}
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Основная информация */}
            <div className="space-y-6">
              <h2 className="text-xl font-semibold border-b pb-2 text-gray-900 dark:text-white">Основная информация</h2>
              
              {/* Статус пользователя */}
              <div className="flex items-center">
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${formData.is_active ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200' : 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200'}`}>
                  {formData.is_active ? 'Активен' : 'Заблокирован'}
                </span>
                <button 
                  type="button"
                  onClick={handleToggleStatus}
                  className="ml-4 inline-flex items-center px-3 py-1 border border-gray-300 dark:border-gray-700 shadow-sm text-sm font-medium rounded-md text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
                >
                  <RefreshIcon className="h-4 w-4 mr-1" />
                  {formData.is_active ? 'Заблокировать' : 'Активировать'}
                </button>
              </div>
              
              {/* ФИО */}
              <div>
                <label htmlFor="full_name" className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                  ФИО <span className="text-red-500">*</span>
                </label>
                <div className="relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <UserIcon className="h-5 w-5 text-gray-400 dark:text-gray-500" />
                  </div>
                  <input
                    type="text"
                    id="full_name"
                    name="full_name"
                    value={formData.full_name}
                    onChange={handleChange}
                    className={`pl-10 block w-full border ${formErrors.full_name ? 'border-red-300 dark:border-red-500' : 'border-gray-300 dark:border-gray-700'} rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary focus:border-primary bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100`}
                    placeholder="Иванов Иван Иванович"
                  />
                </div>
                {formErrors.full_name && <p className="mt-1 text-sm text-red-600 dark:text-red-400">{formErrors.full_name}</p>}
              </div>
              
              {/* Email */}
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                  Email <span className="text-red-500">*</span>
                </label>
                <div className="relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <EnvelopeIcon className="h-5 w-5 text-gray-400 dark:text-gray-500" />
                  </div>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    className={`pl-10 block w-full border ${formErrors.email ? 'border-red-300 dark:border-red-500' : 'border-gray-300 dark:border-gray-700'} rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary focus:border-primary bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100`}
                    placeholder="email@example.com"
                  />
                </div>
                {formErrors.email && <p className="mt-1 text-sm text-red-600 dark:text-red-400">{formErrors.email}</p>}
              </div>
              
              {/* Телефон */}
              <div>
                <label htmlFor="phone" className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                  Телефон
                </label>
                <div className="relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <PhoneIcon className="h-5 w-5 text-gray-400 dark:text-gray-500" />
                  </div>
                  <input
                    type="tel"
                    id="phone"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    className={`pl-10 block w-full border ${formErrors.phone ? 'border-red-300 dark:border-red-500' : 'border-gray-300 dark:border-gray-700'} rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary focus:border-primary bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100`}
                    placeholder="+7 (999) 123-45-67"
                  />
                </div>
                {formErrors.phone && <p className="mt-1 text-sm text-red-600 dark:text-red-400">{formErrors.phone}</p>}
              </div>
            </div>
            
            {/* Учетные данные */}
            <div className="space-y-6">
              <h2 className="text-xl font-semibold border-b pb-2 text-gray-900 dark:text-white">Учетные данные</h2>
              
              {/* Роль пользователя */}
              <div>
                <label htmlFor="role" className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                  Роль пользователя <span className="text-red-500">*</span>
                </label>
                <div className="relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <UserGroupIcon className="h-5 w-5 text-gray-400 dark:text-gray-500" />
                  </div>
                  <select
                    id="role"
                    name="role"
                    value={formData.role}
                    onChange={handleChange}
                    className="pl-10 block w-full border border-gray-300 dark:border-gray-700 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary focus:border-primary bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                    disabled={Number(id) === 1} // Запрещаем менять роль первого (главного) администратора
                  >
                    {roleOptions.map(role => (
                      <option key={role.id} value={role.id}>{role.name}</option>
                    ))}
                  </select>
                </div>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  {roleOptions.find(r => r.id === formData.role)?.description}
                </p>
                {Number(id) === 1 && (
                  <p className="mt-1 text-sm text-yellow-600">
                    Роль главного администратора не может быть изменена
                  </p>
                )}
              </div>
              
              {/* Пароль - опционально для редактирования */}
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                  Новый пароль <span className="text-sm text-gray-500">(оставьте пустым, если не хотите менять)</span>
                </label>
                <div className="relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <LockClosedIcon className="h-5 w-5 text-gray-400 dark:text-gray-500" />
                  </div>
                  <input
                    type="password"
                    id="password"
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    className={`pl-10 block w-full border ${formErrors.password ? 'border-red-300 dark:border-red-500' : 'border-gray-300 dark:border-gray-700'} rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary focus:border-primary bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100`}
                    placeholder="Минимум 6 символов"
                  />
                </div>
                {formErrors.password && <p className="mt-1 text-sm text-red-600 dark:text-red-400">{formErrors.password}</p>}
              </div>
              
              {/* Подтверждение пароля */}
              <div>
                <label htmlFor="confirm_password" className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                  Подтверждение нового пароля
                </label>
                <div className="relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <LockClosedIcon className="h-5 w-5 text-gray-400 dark:text-gray-500" />
                  </div>
                  <input
                    type="password"
                    id="confirm_password"
                    name="confirm_password"
                    value={formData.confirm_password}
                    onChange={handleChange}
                    className={`pl-10 block w-full border ${formErrors.confirm_password ? 'border-red-300 dark:border-red-500' : 'border-gray-300 dark:border-gray-700'} rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary focus:border-primary bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100`}
                    placeholder="Повторите пароль"
                  />
                </div>
                {formErrors.confirm_password && <p className="mt-1 text-sm text-red-600 dark:text-red-400">{formErrors.confirm_password}</p>}
              </div>
            </div>
          </div>
          
          {/* Кнопки действий */}
          <div className="flex justify-between mt-8">
            <button
              type="button"
              onClick={handleDelete}
              disabled={isDeleting || Number(id) === 1}
              className={`inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white ${Number(id) === 1 ? 'bg-gray-400 cursor-not-allowed' : 'bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500'} disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              <TrashIcon className="h-5 w-5 mr-2" />
              {isDeleting ? 'Удаление...' : 'Удалить пользователя'}
            </button>
            
            <div className="flex space-x-3">
              <Link
                href="/admin/users"
                className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
              >
                Отмена
              </Link>
              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-primary hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <SaveIcon className="h-5 w-5 mr-2" />
                {isSubmitting ? 'Сохранение...' : 'Сохранить изменения'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </Layout>
  );
};

export default UserEditPage; 