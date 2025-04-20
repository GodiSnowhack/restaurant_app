import React, { useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import useAuthStore from '@/lib/auth-store';

// Схема валидации для формы регистрации
const registerSchema = z.object({
  name: z.string().min(2, 'Имя должно содержать минимум 2 символа'),
  email: z.string().email('Введите корректный email'),
  password: z.string().min(6, 'Пароль должен содержать минимум 6 символов'),
  confirmPassword: z.string()
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Пароли не совпадают',
  path: ['confirmPassword'],
});

type RegisterFormValues = z.infer<typeof registerSchema>;

export default function RegisterPage() {
  const router = useRouter();
  const { register: registerUser, isLoading, error } = useAuthStore();
  const [generalError, setGeneralError] = useState<string | null>(null);
  
  const { 
    register, 
    handleSubmit, 
    formState: { errors } 
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      name: '',
      email: '',
      password: '',
      confirmPassword: ''
    }
  });
  
  const onSubmit = async (data: RegisterFormValues) => {
    setGeneralError(null);
    try {
      // Удаляем подтверждение пароля перед отправкой
      const { confirmPassword, ...registrationData } = data;
      await registerUser(registrationData.email, registrationData.password, registrationData.name);
      
      // Перенаправляем на страницу входа после успешной регистрации
      router.push('/auth/login?registered=true');
    } catch (err: any) {
      console.error('Ошибка при регистрации:', err);
      
      let errorMessage = 'Ошибка регистрации. Пожалуйста, проверьте введенные данные или попробуйте позже.';
      
      if (err.response?.data) {
        if (typeof err.response.data.detail === 'string') {
          errorMessage = err.response.data.detail;
        } else if (Array.isArray(err.response.data.detail)) {
          errorMessage = err.response.data.detail.map((error: any) => {
            if (error.loc && error.msg) {
              const field = error.loc.slice(1).join('.') || 'значение';
              return `Поле "${field}": ${error.msg}`;
            }
            return typeof error === 'string' ? error : JSON.stringify(error);
          }).join('\n');
        } else if (typeof err.response.data.detail === 'object') {
          errorMessage = JSON.stringify(err.response.data.detail);
        }
      } else if (err.message) {
        errorMessage = err.message;
      }
      
      setGeneralError(errorMessage);
    }
  };
  
  return (
    <>
      <Head>
        <title>Регистрация | Ресторан СППР</title>
      </Head>
      
      <div className="min-h-screen flex flex-col justify-center py-12 sm:px-6 lg:px-8 bg-gray-50">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <h1 className="text-center text-3xl font-bold text-gray-900 mb-6">
            Создать аккаунт
          </h1>
        </div>
        
        <div className="mt-2 sm:mx-auto sm:w-full sm:max-w-md">
          <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
            {(generalError || error) && (
              <div className="mb-4 bg-red-50 p-4 rounded-md">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-red-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <div className="text-sm font-medium text-red-800 whitespace-pre-line">
                      {typeof (generalError || error) === 'string' 
                        ? (generalError || error) 
                        : 'Произошла ошибка при регистрации'}
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            <form className="space-y-6" onSubmit={handleSubmit(onSubmit)}>
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                  Имя
                </label>
                <div className="mt-1">
                  <input
                    id="name"
                    type="text"
                    autoComplete="name"
                    className={`input ${errors.name ? 'border-red-500' : 'border-gray-300'}`}
                    {...register('name')}
                  />
                  {errors.name && (
                    <p className="mt-2 text-sm text-red-600">{errors.name.message}</p>
                  )}
                </div>
              </div>
              
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                  Email
                </label>
                <div className="mt-1">
                  <input
                    id="email"
                    type="email"
                    autoComplete="email"
                    className={`input ${errors.email ? 'border-red-500' : 'border-gray-300'}`}
                    {...register('email')}
                  />
                  {errors.email && (
                    <p className="mt-2 text-sm text-red-600">{errors.email.message}</p>
                  )}
                </div>
              </div>
              
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                  Пароль
                </label>
                <div className="mt-1">
                  <input
                    id="password"
                    type="password"
                    autoComplete="new-password"
                    className={`input ${errors.password ? 'border-red-500' : 'border-gray-300'}`}
                    {...register('password')}
                  />
                  {errors.password && (
                    <p className="mt-2 text-sm text-red-600">{errors.password.message}</p>
                  )}
                </div>
              </div>
              
              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">
                  Подтверждение пароля
                </label>
                <div className="mt-1">
                  <input
                    id="confirmPassword"
                    type="password"
                    autoComplete="new-password"
                    className={`input ${errors.confirmPassword ? 'border-red-500' : 'border-gray-300'}`}
                    {...register('confirmPassword')}
                  />
                  {errors.confirmPassword && (
                    <p className="mt-2 text-sm text-red-600">{errors.confirmPassword.message}</p>
                  )}
                </div>
              </div>
              
              <div>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50"
                >
                  {isLoading ? 'Регистрация...' : 'Зарегистрироваться'}
                </button>
              </div>
            </form>
            
            <div className="mt-6">
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-300"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-white text-gray-500">Или</span>
                </div>
              </div>
              
              <div className="mt-6 text-center">
                <p className="text-sm text-gray-600">
                  Уже есть аккаунт?{' '}
                  <Link href="/auth/login" className="font-medium text-primary hover:text-primary-dark">
                    Войти
                  </Link>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
} 