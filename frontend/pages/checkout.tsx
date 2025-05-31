import {useState, useEffect} from 'react';
import {NextPage} from 'next';
import {useRouter} from 'next/router';
import Link from 'next/link';
import Layout from '../components/Layout';
import useCartStore from '../lib/cart-store';
import useAuthStore from '../lib/auth-store';
import {CheckCircleIcon, CreditCardIcon, BanknotesIcon as CashIcon, UserIcon, PhoneIcon, ClockIcon, KeyIcon, ExclamationTriangleIcon as ExclamationCircleIcon, InformationCircleIcon, MapPinIcon as LocationMarkerIcon} from '@heroicons/react/24/outline';
import {formatPrice} from '../utils/priceFormatter';
import { ordersApi } from '../lib/api/orders';
import { settingsApi } from '../lib/api/settings';
import waiterApi from '../lib/api/waiter';
import {toast} from 'react-hot-toast';
import useReservationsStore from '../lib/reservations-store';
import { RestaurantTable } from '../lib/api/types';

const CheckoutPage: NextPage = () => {
  const router = useRouter();
  const { items, totalPrice, clearCart, reservationCode } = useCartStore();
  const { isAuthenticated, user } = useAuthStore();
  const { verifyReservationCode } = useReservationsStore();
  const [orderType, setOrderType] = useState<'dine-in'>('dine-in');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [comment, setComment] = useState('');
  const [urgent, setUrgent] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card'>('cash');
  const [isGuestPresent, setIsGuestPresent] = useState(true);
  const [isReservationRequired, setIsReservationRequired] = useState(true);
  const [reservationCodeInput, setReservationCodeInput] = useState(reservationCode || '');
  const [isReservationCodeValid, setIsReservationCodeValid] = useState<boolean | null>(null);
  const [isVerifyingCode, setIsVerifyingCode] = useState(false);
  const [reservationCodeError, setReservationCodeError] = useState('');
  const [error, setError] = useState('');
  const [processing, setProcessing] = useState(false);
  const [tables, setTables] = useState<RestaurantTable[]>([]);
  const [selectedTableId, setSelectedTableId] = useState<number | null>(null);
  const [showFloorPlan, setShowFloorPlan] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    payment_method: 'cash',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isGroupOrder, setIsGroupOrder] = useState(false);
  const [tableNumber, setTableNumber] = useState<number | null>(null);
  const [comments, setComments] = useState('');

  // Новые состояния для кода заказа
  const [orderCode, setOrderCode] = useState('');
  const [isCodeValid, setIsCodeValid] = useState<boolean | null>(null);
  const [codeError, setCodeError] = useState<string | null>(null);
  const [verifyingCode, setVerifyingCode] = useState(false);
  const [tableMessage, setTableMessage] = useState<string | null>(null);

  // Добавим состояние для кода официанта
  const [waiterCode, setWaiterCode] = useState('');
  const [waiterAssigned, setWaiterAssigned] = useState(false);

  useEffect(() => {
    // Проверка авторизации
    if (!isAuthenticated) {
      router.push('/auth/login?redirect=/checkout');
      return;
    }

    // Проверка наличия товаров в корзине
    if (items.length === 0) {
      router.push('/menu');
      return;
    }

    // Заполняем данные из профиля пользователя
    if (user) {
      setFormData(prev => ({
        ...prev,
        name: user.full_name || '',
        phone: user.phone || '',
      }));
    }

    // Если есть код бронирования, проверяем его валидность
    if (reservationCode) {
      validateReservationCode(reservationCode);
    }

    const loadSettings = async () => {
      try {
        const settings = await settingsApi.getSettings();
        if (settings?.tables) {
          setTables(settings.tables);
        }
      } catch (error) {
        console.error('Ошибка при загрузке настроек столов:', error);
      }
    };
    
    loadSettings();
  }, [isAuthenticated, items.length, router, user, reservationCode]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleReservationCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const code = e.target.value.toUpperCase();
    setReservationCodeInput(code);
    setIsReservationCodeValid(null); // Сбрасываем результат проверки
  };

  const validateReservationCode = async (code: string) => {
    if (!code) return;
    
    setIsVerifyingCode(true);
    setIsReservationCodeValid(null);
    
    try {
      const result = await verifyReservationCode(code);
      setIsReservationCodeValid(result.valid);
      
      if (result.valid) {
        // Устанавливаем номер стола из бронирования
        const tableNum = result.reservation?.table_number || result.tableNumber;
        if (tableNum) {
          setTableNumber(tableNum);
          console.log(`Установлен номер стола из бронирования: ${tableNum}`);
        } else {
          console.log('Для бронирования не указан номер стола');
        }
        setReservationCodeError('');
      } else {
        setReservationCodeError(result.message || 'Недействительный код бронирования');
      }
    } catch (error) {
      setIsReservationCodeValid(false);
      console.error('Ошибка при проверке кода бронирования:', error);
    } finally {
      setIsVerifyingCode(false);
    }
  };

  // Функция для проверки кода заказа
  const verifyOrderCode = async () => {
    try {
      setVerifyingCode(true);
      setCodeError(null);
      setIsCodeValid(null);
      
      // Заменим вызов orderCodesApi на что-то другое, например ordersApi
      // const response = await orderCodesApi.verifyCode(orderCode);
      
      // Временно заменим на проверку - код действителен, если его длина 6 символов
      const isValid = orderCode.length === 6;
      
      if (isValid) {
        setIsCodeValid(true);
        // Здесь можно добавить логику получения информации о столике
        setTableMessage('Стол найден и доступен для бронирования');
      } else {
        setIsCodeValid(false);
        setCodeError('Недействительный код. Пожалуйста, проверьте код и попробуйте снова.');
      }
    } catch (error: any) {
      setIsCodeValid(false);
      setCodeError(error.message || 'Ошибка при проверке кода');
    } finally {
      setVerifyingCode(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (processing) return;
    
    setProcessing(true);
    setError('');
    
    try {
      // Базовые обязательные данные для заказа
      const orderData: any = {
        // Включаем все данные о блюдах с их количеством
        items: items.map(item => ({
          dish_id: item.dish_id,
          quantity: item.quantity,
          // Комментарий к блюду добавляем только если он есть
          ...(item.comment ? { special_instructions: item.comment } : {})
        })),
        payment_method: formData.payment_method,
        table_number: tableNumber || 1,
        customer_name: formData.name,
        customer_phone: formData.phone
      };
      
      // Добавляем код бронирования, если есть
      if (reservationCode) {
        orderData.reservation_code = reservationCode;
      }
      
      // Добавляем комментарий к заказу, только если он не пустой
      const commentText = (comment || comments || '').trim();
      if (commentText) {
        orderData.comment = commentText;
      }
      
      // Добавляем другие важные флаги
      if (urgent) {
        orderData.is_urgent = true;
      }
      
      if (isGroupOrder) {
        orderData.is_group_order = true;
      }
      
      console.log('Отправка заказа с данными:', JSON.stringify(orderData, null, 2));
      
      const createdOrder = await ordersApi.createOrder(orderData);
      console.log('Заказ успешно создан:', createdOrder);
      
      // Очищаем корзину после успешного создания заказа
      clearCart();
      
      // Редирект на страницу успешного заказа
      router.push(`/orders/${createdOrder.id}?success=true`);
    } catch (err: any) {
      console.error('Ошибка при создании заказа:', err);
      setError(err.message || 'Ошибка при создании заказа');
      setProcessing(false);
    }
  };

  // Вспомогательная функция для получения стиля стола на основе его статуса и доступности
  const getTableStyle = (table: RestaurantTable) => {
    // Базовые стили
    let baseStyle = 'absolute transform -translate-x-1/2 -translate-y-1/2 rounded-xl flex items-center justify-center text-sm font-medium transition-all duration-200 shadow-md';
    let sizeClass = 'w-24 h-24';
    
    // Стили в зависимости от размера стола
    if (table.capacity <= 2) {
      sizeClass = 'w-20 h-20';
    } else if (table.capacity <= 4) {
      sizeClass = 'w-24 h-24';
    } else {
      sizeClass = 'w-28 h-28';
    }
    
    // Стили в зависимости от статуса
    let statusStyle = '';
    if (!table.is_active) {
      statusStyle = 'bg-gray-200 text-gray-500 cursor-not-allowed border border-gray-300';
    } else if (table.status === 'occupied' || table.status === 'reserved') {
      statusStyle = 'bg-red-100 text-red-700 cursor-not-allowed border-2 border-red-300';
    } else {
      statusStyle = 'bg-green-100 hover:bg-green-200 text-green-700 cursor-pointer border-2 border-green-300 hover:shadow-lg hover:-translate-y-1';
    }
    
    // Выбранный стол
    if (table.id === tableNumber) {
      statusStyle = 'bg-blue-500 hover:bg-blue-600 text-white cursor-pointer border-2 border-blue-300 hover:shadow-lg hover:-translate-y-1 animate-pulse';
    }
    
    return `${baseStyle} ${sizeClass} ${statusStyle}`;
  };
  
  // Функция для выбора стола на схеме зала
  const handleTableSelect = (table: RestaurantTable) => {
    if (table.is_active && table.status === 'available') {
      setTableNumber(table.id);
    }
  };

  return (
    <Layout title="Оформление заказа">
      <div className="container mx-auto px-4 py-12 max-w-5xl">
        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold text-gray-800 mb-3">Оформление заказа</h1>
          <p className="text-gray-600">Заполните данные для заказа в нашем ресторане</p>
        </div>
        
        {error && (
          <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded-lg shadow-md mb-8">
            <div className="flex">
              <div className="py-1">
                <svg className="h-6 w-6 text-red-500 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div>
                <p className="font-medium">{error}</p>
              </div>
            </div>
          </div>
        )}
        
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Форма оформления */}
          <div className="lg:w-2/3">
            <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-lg overflow-hidden border border-gray-100">
              <div className="px-8 py-6 border-b bg-gradient-to-r from-primary to-primary-dark">
                <h2 className="text-2xl font-bold text-white">Детали заказа</h2>
              </div>
              
              <div className="p-8 space-y-8">
                {/* Тип заказа */}
                <div className="bg-gray-50 p-6 rounded-lg">
                  <h3 className="text-xl font-medium mb-4 text-gray-800">Вариант заказа</h3>
                  <div className="grid grid-cols-1 gap-4">
                    <div className="flex items-center">
                      <input
                        type="radio"
                        id="present-yes"
                        name="guest_present"
                        className="h-5 w-5 text-primary focus:ring-primary border-gray-300"
                        checked={isGuestPresent}
                        onChange={() => {
                          setIsGuestPresent(true);
                          setOrderType('dine-in');
                        }}
                      />
                      <label htmlFor="present-yes" className="ml-3 block text-sm text-gray-700">
                        Я уже в ресторане и хочу сделать заказ
                      </label>
                    </div>
                    <div className="flex items-center">
                      <input
                        type="radio"
                        id="present-no"
                        name="guest_present"
                        className="h-5 w-5 text-primary focus:ring-primary border-gray-300"
                        checked={!isGuestPresent}
                        onChange={() => {
                          setIsGuestPresent(false);
                          setOrderType('dine-in');
                        }}
                      />
                      <label htmlFor="present-no" className="ml-3 block text-sm text-gray-700">
                        Я собираюсь посетить ресторан позже и хочу сделать заказ заранее
                      </label>
                    </div>
                  </div>
                  
                  {!isGuestPresent && (
                    <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                      <div className="flex items-center mb-4">
                        <ExclamationCircleIcon className="h-5 w-5 text-yellow-500 mr-2" />
                        <h4 className="text-sm font-semibold text-yellow-700">Для заказа заранее требуется код бронирования</h4>
                      </div>
                      <p className="text-sm text-yellow-600 mb-4">
                        Чтобы сделать заказ заранее, необходимо сначала забронировать столик. После подтверждения бронирования вы получите код, который нужно ввести ниже.
                      </p>
                      <div className="flex flex-col sm:flex-row gap-4">
                        <div className="flex-grow">
                          <label htmlFor="reservation-code" className="block text-sm font-medium text-gray-700 mb-1">
                            Код бронирования
                          </label>
                          <input
                            type="text"
                            id="reservation-code"
                            name="reservation_code"
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition"
                            placeholder="XXX-YYY"
                            value={reservationCodeInput}
                            onChange={handleReservationCodeChange}
                            maxLength={7}
                          />
                          {isReservationCodeValid === true && (
                            <p className="mt-1 text-sm text-green-600 flex items-center">
                              <CheckCircleIcon className="h-4 w-4 mr-1" />
                              Код бронирования подтвержден
                            </p>
                          )}
                          {isReservationCodeValid === false && (
                            <p className="mt-1 text-sm text-red-600 flex items-center">
                              <ExclamationCircleIcon className="h-4 w-4 mr-1" />
                              Недействительный код бронирования
                            </p>
                          )}
                          {isVerifyingCode && (
                            <p className="mt-1 text-sm text-gray-600">Проверка кода...</p>
                          )}
                        </div>
                        <div className="self-end">
                          <button
                            type="button"
                            onClick={() => validateReservationCode(reservationCodeInput)}
                            className="px-4 py-3 bg-gray-100 border border-gray-300 rounded-lg hover:bg-gray-200 text-sm font-medium text-gray-700"
                            disabled={!reservationCodeInput || isVerifyingCode}
                          >
                            Проверить код
                          </button>
                        </div>
                      </div>
                      <p className="mt-2 text-xs text-yellow-600">
                        Если у вас еще нет кода бронирования, <Link href="/reservations" className="font-medium underline">забронируйте столик</Link>.
                      </p>
                    </div>
                  )}
                </div>
                
                {/* Контактная информация */}
                <div className="bg-gray-50 p-6 rounded-lg">
                  <h3 className="text-xl font-medium mb-4 text-gray-800 flex items-center">
                    <UserIcon className="h-5 w-5 mr-2 text-primary" />
                    Контактная информация
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                        Имя
                      </label>
                      <input
                        id="name"
                        name="name"
                        type="text"
                        required
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition"
                        value={formData.name}
                        onChange={handleInputChange}
                      />
                    </div>
                    <div>
                      <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
                        Телефон
                      </label>
                      <input
                        id="phone"
                        name="phone"
                        type="tel"
                        required
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition"
                        value={formData.phone}
                        onChange={handleInputChange}
                      />
                    </div>
                  </div>
                </div>
                
                {/* Столик - только если гость в ресторане */}
                {isGuestPresent && (
                  <div className="bg-gray-50 p-6 rounded-lg">
                    <h3 className="text-xl font-medium mb-4 text-gray-800 flex items-center">
                      <ClockIcon className="h-5 w-5 mr-2 text-primary" />
                      Детали заказа в ресторане
                    </h3>
                    <div className="mb-4">
                      <div className="flex justify-between items-center mb-2">
                        <label htmlFor="table" className="block text-sm font-medium text-gray-700">
                          Номер столика
                        </label>
                        <button 
                          type="button"
                          onClick={() => setShowFloorPlan(!showFloorPlan)}
                          className="text-sm font-medium text-primary flex items-center"
                        >
                          <InformationCircleIcon className="h-4 w-4 mr-1" />
                          {showFloorPlan ? 'Скрыть' : 'Показать'} схему зала
                        </button>
                      </div>
                      <select
                        id="table"
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition"
                        value={tableNumber || ''}
                        onChange={(e) => setTableNumber(e.target.value ? Number(e.target.value) : null)}
                        required={isGuestPresent}
                      >
                        <option value="" disabled>Выберите столик</option>
                        {tables.filter(t => t.is_active && t.status === 'available').map(table => (
                          <option key={table.id} value={table.id}>
                            {table.name} - {table.capacity} {table.capacity === 1 ? 'место' : table.capacity < 5 ? 'места' : 'мест'}
                          </option>
                        ))}
                      </select>
                    </div>
                    
                    {/* Схема расположения столов в ресторане */}
                    {showFloorPlan && (
                      <div className="my-4">
                        <div className="border border-gray-300 rounded-lg shadow-md p-4 bg-white">
                          <h4 className="text-sm font-medium mb-2 text-primary flex items-center">
                            <InformationCircleIcon className="h-4 w-4 mr-1" />
                            Интерактивная схема зала
                          </h4>
                          <div className="relative w-full h-96 bg-gray-50 overflow-hidden rounded-md border border-dashed border-gray-300 bg-gradient-to-b from-gray-50 to-gray-100">
                            {/* Фон ресторана */}
                            <div className="absolute top-0 left-0 w-full h-full">
                              {/* Декоративные элементы */}
                              <div className="absolute top-1/4 left-1/2 transform -translate-x-1/2 -translate-y-1/2 border-b-2 border-gray-300 w-3/4"></div>
                              <div className="absolute top-1/3 left-0 w-24 h-24 bg-gray-200 rounded-tr-xl rounded-br-xl opacity-80"></div>
                              <div className="absolute top-2/3 right-0 w-24 h-24 bg-gray-200 rounded-tl-xl rounded-bl-xl opacity-80"></div>
                              
                              {/* Вход */}
                              <div className="absolute bottom-12 right-12 bg-blue-100 rounded-md h-20 w-32 flex items-center justify-center text-sm text-blue-700 font-medium border-2 border-blue-200 shadow-inner">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 9l3 3m0 0l-3 3m3-3H8m13 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                Вход
                              </div>
                              
                              {/* Барная стойка */}
                              <div className="absolute top-4 left-4 bg-amber-100 rounded-lg h-14 w-56 flex items-center justify-center text-sm text-amber-700 font-medium border-2 border-amber-200">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                                </svg>
                                Барная стойка
                              </div>
                            </div>
                            
                            {/* Столы */}
                            {tables.map((table) => (
                              <div
                                key={table.id}
                                className={getTableStyle(table)}
                                style={{ 
                                  left: `${table.position_x}px`, 
                                  top: `${table.position_y}px` 
                                }}
                                onClick={() => {
                                  if (table.is_active && table.status === 'available') {
                                    handleTableSelect(table);
                                  }
                                }}
                              >
                                <div className="text-center">
                                  <div className="font-bold">{table.name}</div>
                                  <div className="text-xs">{table.capacity} {table.capacity === 1 ? 'место' : table.capacity < 5 ? 'места' : 'мест'}</div>
                                  {table.status !== 'available' && (
                                    <div className="mt-1 text-xs font-bold uppercase">
                                      {table.status === 'reserved' ? 'Занят' : 'Забронирован'}
                                    </div>
                                  )}
                                </div>
                              </div>
                            ))}
                            
                            {/* Условные обозначения */}
                            <div className="absolute bottom-2 left-2 bg-white bg-opacity-90 p-3 rounded-md text-xs space-y-1.5 shadow-md border border-gray-200">
                              <div className="font-medium text-gray-700 mb-1">Условные обозначения:</div>
                              <div className="flex items-center">
                                <span className="inline-block w-4 h-4 bg-green-100 mr-2 rounded border border-green-300"></span>
                                <span>Доступно</span>
                              </div>
                              <div className="flex items-center">
                                <span className="inline-block w-4 h-4 bg-red-100 mr-2 rounded border border-red-300"></span>
                                <span>Занято</span>
                              </div>
                              <div className="flex items-center">
                                <span className="inline-block w-4 h-4 bg-blue-500 mr-2 rounded border border-blue-300"></span>
                                <span>Выбранный стол</span>
                              </div>
                            </div>
                          </div>
                          <p className="text-sm text-gray-500 mt-3 bg-gray-50 p-2 rounded border border-gray-200">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 inline-block mr-1 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            Кликните на доступный стол (зеленый), чтобы выбрать его для заказа.
                          </p>
                        </div>
                      </div>
                    )}
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                      <div className="flex items-center p-3 bg-white rounded-lg border border-gray-200">
                        <input
                          id="urgent"
                          type="checkbox"
                          className="h-5 w-5 text-primary focus:ring-primary border-gray-300 rounded"
                          checked={urgent}
                          onChange={(e) => setUrgent(e.target.checked)}
                        />
                        <label htmlFor="urgent" className="ml-3 block text-sm text-gray-700">
                          Срочный заказ
                        </label>
                      </div>
                      <div className="flex items-center p-3 bg-white rounded-lg border border-gray-200">
                        <input
                          id="group"
                          type="checkbox"
                          className="h-5 w-5 text-primary focus:ring-primary border-gray-300 rounded"
                          checked={isGroupOrder}
                          onChange={(e) => setIsGroupOrder(e.target.checked)}
                        />
                        <label htmlFor="group" className="ml-3 block text-sm text-gray-700">
                          Групповой заказ
                        </label>
                      </div>
                    </div>
                  </div>
                )}
                
                {/* Форма для дополнительной информации */}
                <div className="space-y-6">
                  <h2 className="text-xl font-semibold border-b pb-2">Дополнительная информация</h2>
                  
                  {/* Тип заказа */}
                  <div>
                    <span className="block text-sm font-medium text-gray-700 mb-2">
                      Тип заказа
                    </span>
                    <div className="flex flex-col sm:flex-row gap-3">
                      <button
                        type="button"
                        onClick={() => setOrderType('dine-in')}
                        className={`flex-1 inline-flex items-center px-4 py-2 border rounded-md shadow-sm text-sm font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary
                          ${orderType === 'dine-in' 
                            ? 'border-primary bg-primary-light text-primary-dark' 
                            : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'}`}
                      >
                        <LocationMarkerIcon className="h-5 w-5 mr-2" />
                        Я в ресторане
                      </button>
                    </div>
                  </div>
                  
                  {/* Код заказа (только если заказ в ресторане и гость присутствует) */}
                  {orderType === 'dine-in' && isGuestPresent && (
                    <div>
                      <label htmlFor="orderCode" className="block text-sm font-medium text-gray-700 mb-1">
                        Код заказа <span className="text-red-500">*</span>
                        <span className="text-sm text-gray-500 ml-1">(получите у официанта)</span>
                      </label>
                      <div className="mt-1 flex rounded-md shadow-sm">
                        <input
                          type="text"
                          id="orderCode"
                          name="orderCode"
                          value={orderCode}
                          onChange={(e) => {
                            setOrderCode(e.target.value);
                            setIsCodeValid(null);
                            setCodeError(null);
                            setTableMessage(null);
                          }}
                          className={`flex-1 min-w-0 block w-full px-3 py-2 rounded-md 
                            ${codeError 
                              ? 'border-red-300 focus:ring-red-500 focus:border-red-500' 
                              : isCodeValid 
                                ? 'border-green-300 focus:ring-green-500 focus:border-green-500' 
                                : 'border-gray-300 focus:ring-primary focus:border-primary'}`}
                          placeholder="Введите 6-значный код"
                          maxLength={6}
                        />
                        <button
                          type="button"
                          onClick={verifyOrderCode}
                          disabled={verifyingCode || !orderCode}
                          className="ml-3 inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-primary hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {verifyingCode ? (
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                          ) : (
                            <CheckCircleIcon className="h-4 w-4 mr-2" />
                          )}
                          Проверить
                        </button>
                      </div>
                      {codeError && (
                        <p className="mt-1 text-sm text-red-600">{codeError}</p>
                      )}
                      {isCodeValid && (
                        <p className="mt-1 text-sm text-green-600">Код подтвержден</p>
                      )}
                      {tableMessage && (
                        <p className="mt-1 text-sm font-medium text-blue-600 bg-blue-50 p-2 rounded-md border border-blue-100">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 inline-block mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          {tableMessage}
                        </p>
                      )}
                    </div>
                  )}
                  
                  {/* Способ оплаты */}
                  <div>
                    <span className="block text-sm font-medium text-gray-700 mb-2">
                      Способ оплаты
                    </span>
                    <div className="flex gap-3">
                      <div 
                        className={`flex items-center p-4 rounded-lg border cursor-pointer transition ${
                          paymentMethod === 'cash' 
                            ? 'border-primary bg-primary bg-opacity-5' 
                            : 'border-gray-200 bg-white hover:border-gray-300'
                        }`}
                        onClick={() => setPaymentMethod('cash')}
                      >
                        <input
                          id="cash"
                          name="payment_method"
                          type="radio"
                          className="h-5 w-5 text-primary focus:ring-primary border-gray-300"
                          value="cash"
                          checked={paymentMethod === 'cash'}
                          onChange={handleInputChange}
                        />
                        <label htmlFor="cash" className="ml-3 flex items-center cursor-pointer">
                          <CashIcon className="h-5 w-5 text-primary mr-2" />
                          <span className="font-medium">Наличными</span>
                        </label>
                      </div>
                      <div 
                        className={`flex items-center p-4 rounded-lg border cursor-pointer transition ${
                          paymentMethod === 'card' 
                            ? 'border-primary bg-primary bg-opacity-5' 
                            : 'border-gray-200 bg-white hover:border-gray-300'
                        }`}
                        onClick={() => setPaymentMethod('card')}
                      >
                        <input
                          id="card"
                          name="payment_method"
                          type="radio"
                          className="h-5 w-5 text-primary focus:ring-primary border-gray-300"
                          value="card"
                          checked={paymentMethod === 'card'}
                          onChange={handleInputChange}
                        />
                        <label htmlFor="card" className="ml-3 flex items-center cursor-pointer">
                          <CreditCardIcon className="h-5 w-5 text-primary mr-2" />
                          <span className="font-medium">Картой</span>
                        </label>
                      </div>
                    </div>
                  </div>

                  {/* Код официанта (для обслуживания в зале) */}
                  {orderType === 'dine-in' && (
                    <div className="mt-4">
                      <label htmlFor="waiterCode" className="block text-sm font-medium text-gray-700 mb-1">
                        Код официанта <span className="text-sm text-gray-500">(необязательно)</span>
                      </label>
                      <div className="mt-1">
                        <input
                          type="text"
                          id="waiterCode"
                          name="waiterCode"
                          value={waiterCode}
                          onChange={(e) => setWaiterCode(e.target.value.toUpperCase())}
                          disabled={waiterAssigned}
                          className={`block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary focus:border-primary ${
                            waiterAssigned ? 'bg-gray-100' : ''
                          }`}
                          placeholder="Введите код официанта"
                          maxLength={6}
                        />
                        {waiterAssigned && (
                          <p className="mt-1 text-sm text-green-600">
                            Официант привязан к заказу
                          </p>
                        )}
                        <p className="mt-1 text-xs text-gray-500">
                          Если вам известен код официанта, введите его для быстрого обслуживания
                        </p>
                      </div>
                    </div>
                  )}
                </div>
                
                {/* Комментарий к заказу */}
                <div className="bg-gray-50 p-6 rounded-lg">
                  <h3 className="text-xl font-medium mb-4 text-gray-800">Комментарий к заказу</h3>
                  <textarea
                    rows={3}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition"
                    placeholder="Дополнительные пожелания к заказу"
                    value={comments || comment}
                    onChange={(e) => {
                      // Обновляем оба поля для обратной совместимости
                      setComment(e.target.value);
                      setComments(e.target.value);
                    }}
                  />
                </div>
              </div>
              
              <div className="px-8 py-6 border-t bg-gray-50">
                <button
                  type="submit"
                  className={`w-full py-4 px-6 bg-gradient-to-r from-primary to-primary-dark text-white text-lg font-semibold rounded-lg shadow-md hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary transition ${
                    isLoading || (!isGuestPresent && (!reservationCode || isReservationCodeValid === false))
                      ? 'opacity-75 cursor-not-allowed' : ''
                  }`}
                  disabled={isLoading || (!isGuestPresent && (!reservationCode || isReservationCodeValid === false))}
                >
                  {isLoading ? 'Отправка заказа...' : 'Подтвердить заказ'}
                </button>
                <Link 
                  href="/cart" 
                  className="block text-center mt-4 text-primary font-medium hover:underline"
                >
                  Вернуться в корзину
                </Link>
              </div>
            </form>
          </div>
          
          {/* Сводка по заказу */}
          <div className="lg:w-1/3">
            <div className="bg-white rounded-xl shadow-lg overflow-hidden border border-gray-100 sticky top-4">
              <div className="px-6 py-4 border-b bg-gradient-to-r from-primary to-primary-dark">
                <h2 className="text-xl font-bold text-white">Ваш заказ</h2>
              </div>
              <div className="p-6">
                <ul className="divide-y divide-gray-200 mb-4">
                  {items.map((item) => (
                    <li key={item.id} className="py-4 flex justify-between">
                      <div>
                        <span className="font-medium text-gray-800">{item.name}</span>
                        <span className="text-gray-500 ml-2">x {item.quantity}</span>
                        {item.comment && (
                          <p className="text-xs text-gray-500 mt-1 italic">{item.comment}</p>
                        )}
                      </div>
                      <span className="font-medium text-gray-800">{formatPrice(item.price * item.quantity)}</span>
                    </li>
                  ))}
                </ul>
                
                <div className="border-t border-gray-200 pt-4 mb-2">
                  <div className="flex justify-between mb-2">
                    <span className="text-gray-600">Сумма заказа</span>
                    <span>{formatPrice(totalPrice)}</span>
                  </div>
                  <div className="flex justify-between font-medium text-lg mt-4">
                    <span>К оплате</span>
                    <span className="text-primary font-bold">{formatPrice(totalPrice)}</span>
                  </div>
                </div>
                
                <div className="mt-6 bg-yellow-50 border border-yellow-100 rounded-lg p-4 text-sm text-yellow-700">
                  <p className="flex items-center">
                    <svg className="h-5 w-5 text-yellow-500 mr-2" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                    </svg>
                    {isGuestPresent ? 
                      'Оплата производится на месте после подачи заказа.' :
                      'Оплата производится на месте в ресторане по прибытии.'
                    }
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default CheckoutPage; 