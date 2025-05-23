'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { 
  MapPinIcon as LocationMarkerIcon,
  PhoneIcon,
  EnvelopeIcon as MailIcon,
  ClockIcon
} from '@heroicons/react/24/outline';
import { useSettings } from '../settings-context';
import { useRouter } from 'next/router';

const Footer = () => {
  const year = new Date().getFullYear();
  const { settings } = useSettings();
  const router = useRouter();

  // Обработчик клика на домашнюю страницу
  const handleHomeClick = (e: React.MouseEvent) => {
    // Если мы уже на главной странице, предотвращаем переход
    if (router.pathname === '/') {
      e.preventDefault();
      return;
    }
  };

  // Форматирование рабочих часов
  const formatWorkingHours = () => {
    if (!settings?.working_hours) return null;

    // Определяем дни недели и их порядок
    const daysOrder = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    const daysNames = {
      monday: 'Пн',
      tuesday: 'Вт',
      wednesday: 'Ср',
      thursday: 'Чт',
      friday: 'Пт',
      saturday: 'Сб',
      sunday: 'Вс'
    };

    // Группируем дни по расписанию
    const scheduleGroups: Record<string, string[]> = {};
    
    daysOrder.forEach(day => {
      const schedule = settings.working_hours?.[day as keyof typeof settings.working_hours];
      if (!schedule) return;
      
      const key = schedule.is_closed 
        ? 'closed' 
        : `${schedule.open}-${schedule.close}`;
        
      if (!scheduleGroups[key]) {
        scheduleGroups[key] = [];
      }
      scheduleGroups[key].push(day);
    });

    // Форматируем результат
    return (
      <div className="space-y-1">
        {Object.entries(scheduleGroups).map(([schedule, days], index) => {
          // Получаем сокращенные названия дней
          const dayNames = days.map(day => daysNames[day as keyof typeof daysNames]);
          
          // Формируем диапазоны дней
          const ranges: string[] = [];
          let rangeStart = 0;
          
          for (let i = 1; i <= dayNames.length; i++) {
            if (i === dayNames.length || daysOrder.indexOf(days[i]) - daysOrder.indexOf(days[i-1]) !== 1) {
              // Закончился непрерывный диапазон
              if (rangeStart === i - 1) {
                ranges.push(dayNames[rangeStart]);
              } else {
                ranges.push(`${dayNames[rangeStart]}-${dayNames[i-1]}`);
              }
              rangeStart = i;
            }
          }
          
          // Отображаем расписание
          const timeInfo = schedule === 'closed' 
            ? 'Выходной' 
            : schedule.replace('-', ' - ');
            
          return (
            <p key={index} className="text-sm">
              {ranges.join(', ')}: {timeInfo}
            </p>
          );
        })}
      </div>
    );
  };

  return (
    <footer className="bg-gray-800 text-white dark:bg-gray-900">
      {/* Основная информация */}
      <div className="container mx-auto px-4 md:px-6 lg:px-8 max-w-[1400px] pt-12 pb-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* О ресторане */}
          <div>
            <h3 className="text-xl font-bold mb-4">{settings.restaurant_name}</h3>
            <p className="mb-4 text-gray-300 dark:text-gray-300">
              Система поддержки принятия решений для управления рестораном.
              Насладитесь изысканными блюдами в атмосфере уюта и комфорта.
            </p>
            <div className="flex space-x-4">
              <Link href="#" className="text-gray-400 hover:text-gray-300 dark:text-gray-400 dark:hover:text-gray-300">
                <span className="sr-only">Facebook</span>
                <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path fillRule="evenodd" d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12z" clipRule="evenodd" />
                </svg>
              </Link>
              <Link href="#" className="text-gray-400 hover:text-gray-300 dark:text-gray-400 dark:hover:text-gray-300">
                <span className="sr-only">Instagram</span>
                <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path fillRule="evenodd" d="M12.315 2c2.43 0 2.784.013 3.808.06 1.064.049 1.791.218 2.427.465a4.902 4.902 0 011.772 1.153 4.902 4.902 0 011.153 1.772c.247.636.416 1.363.465 2.427.048 1.067.06 1.407.06 4.123v.08c0 2.643-.012 2.987-.06 4.043-.049 1.064-.218 1.791-.465 2.427a4.902 4.902 0 01-1.153 1.772 4.902 4.902 0 01-1.772 1.153c-.636.247-1.363.416-2.427.465-1.067.048-1.407.06-4.123.06h-.08c-2.643 0-2.987-.012-4.043-.06-1.064-.049-1.791-.218-2.427-.465a4.902 4.902 0 01-1.772-1.153 4.902 4.902 0 01-1.153-1.772c-.247-.636-.416-1.363-.465-2.427-.047-1.024-.06-1.379-.06-3.808v-.63c0-2.43.013-2.784.06-3.808.049-1.064.218-1.791.465-2.427a4.902 4.902 0 011.153-1.772A4.902 4.902 0 015.45 2.525c.636-.247 1.363-.416 2.427-.465C8.901 2.013 9.256 2 11.685 2h.63zm-.081 1.802h-.468c-2.456 0-2.784.011-3.807.058-.975.045-1.504.207-1.857.344-.467.182-.8.398-1.15.748-.35.35-.566.683-.748 1.15-.137.353-.3.882-.344 1.857-.047 1.023-.058 1.351-.058 3.807v.468c0 2.456.011 2.784.058 3.807.045.975.207 1.504.344 1.857.182.466.399.8.748 1.15.35.35.683.566 1.15.748.353.137.882.3 1.857.344 1.054.048 1.37.058 4.041.058h.08c2.597 0 2.917-.01 3.96-.058.976-.045 1.505-.207 1.858-.344.466-.182.8-.398 1.15-.748.35-.35.566-.683.748-1.15.137-.353.3-.882.344-1.857.048-1.055.058-1.37.058-4.041v-.08c0-2.597-.01-2.917-.058-3.96-.045-.976-.207-1.505-.344-1.858a3.097 3.097 0 00-.748-1.15 3.098 3.098 0 00-1.15-.748c-.353-.137-.882-.3-1.857-.344-1.023-.047-1.351-.058-3.807-.058zM12 6.865a5.135 5.135 0 110 10.27 5.135 5.135 0 010-10.27zm0 1.802a3.333 3.333 0 100 6.666 3.333 3.333 0 000-6.666zm5.338-3.205a1.2 1.2 0 110 2.4 1.2 1.2 0 010-2.4z" clipRule="evenodd" />
                </svg>
              </Link>
            </div>
          </div>

          {/* Контакты */}
          <div>
            <h3 className="text-xl font-bold mb-4">Контакты</h3>
            <ul className="space-y-3">
              <li className="flex items-start">
                <LocationMarkerIcon className="h-5 w-5 mr-2 mt-0.5 text-primary" />
                <span className="text-gray-300 dark:text-gray-300">{settings.address}</span>
              </li>
              <li className="flex items-center">
                <PhoneIcon className="h-5 w-5 mr-2 text-primary" />
                <a href={`tel:${settings.phone}`} className="text-gray-300 hover:text-white dark:text-gray-300 dark:hover:text-white">
                  {settings.phone}
                </a>
              </li>
              <li className="flex items-center">
                <MailIcon className="h-5 w-5 mr-2 text-primary" />
                <a href={`mailto:${settings.email}`} className="text-gray-300 hover:text-white dark:text-gray-300 dark:hover:text-white">
                  {settings.email}
                </a>
              </li>
              <li className="flex items-start">
                <ClockIcon className="h-5 w-5 mr-2 mt-0.5 text-primary" />
                <div className="text-gray-300 dark:text-gray-300">
                  {formatWorkingHours()}
                </div>
              </li>
            </ul>
          </div>

          {/* Быстрые ссылки */}
          <div>
            <h3 className="text-xl font-bold mb-4">Навигация</h3>
            <nav className="grid grid-cols-2 gap-y-4 sm:grid-cols-4 gap-x-6 mt-8">
              <Link href="/" className="text-base text-gray-300 hover:text-white dark:text-gray-300 dark:hover:text-white" onClick={handleHomeClick}>
                Главная
              </Link>
              <Link href="/menu" className="text-base text-gray-300 hover:text-white dark:text-gray-300 dark:hover:text-white">
                Меню
              </Link>
              <Link href="/reservations" className="text-base text-gray-300 hover:text-white dark:text-gray-300 dark:hover:text-white">
                Бронирование
              </Link>
              <Link href="/about" className="text-base text-gray-300 hover:text-white dark:text-gray-300 dark:hover:text-white">
                О нас
              </Link>
              <Link href="/auth/login" className="text-base text-gray-300 hover:text-white dark:text-gray-300 dark:hover:text-white">
                Войти
              </Link>
            </nav>
          </div>
        </div>
      </div>

      {/* Копирайт */}
      <div className="bg-gray-900 py-4 dark:bg-black">
        <div className="container mx-auto px-4 md:px-6 lg:px-8 max-w-[1400px] text-center text-gray-400 dark:text-gray-300 text-sm">
          <p>&copy; {year} {settings.restaurant_name}. Все права защищены.</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer; 