import {useState} from 'react';
import {NextPage} from 'next';
import {useRouter} from 'next/router';
import Link from 'next/link';
import Layout from '../../../components/Layout';
import useAuthStore from '../../../lib/auth-store';
import {ArrowLeftIcon, UserIcon, MailIcon, PhoneIcon, LockClosedIcon, UserGroupIcon, CheckIcon as SaveIcon, XIcon} from '@heroicons/react/24/solid';
import {usersApi, authApi} from '../../../lib/api';

// Типы ролей
type Role = 'user' | 'admin' | 'waiter' | 'kitchen' | 'supply' | 'guest';

// Данные о ролях для отображения
const roleOptions = [
  { id: 'user', name: 'Клиент', description: 'Обычный пользователь, может делать заказы и бронировать столики' },
  { id: 'admin', name: 'Администратор', description: 'Полный доступ к системе управления рестораном' },
  { id: 'waiter', name: 'Официант', description: 'Обслуживание столиков, прием заказов' },
  { id: 'kitchen', name: 'Повар', description: 'Работа с заказами на кухне, управление меню' },
  { id: 'supply', name: 'Поставщик', description: 'Управление поставками и ингредиентами' },
  { id: 'guest', name: 'Гость', description: 'Ограниченный доступ только для просмотра' }
];

const CreateUserPage: NextPage = () => {
  const router = useRouter();
  const { user, isAuthenticated } = useAuthStore();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  
  // Состояние формы
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirm_password: '',
    full_name: '',
    phone: '',
    role: 'user' as Role
  });
  
  // Состояние ошибок валидации
  const [formErrors, setFormErrors] = useState({
    email: '',
    password: '',
    confirm_password: '',
    full_name: '',
    phone: ''
  });
  
  // Проверка прав администратора
  if (!isAuthenticated || user?.role !== 'admin') {
    if (typeof window !== 'undefined') {
      router.push('/auth/login');
    }
    return null;
  }
  
  // Обработка изменения полей формы
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    
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
    
    // Валидация пароля
    if (!formData.password) {
      errors.password = 'Пароль обязателен';
      isValid = false;
    } else if (formData.password.length < 6) {
      errors.password = 'Пароль должен содержать минимум 6 символов';
      isValid = false;
    }
    
    // Валидация подтверждения пароля
    if (formData.password !== formData.confirm_password) {
      errors.confirm_password = 'Пароли не совпадают';
      isValid = false;
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
    
    if (!validateForm()) return;
    
    try {
      setIsSubmitting(true);
      setError('');
      
      // Подготавливаем данные для API
      const userData = {
        email: formData.email,
        password: formData.password,
        full_name: formData.full_name,
        phone: formData.phone || undefined,
        role: formData.role
      };
      
      // Вызываем API для создания пользователя
      const response = await authApi.register(userData);
      
      setIsSubmitting(false);
      setSuccess(true);
      
      // Перенаправляем на страницу списка пользователей через 2 секунды
      setTimeout(() => {
        router.push('/admin/users');
      }, 2000);
      
    } catch (err: any) {
      setIsSubmitting(false);
      setError(err.response?.data?.detail || 'Произошла ошибка при создании пользователя');
      console.error('Ошибка создания пользователя:', err);
    }
  };
  
  return (
    <Layout title="Добавление пользователя | Админ-панель">
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center mb-6">
          <Link href="/admin/users" className="text-gray-600 hover:text-primary mr-4">
            <ArrowLeftIcon className="h-5 w-5" />
          </Link>
          <h1 className="text-3xl font-bold">Добавление пользователя</h1>
        </div>
        
        {success ? (
          <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded relative mb-6" role="alert">
            <strong className="font-bold">Успешно! </strong>
            <span className="block sm:inline">Пользователь успешно создан.</span>
            <span className="block mt-2">Перенаправление на страницу пользователей...</span>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="bg-white shadow-md rounded-lg p-6">
            {error && (
              <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-6" role="alert">
                <strong className="font-bold">Ошибка! </strong>
                <span className="block sm:inline">{error}</span>
                <button 
                  className="absolute top-0 bottom-0 right-0 px-4 py-3"
                  onClick={() => setError('')}
                >
                  <XIcon className="h-5 w-5" />
                </button>
              </div>
            )}
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Основная информация */}
              <div className="space-y-6">
                <h2 className="text-xl font-semibold border-b pb-2">Основная информация</h2>
                
                {/* ФИО */}
                <div>
                  <label htmlFor="full_name" className="block text-sm font-medium text-gray-700 mb-1">
                    ФИО <span className="text-red-500">*</span>
                  </label>
                  <div className="relative rounded-md shadow-sm">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <UserIcon className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      type="text"
                      id="full_name"
                      name="full_name"
                      value={formData.full_name}
                      onChange={handleChange}
                      className={`pl-10 block w-full border ${formErrors.full_name ? 'border-red-300' : 'border-gray-300'} rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary focus:border-primary`}
                      placeholder="Иванов Иван Иванович"
                    />
                  </div>
                  {formErrors.full_name && <p className="mt-1 text-sm text-red-600">{formErrors.full_name}</p>}
                </div>
                
                {/* Email */}
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                    Email <span className="text-red-500">*</span>
                  </label>
                  <div className="relative rounded-md shadow-sm">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <MailIcon className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      type="email"
                      id="email"
                      name="email"
                      value={formData.email}
                      onChange={handleChange}
                      className={`pl-10 block w-full border ${formErrors.email ? 'border-red-300' : 'border-gray-300'} rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary focus:border-primary`}
                      placeholder="email@example.com"
                    />
                  </div>
                  {formErrors.email && <p className="mt-1 text-sm text-red-600">{formErrors.email}</p>}
                </div>
                
                {/* Телефон */}
                <div>
                  <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
                    Телефон
                  </label>
                  <div className="relative rounded-md shadow-sm">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <PhoneIcon className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      type="tel"
                      id="phone"
                      name="phone"
                      value={formData.phone}
                      onChange={handleChange}
                      className={`pl-10 block w-full border ${formErrors.phone ? 'border-red-300' : 'border-gray-300'} rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary focus:border-primary`}
                      placeholder="+7 (999) 123-45-67"
                    />
                  </div>
                  {formErrors.phone && <p className="mt-1 text-sm text-red-600">{formErrors.phone}</p>}
                </div>
              </div>
              
              {/* Учетные данные */}
              <div className="space-y-6">
                <h2 className="text-xl font-semibold border-b pb-2">Учетные данные</h2>
                
                {/* Роль пользователя */}
                <div>
                  <label htmlFor="role" className="block text-sm font-medium text-gray-700 mb-1">
                    Роль пользователя <span className="text-red-500">*</span>
                  </label>
                  <div className="relative rounded-md shadow-sm">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <UserGroupIcon className="h-5 w-5 text-gray-400" />
                    </div>
                    <select
                      id="role"
                      name="role"
                      value={formData.role}
                      onChange={handleChange}
                      className="pl-10 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary focus:border-primary"
                    >
                      {roleOptions.map(role => (
                        <option key={role.id} value={role.id}>{role.name}</option>
                      ))}
                    </select>
                  </div>
                  <p className="mt-1 text-sm text-gray-500">
                    {roleOptions.find(r => r.id === formData.role)?.description}
                  </p>
                </div>
                
                {/* Пароль */}
                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                    Пароль <span className="text-red-500">*</span>
                  </label>
                  <div className="relative rounded-md shadow-sm">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <LockClosedIcon className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      type="password"
                      id="password"
                      name="password"
                      value={formData.password}
                      onChange={handleChange}
                      className={`pl-10 block w-full border ${formErrors.password ? 'border-red-300' : 'border-gray-300'} rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary focus:border-primary`}
                      placeholder="Минимум 6 символов"
                    />
                  </div>
                  {formErrors.password && <p className="mt-1 text-sm text-red-600">{formErrors.password}</p>}
                </div>
                
                {/* Подтверждение пароля */}
                <div>
                  <label htmlFor="confirm_password" className="block text-sm font-medium text-gray-700 mb-1">
                    Подтверждение пароля <span className="text-red-500">*</span>
                  </label>
                  <div className="relative rounded-md shadow-sm">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <LockClosedIcon className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      type="password"
                      id="confirm_password"
                      name="confirm_password"
                      value={formData.confirm_password}
                      onChange={handleChange}
                      className={`pl-10 block w-full border ${formErrors.confirm_password ? 'border-red-300' : 'border-gray-300'} rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary focus:border-primary`}
                      placeholder="Повторите пароль"
                    />
                  </div>
                  {formErrors.confirm_password && <p className="mt-1 text-sm text-red-600">{formErrors.confirm_password}</p>}
                </div>
              </div>
            </div>
            
            {/* Кнопки действий */}
            <div className="flex justify-end space-x-3 mt-8">
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
                {isSubmitting ? 'Сохранение...' : 'Создать пользователя'}
              </button>
            </div>
          </form>
        )}
      </div>
    </Layout>
  );
};

export default CreateUserPage; 