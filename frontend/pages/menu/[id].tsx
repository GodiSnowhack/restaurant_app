import { useState, useEffect } from 'react';
import { NextPage } from 'next';
import { useRouter } from 'next/router';
import Link from 'next/link';
import Layout from '../../components/Layout';
import { Dish } from '../../types';
import useCartStore from '../../lib/cart-store';
import { menuApi } from '../../lib/api/menu';
import { 
  PlusIcon, 
  MinusIcon, 
  ShoppingCartIcon, 
  ClockIcon, 
  FireIcon,
  ChevronLeftIcon 
} from '@heroicons/react/24/outline';
import { formatPrice } from '../../utils/priceFormatter';
import { getDishImageUrl, handleImageError } from '../../utils/imageHelper';

// Определяем базовые типы
interface AllergenType {
  id: number;
  name: string;
}

interface TagType {
  id: number;
  name: string;
}

// Определяем тип для блюда с расширенными свойствами
interface DishWithDetails extends Omit<Dish, 'allergens'> {
  allergens?: AllergenType[];
  tags?: TagType[];
}

// Определяем тип для ответа API
interface DishResponse extends Dish {
  tags?: any[];
}

const DishDetailPage: NextPage = () => {
  const [dish, setDish] = useState<DishWithDetails | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [comment, setComment] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const router = useRouter();
  const { id } = router.query;
  const { addItem } = useCartStore();

  useEffect(() => {
    const fetchDish = async () => {
      if (!id) return;
      
      try {
        setIsLoading(true);
        const dishData = await menuApi.getDishById(Number(id)) as DishResponse;
        
        if (!dishData) {
          throw new Error('Блюдо не найдено');
        }

        // Преобразуем данные в нужный формат
        const formattedDish: DishWithDetails = {
          id: dishData.id,
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
          weight: dishData.weight,
          cooking_time: dishData.cooking_time,
          cost_price: dishData.cost_price,
          allergens: Array.isArray(dishData.allergens) 
            ? dishData.allergens.map((a: any) => typeof a === 'string' ? { id: 0, name: a } : a)
            : undefined,
          tags: dishData.tags?.map((t: any) => typeof t === 'string' ? { id: 0, name: t } : t)
        };
        
        setDish(formattedDish);
      } catch (error) {
        console.error('Ошибка при загрузке блюда:', error);
        setError('Не удалось загрузить информацию о блюде. Пожалуйста, попробуйте позже.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchDish();
  }, [id]);

  const handleQuantityChange = (value: number) => {
    if (value < 1) return;
    setQuantity(value);
  };

  const handleAddToCart = () => {
    if (!dish) return;
    
    addItem({
      dish_id: dish.id,
      name: dish.name,
      price: dish.price,
      quantity: quantity,
      image_url: dish.image_url,
      comment: comment.trim() || undefined
    });
    
    // Показать уведомление
    alert('Блюдо добавлено в корзину!');
  };

  if (isLoading) {
    return (
      <Layout title="Загрузка...">
        <div className="container mx-auto px-4 py-8">
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
          </div>
        </div>
      </Layout>
    );
  }

  if (error || !dish) {
    return (
      <Layout title="Ошибка">
        <div className="container mx-auto px-4 py-8">
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error || 'Блюдо не найдено'}
          </div>
          <Link 
            href="/menu"
            className="text-primary hover:underline flex items-center"
          >
            <ChevronLeftIcon className="h-5 w-5 mr-1" />
            Вернуться к меню
          </Link>
        </div>
      </Layout>
    );
  }

  return (
    <Layout title={dish.name}>
      <div className="container mx-auto px-4 py-8">
        <Link 
          href="/menu"
          className="text-primary hover:underline flex items-center mb-6"
        >
          <ChevronLeftIcon className="h-5 w-5 mr-1" />
          Вернуться к меню
        </Link>

        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          <div className="md:flex">
            {/* Изображение блюда */}
            <div className="md:w-1/2 h-64 md:h-auto">
              <img
                src={getDishImageUrl(dish.image_url)}
                alt={dish.name}
                className="w-full h-full object-cover"
                onError={handleImageError}
              />
            </div>

            {/* Информация о блюде */}
            <div className="md:w-1/2 p-6">
              <h1 className="text-3xl font-bold mb-2">{dish.name}</h1>
              <p className="text-gray-600 mb-4">{dish.description}</p>
              
              <div className="flex flex-wrap items-center mb-4">
                <div className="flex items-center mr-4 mb-2">
                  <ClockIcon className="h-5 w-5 text-gray-500 mr-1" />
                  <span>{dish.cooking_time} мин</span>
                </div>
                <div className="flex items-center mr-4 mb-2">
                  <FireIcon className="h-5 w-5 text-gray-500 mr-1" />
                  <span>{dish.calories} ккал</span>
                </div>
                {dish.is_vegetarian && (
                  <span className="bg-green-500 text-white text-xs px-2 py-1 rounded-full mb-2">
                    Вегетарианское
                  </span>
                )}
                {dish.is_vegan && (
                  <span className="bg-green-600 text-white text-xs px-2 py-1 rounded-full ml-2 mb-2">
                    Веганское
                  </span>
                )}
              </div>

              {/* Аллергены */}
              {dish.allergens && dish.allergens.length > 0 && (
                <div className="mb-4">
                  <h3 className="font-semibold text-sm mb-2">Аллергены:</h3>
                  <div className="flex flex-wrap">
                    {dish.allergens.map((allergen: AllergenType) => (
                      <span 
                        key={allergen.id} 
                        className="bg-yellow-100 text-yellow-800 text-xs px-2 py-1 rounded mr-2 mb-2"
                      >
                        {allergen.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Теги */}
              {dish.tags && dish.tags.length > 0 && (
                <div className="mb-4">
                  <h3 className="font-semibold text-sm mb-2">Теги:</h3>
                  <div className="flex flex-wrap">
                    {dish.tags.map((tag: TagType) => (
                      <span 
                        key={tag.id} 
                        className="bg-gray-100 text-gray-800 text-xs px-2 py-1 rounded mr-2 mb-2"
                      >
                        {tag.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-6">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-2xl font-bold">{formatPrice(dish.price)}</span>
                  
                  <div className="flex items-center border rounded-md">
                    <button 
                      onClick={() => handleQuantityChange(quantity - 1)}
                      className="px-3 py-1 border-r"
                      disabled={quantity <= 1}
                    >
                      <MinusIcon className="h-4 w-4" />
                    </button>
                    <span className="px-4 py-1">{quantity}</span>
                    <button 
                      onClick={() => handleQuantityChange(quantity + 1)}
                      className="px-3 py-1 border-l"
                    >
                      <PlusIcon className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div className="mb-4">
                  <label htmlFor="comment" className="block text-sm font-medium text-gray-700 mb-1">
                    Комментарий к блюду
                  </label>
                  <textarea
                    id="comment"
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary focus:border-primary"
                    placeholder="Например: без лука, без соли"
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                  />
                </div>

                <button
                  onClick={handleAddToCart}
                  className="w-full bg-primary hover:bg-primary-dark text-white py-3 px-4 rounded-md flex items-center justify-center"
                >
                  <ShoppingCartIcon className="h-5 w-5 mr-2" />
                  Добавить в корзину
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default DishDetailPage; 