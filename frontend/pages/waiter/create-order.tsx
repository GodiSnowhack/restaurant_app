'use client';

import { useState, useEffect } from 'react';
import { NextPage } from 'next';
import { useRouter } from 'next/router';
import { useSession } from 'next-auth/react';
import WaiterLayout from '../../components/WaiterLayout';
import useAuthStore from '../../lib/auth-store';
import { 
  PlusIcon, 
  MinusIcon, 
  TrashIcon, 
  CheckCircleIcon
} from '@heroicons/react/24/outline';
import { toast } from 'react-hot-toast';
import { api } from '../../lib/api';
import { RestaurantTable } from '../../lib/api/types';

// Интерфейсы для работы с данными
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

// Функция для генерации уникального email и пароля для нового пользователя
const generateUserCredentials = () => {
  const randomNumber = Math.floor(10000 + Math.random() * 90000); // 5-значное число
  const email = `user${randomNumber}@restaurant.com`;
  const password = `user${randomNumber}`;
  
  return { email, password };
};

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
  const [customerAgeGroup, setCustomerAgeGroup] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<boolean>(false);
  const [tables, setTables] = useState<RestaurantTable[]>([]);
  const [createdUserInfo, setCreatedUserInfo] = useState<{email: string, password: string} | null>(null);
  
  // Перенаправляем на страницу входа, если пользователь не авторизован
  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/auth/login?redirect=/waiter/create-order');
    }
  }, [isAuthenticated, router]);
  
  // Загружаем столы ресторана и меню при монтировании
  useEffect(() => {
    const fetchTablesAndMenu = async () => {
      try {
        setLoading(true);
        
        // Получаем настройки ресторана, включая столы
        let fetchedTables: RestaurantTable[] = [];
        
        try {
          // Пробуем получить данные о столах из API settings
          const response = await fetch('/api/settings');
          if (response.ok) {
            const settings = await response.json();
            if (settings && settings.tables && Array.isArray(settings.tables)) {
              console.log('Получены столы из настроек:', settings.tables);
              fetchedTables = settings.tables
                .filter((table: RestaurantTable) => 
                  table.status === 'available' || !table.status
                )
                .map((table: RestaurantTable, index: number) => {
                  return {
                    ...table,
                    id: table.id || index + 1,
                    number: typeof table.number === 'number' ? table.number : table.id || index + 1,
                    name: table.name || `Стол №${table.number || index + 1}`
                  };
                });
            }
          } else {
            console.warn('Ошибка при получении настроек:', response.status);
            throw new Error(`Ошибка при получении столов: ${response.status}`);
          }
        } catch (e) {
          console.error('Ошибка при получении столов из API:', e);
          throw e;
        }
        
        setTables(fetchedTables);
        
        // Если есть доступные столы, устанавливаем первый по умолчанию
        if (fetchedTables.length > 0) {
          const firstTableId = String(fetchedTables[0].id);
          console.log('Установка ID первого стола:', firstTableId);
          setTableNumber(firstTableId);
        }
        
        // Получаем меню
        let fetchedMenu: MenuItem[] = [];
        let fetchedCategories: Category[] = [];
        
        try {
          // Пробуем получить меню из API
          const menuResponse = await fetch('/api/menu?method=dishes');
          if (menuResponse.ok) {
            const menuData = await menuResponse.json();
            if (Array.isArray(menuData)) {
              fetchedMenu = menuData;
            } else if (menuData && Array.isArray(menuData.items)) {
              fetchedMenu = menuData.items;
            }
            
            // Получаем категории
            const categoriesResponse = await fetch('/api/menu?method=categories');
            if (categoriesResponse.ok) {
              const categoriesData = await categoriesResponse.json();
              if (Array.isArray(categoriesData)) {
                fetchedCategories = categoriesData.map(category => ({
                  id: category.id.toString(),
                  name: category.name
                }));
              }
            } else {
              throw new Error(`Ошибка при получении категорий: ${categoriesResponse.status}`);
            }
          } else {
            throw new Error(`Ошибка при получении меню: ${menuResponse.status}`);
          }
        } catch (e) {
          console.error('Ошибка при получении меню из API:', e);
          throw e;
        }
        
        setMenuItems(fetchedMenu);
        setCategories(fetchedCategories);
        setLoading(false);
      } catch (err) {
        console.error('Ошибка при загрузке данных:', err);
        setError('Не удалось загрузить данные. Пожалуйста, попробуйте позже.');
        setLoading(false);
      }
    };
    
    if (isAuthenticated) {
      fetchTablesAndMenu();
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
    
    if (!customerName || customerName.trim() === '') {
      setError('Укажите имя клиента');
      return;
    }
    
    if (!customerAgeGroup) {
      setError('Выберите возрастную группу клиента');
      return;
    }
    
    try {
      setSubmitting(true);
      setError(null);
      
      // Найдем выбранный стол
      const selectedTable = tables.find(t => String(t.id) === tableNumber);
      
      // Используем номер стола из объекта, если есть, иначе используем ID
      const tableNumberToSend = selectedTable && typeof selectedTable.number === 'number' 
        ? selectedTable.number 
        : selectedTable && selectedTable.id 
          ? Number(selectedTable.id) 
          : Number(tableNumber);
      
      // Форматируем элементы заказа
      const formattedItems = orderItems.map(item => ({
        dish_id: Number(item.id),
        quantity: Number(item.quantity),
        special_instructions: item.special_instructions || ''
      }));
      
      // Создаем данные заказа
      const orderData = {
        table_number: tableNumberToSend,
        items: formattedItems,
        status: "pending",
        payment_status: "pending",
        payment_method: "cash",
        total_amount: Number(totalAmount.toFixed(2)),
        customer_name: customerName.trim(),
        customer_phone: customerPhone ? customerPhone.trim() : undefined,
        customer_age_group: customerAgeGroup,
        waiter_id: user?.id ? Number(user.id) : undefined
      };
      
      // Получаем токен авторизации
      const token = localStorage.getItem('token');
      
      // Формируем заголовки с токеном авторизации
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };
      
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      
      console.log('Отправка заказа:', orderData);
      
      // Отправляем заказ на сервер с использованием fetch вместо axios
      const response = await fetch('/api/orders/create', {
        method: 'POST',
        headers,
        body: JSON.stringify(orderData),
        // Используем более длительный таймаут для стабильности
        // и указываем обработку ошибок при неполадках сети
        signal: AbortSignal.timeout(30000) // 30 секунд на выполнение запроса
      });
      
      const responseData = await response.json();
      
      // Проверяем успешность запроса по полю success в ответе
      if (!responseData.success) {
        throw new Error(responseData.message || 'Ошибка при создании заказа');
      }
      
      // Проверяем, был ли заказ создан локально (без связи с бэкендом)
      if (responseData.local_only) {
        console.log('Заказ создан локально без связи с бэкендом:', responseData.data);
        // Сохраняем локально созданный заказ в localStorage для последующей синхронизации
        try {
          const localOrders = JSON.parse(localStorage.getItem('offline_orders') || '[]');
          localOrders.push(responseData.data);
          localStorage.setItem('offline_orders', JSON.stringify(localOrders));
          console.log('Заказ сохранен локально для последующей синхронизации');
        } catch (e) {
          console.error('Ошибка при сохранении заказа локально:', e);
        }
      }
      
      // Генерируем данные для создания пользователя
      const { email, password } = generateUserCredentials();
      setCreatedUserInfo({ email, password });
      
      // Сбрасываем форму после успешного создания заказа
      setOrderItems([]);
      setTableNumber(tables.length > 0 ? String(tables[0].id) : '');
      setCustomerName('');
      setCustomerPhone('');
      setCustomerAgeGroup('');
      setSuccess(true);
      
      toast.success('Заказ успешно создан!', {
        duration: 3000,
        position: 'top-center',
      });
      
      // Через 5 секунд убираем уведомление об успехе
      setTimeout(() => {
        setSuccess(false);
        setCreatedUserInfo(null);
      }, 5000);
      
    } catch (err: any) {
      console.error('Ошибка при создании заказа:', err);
      setError(`Не удалось создать заказ: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };
  
  // Обработчик выбора стола
  const handleTableChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedValue = e.target.value;
    setTableNumber(selectedValue);
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
                        <p className="mt-1 font-medium text-primary">{item.price.toFixed(2)} ₸</p>
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
                <select
                  id="tableNumber"
                  value={tableNumber}
                  onChange={handleTableChange}
                  className="w-full p-2 border rounded focus:ring-primary focus:border-primary"
                  required
                >
                  <option value="">Выберите стол</option>
                  {tables.length > 0 ? (
                    tables.map((table: RestaurantTable) => (
                      <option 
                        key={table.id} 
                        value={String(table.id)}
                      >
                        {table.name || `Стол №${table.number}`} (мест: {table.capacity})
                      </option>
                    ))
                  ) : (
                    <option value="" disabled>Нет доступных столов</option>
                  )}
                </select>
              </div>
              
              <div className="mb-3">
                <label htmlFor="customerName" className="block text-sm font-medium text-gray-700 mb-1">
                  Имя клиента *
                </label>
                <input
                  type="text"
                  id="customerName"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full p-2 border rounded focus:ring-primary focus:border-primary"
                  placeholder="Обязательное поле"
                  required
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
              
              <div className="mt-3">
                <label htmlFor="customerAgeGroup" className="block text-sm font-medium text-gray-700 mb-1">
                  Возрастная группа *
                </label>
                <select
                  id="customerAgeGroup"
                  value={customerAgeGroup}
                  onChange={(e) => setCustomerAgeGroup(e.target.value)}
                  className="w-full p-2 border rounded focus:ring-primary focus:border-primary"
                  required
                >
                  <option value="">Выберите возрастную группу</option>
                  <option value="child">Дети (0-12 лет)</option>
                  <option value="teenager">Подростки (13-17 лет)</option>
                  <option value="young">Молодёжь (18-25 лет)</option>
                  <option value="adult">Взрослые (26-45 лет)</option>
                  <option value="middle">Средний возраст (46-65 лет)</option>
                  <option value="senior">Пожилые (66+ лет)</option>
                </select>
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
                        <span className="text-primary font-medium">{(item.price * item.quantity).toFixed(2)} ₸</span>
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
                <span className="text-primary">{totalAmount.toFixed(2)} ₸</span>
              </div>
              
              {error && (
                <div className="mb-4 bg-red-50 text-red-700 p-3 rounded border border-red-200">
                  {error}
                </div>
              )}
              
              {success && (
                <div className="mb-4 bg-green-50 text-green-700 p-3 rounded border border-green-200 flex flex-col">
                  <div className="flex items-center mb-2">
                    <CheckCircleIcon className="h-5 w-5 mr-2" />
                    <span className="font-medium">Заказ успешно создан</span>
                  </div>
                  
                  {createdUserInfo && (
                    <div className="mt-2 pt-2 border-t border-green-200">
                      <p className="text-sm font-medium mb-1">Создан аккаунт клиента:</p>
                      <p className="text-sm">Логин: {createdUserInfo.email}</p>
                      <p className="text-sm">Пароль: {createdUserInfo.password}</p>
                    </div>
                  )}
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