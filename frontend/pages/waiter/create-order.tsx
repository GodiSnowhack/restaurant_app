'use client';

import { useState, useEffect } from 'react';
import { NextPage } from 'next';
import { useRouter } from 'next/router';
import WaiterLayout from '../../components/WaiterLayout';
import useAuthStore from '../../lib/auth-store';
import { menuApi, ordersApi, settingsApi, RestaurantTable as BaseRestaurantTable } from '../../lib/api';
import { 
  PlusIcon, 
  MinusIcon, 
  TrashIcon, 
  CheckCircleIcon
} from '@heroicons/react/24/outline';
import { toast } from 'react-hot-toast';

// Расширяем базовый интерфейс столов для добавления поля name
interface RestaurantTable extends BaseRestaurantTable {
  name?: string;
}

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

// Функция для генерации уникального email и пароля для нового пользователя
const generateUserCredentials = () => {
  const randomNumber = Math.floor(10000 + Math.random() * 90000); // 5-значное число
  const email = `user${randomNumber}@restaurant.com`;
  const password = `user${randomNumber}`; // Используем тот же номер в качестве пароля
  
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
        const settings = await settingsApi.getSettings();
        console.log('Полученные настройки:', settings);
        
        if (settings && settings.tables && Array.isArray(settings.tables)) {
          console.log('Исходные столы до обработки:', JSON.stringify(settings.tables));
          
          // Выводим подробную информацию о каждом столе для отладки
          settings.tables.forEach((table: RestaurantTable, index: number) => {
            console.log(`Стол ${index + 1} (детали):`, JSON.stringify(table));
          });
          
          // Фильтруем столы, чтобы показать только доступные
          const availableTables = settings.tables
            .filter((table: RestaurantTable) => 
              table.status === 'available' || !table.status
            )
            .map((table: RestaurantTable, index: number) => {
              return {
                ...table,
                // Используем id как идентификатор для стола
                id: table.id || index + 1,
                // Устанавливаем number равным id, если он отсутствует
                number: typeof table.number === 'number' ? table.number : table.id || index + 1
              };
            });
            
          console.log('Доступные столы после обработки:', JSON.stringify(availableTables));
          setTables(availableTables);
          
          // Если есть доступные столы, устанавливаем первый по умолчанию
          if (availableTables.length > 0) {
            // Устанавливаем ID первого стола
            const firstTableId = String(availableTables[0].id);
            console.log('Установка ID первого стола:', firstTableId);
            setTableNumber(firstTableId);
          }
        } else {
          // Если столов нет в настройках, создаем временные столы для демонстрации
          const defaultTables = [
            { id: 1, number: 1, capacity: 2, status: 'available', name: 'Стол 1' },
            { id: 2, number: 2, capacity: 4, status: 'available', name: 'Стол 2' },
            { id: 3, number: 3, capacity: 6, status: 'available', name: 'VIP' }
          ];
          console.log('Используем стандартные столы:', defaultTables);
          setTables(defaultTables);
          setTableNumber('1'); // Устанавливаем первый стол по умолчанию
        }
        
        // Получаем меню используя запрос к API с указанием метода
        const menu = await fetch('/api/menu?method=dishes').then(res => res.json()) as MenuResponse;
        
        // Проверяем, что menu.items существует и является массивом
        const items = Array.isArray(menu.items) ? menu.items : Array.isArray(menu) ? menu : [];
        setMenuItems(items);
        
        // Получаем категории отдельным запросом
        const categoriesResponse = await fetch('/api/menu?method=categories').then(res => res.json());
        let categoriesList: Category[] = [];
        
        if (Array.isArray(categoriesResponse)) {
          categoriesList = categoriesResponse.map(category => ({
            id: category.id.toString(),
            name: category.name
          }));
        }
        
        setCategories(categoriesList);
        setLoading(false);
      } catch (err) {
        console.error('Ошибка при загрузке данных:', err);
        setError('Не удалось загрузить данные. Пожалуйста, попробуйте еще раз.');
        setMenuItems([]);
        setCategories([]);
        setTables([]);
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
      console.log('Выбранный стол для заказа:', selectedTable);
      
      // Используем номер стола из объекта, если есть, иначе используем ID
      const tableNumberToSend = selectedTable && typeof selectedTable.number === 'number' 
        ? selectedTable.number 
        : selectedTable && selectedTable.id 
          ? Number(selectedTable.id) 
          : Number(tableNumber);
      
      console.log('Отправка заказа для стола:', selectedTable?.name, 'номер:', tableNumberToSend);
      
      // Максимально упрощенный формат элементов заказа с проверкой типов
      const formattedItems = orderItems.map(item => ({
        dish_id: Number(item.id), // Гарантированно число
        quantity: Number(item.quantity), // Гарантированно число
        special_instructions: item.special_instructions || ''
      }));
      
      // Создаем минимальный необходимый формат заказа
      const orderData: {
        table_number: number;
        items: { 
          dish_id: number; 
          quantity: number; 
          special_instructions: string;
        }[];
        status: string;
        payment_status: string;
        payment_method: string;
        order_type: string;
        total_amount: number;
        waiter_id?: number;
        customer_id?: number;
        customer_name?: string;
        customer_phone?: string;
        customer_age_group?: string;
      } = {
        table_number: tableNumberToSend,
        items: formattedItems,
        status: "pending",
        payment_status: "PENDING",
        payment_method: "cash",
        order_type: "dine_in",
        total_amount: Number(totalAmount.toFixed(2)) // Гарантированно число с 2 знаками
      };
      
      // Добавляем необязательные поля только если они имеют значение
      if (customerName && customerName.trim()) {
        orderData.customer_name = customerName.trim();
      }
      
      if (customerPhone && customerPhone.trim()) {
        orderData.customer_phone = customerPhone.trim();
      }
      
      if (customerAgeGroup && customerAgeGroup.trim()) {
        orderData.customer_age_group = customerAgeGroup.trim();
      }
      
      // Добавляем ID официанта
      if (user?.id) {
        orderData.waiter_id = Number(user.id);
        console.log(`Прикрепляем заказ к официанту с ID: ${user.id}`);
      }
      
      console.log('Данные заказа для отправки:', JSON.stringify(orderData));
      
      // Получаем токен авторизации
      const token = localStorage.getItem('token');
      if (!token) {
        console.error('Токен авторизации отсутствует');
        setError('Ошибка авторизации. Пожалуйста, войдите снова.');
        return;
      }
      
      // Функция для отправки заказа с повторными попытками
      const sendOrderWithRetry = async (maxRetries = 3) => {
        let lastError = null;
        
        for (let attempt = 0; attempt < maxRetries; attempt++) {
          try {
            // Если это повторная попытка, добавляем небольшую задержку
            if (attempt > 0) {
              const delay = 1000 * attempt;
              console.log(`Ожидание ${delay}мс перед повторной попыткой ${attempt + 1}/${maxRetries}...`);
              await new Promise(resolve => setTimeout(resolve, delay));
            }
            
            // Генерируем данные для создания пользователя
            const { email, password } = generateUserCredentials();
            console.log(`Сгенерированы данные для нового пользователя: email=${email}`);
            
            // Сохраняем данные пользователя для отображения
            setCreatedUserInfo({ email, password });
            
            // Создаем пользователя
            const createUserResponse = await fetch('/api/v1/users/create-customer', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'Authorization': `Bearer ${token}`
              },
              body: JSON.stringify({
                name: customerName.trim(),
                email: email,
                password: password,
                phone: customerPhone ? customerPhone.trim() : null,
                age_group: customerAgeGroup,
                role: 'client'
              })
            });
            
            console.log(`Отправленные данные пользователя:`, {
              name: customerName.trim(),
              age_group: customerAgeGroup,
              role: 'client'
            });
            
            // Обрабатываем ответ от сервера
            if (!createUserResponse.ok) {
              const errorText = await createUserResponse.text();
              console.error(`Ошибка создания пользователя (${createUserResponse.status}):`, errorText);
              throw new Error(`Ошибка создания пользователя: ${createUserResponse.status} ${createUserResponse.statusText}`);
            }
            
            // Получаем данные созданного пользователя
            const userData = await createUserResponse.json();
            console.log('Пользователь успешно создан:', userData);
            
            // Получаем ID созданного пользователя
            const customerId = userData.id || userData.user_id;
            if (!customerId) {
              throw new Error('Не удалось получить ID созданного пользователя');
            }
            
            console.log(`Получен ID созданного пользователя: ${customerId}`);
            
            // Обновляем данные заказа, добавляя ID клиента
            orderData.customer_id = customerId;
            
            // Используем Next.js API прокси для создания заказа
            const response = await fetch('/api/orders', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'Authorization': `Bearer ${token}`
              },
              body: JSON.stringify(orderData)
            });
            
            // Обработка ответа от сервера
            const responseText = await response.text();
            console.log(`Ответ сервера (${response.status}):`, responseText);
            
            let responseData;
            try {
              responseData = JSON.parse(responseText);
            } catch (e) {
              responseData = { message: responseText };
            }
            
            if (!response.ok) {
              console.error(`Ошибка API (${response.status}):`, responseData);
              
              // Проверяем, является ли ошибка результатом блокировки базы данных
              const isDatabaseLocked = 
                responseText.includes('database is locked') || 
                (responseData.error && responseData.error.includes('database is locked')) ||
                (responseData.message && responseData.message.includes('database is locked'));
              
              if (isDatabaseLocked && attempt < maxRetries - 1) {
                // Если база заблокирована и это не последняя попытка, продолжаем повторы
                console.log('Обнаружена блокировка базы данных, повторяем запрос...');
                lastError = new Error(responseData.message || `Ошибка создания заказа: ${response.status} ${response.statusText}`);
                continue;
              }
              
              throw new Error(responseData.message || `Ошибка создания заказа: ${response.status} ${response.statusText}`);
            }
            
            // Обрабатываем случаи, когда заказ был создан, но возвращена дополнительная информация
            if (responseData._recovered) {
              console.log('Заказ был восстановлен после ошибки сервера:', responseData);
              toast.success(responseData.message || "Заказ создан, несмотря на временную ошибку сервера", { 
                duration: 3000,
                position: 'top-center',
              });
            } else if (responseData.is_duplicate) {
              console.log('Обнаружено, что заказ является дубликатом:', responseData);
              toast(responseData.duplicate_message || "Заказ уже был создан ранее", {
                duration: 3000,
                position: 'top-center',
                icon: '🔄',
              });
            }
            
            console.log('Заказ успешно создан:', responseData);
            return responseData;
          } catch (err: any) {
            lastError = err;
            
            // Если это ошибка сети, а не ответ сервера, просто повторяем
            if (err instanceof TypeError && err.message.includes('fetch')) {
              console.error('Ошибка сети при отправке заказа:', err);
              continue;
            }
            
            // Для других ошибок проверяем, связана ли она с блокировкой базы данных
            if (err.message && err.message.includes('database is locked') && attempt < maxRetries - 1) {
              console.log('Обнаружена блокировка базы данных в сообщении об ошибке, повторяем запрос...');
              continue;
            }
            
            // Если это последняя попытка или другая ошибка, выбрасываем её
            throw err;
          }
        }
        
        // Если мы здесь, значит все попытки не удались
        throw lastError || new Error('Не удалось создать заказ после нескольких попыток');
      };
      
      // Отправляем заказ с повторными попытками
      await sendOrderWithRetry(3);
      
      // Сбрасываем форму после успешного создания заказа
      setOrderItems([]);
      setTableNumber('');
      setCustomerName('');
      setCustomerPhone('');
      setCustomerAgeGroup('');
      setSuccess(true);
      
      // Через 5 секунд убираем уведомление об успехе
      setTimeout(() => {
        setSuccess(false);
        setCreatedUserInfo(null);
      }, 5000);
      
    } catch (err: any) {
      console.error('Ошибка при создании заказа:', err);
      
      // Специальное сообщение для пользователя при ошибке блокировки базы данных
      if (err.message && err.message.includes('database is locked')) {
        setError('База данных временно занята. Пожалуйста, подождите несколько секунд и попробуйте снова.');
      } else {
        setError(`Не удалось создать заказ: ${err.message}`);
      }
    } finally {
      setSubmitting(false);
    }
  };
  
  // Обработчик выбора стола
  const handleTableChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedValue = e.target.value;
    console.log('Выбран стол (ID):', selectedValue);
    
    if (!selectedValue) {
      console.warn('Выбрано пустое значение стола!');
      return;
    }
    
    // Сохраняем выбранный ID стола
    setTableNumber(selectedValue);
    
    // Найдем соответствующий стол для диагностики
    const selectedTable = tables.find(table => String(table.id) === selectedValue);
    console.log('Найденный стол по ID:', selectedTable);
    
    // Дополнительное логирование сразу после установки значения
    console.log('tableNumber установлен в:', selectedValue, 'для стола:', selectedTable?.name);
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
                    tables.map((table: RestaurantTable) => {
                      // Используем ID стола для значения
                      const tableIdStr = String(table.id);
                      console.log(`Опция стола ${table.name}: id=${tableIdStr}, номер=${table.number}`);
                      return (
                        <option 
                          key={table.id} 
                          value={tableIdStr}
                        >
                          {table.name || `Стол №${table.number}`} (мест: {table.capacity})
                        </option>
                      );
                    })
                  ) : (
                    <option value="" disabled>Нет доступных столов</option>
                  )}
                </select>
                <div className="mt-2">
                  {tableNumber ? (
                    <div className="p-2 bg-green-50 text-green-700 rounded border border-green-200">
                      Выбран стол: {tables.find(t => String(t.id) === tableNumber)?.name || `ID: ${tableNumber}`}
                    </div>
                  ) : (
                    <div className="p-2 bg-yellow-50 text-yellow-700 rounded border border-yellow-200">
                      Пожалуйста, выберите стол для заказа
                    </div>
                  )}
                </div>
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