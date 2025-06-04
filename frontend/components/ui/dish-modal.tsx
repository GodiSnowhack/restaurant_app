import React from 'react';
import Image from 'next/image';
import { XMarkIcon } from '@heroicons/react/24/solid';
import { useTheme } from '@/lib/theme-context';
import { useSettings } from '@/settings-context';
import { Dish } from '@/types';
import { Spinner } from '@/components/ui/spinner';

interface DishModalProps {
  dish: Dish;
  isOpen: boolean;
  onClose: () => void;
  onAddToCart: (quantity: number) => void;
  isLoading?: boolean;
  error?: string | null;
}

const DishModal: React.FC<DishModalProps> = ({
  dish,
  isOpen,
  onClose,
  onAddToCart,
  isLoading = false,
  error = null
}) => {
  const { isDark } = useTheme();
  const { settings } = useSettings();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Затемнение фона */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Модальное окно */}
      <div className={`
        relative w-full max-w-2xl rounded-xl overflow-hidden shadow-2xl
        ${isDark ? 'bg-gray-800 text-gray-100' : 'bg-white text-gray-900'}
      `}>
        {/* Кнопка закрытия */}
        <button
          onClick={onClose}
          className={`
            absolute top-4 right-4 z-10 p-2 rounded-full
            ${isDark 
              ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' 
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }
          `}
        >
          <XMarkIcon className="h-6 w-6" />
        </button>

        {isLoading ? (
          <div className="h-96 flex items-center justify-center">
            <Spinner size="lg" />
          </div>
        ) : error ? (
          <div className="h-96 flex items-center justify-center">
            <div className="text-center">
              <p className={`text-lg mb-4 ${isDark ? 'text-red-400' : 'text-red-600'}`}>
                {error}
              </p>
              <button
                onClick={onClose}
                className={`
                  px-4 py-2 rounded-md text-sm font-medium
                  ${isDark 
                    ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' 
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }
                `}
              >
                Закрыть
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Изображение блюда */}
            <div className="relative h-64 w-full">
              <Image
                src={dish.image_url || '/images/dishes/default.jpg'}
                alt={dish.name}
                fill
                priority
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                style={{ objectFit: 'cover' }}
              />
              {!dish.is_available && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                  <span className="text-white font-medium px-4 py-2 bg-red-500 rounded-full text-lg">
                    Временно недоступно
                  </span>
                </div>
              )}
            </div>

            {/* Информация о блюде */}
            <div className="p-6">
              <h2 className="text-2xl font-bold mb-4 dark:text-white">{dish.name}</h2>
              
              {dish.description && (
                <p className="text-gray-600 dark:text-white text-sm mb-4">{dish.description}</p>
              )}

              {/* Характеристики блюда */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                {dish.calories && (
                  <div>
                    <span className={`
                      block text-sm font-medium
                      ${isDark ? 'text-gray-400' : 'text-gray-500'}
                    `}>
                      Калории
                    </span>
                    <span className="text-lg">{dish.calories} ккал</span>
                  </div>
                )}
                
                {dish.cooking_time && (
                  <div>
                    <span className={`
                      block text-sm font-medium
                      ${isDark ? 'text-gray-400' : 'text-gray-500'}
                    `}>
                      Время приготовления
                    </span>
                    <span className="text-lg">{dish.cooking_time} мин</span>
                  </div>
                )}
              </div>

              {/* Диетические метки */}
              <div className="flex gap-2 mb-6">
                {dish.is_vegetarian && (
                  <span className={`
                    px-3 py-1 rounded-full text-sm
                    ${isDark 
                      ? 'bg-green-900/30 text-green-400' 
                      : 'bg-green-100 text-green-800'
                    }
                  `}>
                    🌱 Вегетарианское
                  </span>
                )}
                {dish.is_vegan && (
                  <span className={`
                    px-3 py-1 rounded-full text-sm
                    ${isDark 
                      ? 'bg-green-900/30 text-green-400' 
                      : 'bg-green-100 text-green-800'
                    }
                  `}>
                    🥬 Веганское
                  </span>
                )}
              </div>

              {/* Цена и кнопка добавления в корзину */}
              <div className="flex items-center justify-between mt-6">
                <span className={`
                  text-2xl font-bold
                  ${isDark ? 'text-primary-400' : 'text-primary'}
                `}>
                  {typeof dish.price === 'number' ? dish.price.toLocaleString() : dish.price} {settings?.currency_symbol || '₸'}
                </span>
                <button
                  onClick={() => {
                    if (dish.is_available) {
                      onAddToCart(1);
                      onClose();
                    }
                  }}
                  disabled={!dish.is_available}
                  className={`
                    px-6 py-2 rounded-lg text-white font-medium
                    transition-all duration-200
                    ${!dish.is_available 
                      ? 'bg-gray-400 cursor-not-allowed'
                      : isDark 
                        ? 'bg-primary hover:bg-primary-hover hover:shadow-lg hover:shadow-primary/30' 
                        : 'bg-primary hover:bg-primary-hover'
                    }
                  `}
                >
                  {dish.is_available ? 'Добавить в корзину' : 'Временно недоступно'}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default DishModal; 