'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { PlusIcon, MinusIcon } from '@heroicons/react/24/solid';
import { useTheme } from '@/lib/theme-context';
import { useSettings } from '@/settings-context';
import type { CartItem, Dish } from '@/types';
import DishModal from './dish-modal';
import { menuApi } from '@/lib/api/menu';

interface DishCardProps extends Dish {
  cartItem?: CartItem;
  onAddToCart: (quantity: number) => void;
  onRemoveFromCart: () => void;
}

export const DishCard: React.FC<DishCardProps> = ({
  id,
  name,
  description,
  price,
  image_url,
  is_vegetarian,
  is_vegan,
  calories,
  cooking_time,
  category_id,
  is_available,
  cartItem,
  onAddToCart,
  onRemoveFromCart,
}) => {
  const { isDark } = useTheme();
  const { settings } = useSettings();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [detailedDish, setDetailedDish] = useState<Dish | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCardClick = async (e: React.MouseEvent) => {
    if (
      e.target instanceof HTMLElement && 
      (e.target.closest('button') || e.target.closest('.cart-controls'))
    ) {
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      const response = await menuApi.getDishById(id);
      
      if (!response) {
        throw new Error('Не удалось получить данные о блюде');
      }

      const formattedDish: Dish = {
        id: response.id,
        name: response.name,
        description: response.description || '',
        price: response.price,
        image_url: response.image_url || null,
        is_available: response.is_available ?? true,
        category_id: response.category_id || 0,
        is_vegetarian: response.is_vegetarian ?? false,
        is_vegan: response.is_vegan ?? false,
        calories: response.calories ?? null,
        cooking_time: response.cooking_time ?? null
      };
      
      setDetailedDish(formattedDish);
      setIsModalOpen(true);
    } catch (error) {
      console.error('Ошибка при загрузке информации о блюде:', error);
      setError('Не удалось загрузить информацию о блюде');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <div 
        onClick={handleCardClick}
        className={`
          rounded-lg overflow-hidden transition-all duration-300 cursor-pointer
          ${isDark 
            ? 'bg-gray-800 shadow-lg hover:shadow-xl hover:shadow-primary/20 border border-gray-700' 
            : 'bg-white shadow-md hover:shadow-lg'
          }
        `}
      >
        <div className="relative h-48 w-full overflow-hidden">
          <Image
            src={image_url || '/images/dishes/default.jpg'}
            alt={name}
            fill
            priority
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            style={{ objectFit: 'cover' }}
            className="transition-transform duration-300 hover:scale-105"
          />
          {!is_available && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
              <span className="text-white font-medium px-3 py-1 bg-red-500 rounded-full">
                Недоступно
              </span>
            </div>
          )}
        </div>
        <div className="p-4 flex flex-col h-[150px]">
          <h3 className={`
            text-lg font-semibold mb-2 truncate
            ${isDark ? 'text-gray-100' : 'text-gray-900'}
          `}>
            {name}
          </h3>
          <p className={`
            text-sm mb-2 line-clamp-2 flex-grow
            ${isDark ? 'text-gray-400' : 'text-gray-600'}
          `}>
            {description}
          </p>
          <div className="flex flex-wrap gap-2 mb-2">
            {is_vegetarian && (
              <span 
                className="text-green-500 dark:text-green-400 text-sm inline-flex items-center" 
                title="Вегетарианское блюдо"
              >
                🌱
              </span>
            )}
            {is_vegan && (
              <span 
                className="text-green-500 dark:text-green-400 text-sm inline-flex items-center" 
                title="Веганское блюдо"
              >
                🥬
              </span>
            )}
            {calories !== null && calories !== undefined && (
              <span 
                className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}
                title="Калории"
              >
                {calories} ккал
              </span>
            )}
            {cooking_time !== null && cooking_time !== undefined && (
              <span 
                className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}
                title="Время приготовления"
              >
                ⏱️ {cooking_time} мин
              </span>
            )}
          </div>
          <div className="flex justify-between items-center mt-auto">
            <span className={`
              font-bold whitespace-nowrap
              ${isDark ? 'text-primary-400' : 'text-primary'}
            `}>
              {typeof price === 'number' ? price.toLocaleString() : price} {settings?.currency_symbol || '₸'}
            </span>
            <div className="cart-controls">
              {cartItem ? (
                <div className="flex items-center space-x-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemoveFromCart();
                    }}
                    className={`
                      p-1 rounded-full transition-all duration-200
                      ${isDark 
                        ? 'bg-gray-700 hover:bg-gray-600 text-gray-300 hover:text-white hover:shadow-lg hover:shadow-primary/20' 
                        : 'bg-gray-100 hover:bg-gray-200 text-gray-600'
                      }
                    `}
                  >
                    <MinusIcon className="h-4 w-4" />
                  </button>
                  <span className={`
                    font-medium min-w-[20px] text-center
                    ${isDark ? 'text-gray-300' : 'text-gray-900'}
                  `}>
                    {cartItem.quantity}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onAddToCart(1);
                    }}
                    className={`
                      p-1 rounded-full transition-all duration-200
                      ${isDark 
                        ? 'bg-gray-700 hover:bg-gray-600 text-gray-300 hover:text-white hover:shadow-lg hover:shadow-primary/20' 
                        : 'bg-gray-100 hover:bg-gray-200 text-gray-600'
                      }
                    `}
                  >
                    <PlusIcon className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (is_available) {
                      onAddToCart(1);
                    }
                  }}
                  disabled={!is_available}
                  className={`
                    px-3 py-1.5 rounded-md text-sm whitespace-nowrap
                    transition-all duration-200
                    ${!is_available 
                      ? 'bg-gray-400 cursor-not-allowed'
                      : isDark 
                        ? 'bg-primary text-white hover:bg-primary-hover hover:shadow-lg hover:shadow-primary/30' 
                        : 'bg-primary text-white hover:bg-primary-hover'
                    }
                  `}
                >
                  {is_available ? 'Добавить' : 'Недоступно'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <DishModal
        dish={detailedDish || {
          id,
          name,
          description: description || '',
          price,
          image_url: image_url || null,
          is_available,
          category_id,
          is_vegetarian,
          is_vegan,
          calories: calories ?? null,
          cooking_time: cooking_time ?? null
        }}
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setDetailedDish(null);
        }}
        onAddToCart={onAddToCart}
        isLoading={isLoading}
        error={error}
      />
    </>
  );
};

export default DishCard;