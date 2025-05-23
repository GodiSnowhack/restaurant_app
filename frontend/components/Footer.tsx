'use client';

import React from 'react';
import Link from 'next/link';
import { useSettings } from '../settings-context';
import { 
  MapPinIcon, 
  PhoneIcon, 
  EnvelopeIcon as MailIcon,
  GlobeAltIcon
} from '@heroicons/react/24/outline';

const Footer: React.FC = () => {
  const { settings } = useSettings();
  
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-gray-900 text-white">
      <div className="max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* О ресторане */}
          <div>
            <h3 className="text-xl font-bold mb-4">{settings?.restaurant_name || 'Наш ресторан'}</h3>
            <p className="mb-4 text-gray-300 dark:text-gray-300">
              Система поддержки принятия решений для управления рестораном.
              Насладитесь изысканными блюдами в атмосфере уюта и комфорта.
            </p>
            <div className="space-y-2">
              {settings?.address && (
                <div className="flex items-center">
                  <MapPinIcon className="h-5 w-5 mr-2 text-primary" />
                  <span className="text-gray-300">{settings.address}</span>
                </div>
              )}
              {settings?.phone && (
                <div className="flex items-center">
                  <PhoneIcon className="h-5 w-5 mr-2 text-primary" />
                  <span className="text-gray-300">{settings.phone}</span>
                </div>
              )}
              {settings?.email && (
                <div className="flex items-center">
                  <MailIcon className="h-5 w-5 mr-2 text-primary" />
                  <span className="text-gray-300">{settings.email}</span>
                </div>
              )}
              {settings?.website && (
                <div className="flex items-center">
                  <GlobeAltIcon className="h-5 w-5 mr-2 text-primary" />
                  <a 
                    href={settings.website} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="text-gray-300 hover:text-primary"
                  >
                    {settings.website}
                  </a>
                </div>
              )}
            </div>
          </div>

          {/* Навигация */}
          <div>
            <h3 className="text-xl font-bold mb-4">Навигация</h3>
            <ul className="space-y-2">
              <li>
                <Link href="/" className="text-gray-300 hover:text-primary">
                  Главная
                </Link>
              </li>
              <li>
                <Link href="/menu" className="text-gray-300 hover:text-primary">
                  Меню
                </Link>
              </li>
              <li>
                <Link href="/reservations" className="text-gray-300 hover:text-primary">
                  Бронирование
                </Link>
              </li>
              <li>
                <Link href="/contacts" className="text-gray-300 hover:text-primary">
                  Контакты
                </Link>
              </li>
            </ul>
          </div>

          {/* Часы работы */}
          <div>
            <h3 className="text-xl font-bold mb-4">Часы работы</h3>
            {settings?.working_hours && (
              <div className="space-y-2 text-gray-300">
                {Object.entries(settings.working_hours).map(([day, hours]) => {
                  if (typeof hours === 'object' && !Array.isArray(hours) && hours !== null) {
                    const dayNames: Record<string, string> = {
                      monday: 'Понедельник',
                      tuesday: 'Вторник',
                      wednesday: 'Среда',
                      thursday: 'Четверг',
                      friday: 'Пятница',
                      saturday: 'Суббота',
                      sunday: 'Воскресенье'
                    };
                    
                    if (dayNames[day]) {
                      return (
                        <div key={day} className="flex justify-between">
                          <span>{dayNames[day]}</span>
                          <span>
                            {hours.is_closed 
                              ? 'Закрыто' 
                              : `${hours.open} - ${hours.close}`}
                          </span>
                        </div>
                      );
                    }
                  }
                  return null;
                })}
              </div>
            )}
          </div>
        </div>

        {/* Копирайт */}
        <div className="mt-8 pt-8 border-t border-gray-800">
          <p className="text-center text-gray-400">
            © {currentYear} {settings?.restaurant_name || 'Наш ресторан'}. Все права защищены.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer; 