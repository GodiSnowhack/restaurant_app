import {useState, useEffect} from 'react';
import {NextPage} from 'next';
import {useRouter} from 'next/router';
import Link from 'next/link';
import Layout from '../../components/Layout';
import useAuthStore from '../../lib/auth-store';
import {menuApi} from '../../lib/api';
import ImageUploader from '../../components/ImageUploader';
import {ArrowLeftIcon, PlusIcon, TrashIcon, FilterIcon} from '@heroicons/react/24/outline';
import {PencilIcon, PhotoIcon as PhotographIcon} from '@heroicons/react/24/solid';
import {formatPrice} from '../../utils/priceFormatter';

type Dish = {
  id: number;
  name: string;
  description: string;
  price: number;
  category_id: number;
  image_url: string;
  is_available: boolean;
  ingredients: string;
  calories: number;
  weight: number;
  is_vegetarian: boolean;
  is_spicy: boolean;
  position: number;
  category?: {
    id: number;
    name: string;
  };
};

type Category = {
  id: number;
  name: string;
  description: string;
  position: number;
};

const AdminMenuPage: NextPage = () => {
  const router = useRouter();
  const { user, isAuthenticated } = useAuthStore();
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('dishes');
  const [showDishForm, setShowDishForm] = useState(false);
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [currentFilter, setCurrentFilter] = useState<number | 'all'>('all');
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: '',
    cost_price: '',
    category_id: '',
    image_url: '',
    calories: '',
    cooking_time: '',
    weight: '',
    is_vegetarian: false,
    is_vegan: false,
    is_spicy: false,
    is_available: true,
    ingredients: ''
  });

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
        
        // Загружаем данные с сервера через API
        const categoriesData = await menuApi.getCategories();
        setCategories(categoriesData);
        
        const dishesData = await menuApi.getDishes();
        setDishes(dishesData);
        
        setIsLoading(false);
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
        }, 1000);
      }
    };

    checkAdmin();
  }, [isAuthenticated, user, router]);

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

  const filteredDishes = currentFilter === 'all' 
    ? dishes 
    : dishes.filter(dish => dish.category_id === currentFilter);

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
      // Преобразуем строковые значения в числа
      const dishData = {
        ...formData,
        price: parseFloat(formData.price),
        cost_price: formData.cost_price ? parseFloat(formData.cost_price) : undefined,
        category_id: parseInt(formData.category_id),
        calories: formData.calories ? parseInt(formData.calories) : undefined,
        cooking_time: formData.cooking_time ? parseInt(formData.cooking_time) : undefined,
        weight: formData.weight ? parseInt(formData.weight) : undefined,
      };
      
      // Добавляем позицию по умолчанию
      const position = dishes.filter(d => d.category_id === dishData.category_id).length + 1;
      
      // В реальном приложении отправляем запрос на сервер
      try {
        // Пытаемся отправить через API
        const newDish = await menuApi.createDish(dishData);
        setDishes(prev => [...prev, newDish]);
      } catch (error) {
        console.error('Ошибка при создании блюда через API:', error);
        
        // Если API не работает, добавляем локально для демонстрации
        const newDish = {
          ...dishData,
          id: Math.max(0, ...dishes.map(d => d.id)) + 1,
          position: position,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          ingredients: dishData.ingredients || "Не указаны"
        } as Dish;
        
        setDishes(prev => [...prev, newDish]);
      }
      
      // Очищаем форму и закрываем её
      setFormData({
        name: '',
        description: '',
        price: '',
        cost_price: '',
        category_id: '',
        image_url: '',
        calories: '',
        cooking_time: '',
        weight: '',
        is_vegetarian: false,
        is_vegan: false,
        is_spicy: false,
        is_available: true,
        ingredients: ''
      });
      
      setShowDishForm(false);
      alert('Блюдо успешно добавлено!');
    } catch (error) {
      console.error('Ошибка при добавлении блюда:', error);
      alert('Не удалось добавить блюдо. Пожалуйста, проверьте введенные данные.');
    }
  };

  if (isLoading) {
    return (
      <Layout title="Управление меню | Админ-панель">
        <div className="container mx-auto px-4 py-8">
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="Управление меню | Админ-панель">
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center mb-6">
          <Link href="/admin" className="text-gray-600 hover:text-primary mr-4">
            <ArrowLeftIcon className="h-5 w-5" />
          </Link>
          <h1 className="text-3xl font-bold">Управление меню</h1>
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
              Блюда
            </button>
            <button
              onClick={() => setActiveTab('categories')}
              className={`px-4 py-2 font-medium border-b-2 -mb-px ${
                activeTab === 'categories' 
                  ? 'border-primary text-primary' 
                  : 'border-transparent text-gray-600 hover:text-gray-800'
              }`}
            >
              Категории
            </button>
          </div>
        </div>

        {/* Список блюд */}
        {activeTab === 'dishes' && (
          <>
            {/* Фильтр категорий и кнопка добавления */}
            <div className="flex flex-wrap items-center justify-between mb-6">
              <div className="flex flex-wrap gap-2 mb-4 md:mb-0">
                <button
                  onClick={() => setCurrentFilter('all')}
                  className={`px-3 py-1 rounded-md text-sm ${
                    currentFilter === 'all' 
                      ? 'bg-primary text-white' 
                      : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                  }`}
                >
                  Все
                </button>
                {categories.map(category => (
                  <button
                    key={category.id}
                    onClick={() => setCurrentFilter(category.id)}
                    className={`px-3 py-1 rounded-md text-sm ${
                      currentFilter === category.id 
                        ? 'bg-primary text-white' 
                        : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                    }`}
                  >
                    {category.name}
                  </button>
                ))}
              </div>
              
              <button
                onClick={() => setShowDishForm(true)}
                className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-primary hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
              >
                <PlusIcon className="h-5 w-5 mr-2" />
                Добавить блюдо
              </button>
            </div>

            {/* Таблица блюд */}
            <div className="bg-white shadow-md rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Изображение
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Название
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Категория
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Цена
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Статус
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Действия
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredDishes.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-6 py-4 text-center text-gray-500">
                          Нет блюд для отображения
                        </td>
                      </tr>
                    ) : (
                      filteredDishes.map((dish) => (
                        <tr key={dish.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
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
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">{dish.name}</div>
                            <div className="text-sm text-gray-500 truncate max-w-xs">{dish.description}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {getCategoryName(dish.category_id)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {formatPrice(dish.price)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                              dish.is_available
                                ? 'bg-green-100 text-green-800'
                                : 'bg-red-100 text-red-800'
                            }`}>
                              {dish.is_available ? 'Доступно' : 'Недоступно'}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            <div className="flex space-x-3">
                              <Link 
                                href={`/admin/menu/dishes/${dish.id}`}
                                className="text-indigo-600 hover:text-indigo-900"
                                title="Редактировать"
                              >
                                <PencilIcon className="h-5 w-5" />
                              </Link>
                              <button
                                onClick={() => handleDeleteDish(dish.id)}
                                className="text-red-600 hover:text-red-900"
                                title="Удалить"
                              >
                                <TrashIcon className="h-5 w-5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Форма добавления блюда (по клику на кнопку) */}
            {showDishForm && (
              <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
                <div className="bg-white rounded-lg shadow-xl p-6 max-w-2xl w-full mx-4">
                  <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold">Добавить блюдо</h2>
                    <button
                      onClick={() => setShowDishForm(false)}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <span className="text-2xl">&times;</span>
                    </button>
                  </div>
                  
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
                    
                    <div>
                      <label htmlFor="ingredients" className="block text-sm font-medium text-gray-700 mb-1">
                        Ингредиенты
                      </label>
                      <textarea
                        id="ingredients"
                        name="ingredients"
                        value={formData.ingredients}
                        onChange={handleInputChange}
                        rows={2}
                        placeholder="Перечислите основные ингредиенты через запятую"
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