'use client';

import React from 'react';
import Image from 'next/image';
import { PlusIcon, MinusIcon } from '@heroicons/react/24/solid';
import { useTheme } from '@/lib/theme-context';
import { useSettings } from '@/settings-context';
import { CartItem } from '@/types';

interface DishCardProps {
  id: number;
  name: string;
  description: string;
  price: number;
  image_url?: string;
  is_vegetarian?: boolean;
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
  cartItem,
  onAddToCart,
  onRemoveFromCart
}) => {
  const { isDark } = useTheme();
  const { settings } = useSettings();

  return (
    <div className={`
      rounded-lg overflow-hidden transition-all duration-300
      ${isDark 
        ? 'bg-gray-800 shadow-lg hover:shadow-xl hover:shadow-primary/20 border border-gray-700' 
        : 'bg-white shadow-md hover:shadow-lg'
      }
    `}>
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
        <div className="flex justify-between items-center mt-auto">
          <span className={`
            font-bold whitespace-nowrap
            ${isDark ? 'text-primary-400' : 'text-primary'}
          `}>
            {typeof price === 'number' ? price.toLocaleString() : price} {settings?.currency_symbol || '₸'}
          </span>
          {cartItem ? (
            <div className="flex items-center space-x-2">
              <button
                onClick={onRemoveFromCart}
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
                onClick={() => onAddToCart(1)}
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
              onClick={() => onAddToCart(1)}
              className={`
                px-3 py-1.5 rounded-md text-sm whitespace-nowrap
                transition-all duration-200
                ${isDark 
                  ? 'bg-primary text-white hover:bg-primary-hover hover:shadow-lg hover:shadow-primary/30' 
                  : 'bg-primary text-white hover:bg-primary-hover'
                }
              `}
            >
              Добавить
            </button>
          )}
        </div>
        {is_vegetarian && (
          <span 
            className="text-green-500 dark:text-green-400 text-sm mt-1 inline-block" 
            title="Вегетарианское блюдо"
          >
            🌱
          </span>
        )}
      </div>
    </div>
  );
};

export default DishCard; 