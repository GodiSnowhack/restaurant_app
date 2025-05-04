import React, { useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import axios from 'axios';
import toast from 'react-hot-toast';

// Валидационная схема для формы регистрации
const registerSchema = z.object({
  name: z.string().min(2, 'Имя должно содержать не менее 2 символов'),
  email: z.string().email('Введите корректный email адрес'),
  password: z.string().min(6, 'Пароль должен содержать не менее 6 символов'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Пароли не совпадают',
  path: ['confirmPassword'],
});

// Тип для данных формы на основе схемы
type RegisterFormData = z.infer<typeof registerSchema>;

export default function RegisterPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<any>(null);

  // Инициализация формы с валидатором
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      name: '',
      email: '',
      password: '',
      confirmPassword: '',
    },
  });

  // Обработка отправки формы
  const onSubmit = async (data: RegisterFormData) => {
    setIsSubmitting(true);
    setServerError(null);
    setValidationErrors(null);

    try {
      // Отправляем запрос на API для регистрации
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          full_name: data.name,
          email: data.email,
          password: data.password,
          role: 'waiter' // Устанавливаем роль "waiter" для нового пользователя
        }),
      });

      const responseData = await response.json();
      
      if (!response.ok) {
        throw new Error(responseData.detail || 'Ошибка при регистрации');
      }

      // Показываем сообщение об успешной регистрации
      toast.success('Регистрация успешна! Выполните вход в систему');
      
      // Переход на страницу входа
      router.push('/auth/login');
    } catch (error: any) {
      console.error('Ошибка при регистрации:', error);
      
      // Обработка различных типов ошибок
      if (axios.isAxiosError(error)) {
        const status = error.response?.status;
        const errorData = error.response?.data;
        
        // Детально логируем ошибку для отладки
        console.log('Детали ошибки:', {
          status,
          data: errorData
        });
        
        if (status === 422 && errorData?.errors) {
          // Обработка ошибок валидации
          setValidationErrors(errorData.errors);
          
          // Отображаем первую ошибку валидации в качестве уведомления
          if (Array.isArray(errorData.errors)) {
            const firstError = errorData.errors[0];
            toast.error(firstError.msg || firstError.loc.join('.') + ': ' + firstError.msg);
          } else {
            toast.error('Проверьте правильность введенных данных');
          }
        } else if (status === 409) {
          // Пользователь с таким email уже существует
          setServerError('Пользователь с таким email уже существует');
          toast.error('Пользователь с таким email уже существует');
        } else if (errorData?.detail) {
          // Если есть детальное описание ошибки
          setServerError(errorData.detail);
          toast.error(errorData.detail);
        } else {
          // Общая ошибка сервера
          setServerError('Произошла ошибка при регистрации. Пожалуйста, попробуйте позже.');
          toast.error('Ошибка регистрации');
        }
      } else {
        // Неожиданная ошибка
        setServerError('Произошла неизвестная ошибка. Пожалуйста, попробуйте позже.');
        toast.error('Неизвестная ошибка');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Отображение детальных ошибок валидации с сервера
  const renderValidationErrors = () => {
    if (!validationErrors) return null;
    
    if (Array.isArray(validationErrors)) {
      return (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
          <h4 className="text-red-700 font-medium">Ошибки валидации:</h4>
          <ul className="list-disc list-inside text-red-600 text-sm">
            {validationErrors.map((err: any, index: number) => (
              <li key={index}>
                {err.loc?.join('.') || 'Поле'}: {err.msg}
              </li>
            ))}
          </ul>
        </div>
      );
    }
    
    return null;
  };

  return (
    <>
      <Head>
        <title>Регистрация | Система управления рестораном</title>
      </Head>
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full p-6 bg-white rounded-lg shadow-md">
          <h1 className="text-2xl font-bold text-center text-gray-800 mb-6">
            Регистрация нового пользователя
          </h1>
          
          {serverError && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">
              {serverError}
            </div>
          )}
          
          {renderValidationErrors()}
          
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {/* Поле имени */}
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                Имя
              </label>
              <input
                id="name"
                type="text"
                {...register('name')}
                className={`mt-1 block w-full px-3 py-2 border ${
                  errors.name ? 'border-red-300' : 'border-gray-300'
                } rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500`}
                placeholder="Ваше имя"
              />
              {errors.name && (
                <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>
              )}
            </div>
            
            {/* Поле email */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                Email
              </label>
              <input
                id="email"
                type="email"
                {...register('email')}
                className={`mt-1 block w-full px-3 py-2 border ${
                  errors.email ? 'border-red-300' : 'border-gray-300'
                } rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500`}
                placeholder="your.email@example.com"
              />
              {errors.email && (
                <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>
              )}
            </div>
            
            {/* Поле пароля */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                Пароль
              </label>
              <input
                id="password"
                type="password"
                {...register('password')}
                className={`mt-1 block w-full px-3 py-2 border ${
                  errors.password ? 'border-red-300' : 'border-gray-300'
                } rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500`}
                placeholder="Минимум 6 символов"
              />
              {errors.password && (
                <p className="mt-1 text-sm text-red-600">{errors.password.message}</p>
              )}
            </div>
            
            {/* Поле подтверждения пароля */}
            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">
                Подтверждение пароля
              </label>
              <input
                id="confirmPassword"
                type="password"
                {...register('confirmPassword')}
                className={`mt-1 block w-full px-3 py-2 border ${
                  errors.confirmPassword ? 'border-red-300' : 'border-gray-300'
                } rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500`}
                placeholder="Повторите пароль"
              />
              {errors.confirmPassword && (
                <p className="mt-1 text-sm text-red-600">{errors.confirmPassword.message}</p>
              )}
            </div>
            
            {/* Кнопка регистрации */}
            <button
              type="submit"
              disabled={isSubmitting}
              className={`w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white ${
                isSubmitting
                  ? 'bg-indigo-400 cursor-not-allowed'
                  : 'bg-indigo-600 hover:bg-indigo-700'
              } focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500`}
            >
              {isSubmitting ? 'Регистрация...' : 'Зарегистрироваться'}
            </button>
            
            {/* Ссылка на вход */}
            <div className="text-center mt-4">
              <p className="text-sm text-gray-600">
                Уже зарегистрированы?{' '}
                <Link href="/auth/login" className="text-indigo-600 hover:text-indigo-500">
                  Войти
                </Link>
              </p>
            </div>
          </form>
        </div>
      </div>
    </>
  );
} 