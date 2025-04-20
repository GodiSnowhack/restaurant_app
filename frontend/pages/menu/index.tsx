'use client';

import React, { useEffect, useState } from 'react';
import { menuApi } from '@/lib/api';
import { Dish, Category } from '@/types';
import { useRouter } from 'next/router';
import Image from 'next/image';
import useCartStore from '@/lib/cart-store';
import { PlusIcon, MinusIcon } from '@heroicons/react/24/solid';
import { useSettings } from '@/settings-context';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

export default function MenuPage() {
  const router = useRouter();
  const { addItem, removeItem, items } = useCartStore();
  const { settings } = useSettings();
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const maxRetries = 3;

  const loadCategories = async () => {
    try {
      const data = await menuApi.getCategories();
      setCategories(data);
    } catch (err) {
      console.error('Ошибка при загрузке категорий:', err);
      if (retryCount < maxRetries) {
        setTimeout(() => {
          setRetryCount(prev => prev + 1);
          loadCategories();
        }, 2000);
      }
    }
  };

  const loadDishes = async () => {
    try {
      setLoading(true);
      setError(null);
      const params = selectedCategory ? { category_id: selectedCategory } : undefined;
      const data = await menuApi.getDishes(params);
      setDishes(data);
    } catch (err) {
      console.error('Ошибка при загрузке блюд:', err);
      setError('Не удалось загрузить меню. Пожалуйста, попробуйте позже.');
      if (retryCount < maxRetries) {
        setTimeout(() => {
          setRetryCount(prev => prev + 1);
          loadDishes();
        }, 2000);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCategories();
  }, []);

  useEffect(() => {
    loadDishes();
  }, [selectedCategory]);

  const handleCategoryClick = (categoryId: number | null) => {
    setSelectedCategory(categoryId);
  };

  const handleRetry = () => {
    setRetryCount(0);
    loadDishes();
  };

  return (
    <>
      <Header />
      <div className="container mx-auto px-4 py-8">
        {/* Категории */}
        <div className="mb-8 overflow-x-auto">
          <div className="flex space-x-4 pb-4 min-w-max">
            <button
              onClick={() => handleCategoryClick(null)}
              className={`px-4 py-2 rounded-full ${
                selectedCategory === null
                  ? 'bg-primary text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Все блюда
            </button>
            {categories.map((category) => (
              <button
                key={category.id}
                onClick={() => handleCategoryClick(category.id)}
                className={`px-4 py-2 rounded-full ${
                  selectedCategory === category.id
                    ? 'bg-primary text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {category.name}
              </button>
            ))}
          </div>
        </div>

        {/* Сообщение об ошибке */}
        {error && (
          <div className="mb-8 p-4 bg-red-50 text-red-700 rounded-lg">
            <p>{error}</p>
            <button
              onClick={handleRetry}
              className="mt-2 text-sm text-red-700 underline hover:text-red-800"
            >
              Попробовать снова
            </button>
          </div>
        )}

        {/* Индикатор загрузки */}
        {loading && (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          </div>
        )}

        {/* Сетка блюд */}
        {!loading && !error && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {dishes.map((dish) => {
              const cartItem = items.find(item => item.dishId === dish.id);
              return (
                <div
                  key={dish.id}
                  className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow duration-300"
                >
                  <div className="relative h-48 w-full">
                    <Image
                      src={dish.image_url || '/images/dishes/default.jpg'}
                      alt={dish.name}
                      layout="fill"
                      objectFit="cover"
                      className="transition-transform duration-300 hover:scale-105"
                    />
                  </div>
                  <div className="p-4">
                    <h3 className="text-lg font-semibold mb-2">{dish.name}</h3>
                    <p className="text-gray-600 text-sm mb-2">{dish.description}</p>
                    <div className="flex justify-between items-center">
                      <span className="text-primary font-bold">
                        {dish.price} {settings.currency_symbol}
                      </span>
                      <div className="flex items-center space-x-2">
                        {cartItem ? (
                          <>
                            <button
                              onClick={() => removeItem(cartItem.id)}
                              className="p-1 rounded-full bg-gray-100 hover:bg-gray-200"
                            >
                              <MinusIcon className="h-5 w-5 text-gray-600" />
                            </button>
                            <span className="text-gray-900 font-medium">{cartItem.quantity}</span>
                            <button
                              onClick={() => addItem({
                                dishId: dish.id,
                                name: dish.name,
                                price: dish.price,
                                quantity: 1,
                                imageUrl: dish.image_url
                              })}
                              className="p-1 rounded-full bg-gray-100 hover:bg-gray-200"
                            >
                              <PlusIcon className="h-5 w-5 text-gray-600" />
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => addItem({
                              dishId: dish.id,
                              name: dish.name,
                              price: dish.price,
                              quantity: 1,
                              imageUrl: dish.image_url
                            })}
                            className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary-dark"
                          >
                            Добавить
                          </button>
                        )}
                      </div>
                    </div>
                    {dish.is_vegetarian && (
                      <span className="text-green-600 text-sm">🌱</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Сообщение, если блюд нет */}
        {!loading && !error && dishes.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500">В данной категории пока нет блюд</p>
          </div>
        )}
      </div>
      <Footer />
    </>
  );
} 