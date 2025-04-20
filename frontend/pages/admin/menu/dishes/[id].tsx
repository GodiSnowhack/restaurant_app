import {useState, useEffect} from 'react';
import {NextPage} from 'next';
import {useRouter} from 'next/router';
import Link from 'next/link';
import Layout from '../../../../components/Layout';
import useAuthStore from '../../../../lib/auth-store';
import {menuApi} from '../../../../lib/api';
import ImageUploader from '../../../../components/ImageUploader';
import {ArrowLeftIcon, CheckIcon as SaveIcon} from '@heroicons/react/24/outline';

const EditDishPage: NextPage = () => {
  const router = useRouter();
  const { id } = router.query;
  const { user, isAuthenticated } = useAuthStore();
  const [categories, setCategories] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: '',
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
    };

    checkAdmin();
  }, [isAuthenticated, user, router]);

  useEffect(() => {
    const fetchData = async () => {
      if (!id || typeof id !== 'string') return;

      try {
        setIsLoading(true);
        setError(null);
        
        // Загружаем категории
        const categoriesData = await menuApi.getCategories();
        setCategories(categoriesData);
        
        // Загружаем данные блюда
        const dishData = await menuApi.getDishById(parseInt(id));
        
        // Преобразуем числовые значения в строки для полей формы
        setFormData({
          name: dishData.name,
          description: dishData.description || '',
          price: dishData.price.toString(),
          category_id: dishData.category_id.toString(),
          image_url: dishData.image_url || '',
          calories: dishData.calories ? dishData.calories.toString() : '',
          cooking_time: dishData.cooking_time ? dishData.cooking_time.toString() : '',
          weight: dishData.weight ? dishData.weight.toString() : '',
          is_vegetarian: dishData.is_vegetarian || false,
          is_vegan: dishData.is_vegan || false,
          is_spicy: dishData.is_spicy || false,
          is_available: dishData.is_available !== false, // по умолчанию true
          ingredients: dishData.ingredients || ''
        });
        
        setIsLoading(false);
      } catch (error) {
        console.error('Ошибка при загрузке данных:', error);
        setError('Не удалось загрузить данные блюда. Пожалуйста, попробуйте позже.');
        setIsLoading(false);
      }
    };

    fetchData();
  }, [id, router]);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!id || typeof id !== 'string') return;
    
    try {
      setIsSaving(true);
      setError(null);
      
      // Преобразуем строковые значения в числа
      const dishData = {
        ...formData,
        price: parseFloat(formData.price),
        category_id: parseInt(formData.category_id),
        calories: formData.calories ? parseInt(formData.calories) : undefined,
        cooking_time: formData.cooking_time ? parseInt(formData.cooking_time) : undefined,
        weight: formData.weight ? parseInt(formData.weight) : undefined,
      };
      
      // Отправляем запрос на обновление блюда
      await menuApi.updateDish(parseInt(id), dishData);
      
      // Перенаправляем на страницу управления меню
      router.push('/admin/menu');
    } catch (error) {
      console.error('Ошибка при обновлении блюда:', error);
      setError('Не удалось обновить блюдо. Пожалуйста, проверьте введенные данные.');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <Layout title="Редактирование блюда | Админ-панель">
        <div className="container mx-auto px-4 py-8">
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="Редактирование блюда | Админ-панель">
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center mb-6">
          <Link href="/admin/menu" className="text-gray-600 hover:text-primary mr-4">
            <ArrowLeftIcon className="h-5 w-5" />
          </Link>
          <h1 className="text-3xl font-bold">Редактирование блюда</h1>
        </div>
        
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}
        
        <div className="bg-white shadow-md rounded-lg p-6">
          <form onSubmit={handleSubmit}>
            <div className="mb-6">
              <h3 className="text-lg font-medium mb-4">Изображение блюда</h3>
              <ImageUploader 
                initialImage={formData.image_url}
                onImageUpload={handleImageUpload}
                className="mb-4"
                deleteFromServer={true}
              />
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
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
                <label htmlFor="category_id" className="block text-sm font-medium text-gray-700 mb-1">
                  Категория*
                </label>
                <select
                  id="category_id"
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
                  Цена*
                </label>
                <input
                  type="number"
                  id="price"
                  name="price"
                  value={formData.price}
                  onChange={handleInputChange}
                  step="0.01"
                  min="0"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary focus:border-primary"
                  required
                />
              </div>
              
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary focus:border-primary"
                />
              </div>
            </div>
            
            <div className="mb-6">
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
            
            <div className="mb-6">
              <label htmlFor="ingredients" className="block text-sm font-medium text-gray-700 mb-1">
                Ингредиенты
              </label>
              <textarea
                id="ingredients"
                name="ingredients"
                value={formData.ingredients}
                onChange={handleInputChange}
                rows={3}
                placeholder="Введите ингредиенты, по одному на строку"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary focus:border-primary"
              ></textarea>
            </div>
            
            <div className="flex flex-wrap gap-6 mb-6">
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="is_vegetarian"
                  name="is_vegetarian"
                  checked={formData.is_vegetarian}
                  onChange={handleCheckboxChange}
                  className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
                />
                <label htmlFor="is_vegetarian" className="ml-2 block text-sm text-gray-700">
                  Вегетарианское блюдо
                </label>
              </div>
              
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="is_vegan"
                  name="is_vegan"
                  checked={formData.is_vegan}
                  onChange={handleCheckboxChange}
                  className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
                />
                <label htmlFor="is_vegan" className="ml-2 block text-sm text-gray-700">
                  Веганское блюдо
                </label>
              </div>
              
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="is_spicy"
                  name="is_spicy"
                  checked={formData.is_spicy}
                  onChange={handleCheckboxChange}
                  className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
                />
                <label htmlFor="is_spicy" className="ml-2 block text-sm text-gray-700">
                  Острое блюдо
                </label>
              </div>
              
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="is_available"
                  name="is_available"
                  checked={formData.is_available}
                  onChange={handleCheckboxChange}
                  className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
                />
                <label htmlFor="is_available" className="ml-2 block text-sm text-gray-700">
                  Доступно к заказу
                </label>
              </div>
            </div>
            
            <div className="flex justify-end gap-3">
              <Link
                href="/admin/menu"
                className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
              >
                Отмена
              </Link>
              <button
                type="submit"
                disabled={isSaving}
                className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-primary hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50"
              >
                {isSaving ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Сохранение...
                  </>
                ) : (
                  <>
                    Сохранить
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Layout>
  );
};

export default EditDishPage; 