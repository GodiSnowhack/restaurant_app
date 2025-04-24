import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import useAuthStore from '@/lib/auth-store';
import * as mobileAuth from '@/lib/mobile-auth';

// Схема валидации для формы входа
const loginSchema = z.object({
  email: z.string().email('Введите корректный email'),
  password: z.string().min(6, 'Пароль должен содержать минимум 6 символов'),
});

type LoginFormValues = z.infer<typeof loginSchema>;

// Обновляю существующую функцию checkServerAvailability
const checkServerAvailability = async (): Promise<boolean> => {
  return await mobileAuth.checkServerAvailability();
};

// Обновляю функцию directLogin для использования новой библиотеки
const directLogin = async (email: string, password: string): Promise<{success: boolean, token?: string, error?: string}> => {
  return await mobileAuth.directLogin(email, password);
};

export default function LoginPage() {
  const router = useRouter();
  const { returnUrl } = router.query;
  const { login, isLoading, error, isMobileDevice, fetchUserProfile } = useAuthStore();
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [submitAttempts, setSubmitAttempts] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loginStatus, setLoginStatus] = useState<string | null>(null);
  
  const { 
    register, 
    handleSubmit, 
    formState: { errors } 
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: ''
    }
  });
  
  // Очищаем состояние ошибок при монтировании компонента
  useEffect(() => {
    setGeneralError(null);
    
    // Проверяем наличие последних ошибок авторизации в localStorage для отладки
    if (typeof window !== 'undefined') {
      const lastError = localStorage.getItem('auth_error');
      if (lastError) {
        console.log('Login Page - Последняя ошибка авторизации:', lastError);
      }
      
      // Очищаем другие поля для отладки
      localStorage.removeItem('login_attempt_error');
      localStorage.setItem('login_page_visit', new Date().toISOString());
    }
  }, []);
  
  // Мониторим состояние загрузки
  useEffect(() => {
    if (!isLoading && isSubmitting) {
      setIsSubmitting(false);
    }
  }, [isLoading, isSubmitting]);
  
  const onSubmit = async (data: LoginFormValues) => {
    setGeneralError(null);
    setIsSubmitting(true);
    setSubmitAttempts(prev => prev + 1);
    
    // Обновляем статус для более подробной обратной связи
    setLoginStatus('Отправка данных на сервер...');
    
    console.log(`Login Page - Попытка входа #${submitAttempts + 1}`, { email: data.email, isMobile: isMobileDevice });
    
    try {
      if (typeof window !== 'undefined') {
        // Сохраняем информацию о попытке входа для отладки
        localStorage.setItem('login_attempt_start', Date.now().toString());
        localStorage.setItem('login_email', data.email); // Сохраняем только для отладки!
      }
      
      // Проверяем доступность сервера перед отправкой запроса на мобильных устройствах
      if (isMobileDevice) {
        setLoginStatus('Проверка соединения с сервером...');
        
        const isServerAvailable = await checkServerAvailability();
        
        // Для мобильных устройств используем расширенные методы авторизации
        setLoginStatus('Выполняется вход (мобильная версия)...');
        
        try {
          const directLoginResult = await directLogin(data.email, data.password);
          if (directLoginResult.success) {
            setLoginStatus('Авторизация успешна, загружаем профиль...');
            
            // Сохраняем успешную авторизацию для отладки
            if (typeof window !== 'undefined') {
              localStorage.setItem('login_success', Date.now().toString());
              localStorage.setItem('login_method', 'mobile_direct');
            }
            
            // Явно запрашиваем профиль пользователя
            try {
              if (directLoginResult.token) {
                const userProfile = await mobileAuth.fetchUserProfileDirect(directLoginResult.token);
                console.log('Профиль пользователя загружен:', userProfile);
              } else {
                await fetchUserProfile();
              }
            } catch (profileError) {
              console.error('Ошибка при загрузке профиля:', profileError);
            }
            
            // Перенаправляем пользователя после успешного входа
            setLoginStatus('Авторизация успешна, перенаправление...');
            router.push((returnUrl as string) || '/');
            return;
          } else {
            console.error('Ошибка мобильной авторизации:', directLoginResult.error);
            setLoginStatus('Ошибка авторизации. Попытка через основной метод...');
          }
        } catch (mobileError) {
          console.error('Ошибка в процессе мобильной авторизации:', mobileError);
          setLoginStatus('Ошибка авторизации. Попытка через основной метод...');
        }
      }
      
      // Если мобильная авторизация не удалась или это десктоп, используем стандартный метод
      setLoginStatus('Выполняется стандартная авторизация...');
      
      try {
        await login(data.email, data.password);
        
        setLoginStatus('Авторизация успешна, перенаправление...');
        
        // Сохраняем успешную авторизацию для отладки
        if (typeof window !== 'undefined') {
          localStorage.setItem('login_success', Date.now().toString());
          localStorage.setItem('login_method', 'standard');
        }
        
        // Перенаправляем пользователя после успешного входа
        router.push((returnUrl as string) || '/');
      } catch (error: any) {
        console.error('Ошибка при стандартной авторизации:', error);
        setLoginStatus(null);
        
        // Если ошибка связана с сетью, проверяем подключение
        if (error.message && (error.message.includes('network') || error.message.includes('соединение') || error.message.includes('подключен'))) {
          setGeneralError('Проблема с подключением к интернету. Пожалуйста, проверьте ваше соединение и попробуйте снова.');
        } else {
          setGeneralError(error.message || 'Произошла ошибка при входе. Пожалуйста, проверьте введенные данные.');
        }
      }
    } catch (generalError: any) {
      console.error('Общая ошибка входа:', generalError);
      setLoginStatus(null);
      setGeneralError('Произошла непредвиденная ошибка. Пожалуйста, попробуйте снова позже.');
    } finally {
      setIsSubmitting(false);
    }
  };
  
  return (
    <>
      <Head>
        <title>Вход в систему | Ресторан</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="bg-white p-6 sm:p-8 rounded-lg shadow-xl w-full max-w-md">
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold text-gray-800">Вход в личный кабинет</h1>
            <p className="text-gray-600 mt-2">Введите ваши учетные данные для входа</p>
          </div>
          
          {/* Информация о статусе авторизации */}
          {loginStatus && (
            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 text-blue-700 rounded-md">
              <div className="flex items-center">
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span>{loginStatus}</span>
              </div>
            </div>
          )}
          
          {/* Отображение общих ошибок */}
          {(generalError || error) && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-md">
              <div className="flex items-start">
                <svg className="h-5 w-5 text-red-500 mr-2 mt-0.5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                <div>
                  <p className="font-medium">{generalError || error}</p>
                  {generalError && isMobileDevice && (
                    <p className="text-sm mt-1">
                      Проверьте подключение к интернету и попробуйте обновить страницу.
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
          
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                className={`w-full px-4 py-2 border rounded-md focus:ring-2 focus:outline-none ${
                  errors.email ? 'border-red-300 focus:ring-red-300' : 'border-gray-300 focus:ring-primary-300'
                }`}
                placeholder="Введите ваш email"
                {...register('email')}
                disabled={isSubmitting}
              />
              {errors.email && (
                <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>
              )}
            </div>
            
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                Пароль
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                className={`w-full px-4 py-2 border rounded-md focus:ring-2 focus:outline-none ${
                  errors.password ? 'border-red-300 focus:ring-red-300' : 'border-gray-300 focus:ring-primary-300'
                }`}
                placeholder="Введите ваш пароль"
                {...register('password')}
                disabled={isSubmitting}
              />
              {errors.password && (
                <p className="mt-1 text-sm text-red-600">{errors.password.message}</p>
              )}
            </div>
            
            <div>
              <button
                type="submit"
                className={`w-full py-2 px-4 rounded-md text-white font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                  isSubmitting
                    ? 'bg-primary-300 cursor-not-allowed'
                    : 'bg-primary hover:bg-primary-dark focus:ring-primary-500'
                }`}
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Выполняется вход...' : 'Войти'}
              </button>
            </div>
            
            <div className="text-center">
              <Link href="/auth/register" className="text-primary hover:text-primary-dark text-sm">
                Нет аккаунта? Зарегистрироваться
              </Link>
            </div>
          </form>
          
          {/* Информация для отладки на мобильных устройствах */}
          {isMobileDevice && process.env.NODE_ENV !== 'production' && (
            <div className="mt-6 p-2 border border-gray-200 rounded-md text-xs text-gray-500">
              <details>
                <summary className="cursor-pointer">Информация для отладки</summary>
                <div className="mt-2 space-y-1">
                  <p>ID сессии: {Date.now()}</p>
                  <p>User Agent: {typeof navigator !== 'undefined' ? navigator.userAgent : 'Недоступно'}</p>
                  <p>Попыток входа: {submitAttempts}</p>
                  <p>Сеть: {typeof navigator !== 'undefined' && navigator.onLine ? 'Online' : 'Offline'}</p>
                </div>
              </details>
            </div>
          )}
        </div>
      </div>
    </>
  );
} 