import {useState, useEffect} from 'react';
import {NextPage} from 'next';
import {useRouter} from 'next/router';
import Link from 'next/link';
import Layout from '../../components/Layout';
import useAuthStore from '../../lib/auth-store';
import useSettingsStore from '../../lib/settings-store';
import {settingsApi} from '../../lib/api';
import {ArrowLeftIcon, ClockIcon, Cog6ToothIcon as CogIcon, PhoneIcon, MapPinIcon as LocationMarkerIcon, EnvelopeIcon as MailIcon, PlusIcon, TrashIcon, Squares2X2Icon as ViewGridIcon} from '@heroicons/react/24/outline';
import {CurrencyDollarIcon, GlobeAltIcon, DocumentTextIcon, ArrowPathIcon as RefreshIcon} from '@heroicons/react/24/solid';
import {RestaurantTable} from '../../lib/settings-store';
import FloorPlan from '../../components/FloorPlan';
import { useTheme } from '@/lib/theme-context';

const AdminSettingsPage: NextPage = () => {
  const router = useRouter();
  const { user, isAuthenticated } = useAuthStore();
  const { isDark } = useTheme();
  const { settings, isLoading: isLoadingSettings, updateSettings, loadSettings } = useSettingsStore();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('general');
  const [formData, setFormData] = useState(settings);
  const [lastUpdateTime, setLastUpdateTime] = useState<string>('');
  
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
        await loadSettings();
        setFormData(settings);
        setLastUpdateTime(new Date().toLocaleString());
        setIsLoading(false);
      } catch (error) {
        console.error('Ошибка при загрузке настроек:', error);
        setIsLoading(false);
      }
    };

    checkAdmin();
  }, [isAuthenticated, user, router, loadSettings]);

  useEffect(() => {
    if (!isLoading) {
      setFormData(settings);
    }
  }, [settings, isLoading]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };
  
  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: checked
    }));
  };
  
  const handleWorkingHoursChange = (day: string, field: string, value: string | boolean) => {
    setFormData(prev => ({
      ...prev,
      working_hours: {
        ...prev.working_hours,
        [day as keyof typeof prev.working_hours]: {
          ...prev.working_hours[day as keyof typeof prev.working_hours],
          [field]: value
        }
      }
    }));
  };
  
  const handleSaveSettings = async () => {
    setIsSaving(true);
    
    try {
      // Сохраняем настройки через стор
      await updateSettings(formData);
      setLastUpdateTime(new Date().toLocaleString());
      
      setIsSaving(false);
      alert('Настройки успешно сохранены!');
    } catch (error) {
      console.error('Ошибка при сохранении настроек:', error);
      setIsSaving(false);
      alert('Настройки сохранены локально, но возникла ошибка при сохранении на сервере.');
    }
  };

  const handleForceRefresh = async () => {
    setIsRefreshing(true);
    
    try {
      // Принудительное обновление настроек с сервера
      const refreshedSettings = await settingsApi.forceRefreshSettings();
      
      if (refreshedSettings) {
        setFormData(refreshedSettings);
        setLastUpdateTime(new Date().toLocaleString());
        alert('Настройки успешно обновлены с сервера!');
      } else {
        alert('Не удалось получить обновленные настройки с сервера.');
      }
    } catch (error) {
      console.error('Ошибка при принудительном обновлении настроек:', error);
      alert('Произошла ошибка при обновлении настроек с сервера.');
    } finally {
      setIsRefreshing(false);
    }
  };
  
  if (isLoading) {
    return (
      <Layout title="Настройки | Админ-панель">
        <div className="container mx-auto px-4 py-8">
          <div className="flex justify-center items-center h-64">
            <div className={`animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 ${isDark ? 'border-primary-400' : 'border-primary'}`}></div>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="Настройки | Админ-панель">
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Link 
              href="/admin" 
              className={`inline-flex items-center px-3 py-2 border ${isDark ? 'border-gray-700 text-primary-400 bg-gray-800 hover:bg-gray-700' : 'border-transparent text-primary bg-white hover:bg-gray-50'} text-sm leading-4 font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary${isDark ? '-400' : ''}`}
            >
              <ArrowLeftIcon className="h-4 w-4 mr-1" />
              Вернуться к панели управления
            </Link>
            <h1 className={`text-3xl font-bold ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>Настройки</h1>
          </div>
          
          <div className="flex items-center gap-4">
            <div className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
              Последнее обновление: {lastUpdateTime}
            </div>
            <button
              onClick={handleForceRefresh}
              disabled={isRefreshing}
              className={`inline-flex items-center px-3 py-2 border ${isDark ? 'border-gray-700 text-gray-300 bg-gray-800 hover:bg-gray-700' : 'border-gray-300 text-gray-700 bg-white hover:bg-gray-50'} shadow-sm text-sm leading-4 font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary${isDark ? '-400' : ''}`}
            >
              {isRefreshing ? (
                <div className={`animate-spin mr-1 h-4 w-4 border-2 ${isDark ? 'border-gray-500 border-t-gray-800' : 'border-gray-500 border-t-white'} rounded-full`}></div>
              ) : (
                <RefreshIcon className="h-4 w-4 mr-1" />
              )}
              Обновить с сервера
            </button>
          </div>
        </div>

        <div className={`${isDark ? 'bg-gray-800 border border-gray-700' : 'bg-white'} rounded-lg shadow-md overflow-hidden`}>
          <div className="flex flex-col md:flex-row">
            {/* Боковая навигация */}
            <div className={`w-full md:w-64 ${isDark ? 'bg-gray-900' : 'bg-gray-50'} p-4`}>
              <div className="sticky top-4">
                <h2 className={`text-lg font-medium mb-4 ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>Категории настроек</h2>
                <nav className="space-y-2">
                  <button
                    onClick={() => setActiveTab('general')}
                    className={`flex items-center w-full px-3 py-2 rounded-md text-sm font-medium ${
                      activeTab === 'general' 
                        ? isDark ? 'bg-primary-500 text-white' : 'bg-primary text-white'
                        : isDark ? 'text-gray-300 hover:bg-gray-800' : 'text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    <CogIcon className="h-5 w-5 mr-2" />
                    Основные настройки
                  </button>
                  <button
                    onClick={() => setActiveTab('hours')}
                    className={`flex items-center w-full px-3 py-2 rounded-md text-sm font-medium ${
                      activeTab === 'hours' 
                        ? isDark ? 'bg-primary-500 text-white' : 'bg-primary text-white'
                        : isDark ? 'text-gray-300 hover:bg-gray-800' : 'text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    <ClockIcon className="h-5 w-5 mr-2" />
                    Часы работы
                  </button>
                  <button
                    onClick={() => setActiveTab('payment')}
                    className={`flex items-center w-full px-3 py-2 rounded-md text-sm font-medium ${
                      activeTab === 'payment' 
                        ? isDark ? 'bg-primary-500 text-white' : 'bg-primary text-white'
                        : isDark ? 'text-gray-300 hover:bg-gray-800' : 'text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    <CurrencyDollarIcon className="h-5 w-5 mr-2" />
                    Оплата
                  </button>
                  <button
                    onClick={() => setActiveTab('notifications')}
                    className={`flex items-center w-full px-3 py-2 rounded-md text-sm font-medium ${
                      activeTab === 'notifications' 
                        ? isDark ? 'bg-primary-500 text-white' : 'bg-primary text-white'
                        : isDark ? 'text-gray-300 hover:bg-gray-800' : 'text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    <MailIcon className="h-5 w-5 mr-2" />
                    Уведомления
                  </button>
                  <button
                    onClick={() => setActiveTab('policies')}
                    className={`flex items-center w-full px-3 py-2 rounded-md text-sm font-medium ${
                      activeTab === 'policies' 
                        ? isDark ? 'bg-primary-500 text-white' : 'bg-primary text-white'
                        : isDark ? 'text-gray-300 hover:bg-gray-800' : 'text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    <DocumentTextIcon className="h-5 w-5 mr-2" />
                    Правовые документы
                  </button>
                  <button
                    onClick={() => setActiveTab('tables')}
                    className={`flex items-center w-full px-3 py-2 rounded-md text-sm font-medium ${
                      activeTab === 'tables' 
                        ? isDark ? 'bg-primary-500 text-white' : 'bg-primary text-white'
                        : isDark ? 'text-gray-300 hover:bg-gray-800' : 'text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    <ViewGridIcon className="h-5 w-5 mr-2" />
                    Столы ресторана
                  </button>
                </nav>
              </div>
            </div>

            {/* Контент настроек */}
            <div className="flex-1 p-6">
              {/* Основные настройки */}
              {activeTab === 'general' && (
                <div className="space-y-6">
                  <h2 className="text-xl font-medium">Основные настройки</h2>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label htmlFor="restaurant_name" className="block text-sm font-medium text-gray-700">
                        Название ресторана
                      </label>
                      <input
                        type="text"
                        id="restaurant_name"
                        name="restaurant_name"
                        value={formData.restaurant_name}
                        onChange={handleInputChange}
                        className="mt-1 focus:ring-primary focus:border-primary block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
                      />
                    </div>

                    <div>
                      <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                        Электронная почта
                      </label>
                      <div className="mt-1 relative rounded-md shadow-sm">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <MailIcon className="h-5 w-5 text-gray-400" />
                        </div>
                        <input
                          type="email"
                          id="email"
                          name="email"
                          value={formData.email}
                          onChange={handleInputChange}
                          className="focus:ring-primary focus:border-primary block w-full pl-10 sm:text-sm border-gray-300 rounded-md"
                        />
                      </div>
                    </div>

                    <div>
                      <label htmlFor="phone" className="block text-sm font-medium text-gray-700">
                        Телефон
                      </label>
                      <div className="mt-1 relative rounded-md shadow-sm">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <PhoneIcon className="h-5 w-5 text-gray-400" />
                        </div>
                        <input
                          type="text"
                          id="phone"
                          name="phone"
                          value={formData.phone}
                          onChange={handleInputChange}
                          className="focus:ring-primary focus:border-primary block w-full pl-10 sm:text-sm border-gray-300 rounded-md"
                        />
                      </div>
                    </div>

                    <div>
                      <label htmlFor="website" className="block text-sm font-medium text-gray-700">
                        Веб-сайт
                      </label>
                      <div className="mt-1 relative rounded-md shadow-sm">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <GlobeAltIcon className="h-5 w-5 text-gray-400" />
                        </div>
                        <input
                          type="url"
                          id="website"
                          name="website"
                          value={formData.website}
                          onChange={handleInputChange}
                          className="focus:ring-primary focus:border-primary block w-full pl-10 sm:text-sm border-gray-300 rounded-md"
                        />
                      </div>
                    </div>

                    <div className="md:col-span-2">
                      <label htmlFor="address" className="block text-sm font-medium text-gray-700">
                        Адрес
                      </label>
                      <div className="mt-1 relative rounded-md shadow-sm">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <LocationMarkerIcon className="h-5 w-5 text-gray-400" />
                        </div>
                        <input
                          type="text"
                          id="address"
                          name="address"
                          value={formData.address}
                          onChange={handleInputChange}
                          className="focus:ring-primary focus:border-primary block w-full pl-10 sm:text-sm border-gray-300 rounded-md"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-3">
                    <div className="flex items-center">
                      <input
                        id="table_reservation_enabled"
                        name="table_reservation_enabled"
                        type="checkbox"
                        checked={formData.table_reservation_enabled}
                        onChange={handleCheckboxChange}
                        className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
                      />
                      <label htmlFor="table_reservation_enabled" className="ml-2 block text-sm text-gray-900">
                        Разрешить бронирование столиков
                      </label>
                    </div>
                  </div>
                </div>
              )}

              {/* Часы работы */}
              {activeTab === 'hours' && (
                <div className="space-y-6">
                  <h2 className="text-xl font-medium">Часы работы</h2>

                  <div className="space-y-4">
                    {[
                      'monday', 'tuesday', 'wednesday', 'thursday', 
                      'friday', 'saturday', 'sunday'
                    ].map(day => {
                      const dayNames: Record<string, string> = {
                        monday: 'Понедельник',
                        tuesday: 'Вторник',
                        wednesday: 'Среда',
                        thursday: 'Четверг',
                        friday: 'Пятница',
                        saturday: 'Суббота',
                        sunday: 'Воскресенье'
                      };
                      const dayName = dayNames[day as keyof typeof dayNames];
                      // Убедимся, что для каждого дня есть данные
                      const hours = formData.working_hours[day as keyof typeof formData.working_hours] || {
                        open: '09:00',
                        close: '22:00',
                        is_closed: false
                      };

                      return (
                        <div key={day} className="flex items-center space-x-4">
                          <div className="w-32 font-medium">{dayName}</div>
                          
                          <div className="flex items-center">
                            <input
                              id={`${day}_closed`}
                              type="checkbox"
                              checked={hours.is_closed}
                              onChange={(e) => handleWorkingHoursChange(day, 'is_closed', e.target.checked)}
                              className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
                            />
                            <label htmlFor={`${day}_closed`} className="ml-2 text-sm text-gray-900">
                              Выходной
                            </label>
                          </div>
                          
                          {!hours.is_closed && (
                            <>
                              <div className="flex items-center">
                                <label htmlFor={`${day}_open`} className="mr-2 text-sm text-gray-700">
                                  Открытие:
                                </label>
                                <input
                                  type="time"
                                  id={`${day}_open`}
                                  value={hours.open}
                                  onChange={(e) => handleWorkingHoursChange(day, 'open', e.target.value)}
                                  className="focus:ring-primary focus:border-primary block shadow-sm sm:text-sm border-gray-300 rounded-md"
                                />
                              </div>
                              
                              <div className="flex items-center">
                                <label htmlFor={`${day}_close`} className="mr-2 text-sm text-gray-700">
                                  Закрытие:
                                </label>
                                <input
                                  type="time"
                                  id={`${day}_close`}
                                  value={hours.close}
                                  onChange={(e) => handleWorkingHoursChange(day, 'close', e.target.value)}
                                  className="focus:ring-primary focus:border-primary block shadow-sm sm:text-sm border-gray-300 rounded-md"
                                />
                              </div>
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Оплата */}
              {activeTab === 'payment' && (
                <div className="space-y-6">
                  <h2 className="text-xl font-medium">Оплата</h2>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label htmlFor="currency" className="block text-sm font-medium text-gray-700">
                        Валюта
                      </label>
                      <select
                        id="currency"
                        name="currency"
                        value={formData.currency}
                        onChange={handleInputChange}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
                      >
                        <option value="KZT">Казахстанский тенге (KZT)</option>
                        <option value="USD">Доллар США (USD)</option>
                        <option value="EUR">Евро (EUR)</option>
                      </select>
                    </div>

                    <div>
                      <label htmlFor="currency_symbol" className="block text-sm font-medium text-gray-700">
                        Символ валюты
                      </label>
                      <input
                        type="text"
                        id="currency_symbol"
                        name="currency_symbol"
                        value={formData.currency_symbol}
                        onChange={handleInputChange}
                        className="mt-1 focus:ring-primary focus:border-primary block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
                      />
                    </div>

                    <div>
                      <label htmlFor="tax_percentage" className="block text-sm font-medium text-gray-700">
                        НДС (%)
                      </label>
                      <input
                        type="number"
                        id="tax_percentage"
                        name="tax_percentage"
                        value={formData.tax_percentage}
                        onChange={handleInputChange}
                        className="mt-1 focus:ring-primary focus:border-primary block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
                      />
                    </div>

                    <div>
                      <label htmlFor="min_order_amount" className="block text-sm font-medium text-gray-700">
                        Минимальная сумма заказа
                      </label>
                      <div className="mt-1 relative rounded-md shadow-sm">
                        <input
                          type="number"
                          id="min_order_amount"
                          name="min_order_amount"
                          value={formData.min_order_amount}
                          onChange={handleInputChange}
                          className="focus:ring-primary focus:border-primary block w-full sm:text-sm border-gray-300 rounded-md"
                        />
                        <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                          <span className="text-gray-500 sm:text-sm">{formData.currency_symbol}</span>
                        </div>
                      </div>
                    </div>

                    <div className="col-span-2">
                      <h3 className="text-lg font-medium mb-4">Способы оплаты</h3>
                      
                      <div className="space-y-2">
                        <div className="flex items-center">
                          <input
                            id="payment_cash"
                            name="payment_cash"
                            type="checkbox"
                            checked={formData.payment_methods?.includes('cash') || false}
                            onChange={(e) => {
                              const methods = formData.payment_methods || [];
                              if (e.target.checked) {
                                if (!methods.includes('cash')) {
                                  setFormData({
                                    ...formData,
                                    payment_methods: [...methods, 'cash']
                                  });
                                }
                              } else {
                                setFormData({
                                  ...formData,
                                  payment_methods: methods.filter(m => m !== 'cash')
                                });
                              }
                            }}
                            className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
                          />
                          <label htmlFor="payment_cash" className="ml-2 block text-sm text-gray-900">
                            Наличные
                          </label>
                        </div>
                        
                        <div className="flex items-center">
                          <input
                            id="payment_card"
                            name="payment_card"
                            type="checkbox"
                            checked={formData.payment_methods?.includes('card') || false}
                            onChange={(e) => {
                              const methods = formData.payment_methods || [];
                              if (e.target.checked) {
                                if (!methods.includes('card')) {
                                  setFormData({
                                    ...formData,
                                    payment_methods: [...methods, 'card']
                                  });
                                }
                              } else {
                                setFormData({
                                  ...formData,
                                  payment_methods: methods.filter(m => m !== 'card')
                                });
                              }
                            }}
                            className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
                          />
                          <label htmlFor="payment_card" className="ml-2 block text-sm text-gray-900">
                            Банковские карты
                          </label>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Уведомления */}
              {activeTab === 'notifications' && (
                <div className="space-y-6">
                  <h2 className="text-xl font-medium">Настройки уведомлений</h2>

                  <div>
                    <h3 className="text-lg font-medium mb-4">Email уведомления (SMTP)</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label htmlFor="smtp_host" className="block text-sm font-medium text-gray-700">
                          SMTP Хост
                        </label>
                        <input
                          type="text"
                          id="smtp_host"
                          name="smtp_host"
                          value={formData.smtp_host}
                          onChange={handleInputChange}
                          className="mt-1 focus:ring-primary focus:border-primary block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
                        />
                      </div>

                      <div>
                        <label htmlFor="smtp_port" className="block text-sm font-medium text-gray-700">
                          SMTP Порт
                        </label>
                        <input
                          type="number"
                          id="smtp_port"
                          name="smtp_port"
                          value={formData.smtp_port}
                          onChange={handleInputChange}
                          className="mt-1 focus:ring-primary focus:border-primary block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
                        />
                      </div>

                      <div>
                        <label htmlFor="smtp_user" className="block text-sm font-medium text-gray-700">
                          SMTP Пользователь
                        </label>
                        <input
                          type="text"
                          id="smtp_user"
                          name="smtp_user"
                          value={formData.smtp_user}
                          onChange={handleInputChange}
                          className="mt-1 focus:ring-primary focus:border-primary block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
                        />
                      </div>

                      <div>
                        <label htmlFor="smtp_password" className="block text-sm font-medium text-gray-700">
                          SMTP Пароль
                        </label>
                        <input
                          type="password"
                          id="smtp_password"
                          name="smtp_password"
                          value={formData.smtp_password}
                          onChange={handleInputChange}
                          className="mt-1 focus:ring-primary focus:border-primary block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
                        />
                      </div>

                      <div>
                        <label htmlFor="smtp_from_email" className="block text-sm font-medium text-gray-700">
                          Email отправителя
                        </label>
                        <input
                          type="email"
                          id="smtp_from_email"
                          name="smtp_from_email"
                          value={formData.smtp_from_email}
                          onChange={handleInputChange}
                          className="mt-1 focus:ring-primary focus:border-primary block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
                        />
                      </div>

                      <div>
                        <label htmlFor="smtp_from_name" className="block text-sm font-medium text-gray-700">
                          Имя отправителя
                        </label>
                        <input
                          type="text"
                          id="smtp_from_name"
                          name="smtp_from_name"
                          value={formData.smtp_from_name}
                          onChange={handleInputChange}
                          className="mt-1 focus:ring-primary focus:border-primary block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-lg font-medium mb-4">SMS уведомления</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label htmlFor="sms_api_key" className="block text-sm font-medium text-gray-700">
                          API Ключ для SMS
                        </label>
                        <input
                          type="password"
                          id="sms_api_key"
                          name="sms_api_key"
                          value={formData.sms_api_key}
                          onChange={handleInputChange}
                          className="mt-1 focus:ring-primary focus:border-primary block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
                        />
                      </div>

                      <div>
                        <label htmlFor="sms_sender" className="block text-sm font-medium text-gray-700">
                          Отправитель SMS
                        </label>
                        <input
                          type="text"
                          id="sms_sender"
                          name="sms_sender"
                          value={formData.sms_sender}
                          onChange={handleInputChange}
                          className="mt-1 focus:ring-primary focus:border-primary block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Правовые документы */}
              {activeTab === 'policies' && (
                <div className="space-y-6">
                  <h2 className="text-xl font-medium">Правовые документы</h2>

                  <div>
                    <label htmlFor="privacy_policy" className="block text-sm font-medium text-gray-700 mb-2">
                      Политика конфиденциальности
                    </label>
                    <textarea
                      id="privacy_policy"
                      name="privacy_policy"
                      rows={6}
                      value={formData.privacy_policy}
                      onChange={handleInputChange}
                      className="mt-1 focus:ring-primary focus:border-primary block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
                    />
                  </div>

                  <div>
                    <label htmlFor="terms_of_service" className="block text-sm font-medium text-gray-700 mb-2">
                      Условия обслуживания
                    </label>
                    <textarea
                      id="terms_of_service"
                      name="terms_of_service"
                      rows={6}
                      value={formData.terms_of_service}
                      onChange={handleInputChange}
                      className="mt-1 focus:ring-primary focus:border-primary block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
                    />
                  </div>
                </div>
              )}

              {/* Управление столами */}
              {activeTab === 'tables' && (
                <div className="space-y-6">
                  <h2 className="text-xl font-medium">Управление столами ресторана</h2>
                  
                  <div className="mb-6">
                    <p className="text-gray-600 mb-4">
                      Здесь вы можете управлять столами вашего ресторана для системы бронирования.
                    </p>
                    
                    <div className="flex space-x-4">
                      <button 
                        onClick={() => {
                          // Добавление нового стола
                          const newTable = {
                            name: `Стол ${(formData.tables || []).length + 1}`,
                            capacity: 4,
                            is_active: true,
                            position_x: 100,
                            position_y: 100,
                            status: 'available' as 'available' | 'reserved' | 'occupied'
                          };
                          
                          setFormData(prev => ({
                            ...prev,
                            tables: [...(prev.tables || []), {
                              ...newTable,
                              id: prev.tables?.length > 0 
                                ? Math.max(...prev.tables.map(t => t.id)) + 1 
                                : 1
                            }]
                          }));
                        }}
                        className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
                      >
                        <PlusIcon className="h-4 w-4 mr-2" />
                        Добавить стол
                      </button>
                      
                      <button 
                        onClick={() => {
                          // Равномерное распределение столов по схеме
                          if (!formData.tables || formData.tables.length === 0) return;
                          
                          const tableCount = formData.tables.length;
                          const newTables = [...formData.tables];
                          
                          // Определяем количество столов по осям
                          const gridSize = Math.ceil(Math.sqrt(tableCount));
                          const stepX = 20; // шаг между столами по горизонтали (в процентах)
                          const stepY = 20; // шаг между столами по вертикали (в процентах)
                          const startX = 15; // отступ слева (в процентах)
                          const startY = 15; // отступ сверху (в процентах)
                          
                          // Распределяем столы по сетке
                          newTables.forEach((table, index) => {
                            const row = Math.floor(index / gridSize);
                            const col = index % gridSize;
                            
                            newTables[index] = {
                              ...table,
                              position_x: startX + col * stepX,
                              position_y: startY + row * stepY
                            };
                          });
                          
                          setFormData({...formData, tables: newTables});
                        }}
                        className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
                      >
                        <ViewGridIcon className="h-4 w-4 mr-2" />
                        Распределить равномерно
                      </button>
                    </div>
                  </div>
                  
                  <div className="bg-white shadow overflow-hidden border-b border-gray-200 sm:rounded-lg">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Название
                          </th>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Вместимость
                          </th>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Статус
                          </th>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Активен
                          </th>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Позиция
                          </th>
                          <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Действия
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {(formData.tables || []).map((table, index) => (
                          <tr key={table.id}>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <input
                                type="text"
                                value={table.name}
                                onChange={(e) => {
                                  const newTables = [...(formData.tables || [])];
                                  newTables[index] = {...table, name: e.target.value};
                                  setFormData({...formData, tables: newTables});
                                }}
                                className="block w-full text-sm border-gray-300 rounded-md shadow-sm focus:ring-primary focus:border-primary"
                              />
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <input
                                type="number"
                                min="1"
                                max="20"
                                value={table.capacity}
                                onChange={(e) => {
                                  const newTables = [...(formData.tables || [])];
                                  newTables[index] = {...table, capacity: parseInt(e.target.value)};
                                  setFormData({...formData, tables: newTables});
                                }}
                                className="block w-24 text-sm border-gray-300 rounded-md shadow-sm focus:ring-primary focus:border-primary"
                              />
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <select
                                value={table.status}
                                onChange={(e) => {
                                  const newTables = [...(formData.tables || [])];
                                  newTables[index] = {
                                    ...table, 
                                    status: e.target.value as 'available' | 'reserved' | 'occupied'
                                  };
                                  setFormData({...formData, tables: newTables});
                                }}
                                className="block w-full text-sm border-gray-300 rounded-md shadow-sm focus:ring-primary focus:border-primary"
                              >
                                <option value="available">Доступен</option>
                                <option value="reserved">Забронирован</option>
                                <option value="occupied">Занят</option>
                              </select>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-center">
                              <input
                                type="checkbox"
                                checked={table.is_active}
                                onChange={(e) => {
                                  const newTables = [...(formData.tables || [])];
                                  newTables[index] = {...table, is_active: e.target.checked};
                                  setFormData({...formData, tables: newTables});
                                }}
                                className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
                              />
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex space-x-2">
                                <div>
                                  <label className="block text-xs text-gray-500">X</label>
                                  <input
                                    type="number"
                                    value={table.position_x}
                                    onChange={(e) => {
                                      const newTables = [...(formData.tables || [])];
                                      newTables[index] = {...table, position_x: parseInt(e.target.value)};
                                      setFormData({...formData, tables: newTables});
                                    }}
                                    className="block w-20 text-sm border-gray-300 rounded-md shadow-sm focus:ring-primary focus:border-primary"
                                  />
                                </div>
                                <div>
                                  <label className="block text-xs text-gray-500">Y</label>
                                  <input
                                    type="number"
                                    value={table.position_y}
                                    onChange={(e) => {
                                      const newTables = [...(formData.tables || [])];
                                      newTables[index] = {...table, position_y: parseInt(e.target.value)};
                                      setFormData({...formData, tables: newTables});
                                    }}
                                    className="block w-20 text-sm border-gray-300 rounded-md shadow-sm focus:ring-primary focus:border-primary"
                                  />
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                              <button
                                onClick={() => {
                                  const newTables = (formData.tables || []).filter(t => t.id !== table.id);
                                  setFormData({...formData, tables: newTables});
                                }}
                                className="text-red-600 hover:text-red-900"
                              >
                                <TrashIcon className="h-5 w-5" />
                              </button>
                            </td>
                          </tr>
                        ))}
                        
                        {(formData.tables || []).length === 0 && (
                          <tr>
                            <td colSpan={6} className="px-6 py-4 whitespace-nowrap text-center text-gray-500">
                              У вас пока нет столов. Добавьте новый стол с помощью кнопки выше.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                  
                  <div className="mt-4">
                    <h3 className="text-lg font-medium mb-4">Предварительный просмотр</h3>
                    <div className="flex justify-center">
                      <FloorPlan 
                        tables={formData.tables || []}
                        height="h-96" 
                        containerClassName="w-full max-w-4xl mx-auto"
                        showBarCounter={true}
                        showLegend={true}
                        showEntrance={true}
                        isPixelPosition={false}
                        tableScaleFactor={0.8}
                        maxWidth={550}
                        maxHeight={350}
                        percentMultiplier={2.5}
                      />
                    </div>
                    <p className="text-sm text-gray-500 mt-2">
                      Примечание: Это схематичный просмотр. В системе бронирования расположение столов может отличаться.
                    </p>
                  </div>
                </div>
              )}

              {/* Кнопка сохранения */}
              <div className="mt-8 flex justify-end">
                <button
                  type="button"
                  onClick={handleSaveSettings}
                  disabled={isSaving}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
                >
                  {isSaving ? (
                    <>
                      <div className="animate-spin mr-2 h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
                      Сохранение...
                    </>
                  ) : 'Сохранить настройки'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default AdminSettingsPage; 