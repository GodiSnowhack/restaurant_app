import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import Head from 'next/head';
import {useRouter} from 'next/router';
import Header from '../components/Header';
import Footer from '../components/Footer';
import Layout from '../components/Layout';
import useAuthStore from '../lib/auth-store';
import {UserIcon, ClipboardDocumentListIcon, Cog6ToothIcon as CogIcon} from '@heroicons/react/24/solid';
import { ArrowRightIcon, StarIcon, MapIcon, PhoneIcon, ClockIcon } from '@heroicons/react/24/outline';
import { EnvelopeIcon as MailIcon, MapPinIcon as LocationMarkerIcon } from '@heroicons/react/24/outline';
import { Spinner } from '@/components/ui/spinner';
import useCartStore from '../lib/cart-store';
import {useSettings} from '../settings-context';
import { menuApi } from '../lib/api/';
import type { Dish } from '../types';

interface Restaurant {
  restaurant_name: string;
  welcome_text: string;
  logo_url: string;
  description?: string;
  address?: string;
  phone?: string;
  email?: string;
  working_hours?: string;
  latitude?: number; 
  longitude?: number;
  delivery_radius?: number;
  min_order?: number;
  delivery_fee?: number;
  avg_delivery_time?: number;
  social_links?: {
    facebook?: string;
    instagram?: string;
    twitter?: string;
  };
}

// Дополним тип Dish для использования в компоненте
interface ExtendedDish extends Dish {
  featured?: boolean;
  rating?: number;
}

// Отзывы
const testimonials = [
  {
    name: 'Иван Петров',
    text: 'Отличный ресторан! Очень вкусные блюда и отличный сервис.',
    rating: 5,
    date: '15.04.2023',
    avatar: '/avatars/user1.jpg'
  },
  {
    name: 'Анна Смирнова',
    text: 'Рекомендую всем любителям хорошей кухни! Если хотите попробовать что-то новое, то этот ресторан - идеальный выбор.',
    rating: 5,
    date: '23.03.2023',
    avatar: '/avatars/user2.jpg'
  },
  {
    name: 'Дмитрий Иванов',
    text: 'Обслуживание на высшем уровне! Я был в этом ресторане несколько раз и каждый раз был доволен. У них получается очень вкусный крем-суп.',
    rating: 5,
    date: '05.05.2023',
    avatar: '/avatars/user3.jpg'
  }
];

// Компонент для быстрого доступа к функциям
const QuickAccess = () => {
  const { user, isAuthenticated } = useAuthStore();
  const [isOpen, setIsOpen] = useState(false);

  // Если пользователь не авторизован, не показываем компонент
  if (!isAuthenticated || !user) return null;

  const togglePanel = () => {
    setIsOpen(!isOpen);
  };

  const getAccessLinks = () => {
    const links = [];

    // Для официанта
    if (user.role === 'waiter' || user.role === 'admin') {
      links.push(
        <Link key="waiter" href="/waiter" className="flex items-center bg-blue-500 text-white p-3 rounded-lg mb-2 hover:bg-blue-600 transition-colors">
          <ClipboardDocumentListIcon className="h-6 w-6 mr-2" />
          <span>Панель официанта</span>
        </Link>
      );
    }

    // Для администратора 
    if (user.role === 'admin') {
      links.push(
        <Link key="admin" href="/admin" className="flex items-center bg-purple-500 text-white p-3 rounded-lg mb-2 hover:bg-purple-600 transition-colors">
          <CogIcon className="h-6 w-6 mr-2" />
          <span>Панель администратора</span>
        </Link>
      );
    }

    return links;
  };

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {isOpen && (
        <div className="bg-white p-4 rounded-lg shadow-lg mb-4 w-64 animate-fade-in">
          <h3 className="text-lg font-bold mb-3 text-gray-800">Быстрый доступ</h3>
          <div className="space-y-2">
            {getAccessLinks()}
          </div>
        </div>
      )}
      
      <button
        onClick={togglePanel}
        className="bg-primary p-4 rounded-full shadow-lg hover:bg-primary-dark transition-colors flex items-center justify-center relative"
      >
        <UserIcon className="h-6 w-6 text-white" />
        {!isOpen && user.role === 'waiter' && (
          <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full animate-pulse"></div>
        )}
      </button>
    </div>
  );
};

const HomePageContent = () => {
  const { isAuthenticated, user } = useAuthStore();
  const { settings: contextSettings } = useSettings();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [settings, setSettings] = useState<Restaurant | null>(null);
  const [popularDishes, setPopularDishes] = useState<ExtendedDish[]>([]);

  // Выносим функцию за пределы useEffect для повторного использования
  const loadInitialData = async () => {
    setLoading(true);
    try {
      // Используем settings из контекста вместо отдельного запроса
      if (contextSettings) {
        setSettings(contextSettings as unknown as Restaurant);
      }
      
      // Получаем популярные блюда
      const getDishesForMainPage = async () => {
        try {
          // Получаем все блюда и отбираем популярные
          const allDishesResponse = await menuApi.getDishes();
          
          // Временное решение для преобразования ответа API в нужный формат
          let dishes: any[] = [];
          
          if (allDishesResponse && Array.isArray(allDishesResponse)) {
            dishes = allDishesResponse;
          } else if (allDishesResponse && typeof allDishesResponse === 'object') {
            // Проверяем наличие свойства dishes в ответе
            if ('dishes' in allDishesResponse && Array.isArray((allDishesResponse as any).dishes)) {
              dishes = (allDishesResponse as any).dishes;
            }
          }
          
          // Фильтруем и типизируем данные как ExtendedDish
          const popularDishes = dishes
            .filter(dish => {
              if (!dish) return false;
              
              // Проверяем наличие свойств featured или rating
              const asDish = dish as any;
              return (
                asDish.featured === true || 
                (asDish.rating !== undefined && asDish.rating > 4.5)
              );
            })
            .slice(0, 6) as ExtendedDish[];
          
          return popularDishes;
        } catch (error) {
          console.error('Ошибка при получении популярных блюд:', error);
          return []; // Возвращаем пустой массив в случае ошибки
        }
      };
      
      const dishes = await getDishesForMainPage();
      setPopularDishes(dishes);
      setError(null);
    } catch (err) {
      console.error('Ошибка при загрузке данных:', err);
      setError('Не удалось загрузить данные. Пожалуйста, попробуйте позже.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInitialData();
  }, []);

  const router = useRouter();
  const [showWaiterBanner, setShowWaiterBanner] = useState(false);

  useEffect(() => {
    // Показываем баннер для официантов
    if (isAuthenticated && (user?.role === 'waiter' || user?.role === 'admin')) {
      setShowWaiterBanner(true);
    }
  }, [isAuthenticated, user]);
  
  const handleViewMenu = () => {
    router.push('/menu');
  };
  
  const handleAddToCart = (dish: Dish) => {
    // Добавление блюда в корзину
    console.log('Добавлено в корзину:', dish);
  };
  
  // Функция для форматирования рабочих часов
  const formatWorkingHours = () => {
    if (!settings?.working_hours) return 'Пн-Вс: 10:00 - 22:00';
    
    // Если working_hours это строка, возвращаем её
    if (typeof settings.working_hours === 'string') {
      return settings.working_hours;
    }
    
    // Если working_hours это объект, форматируем его
    try {
      // Пример простого форматирования
      const days = {
        monday: 'Пн',
        tuesday: 'Вт',
        wednesday: 'Ср',
        thursday: 'Чт',
        friday: 'Пт',
        saturday: 'Сб',
        sunday: 'Вс'
      };
      
      // Формируем строку с рабочими часами
      let formattedHours = '';
      for (const [day, value] of Object.entries(settings.working_hours)) {
        if (days[day as keyof typeof days]) {
          const dayData = value as any;
          if (dayData.is_closed) {
            formattedHours += `${days[day as keyof typeof days]}: Выходной, `;
          } else {
            formattedHours += `${days[day as keyof typeof days]}: ${dayData.open}-${dayData.close}, `;
          }
        }
      }
      
      // Убираем последнюю запятую и пробел
      return formattedHours.slice(0, -2);
    } catch (error) {
      console.error('Ошибка форматирования рабочих часов:', error);
      return 'Пн-Вс: 10:00 - 22:00';
    }
  };
  
  return (
    <div className="bg-white dark:bg-gray-900">
      {loading ? (
        <div className="min-h-screen flex flex-col items-center justify-center dark:text-white">
          <Spinner className="w-12 h-12 text-primary" />
          <p className="mt-4 text-lg">Загрузка данных...</p>
        </div>
      ) : error ? (
        <div className="min-h-screen flex flex-col items-center justify-center px-4 text-center dark:text-white">
          <div className="bg-red-50 dark:bg-red-900/30 text-red-800 dark:text-red-200 p-4 rounded-lg mb-4">
            <p>{error}</p>
          </div>
          <button 
            onClick={loadInitialData}
            className="mt-4 bg-primary text-white px-4 py-2 rounded-md hover:bg-primary-dark"
          >
            Попробовать снова
          </button>
        </div>
      ) : (
        <>
          {/* Hero секция */}
          <section className="relative bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 overflow-hidden">
            <div className="container mx-auto px-4 py-16 md:py-24 flex flex-col md:flex-row items-center">
              <div className="md:w-1/2 md:pr-12 mb-10 md:mb-0 text-center md:text-left">
                <h1 className="text-4xl md:text-5xl font-bold mb-6 text-gray-900 dark:text-white">
                  {settings?.welcome_text || 'Добро пожаловать в наш ресторан!'}
                </h1>
                <p className="text-lg md:text-xl text-gray-600 dark:text-gray-300 mb-8">
                  {settings?.description || 'Насладитесь изысканными блюдами в атмосфере уюта и комфорта. Наше меню разработано лучшими шеф-поварами, чтобы предложить вам незабываемые вкусовые впечатления.'}
                </p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center md:justify-start">
                  <button
                    onClick={handleViewMenu}
                    className="bg-primary hover:bg-primary-dark text-white font-bold py-3 px-6 rounded-lg transition-colors flex items-center justify-center"
                  >
                    Изучить меню
                    <ArrowRightIcon className="w-5 h-5 ml-2" />
                  </button>
                  <Link 
                    href="/reservations"
                    className="bg-white dark:bg-gray-800 border-2 border-primary hover:border-primary-dark text-primary hover:text-primary-dark dark:text-white font-bold py-3 px-6 rounded-lg transition-colors flex items-center justify-center"
                  >
                    Забронировать стол
                  </Link>
                </div>
              </div>
              <div className="md:w-1/2 relative">
                {settings?.logo_url ? (
                  <div className="relative rounded-lg overflow-hidden shadow-2xl transform transition-transform hover:scale-105">
                    <Image 
                      src={settings.logo_url} 
                      alt={settings?.restaurant_name || 'Ресторан'} 
                      width={600} 
                      height={400}
                      className="object-cover"
                    />
                  </div>
                ) : (
                  <div className="bg-gray-200 dark:bg-gray-700 rounded-lg h-80 flex items-center justify-center">
                    <p className="text-gray-500 dark:text-gray-400">Изображение ресторана</p>
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* Популярные блюда */}
          {popularDishes.length > 0 && (
            <section className="py-16 bg-white dark:bg-gray-900">
              <div className="container mx-auto px-4">
                <h2 className="text-3xl font-bold mb-12 text-center text-gray-900 dark:text-white">
                  Популярные блюда
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
                  {popularDishes.map((dish, index) => (
                    <div key={dish.id || index} className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow">
                      <div className="relative h-48">
                        {dish.image_url ? (
                          <Image
                            src={dish.image_url}
                            alt={dish.name}
                            fill
                            className="object-cover"
                          />
                        ) : (
                          <div className="w-full h-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                            <p className="text-gray-500 dark:text-gray-400">Изображение недоступно</p>
                          </div>
                        )}
                        {dish.featured && (
                          <div className="absolute top-2 right-2 bg-primary text-white text-xs font-bold px-2 py-1 rounded">
                            Хит продаж
                          </div>
                        )}
                      </div>
                      <div className="p-4">
                        <div className="flex justify-between items-start mb-2">
                          <h3 className="text-xl font-semibold text-gray-900 dark:text-white">{dish.name}</h3>
                          <p className="font-bold text-primary">{dish.price} ₽</p>
                        </div>
                        <p className="text-gray-600 dark:text-gray-300 text-sm mb-4 line-clamp-2">{dish.description}</p>
                        {dish.rating && (
                          <div className="flex items-center mb-4">
                            {[...Array(5)].map((_, i) => (
                              <StarIcon
                                key={i}
                                className={`h-5 w-5 ${
                                  i < Math.floor(dish.rating || 0)
                                    ? 'text-yellow-400'
                                    : 'text-gray-300 dark:text-gray-600'
                                }`}
                              />
                            ))}
                            <span className="ml-2 text-sm text-gray-600 dark:text-gray-400">{dish.rating}</span>
                          </div>
                        )}
                        <button
                          onClick={() => handleAddToCart(dish)}
                          className="w-full bg-primary hover:bg-primary-dark text-white font-medium py-2 px-4 rounded-md transition-colors"
                        >
                          В корзину
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="text-center mt-10">
                  <Link
                    href="/menu"
                    className="inline-flex items-center bg-white dark:bg-gray-800 border-2 border-primary hover:border-primary-dark text-primary hover:text-primary-dark dark:text-white font-bold py-3 px-6 rounded-lg transition-colors"
                  >
                    Смотреть все меню
                    <ArrowRightIcon className="w-5 h-5 ml-2" />
                  </Link>
                </div>
              </div>
            </section>
          )}

          {/* Информация о ресторане */}
          <section className="py-16 bg-gray-50 dark:bg-gray-800">
            <div className="container mx-auto px-4">
              <h2 className="text-3xl font-bold mb-12 text-center text-gray-900 dark:text-white">
                О нас
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="bg-white dark:bg-gray-900 rounded-lg shadow-md p-6 text-center">
                  <div className="rounded-full bg-primary/10 w-16 h-16 flex items-center justify-center mx-auto mb-4">
                    <MapIcon className="h-8 w-8 text-primary" />
                  </div>
                  <h3 className="text-xl font-semibold mb-2 text-gray-900 dark:text-white">
                    Местоположение
                  </h3>
                  <p className="text-gray-600 dark:text-gray-300">
                    {settings?.address || 'Москва, ул. Тверская, 1'}
                  </p>
                </div>

                <div className="bg-white dark:bg-gray-900 rounded-lg shadow-md p-6 text-center">
                  <div className="rounded-full bg-primary/10 w-16 h-16 flex items-center justify-center mx-auto mb-4">
                    <PhoneIcon className="h-8 w-8 text-primary" />
                  </div>
                  <h3 className="text-xl font-semibold mb-2 text-gray-900 dark:text-white">
                    Контакты
                  </h3>
                  <p className="text-gray-600 dark:text-gray-300">
                    Тел: {settings?.phone || '+7 (XXX) XXX-XX-XX'}<br />
                    Email: {settings?.email || 'info@restaurant.com'}
                  </p>
                </div>

                <div className="bg-white dark:bg-gray-900 rounded-lg shadow-md p-6 text-center">
                  <div className="rounded-full bg-primary/10 w-16 h-16 flex items-center justify-center mx-auto mb-4">
                    <ClockIcon className="h-8 w-8 text-primary" />
                  </div>
                  <h3 className="text-xl font-semibold mb-2 text-gray-900 dark:text-white">
                    Часы работы
                  </h3>
                  <p className="text-gray-600 dark:text-gray-300">
                    Пн-Пт: 12:00 - 23:00<br />
                    Сб-Вс: 12:00 - 00:00
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Отзывы */}
          <section className="py-16 bg-white dark:bg-gray-900">
            <div className="container mx-auto px-4">
              <h2 className="text-3xl font-bold mb-12 text-center text-gray-900 dark:text-white">
                Отзывы наших гостей
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {testimonials.map((testimonial, index) => (
                  <div key={index} className="bg-gray-50 dark:bg-gray-800 rounded-lg p-6 shadow-md">
                    <div className="flex items-center mb-4">
                      <div className="mr-4">
                        <div className="w-12 h-12 rounded-full bg-gray-300 dark:bg-gray-600 overflow-hidden">
                          {testimonial.avatar ? (
                            <Image 
                              src={testimonial.avatar} 
                              alt={testimonial.name} 
                              width={48} 
                              height={48}
                              className="object-cover w-full h-full"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-primary text-white text-sm font-bold">
                              {testimonial.name.substring(0, 2).toUpperCase()}
                            </div>
                          )}
                        </div>
                      </div>
                      <div>
                        <h4 className="font-semibold text-gray-900 dark:text-white">{testimonial.name}</h4>
                        <div className="flex mt-1">
                          {[...Array(5)].map((_, i) => (
                            <StarIcon
                              key={i}
                              className={`h-4 w-4 ${
                                i < testimonial.rating
                                  ? 'text-yellow-400'
                                  : 'text-gray-300 dark:text-gray-600'
                              }`}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                    <p className="text-gray-600 dark:text-gray-300 italic mb-2">"{testimonial.text}"</p>
                    <p className="text-gray-500 dark:text-gray-400 text-sm mt-4">{testimonial.date}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Call to action */}
          <section className="py-16 bg-primary">
            <div className="container mx-auto px-4 text-center">
              <h2 className="text-3xl font-bold mb-6 text-white">
                Приходите к нам в гости!
              </h2>
              <p className="text-xl text-white/90 mb-8 max-w-2xl mx-auto">
                Забронируйте столик прямо сейчас и наслаждайтесь великолепной кухней в уютной атмосфере.
              </p>
              <Link
                href="/reservations"
                className="inline-block bg-white text-primary font-bold py-3 px-8 rounded-lg hover:bg-gray-100 transition-colors"
              >
                Забронировать столик
              </Link>
            </div>
          </section>
        </>
      )}
      <QuickAccess />
    </div>
  );
};

export default function HomePage() {
  const [mounted, setMounted] = useState(false);
  
  useEffect(() => {
    setMounted(true);
  }, []);
  
  return (
    <Layout title="Главная - Ресторан">
      <div suppressHydrationWarning>
        {mounted && <HomePageContent />}
        {!mounted && (
          <div className="min-h-screen flex flex-col items-center justify-center dark:text-white">
            <Spinner className="w-12 h-12 text-primary" />
            <p className="mt-4 text-lg">Загрузка данных...</p>
          </div>
        )}
      </div>
    </Layout>
  );
} 