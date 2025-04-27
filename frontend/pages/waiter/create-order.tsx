'use client';

import { useState, useEffect } from 'react';
import { NextPage } from 'next';
import { useRouter } from 'next/router';
import WaiterLayout from '../../components/WaiterLayout';
import useAuthStore from '../../lib/auth-store';
import { menuApi, ordersApi } from '../../lib/api';
import { 
  PlusIcon, 
  MinusIcon, 
  TrashIcon, 
  CheckCircleIcon
} from '@heroicons/react/24/outline';

interface MenuItem {
  id: string;
  name: string;
  price: number;
  description: string;
  image?: string;
  category: string;
}

interface OrderItem {
  id: string;
  quantity: number;
  name: string;
  price: number;
  special_instructions?: string;
}

interface Category {
  id: string;
  name: string;
}

interface MenuResponse {
  items: MenuItem[];
}

const CreateOrderPage: NextPage = () => {
  const router = useRouter();
  const { isAuthenticated, user } = useAuthStore();
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [tableNumber, setTableNumber] = useState<string>('');
  const [customerName, setCustomerName] = useState<string>('');
  const [customerPhone, setCustomerPhone] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<boolean>(false);
  
  // Перенаправляем на страницу входа, если пользователь не авторизован
  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/auth/login?redirect=/waiter/create-order');
    }
  }, [isAuthenticated, router]);
  
  // Загружаем меню при монтировании
  useEffect(() => {
    const fetchMenuItems = async () => {
      try {
        setLoading(true);
        // Получаем меню используя запрос к API
        const menu = await fetch('/api/menu').then(res => res.json()) as MenuResponse;
        setMenuItems(menu.items || []);
        
        // Извлекаем уникальные категории из меню
        const uniqueCategories = Array.from(
          new Set(menu.items.map((item: MenuItem) => item.category))
        ).map((categoryName: string) => ({ 
          id: categoryName,
          name: categoryName 
        }));
        
        setCategories(uniqueCategories);
        setLoading(false);
      } catch (err) {
        console.error('Ошибка при загрузке меню:', err);
        setError('Не удалось загрузить меню. Пожалуйста, попробуйте еще раз.');
        setLoading(false);
      }
    };
    
    if (isAuthenticated) {
      fetchMenuItems();
    }
  }, [isAuthenticated]);
  
  // Фильтруем меню по выбранной категории
  const filteredMenuItems = selectedCategory === 'all'
    ? menuItems
    : menuItems.filter(item => item.category === selectedCategory);
  
  // Добавляем элемент в заказ
  const addItemToOrder = (item: MenuItem) => {
    const existingItem = orderItems.find(orderItem => orderItem.id === item.id);
    
    if (existingItem) {
      // Если элемент уже в заказе, увеличиваем количество
      setOrderItems(orderItems.map(orderItem => 
        orderItem.id === item.id 
          ? { ...orderItem, quantity: orderItem.quantity + 1 } 
          : orderItem
      ));
    } else {
      // Иначе добавляем новый элемент
      setOrderItems([...orderItems, { 
        id: item.id,
        name: item.name,
        price: item.price,
        quantity: 1,
        special_instructions: ''
      }]);
    }
  };
  
  // Увеличиваем количество элемента в заказе
  const incrementItem = (id: string) => {
    setOrderItems(orderItems.map(item => 
      item.id === id 
        ? { ...item, quantity: item.quantity + 1 } 
        : item
    ));
  };
  
  // Уменьшаем количество элемента в заказе
  const decrementItem = (id: string) => {
    setOrderItems(orderItems.map(item => 
      item.id === id && item.quantity > 1
        ? { ...item, quantity: item.quantity - 1 } 
        : item
    ).filter(item => !(item.id === id && item.quantity === 1)));
  };
  
  // Удаляем элемент из заказа
  const removeItem = (id: string) => {
    setOrderItems(orderItems.filter(item => item.id !== id));
  };
  
  // Обновляем специальные инструкции для элемента
  const updateSpecialInstructions = (id: string, instructions: string) => {
    setOrderItems(orderItems.map(item => 
      item.id === id 
        ? { ...item, special_instructions: instructions } 
        : item
    ));
  };
  
  // Рассчитываем общую сумму заказа
  const totalAmount = orderItems.reduce(
    (total, item) => total + (item.price * item.quantity), 
    0
  );
  
  // Отправляем заказ
  const submitOrder = async () => {
    if (orderItems.length === 0) {
      setError('Заказ не может быть пустым');
      return;
    }
    
    if (!tableNumber) {
      setError('Укажите номер стола');
      return;
    }
    
    try {
      setSubmitting(true);
      setError(null);
      
      const orderData = {
        items: orderItems,
        table_number: tableNumber,
        customer_name: customerName,
        customer_phone: customerPhone,
        created_by_waiter: user?.id,
        status: 'pending',
        total_amount: totalAmount
      };
      
      // Создаем новый заказ через API
      await fetch('/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(orderData)
      });
      
      // Сбрасываем форму
      setOrderItems([]);
      setTableNumber('');
      setCustomerName('');
      setCustomerPhone('');
      setSuccess(true);
      
      // Через 3 секунды убираем уведомление об успехе
      setTimeout(() => {
        setSuccess(false);
      }, 3000);
      
    } catch (err) {
      console.error('Ошибка при создании заказа:', err);
      setError('Не удалось создать заказ. Пожалуйста, попробуйте еще раз.');
    } finally {
      setSubmitting(false);
    }
  };
  
  if (!isAuthenticated) {
    return (
      <WaiterLayout title="Загрузка..." activeTab="create-order">
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-primary"></div>
        </div>
      </WaiterLayout>
    );
  }
  
  return (
    <WaiterLayout title="Создать заказ" activeTab="create-order">
      <div className="flex flex-col md:flex-row gap-6">
        {/* Меню (левая часть) */}
        <div className="w-full md:w-2/3">
          {/* Фильтр по категориям */}
          <div className="mb-4 bg-white p-4 rounded-lg shadow">
            <h2 className="text-lg font-semibold mb-2">Категории</h2>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setSelectedCategory('all')}
                className={`px-4 py-2 rounded-full text-sm ${
                  selectedCategory === 'all'
                    ? 'bg-primary text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Все
              </button>
              {categories.map(category => (
                <button
                  key={category.id}
                  onClick={() => setSelectedCategory(category.id)}
                  className={`px-4 py-2 rounded-full text-sm ${
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
          
          {/* Список блюд */}
          {loading ? (
            <div className="flex justify-center items-center h-64">
              <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-primary"></div>
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow">
              <div className="p-4 border-b">
                <h2 className="text-lg font-semibold">Меню</h2>
              </div>
              <div className="divide-y">
                {filteredMenuItems.length > 0 ? (
                  filteredMenuItems.map(item => (
                    <div key={item.id} className="p-4 hover:bg-gray-50 flex justify-between items-center">
                      <div>
                        <h3 className="font-medium">{item.name}</h3>
                        <p className="text-sm text-gray-600">{item.description}</p>
                        <p className="mt-1 font-medium text-primary">{item.price.toFixed(2)} ₽</p>
                      </div>
                      <button
                        onClick={() => addItemToOrder(item)}
                        className="p-2 text-primary hover:bg-primary hover:text-white rounded-full transition-colors"
                      >
                        <PlusIcon className="h-6 w-6" />
                      </button>
                    </div>
                  ))
                ) : (
                  <div className="p-8 text-center text-gray-500">
                    Нет доступных блюд в этой категории
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
        
        {/* Заказ (правая часть) */}
        <div className="w-full md:w-1/3">
          <div className="bg-white rounded-lg shadow">
            <div className="p-4 border-b">
              <h2 className="text-lg font-semibold">Текущий заказ</h2>
            </div>
            
            {/* Данные о столе/клиенте */}
            <div className="p-4 border-b">
              <div className="mb-3">
                <label htmlFor="tableNumber" className="block text-sm font-medium text-gray-700 mb-1">
                  Номер стола *
                </label>
                <input
                  type="text"
                  id="tableNumber"
                  value={tableNumber}
                  onChange={(e) => setTableNumber(e.target.value)}
                  className="w-full p-2 border rounded focus:ring-primary focus:border-primary"
                  placeholder="Например: 5"
                  required
                />
              </div>
              
              <div className="mb-3">
                <label htmlFor="customerName" className="block text-sm font-medium text-gray-700 mb-1">
                  Имя клиента
                </label>
                <input
                  type="text"
                  id="customerName"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full p-2 border rounded focus:ring-primary focus:border-primary"
                  placeholder="Необязательно"
                />
              </div>
              
              <div>
                <label htmlFor="customerPhone" className="block text-sm font-medium text-gray-700 mb-1">
                  Телефон клиента
                </label>
                <input
                  type="tel"
                  id="customerPhone"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  className="w-full p-2 border rounded focus:ring-primary focus:border-primary"
                  placeholder="Необязательно"
                />
              </div>
            </div>
            
            {/* Элементы заказа */}
            <div className="max-h-80 overflow-y-auto">
              {orderItems.length > 0 ? (
                <div className="divide-y">
                  {orderItems.map(item => (
                    <div key={item.id} className="p-4">
                      <div className="flex justify-between items-center mb-2">
                        <span className="font-medium">{item.name}</span>
                        <span className="text-primary font-medium">{(item.price * item.quantity).toFixed(2)} ₽</span>
                      </div>
                      
                      <div className="flex items-center justify-between mt-2">
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => decrementItem(item.id)}
                            className="p-1 rounded-full bg-gray-100 hover:bg-gray-200"
                          >
                            <MinusIcon className="h-4 w-4" />
                          </button>
                          <span>{item.quantity}</span>
                          <button
                            onClick={() => incrementItem(item.id)}
                            className="p-1 rounded-full bg-gray-100 hover:bg-gray-200"
                          >
                            <PlusIcon className="h-4 w-4" />
                          </button>
                        </div>
                        
                        <button
                          onClick={() => removeItem(item.id)}
                          className="p-1 text-red-500 hover:bg-red-50 rounded"
                        >
                          <TrashIcon className="h-5 w-5" />
                        </button>
                      </div>
                      
                      <div className="mt-2">
                        <input
                          type="text"
                          placeholder="Особые пожелания"
                          value={item.special_instructions || ''}
                          onChange={(e) => updateSpecialInstructions(item.id, e.target.value)}
                          className="w-full p-2 text-sm border rounded focus:ring-primary focus:border-primary"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center text-gray-500">
                  Заказ пуст. Добавьте блюда из меню.
                </div>
              )}
            </div>
            
            {/* Итого и кнопка отправки */}
            <div className="p-4 border-t">
              <div className="flex justify-between items-center font-bold mb-4">
                <span>Итого:</span>
                <span className="text-primary">{totalAmount.toFixed(2)} ₽</span>
              </div>
              
              {error && (
                <div className="mb-4 bg-red-50 text-red-700 p-3 rounded border border-red-200">
                  {error}
                </div>
              )}
              
              {success && (
                <div className="mb-4 bg-green-50 text-green-700 p-3 rounded border border-green-200 flex items-center">
                  <CheckCircleIcon className="h-5 w-5 mr-2" />
                  Заказ успешно создан
                </div>
              )}
              
              <button
                onClick={submitOrder}
                disabled={submitting || orderItems.length === 0}
                className={`w-full p-3 rounded text-white ${
                  submitting || orderItems.length === 0
                    ? 'bg-gray-400 cursor-not-allowed'
                    : 'bg-primary hover:bg-primary-dark'
                }`}
              >
                {submitting ? 'Отправка...' : 'Оформить заказ'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </WaiterLayout>
  );
};

export default CreateOrderPage; 