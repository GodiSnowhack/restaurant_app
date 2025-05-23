import { NextPage } from 'next';
import { useState, useEffect, ChangeEvent } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import Layout from '../../components/Layout';
import useAuthStore from '../../lib/auth-store';
import useSettingsStore from '../../lib/settings-store';
import { settingsApi } from '../../lib/api/settings';
import {ArrowLeftIcon, ClockIcon, Cog6ToothIcon as CogIcon, PhoneIcon, MapPinIcon as LocationMarkerIcon, EnvelopeIcon as MailIcon, PlusIcon, TrashIcon, Squares2X2Icon as ViewGridIcon} from '@heroicons/react/24/outline';
import {CurrencyDollarIcon, GlobeAltIcon, DocumentTextIcon, ArrowPathIcon as RefreshIcon} from '@heroicons/react/24/solid';
import { RestaurantTable, RestaurantSettings } from '../../lib/api/types';
import FloorPlan from '../../components/FloorPlan';
import { useTheme } from '@/lib/theme-context';
import { WorkingHours, WorkingHoursItem } from '../../lib/api/types';
import { formatPrice } from '../../utils/priceFormatter';
import { toast } from 'react-hot-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const AdminSettingsPage: NextPage = () => {
  const router = useRouter();
  const { user, isAuthenticated } = useAuthStore();
  const { isDark } = useTheme();
  const { settings, isLoading: isLoadingSettings, updateSettings, loadSettings } = useSettingsStore();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('general');
  const [formData, setFormData] = useState<RestaurantSettings | null>(null);
  const [lastUpdateTime, setLastUpdateTime] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

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

  const handleInputChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        [name]: value
      };
    });
  };
  
  const handleSelectChange = (e: ChangeEvent<HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        [name]: value
      };
    });
  };
  
  const handleCheckboxChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = e.target;
    setFormData((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        [name]: checked
      };
    });
  };
  
  const handleWorkingHoursChange = (day: string, field: string, value: string | boolean) => {
    setFormData((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        working_hours: {
          ...prev.working_hours,
          [day]: {
            ...prev.working_hours[day as keyof WorkingHours],
            [field]: value
          }
        }
      };
    });
  };
  
  const handleSaveSettings = async () => {
    setIsSaving(true);
    
    try {
      if (!formData) {
        throw new Error('Нет данных для сохранения');
      }
      
      await updateSettings(formData);
      setLastUpdateTime(new Date().toLocaleString());
      
      setIsSaving(false);
      toast.success('Настройки успешно сохранены');
    } catch (error) {
      console.error('Ошибка при сохранении настроек:', error);
      setIsSaving(false);
      setError('Ошибка при сохранении настроек');
      toast.error('Ошибка при сохранении настроек');
    }
  };

  const handleForceRefresh = async () => {
    setIsRefreshing(true);
    
    try {
      const refreshedSettings = await settingsApi.getSettings();
      
      if (refreshedSettings) {
        setFormData(refreshedSettings);
        setLastUpdateTime(new Date().toLocaleString());
        toast.success('Настройки успешно обновлены с сервера');
      } else {
        toast.error('Не удалось получить обновленные настройки с сервера');
      }
    } catch (error) {
      console.error('Ошибка при принудительном обновлении настроек:', error);
      toast.error('Произошла ошибка при обновлении настроек с сервера');
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleTableAdd = () => {
    if (!formData) return;

    const newTable: RestaurantTable = {
      id: Math.max(0, ...formData.tables.map(t => t.id)) + 1,
      number: formData.tables.length + 1,
      name: `Стол ${formData.tables.length + 1}`,
      capacity: 2,
      is_active: true,
      position_x: 100,
      position_y: 100,
      status: 'available'
    };

    setFormData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        tables: [...prev.tables, newTable]
      };
    });

    // Автоматически сохраняем изменения
    handleSaveSettings();
  };

  const handleTableChange = (tableId: number, field: keyof RestaurantTable, value: any) => {
    if (!formData) return;

    setFormData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        tables: prev.tables.map(table =>
          table.id === tableId ? { ...table, [field]: value } : table
        )
      };
    });

    // Автоматически сохраняем изменения после небольшой задержки
    const timeoutId = setTimeout(() => {
      handleSaveSettings();
    }, 500);

    return () => clearTimeout(timeoutId);
  };

  const handleTableDelete = (tableId: number) => {
    if (!formData) return;

    setFormData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        tables: prev.tables.filter(table => table.id !== tableId)
      };
    });

    // Автоматически сохраняем изменения
    handleSaveSettings();
  };

  if (isLoading) {
    return (
      <Layout title="Загрузка... | Настройки">
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary-600"></div>
        </div>
      </Layout>
    );
  }

  if (!formData) {
    return (
      <Layout title="Ошибка | Настройки">
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-red-500 text-xl">Ошибка: Настройки не найдены</div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="Настройки ресторана">
      <form onSubmit={handleSaveSettings} className="space-y-6 max-w-7xl mx-auto px-4 py-8">
        {/* Основные настройки */}
        <div className="space-y-4">
          <h2 className="text-2xl font-bold">Основные настройки</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Input
              label="Название ресторана"
              value={formData.restaurant_name}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setFormData(prev => {
                if (!prev) return null;
                return { ...prev, restaurant_name: e.target.value };
              })}
              fullWidth
            />
            <Input
              label="Email"
              type="email"
              value={formData.email}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setFormData(prev => {
                if (!prev) return null;
                return { ...prev, email: e.target.value };
              })}
              fullWidth
            />
            <Input
              label="Телефон"
              value={formData.phone}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setFormData(prev => {
                if (!prev) return null;
                return { ...prev, phone: e.target.value };
              })}
              fullWidth
            />
            <Input
              label="Веб-сайт"
              type="url"
              value={formData.website}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setFormData(prev => {
                if (!prev) return null;
                return { ...prev, website: e.target.value };
              })}
              fullWidth
            />
            <Input
              label="Адрес"
              value={formData.address}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setFormData(prev => {
                if (!prev) return null;
                return { ...prev, address: e.target.value };
              })}
              fullWidth
            />
          </div>
        </div>

        {/* Столы */}
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold">Столы</h2>
            <Button onClick={handleTableAdd} type="button" variant="primary">
              Добавить стол
            </Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {formData.tables.map((table) => (
              <div key={table.id} className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
                <div className="flex justify-between items-start mb-4">
                  <h3 className="text-lg font-semibold">{table.name}</h3>
                  <Button
                    onClick={() => handleTableDelete(table.id)}
                    variant="danger"
                    size="sm"
                    type="button"
                  >
                    Удалить
                  </Button>
                </div>
                <div className="space-y-4">
                  <Input
                    label="Название"
                    value={table.name}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => handleTableChange(table.id, 'name', e.target.value)}
                    fullWidth
                  />
                  <Input
                    label="Вместимость"
                    type="number"
                    value={table.capacity}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => handleTableChange(table.id, 'capacity', parseInt(e.target.value))}
                    fullWidth
                  />
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id={`table-active-${table.id}`}
                      checked={table.is_active}
                      onChange={(e: ChangeEvent<HTMLInputElement>) => handleTableChange(table.id, 'is_active', e.target.checked)}
                      className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                    />
                    <label htmlFor={`table-active-${table.id}`} className="text-sm font-medium text-gray-700 dark:text-gray-200">
                      Активен
                    </label>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Кнопки управления */}
        <div className="flex justify-end space-x-4">
          <Button
            onClick={() => loadSettings()}
            type="button"
            variant="secondary"
            disabled={isSaving}
          >
            Отменить
          </Button>
          <Button type="submit" disabled={isSaving}>
            {isSaving ? 'Сохранение...' : 'Сохранить'}
          </Button>
        </div>

        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-4 mt-6">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800 dark:text-red-200">
                  {error}
                </h3>
              </div>
            </div>
          </div>
        )}
      </form>
    </Layout>
  );
};

export default AdminSettingsPage; 