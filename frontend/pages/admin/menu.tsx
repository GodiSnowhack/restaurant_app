import {useState, useEffect} from 'react';
import {NextPage} from 'next';
import {useRouter} from 'next/router';
import Link from 'next/link';
import Layout from '../../components/Layout';
import useAuthStore from '../../lib/auth-store';
import { menuApi } from '../../lib/api/menu';
import type { Dish, Category, CreateDishDTO } from '@/types';
import ImageUploader from '../../components/ImageUploader';
import {ArrowLeftIcon, PlusIcon, TrashIcon, MagnifyingGlassIcon} from '@heroicons/react/24/outline';
import {PencilIcon, PhotoIcon as PhotographIcon} from '@heroicons/react/24/solid';
import {formatPrice} from '../../utils/priceFormatter';
import { useTheme } from '@/lib/theme-context';

const AdminMenuPage: NextPage = () => {
  const router = useRouter();
  const { user, isAuthenticated } = useAuthStore();
  const { isDark } = useTheme();
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('dishes');
  const [showDishForm, setShowDishForm] = useState(false);
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [currentFilter, setCurrentFilter] = useState<number | 'all'>('all');
  const [formData, setFormData] = useState<Partial<CreateDishDTO>>({
    name: '',
    description: '',
    price: 0,
    cost_price: 0,
    category_id: undefined,
    image_url: '',
    calories: 0,
    cooking_time: 0,
    weight: 0,
    is_vegetarian: false,
    is_vegan: false,
    is_spicy: false,
    is_available: true
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);

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
        
        // Сбрасываем localStorage кэш
        localStorage.removeItem('cached_dishes');
        Object.keys(localStorage).forEach(key => {
          if (key.startsWith('cached_dishes_')) {
            localStorage.removeItem(key);
          }
        });
        
        // Загружаем данные с сервера через API
        const categoriesData = await menuApi.getCategories();
        setCategories(categoriesData);
        
        // Загружаем блюда
        const dishesData = await menuApi.getDishes();
        setDishes(dishesData);
        
        setIsLoading(false);
        
        // Проверяем наличие параметра showDishForm в URL
        if (router.query.showDishForm === 'true') {
          setShowDishForm(true);
        }
      } catch (error) {
        console.error('Ошибка при загрузке данных меню:', error);
        setIsLoading(false);
        
        // В случае ошибки API, загружаем только демо-категории, но не блюда
        setTimeout(() => {
          setCategories([
            { id: 1, name: 'Горячие блюда', description: 'Основные блюда нашего ресторана', position: 1 },
            { id: 2, name: 'Салаты', description: 'Свежие и вкусные салаты', position: 2 },
            { id: 3, name: 'Супы', description: 'Горячие супы на любой вкус', position: 3 },
            { id: 4, name: 'Десерты', description: 'Сладкие блюда для завершения трапезы', position: 4 },
            { id: 5, name: 'Напитки', description: 'Безалкогольные и алкогольные напитки', position: 5 }
          ]);
          
          // Не загружаем предустановленные блюда
          setDishes([]);
          setIsLoading(false);
          
          // Проверяем наличие параметра showDishForm в URL даже в случае ошибки
          if (router.query.showDishForm === 'true') {
            setShowDishForm(true);
          }
        }, 1000);
      }
    };

    checkAdmin();
  }, [isAuthenticated, user, router, router.asPath]);

  const handleDeleteDish = async (id: number) => {
    if (window.confirm('Вы уверены, что хотите удалить это блюдо?')) {
      try {
        // Пытаемся удалить через API
        await menuApi.deleteDish(id);
        // Обновляем локальный список блюд
        setDishes(dishes.filter(dish => dish.id !== id));
      } catch (error) {
        console.error('Ошибка при удалении блюда:', error);
        // Даже если API не работает, всё равно обновляем UI для лучшего UX
        setDishes(dishes.filter(dish => dish.id !== id));
      }
    }
  };

  const handleDeleteCategory = (id: number) => {
    // Проверяем, есть ли блюда с этой категорией
    const dishesInCategory = dishes.filter(dish => dish.category_id === id);
    
    if (dishesInCategory.length > 0) {
      alert(`Невозможно удалить категорию. В ней содержится ${dishesInCategory.length} блюд.`);
      return;
    }
    
    if (window.confirm('Вы уверены, что хотите удалить эту категорию?')) {
      // В реальном приложении отправляем запрос на удаление
      // await fetch(`${process.env.NEXT_PUBLIC_API_URL}/categories/${id}`, { method: 'DELETE' });
      setCategories(categories.filter(category => category.id !== id));
    }
  };

  const getCategoryName = (categoryId: number) => {
    const category = categories.find(cat => cat.id === categoryId);
    return category ? category.name : 'Без категории';
  };

  const filteredDishes = searchQuery
    ? dishes.filter(dish => 
        dish.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
        (dish.description && dish.description.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    : dishes;

  const finalFilteredDishes = categoryFilter 
    ? filteredDishes.filter(dish => dish.category_id.toString() === categoryFilter)
    : filteredDishes;

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = e.target;
    setFormData(prev => ({ ...prev, [name]: checked }));
  };

  const handleImageUpload = (imageUrl: string) => {
    setFormData(prev => ({ ...prev, image_url: imageUrl }));
  };

  const handleAddDish = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const dishData: CreateDishDTO = {
        name: formData.name || '',
        description: formData.description || '',
        price: parseFloat(formData.price?.toString() || '0'),
        cost_price: formData.cost_price ? parseFloat(formData.cost_price.toString()) : undefined,
        category_id: formData.category_id ? parseInt(formData.category_id.toString()) : 0,
        image_url: formData.image_url || '',
        calories: parseInt(formData.calories?.toString() || '0'),
        cooking_time: parseInt(formData.cooking_time?.toString() || '0'),
        weight: parseInt(formData.weight?.toString() || '0'),
        is_vegetarian: formData.is_vegetarian ?? false,
        is_vegan: formData.is_vegan ?? false,
        is_spicy: formData.is_spicy ?? false,
        is_available: formData.is_available ?? true
      };
      
      // Добавляем позицию по умолчанию
      const position = dishes.filter(d => d.category_id === dishData.category_id).length + 1;
      dishData.position = position;
      
      try {
        const newDish = await menuApi.createDish(dishData);
        setDishes(prev => [...prev, newDish]);
        setShowDishForm(false);
        setFormData({
          name: '',
          description: '',
          price: 0,
          cost_price: 0,
          category_id: undefined,
          image_url: '',
          calories: 0,
          cooking_time: 0,
          weight: 0,
          is_vegetarian: false,
          is_vegan: false,
          is_spicy: false,
          is_available: true
        });
      } catch (error) {
        console.error('Ошибка при создании блюда через API:', error);
        
        // Если API не работает, добавляем локально для демонстрации
        const newDish: Dish = {
          id: Math.max(0, ...dishes.map(d => d.id)) + 1,
          name: dishData.name,
          description: dishData.description,
          price: dishData.price,
          image_url: dishData.image_url,
          category_id: dishData.category_id,
          is_available: dishData.is_available,
          is_vegetarian: dishData.is_vegetarian,
          is_vegan: dishData.is_vegan,
          is_spicy: dishData.is_spicy,
          calories: dishData.calories,
          cooking_time: dishData.cooking_time,
          weight: dishData.weight,
          position: position,
          formatted_price: formatPrice(dishData.price)
        };
        
        setDishes(prev => [...prev, newDish]);
        setShowDishForm(false);
      }
    } catch (error) {
      console.error('Ошибка при создании блюда:', error);
    }
  };

  if (isLoading) {
    return (
      <Layout title="Управление меню | Админ-панель">
        <div className="container mx-auto px-4 py-8">
          <div className="flex justify-center items-center h-64">
            <div className={`animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 ${isDark ? 'border-primary-400' : 'border-primary'}`}></div>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="Управление меню | Админ-панель">
      <div className="container mx-auto px-4 py-8 dark:bg-gray-900 min-h-screen">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Link 
              href="/admin" 
              className={`inline-flex items-center px-3 py-2 border ${isDark ? 'border-gray-700 text-primary-400 bg-gray-800 hover:bg-gray-700' : 'border-transparent text-primary bg-white hover:bg-gray-50'} text-sm leading-4 font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary${isDark ? '-400' : ''}`}
            >
              <ArrowLeftIcon className="h-4 w-4 mr-1" />
              Вернуться к панели управления
            </Link>
            <h1 className={`text-3xl font-bold ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>Управление меню</h1>
          </div>

          <div className="flex gap-3">
            <Link
              href="/admin/menu/categories"
              className={`inline-flex items-center px-4 py-2 border ${isDark ? 'border-gray-700 bg-gray-800 text-primary-400 hover:bg-gray-700' : 'border-primary bg-white text-primary hover:bg-gray-50'} rounded-md shadow-sm text-sm font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary${isDark ? '-400' : ''}`}
            >
              <PlusIcon className="h-4 w-4 mr-2" />
              Категории
            </Link>
            <Link
              href="/admin/menu/add"
              className={`inline-flex items-center px-4 py-2 ${isDark ? 'bg-primary-500 hover:bg-primary-400 text-white' : 'bg-primary hover:bg-primary-dark text-white'} border border-transparent rounded-md shadow-sm text-sm font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary${isDark ? '-400' : ''}`}
            >
              <PlusIcon className="h-4 w-4 mr-2" />
              Добавить блюдо
            </Link>
          </div>
        </div>

        {/* Поиск и фильтрация */}
        <div className={`${isDark ? 'bg-gray-800 border border-gray-700' : 'bg-white'} rounded-lg shadow-md p-4 mb-8`}>
          <div className="flex flex-col md:flex-row justify-between gap-4">
            {/* Поисковая строка */}
            <div className="relative w-full md:w-1/2">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <MagnifyingGlassIcon className={`h-5 w-5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`} />
              </div>
              <input
                type="text"
                placeholder="Поиск блюд..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={`py-2 pl-10 pr-4 block w-full shadow-sm rounded-md ${isDark 
                  ? 'bg-gray-700 border-gray-600 text-gray-200 placeholder-gray-400 focus:border-primary-400 focus:ring-primary-400' 
                  : 'border-gray-300 focus:ring-primary focus:border-primary'
                }`}
              />
            </div>

            {/* Фильтр категорий */}
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setCategoryFilter(null)}
                className={`px-3 py-2 text-sm font-medium rounded-md ${
                  categoryFilter === null
                    ? isDark ? 'bg-gray-700 text-white' : 'bg-gray-100 text-gray-900'
                    : isDark ? 'text-gray-300 hover:bg-gray-700' : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                Все
              </button>
              {categories.map((category) => (
                <button
                  key={category.id}
                  onClick={() => setCategoryFilter(category.id.toString())}
                  className={`px-3 py-2 text-sm font-medium rounded-md ${
                    categoryFilter === category.id.toString()
                      ? isDark ? 'bg-primary-900/50 text-primary-200' : 'bg-primary-100 text-primary-900'
                      : isDark ? 'text-gray-300 hover:bg-gray-700' : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  {category.name}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Табы */}
        <div className="mb-8">
          <div className="flex border-b">
            <button
              onClick={() => setActiveTab('dishes')}
              className={`px-4 py-2 font-medium border-b-2 -mb-px ${
                activeTab === 'dishes' 
                  ? 'border-primary text-primary' 
                  : 'border-transparent text-gray-600 hover:text-gray-800'
              }`}
            >
              <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">Блюда</h2>
            </button>
            <button
              onClick={() => setActiveTab('categories')}
              className={`px-4 py-2 font-medium border-b-2 -mb-px ${
                activeTab === 'categories' 
                  ? 'border-primary text-primary' 
                  : 'border-transparent text-gray-600 hover:text-gray-800'
              }`}
            >
              <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">Категории</h2>
            </button>
          </div>
        </div>

        {/* Список блюд */}
        {activeTab === 'dishes' && (
          <>
            {/* Таблица блюд */}
            <div className={`${isDark ? 'bg-gray-800 border border-gray-700' : 'bg-white'} rounded-lg shadow-md overflow-hidden`}>
              {finalFilteredDishes.length === 0 ? (
                <div className={`p-12 text-center ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                  <p className="text-lg font-medium mb-2">Блюда не найдены</p>
                  <p className="mb-6">Попробуйте изменить параметры поиска или добавьте новое блюдо</p>
                  <Link
                    href="/admin/menu/add"
                    className={`inline-flex items-center px-4 py-2 ${isDark ? 'bg-primary-500 hover:bg-primary-400 text-white' : 'bg-primary hover:bg-primary-dark text-white'} border border-transparent rounded-md shadow-sm text-sm font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary${isDark ? '-400' : ''}`}
                  >
                    <PlusIcon className="h-4 w-4 mr-2" />
                    Добавить блюдо
                  </Link>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className={`min-w-full divide-y ${isDark ? 'divide-gray-700' : 'divide-gray-200'}`}>
                    <thead className={isDark ? 'bg-gray-900/50' : 'bg-gray-50'}>
                      <tr>
                        <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                          Изображение
                        </th>
                        <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                          Название
                        </th>
                        <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                          Категория
                        </th>
                        <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                          Цена
                        </th>
                        <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                          Статус
                        </th>
                        <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                          Действия
                        </th>
                      </tr>
                    </thead>
                    <tbody className={`${isDark ? 'divide-y divide-gray-700' : 'divide-y divide-gray-200'}`}>
                      {finalFilteredDishes.map((dish) => (
                        <tr key={dish.id} className={
                          dish.is_available 
                          ? isDark ? 'bg-gray-800 hover:bg-gray-700' : 'bg-white hover:bg-gray-50' 
                          : isDark ? 'bg-gray-900/70 text-gray-400' : 'bg-gray-50 text-gray-400'
                        }>
                          <td className={`px-6 py-4 ${isDark ? 'text-gray-200' : 'text-gray-900'}`}>
                            {dish.image_url ? (
                              <img 
                                src={dish.image_url} 
                                alt={dish.name}
                                className="h-12 w-12 object-cover rounded-md" 
                              />
                            ) : (
                              <div className="h-12 w-12 bg-gray-200 rounded-md flex items-center justify-center">
                                <PhotographIcon className="h-6 w-6 text-gray-400" />
                              </div>
                            )}
                          </td>
                          <td className={`px-6 py-4 ${isDark ? 'text-gray-200' : 'text-gray-900'}`}>
                            <div className={`font-medium ${dish.is_available ? (isDark ? 'text-gray-200' : 'text-gray-900') : (isDark ? 'text-gray-400' : 'text-gray-500')}`}>
                              {dish.name}
                            </div>
                            <div className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'} line-clamp-1`}>
                              {dish.description}
                            </div>
                          </td>
                          <td className={`px-6 py-4 ${isDark ? 'text-primary-400' : 'text-primary-700'}`}>
                            {getCategoryName(dish.category_id)}
                          </td>
                          <td className={`px-6 py-4 ${isDark ? 'text-gray-200' : 'text-gray-900'}`}>
                            {formatPrice(dish.price)}
                          </td>
                          <td className="px-6 py-4">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              dish.is_available
                                ? isDark ? 'bg-green-900/30 text-green-200' : 'bg-green-100 text-green-800'
                                : isDark ? 'bg-red-900/30 text-red-200' : 'bg-red-100 text-red-800'
                            }`}>
                              {dish.is_available ? 'Доступно' : 'Недоступно'}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            <div className="flex space-x-3">
                              <Link 
                                href={`/admin/menu/${dish.id}/edit`}
                                className={`text-${isDark ? 'primary-400 hover:text-primary-300' : 'primary-600 hover:text-primary-900'}`}
                              >
                                <PencilIcon className="h-5 w-5" />
                              </Link>
                              <button
                                onClick={() => handleDeleteDish(dish.id)}
                                className={`text-${isDark ? 'red-400 hover:text-red-300' : 'red-600 hover:text-red-900'}`}
                              >
                                <TrashIcon className="h-5 w-5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Форма добавления блюда (по клику на кнопку) */}
            {showDishForm && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 w-full max-w-2xl max-h-[90vh] overflow-y-auto dark:text-white">
                  <h2 className="text-2xl font-bold mb-4 dark:text-white">Создать блюдо</h2>
                  <form className="space-y-4" onSubmit={handleAddDish}>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                          Название блюда*
                        </label>
                        <input
                          type="text"
                          id="name"
                          name="name"
                          value={formData.name}
                          onChange={handleInputChange}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary focus:border-primary"
                          required
                        />
                      </div>
                      
                      <div>
                        <label htmlFor="category" className="block text-sm font-medium text-gray-700 mb-1">
                          Категория*
                        </label>
                        <select
                          id="category"
                          name="category_id"
                          value={formData.category_id}
                          onChange={handleInputChange}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary focus:border-primary"
                          required
                        >
                          <option value="">Выберите категорию</option>
                          {categories.map(cat => (
                            <option key={cat.id} value={cat.id}>{cat.name}</option>
                          ))}
                        </select>
                      </div>
                      
                      <div>
                        <label htmlFor="price" className="block text-sm font-medium text-gray-700 mb-1">
                          Цена (₸)*
                        </label>
                        <input
                          type="number"
                          id="price"
                          name="price"
                          value={formData.price}
                          onChange={handleInputChange}
                          min="0"
                          step="10"
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary focus:border-primary"
                          required
                        />
                      </div>
                      
                      <div>
                        <label htmlFor="cost_price" className="block text-sm font-medium text-gray-700 mb-1">
                          Себестоимость (₸)
                        </label>
                        <input
                          type="number"
                          id="cost_price"
                          name="cost_price"
                          value={formData.cost_price}
                          onChange={handleInputChange}
                          min="0"
                          step="10"
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary focus:border-primary"
                        />
                      </div>
                      
                      <div>
                        <label htmlFor="image_url" className="block text-sm font-medium text-gray-700 mb-1">
                          URL изображения
                        </label>
                        <ImageUploader 
                          initialImage={formData.image_url}
                          onImageUpload={handleImageUpload}
                          className="mb-4"
                          deleteFromServer={true}
                        />
                      </div>
                    </div>
                    
                    <div>
                      <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
                        Описание блюда
                      </label>
                      <textarea
                        id="description"
                        name="description"
                        value={formData.description}
                        onChange={handleInputChange}
                        rows={3}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary focus:border-primary"
                      ></textarea>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label htmlFor="calories" className="block text-sm font-medium text-gray-700 mb-1">
                          Калории (ккал)
                        </label>
                        <input
                          type="number"
                          id="calories"
                          name="calories"
                          value={formData.calories}
                          onChange={handleInputChange}
                          min="0"
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary focus:border-primary"
                        />
                      </div>
                      
                      <div>
                        <label htmlFor="cooking_time" className="block text-sm font-medium text-gray-700 mb-1">
                          Время приготовления (мин)
                        </label>
                        <input
                          type="number"
                          id="cooking_time"
                          name="cooking_time"
                          value={formData.cooking_time}
                          onChange={handleInputChange}
                          min="0"
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary focus:border-primary"
                        />
                      </div>
                      
                      <div>
                        <label htmlFor="weight" className="block text-sm font-medium text-gray-700 mb-1">
                          Вес (г)
                        </label>
                        <input
                          type="number"
                          id="weight"
                          name="weight"
                          value={formData.weight}
                          onChange={handleInputChange}
                          min="0"
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary focus:border-primary"
                        />
                      </div>
                    </div>
                    
                    <div className="flex flex-wrap items-center gap-4">
                      <div className="flex items-center">
                        <input
                          id="is_vegetarian"
                          name="is_vegetarian"
                          type="checkbox"
                          checked={formData.is_vegetarian}
                          onChange={handleCheckboxChange}
                          className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
                        />
                        <label htmlFor="is_vegetarian" className="ml-2 block text-sm text-gray-700">
                          Вегетарианское
                        </label>
                      </div>
                      
                      <div className="flex items-center">
                        <input
                          id="is_vegan"
                          name="is_vegan"
                          type="checkbox"
                          checked={formData.is_vegan}
                          onChange={handleCheckboxChange}
                          className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
                        />
                        <label htmlFor="is_vegan" className="ml-2 block text-sm text-gray-700">
                          Веганское
                        </label>
                      </div>
                      
                      <div className="flex items-center">
                        <input
                          id="is_spicy"
                          name="is_spicy"
                          type="checkbox"
                          checked={formData.is_spicy}
                          onChange={handleCheckboxChange}
                          className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
                        />
                        <label htmlFor="is_spicy" className="ml-2 block text-sm text-gray-700">
                          Острое
                        </label>
                      </div>
                      
                      <div className="flex items-center">
                        <input
                          id="is_available"
                          name="is_available"
                          type="checkbox"
                          checked={formData.is_available}
                          onChange={handleCheckboxChange}
                          className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
                        />
                        <label htmlFor="is_available" className="ml-2 block text-sm text-gray-700">
                          В наличии
                        </label>
                      </div>
                    </div>
                    
                    <div className="mt-6 flex justify-end space-x-3">
                      <button
                        type="button"
                        onClick={() => setShowDishForm(false)}
                        className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none"
                      >
                        Отмена
                      </button>
                      <button
                        type="submit"
                        className="px-4 py-2 border border-transparent rounded-md shadow-sm text-white bg-primary hover:bg-primary-dark focus:outline-none"
                      >
                        Сохранить
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </>
        )}

        {/* Список категорий */}
        {activeTab === 'categories' && (
          <>
            {/* Кнопка добавления категории */}
            <div className="flex justify-end mb-6">
              <button
                onClick={() => setShowCategoryForm(true)}
                className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-primary hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
              >
                <PlusIcon className="h-5 w-5 mr-2" />
                Добавить категорию
              </button>
            </div>

            {/* Таблица категорий */}
            <div className="bg-white shadow-md rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Название
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Описание
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Кол-во блюд
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Позиция
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Действия
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {categories.map((category) => (
                      <tr key={category.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">{category.name}</div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-gray-500 truncate max-w-xs">{category.description}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">
                            {dishes.filter(dish => dish.category_id === category.id).length}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">{category.position}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          <div className="flex space-x-3">
                            <button
                              onClick={() => router.push(`/admin/menu/categories/${category.id}`)}
                              className="text-indigo-600 hover:text-indigo-900"
                              title="Редактировать"
                            >
                              <PencilIcon className="h-5 w-5" />
                            </button>
                            <button
                              onClick={() => handleDeleteCategory(category.id)}
                              className="text-red-600 hover:text-red-900"
                              title="Удалить"
                            >
                              <TrashIcon className="h-5 w-5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Форма добавления категории (по клику на кнопку) */}
            {showCategoryForm && (
              <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
                <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
                  <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold">Добавить категорию</h2>
                    <button
                      onClick={() => setShowCategoryForm(false)}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <span className="text-2xl">&times;</span>
                    </button>
                  </div>
                  <p className="text-gray-600 mb-4">Форма добавления новой категории</p>
                  <div className="mt-4 flex justify-end">
                    <button
                      type="button"
                      onClick={() => setShowCategoryForm(false)}
                      className="inline-flex justify-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none"
                    >
                      Отмена
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </Layout>
  );
};

export default AdminMenuPage; 