import { useEffect, useState } from 'react';
import { NextPage } from 'next';
import Link from 'next/link';
import Layout from '../components/Layout';
import useCartStore from '../lib/cart-store';
import useAuthStore from '../lib/auth-store';
import useReservationsStore from '../lib/reservations-store';
import AuthModal from '../components/AuthModal';
import { 
  TrashIcon, 
  PlusIcon, 
  MinusIcon, 
  ShoppingCartIcon, 
  ChevronRightIcon,
  KeyIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  ArrowLeftIcon,
  ArrowRightIcon
} from '@heroicons/react/24/outline';
import { formatPrice } from '../utils/priceFormatter';

const CartPage: NextPage = () => {
  const { items, totalPrice, updateQuantity, removeItem, clearCart, reservationCode, setReservationCode, reservationCodeError, setReservationCodeError } = useCartStore();
  const { isAuthenticated } = useAuthStore();
  const { verifyReservationCode } = useReservationsStore();
  const [comment, setComment] = useState('');
  const [showReservationCodeInput, setShowReservationCodeInput] = useState(false);
  const [isVerifyingCode, setIsVerifyingCode] = useState(false);
  const [isReservationCodeValid, setIsReservationCodeValid] = useState<boolean | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);

  // При загрузке проверяем код бронирования, если он есть
  useEffect(() => {
    if (reservationCode) {
      validateReservationCode(reservationCode);
    }
  }, [reservationCode]);

  const handleReservationCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const code = e.target.value.toUpperCase();
    setReservationCode(code);
    setIsReservationCodeValid(null); // Сбрасываем результат проверки
  };

  const validateReservationCode = async (code: string) => {
    if (!code) return;
    
    setIsVerifyingCode(true);
    setIsReservationCodeValid(null);
    setReservationCodeError('');
    
    try {
      const result = await verifyReservationCode(code);
      setIsReservationCodeValid(result.valid);
      
      if (!result.valid && result.message) {
        setReservationCodeError(result.message);
      } else {
        setReservationCodeError('');
      }
    } catch (error) {
      setIsReservationCodeValid(false);
      setReservationCodeError('Ошибка при проверке кода бронирования');
      console.error('Ошибка при проверке кода бронирования:', error);
    } finally {
      setIsVerifyingCode(false);
    }
  };

  // Обработчик нажатия на кнопку оформления заказа для неавторизованных пользователей
  const handleCheckoutClick = () => {
    if (!isAuthenticated) {
      setShowAuthModal(true);
    } else {
      window.location.href = '/checkout';
    }
  };

  if (items.length === 0) {
    return (
      <Layout title="Корзина">
        <div className="container mx-auto px-4 py-12">
          <h1 className="text-3xl font-bold mb-8">Корзина</h1>
          <div className="bg-white rounded-lg shadow-md p-8 text-center">
            <div className="flex justify-center mb-4">
              <ShoppingCartIcon className="h-16 w-16 text-gray-400" />
            </div>
            <h2 className="text-2xl font-medium mb-4">Ваша корзина пуста</h2>
            <p className="text-gray-600 mb-6">
              Добавьте блюда из меню, чтобы сделать заказ
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <Link 
                href="/menu" 
                className="inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 shadow-sm"
              >
                <ArrowLeftIcon className="h-5 w-5 mr-2" />
                Продолжить покупки
              </Link>
              <button 
                onClick={handleCheckoutClick}
                className="inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-primary hover:bg-primary-dark shadow-sm"
              >
                Оформить заказ
                <ArrowRightIcon className="h-5 w-5 ml-2" />
              </button>
            </div>
          </div>
        </div>
        
        {/* Модальное окно авторизации */}
        <AuthModal 
          isOpen={showAuthModal} 
          onClose={() => setShowAuthModal(false)} 
          actionType="checkout" 
        />
      </Layout>
    );
  }

  return (
    <Layout title="Корзина">
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8">Корзина</h1>

        <div className="flex flex-col md:flex-row gap-8">
          {/* Список товаров */}
          <div className="md:w-2/3">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Ваш заказ</h2>
              </div>
              <ul className="divide-y divide-gray-200 dark:divide-gray-700">
                {items.map((item) => (
                  <li key={item.id} className="px-6 py-4">
                    <div className="flex flex-col sm:flex-row">
                      <div className="sm:w-16 sm:h-16 mb-4 sm:mb-0 bg-gray-200 dark:bg-gray-700 rounded flex-shrink-0">
                        {item.image_url ? (
                          <img
                            src={item.image_url}
                            alt={item.name}
                            className="w-full h-full object-cover rounded"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <span className="text-gray-400 text-xs">Нет фото</span>
                          </div>
                        )}
                      </div>
                      <div className="flex-grow sm:ml-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <h3 className="text-sm font-semibold">{item.name}</h3>
                            <p className="font-medium text-gray-900">{formatPrice(item.price)}</p>
                          </div>
                          
                          <div className="flex items-center">
                            <div className="flex items-center border rounded-md mr-4 border-gray-200 dark:border-gray-700">
                              <button
                                className="px-3 py-1 border-r focus:outline-none"
                                onClick={() => updateQuantity(item.id, item.quantity - 1)}
                                disabled={item.quantity <= 1}
                              >
                                <MinusIcon className="h-4 w-4" />
                              </button>
                              <span className="px-3 py-1">{item.quantity}</span>
                              <button
                                className="px-3 py-1 border-l focus:outline-none"
                                onClick={() => updateQuantity(item.id, item.quantity + 1)}
                              >
                                <PlusIcon className="h-4 w-4" />
                              </button>
                            </div>
                            
                            <button
                              onClick={() => removeItem(item.id)}
                              className="text-red-500 hover:text-red-700"
                            >
                              <TrashIcon className="h-5 w-5" />
                            </button>
                          </div>
                        </div>
                        
                        {item.comment && (
                          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                            Комментарий: {item.comment}
                          </p>
                        )}
                        
                        <p className="mt-1 text-sm font-medium text-gray-700 dark:text-gray-200 text-right">
                          Итого: {formatPrice(item.price * item.quantity)}
                        </p>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
              <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700">
                <button 
                  onClick={() => clearCart()}
                  className="text-red-600 hover:text-red-800 text-sm font-medium"
                >
                  Очистить корзину
                </button>
              </div>
            </div>
          </div>

          {/* Оформление заказа */}
          <div className="md:w-1/3">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
              <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">Оформление заказа</h2>
              
              <div className="mb-4">
                <label htmlFor="order-comment" className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                  Комментарий к заказу
                </label>
                <textarea
                  id="order-comment"
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md focus:outline-none focus:ring-primary focus:border-primary bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                  placeholder="Пожелания к заказу"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                />
              </div>

              {/* Код бронирования */}
              <div className="mb-4">
                <button 
                  onClick={() => setShowReservationCodeInput(!showReservationCodeInput)}
                  className="flex items-center text-sm font-medium text-primary hover:text-primary-dark"
                >
                  <KeyIcon className="h-4 w-4 mr-1" />
                  {showReservationCodeInput ? 'Скрыть форму кода бронирования' : 'У меня есть код бронирования'}
                </button>
                
                {showReservationCodeInput && (
                  <div className="mt-3 p-4 bg-blue-50 dark:bg-blue-900 rounded-lg">
                    <p className="text-sm text-blue-700 dark:text-blue-200 mb-3">
                      Если вы забронировали столик и хотите заказать блюда заранее, введите код бронирования:
                    </p>
                    <div className="flex items-center space-x-2">
                      <input
                        type="text"
                        placeholder="XXX-YYY"
                        maxLength={7}
                        className="flex-grow px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md focus:outline-none focus:ring-primary focus:border-primary bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                        value={reservationCode || ''}
                        onChange={handleReservationCodeChange}
                      />
                      <button
                        onClick={() => validateReservationCode(reservationCode || '')}
                        className="px-3 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50"
                        disabled={!reservationCode || isVerifyingCode}
                      >
                        Проверить
                      </button>
                    </div>
                    {isVerifyingCode && (
                      <p className="mt-2 text-sm text-blue-600 dark:text-blue-300">Проверка кода...</p>
                    )}
                    {isReservationCodeValid === true && (
                      <p className="mt-2 text-sm text-green-600 dark:text-green-400 flex items-center">
                        <CheckCircleIcon className="h-4 w-4 mr-1" />
                        Код подтвержден
                      </p>
                    )}
                    {isReservationCodeValid === false && (
                      <p className="mt-2 text-sm text-red-600 dark:text-red-400 flex items-center">
                        <ExclamationCircleIcon className="h-4 w-4 mr-1" />
                        {reservationCodeError || 'Недействительный код'}
                      </p>
                    )}
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 font-medium">
                      Не имеете бронирования? <Link href="/reservations" className="underline">Забронируйте столик</Link>.
                    </p>
                  </div>
                )}
              </div>
              
              <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
                <div className="flex justify-between mb-2">
                  <span>Сумма заказа:</span>
                  <span>{formatPrice(totalPrice)}</span>
                </div>
                <div className="flex justify-between font-bold text-lg">
                  <span>Итого к оплате:</span>
                  <span>{formatPrice(totalPrice)}</span>
                </div>
              </div>
              
              {isAuthenticated ? (
                <Link 
                  href="/checkout" 
                  className="w-full btn btn-primary block text-center mt-4"
                >
                  Оформить заказ
                </Link>
              ) : (
                <button 
                  onClick={handleCheckoutClick}
                  className="w-full btn btn-primary block text-center mt-4"
                >
                  Оформить заказ
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
      
      {/* Модальное окно авторизации */}
      <AuthModal 
        isOpen={showAuthModal} 
        onClose={() => setShowAuthModal(false)} 
        actionType="checkout" 
      />
    </Layout>
  );
};

export default CartPage; 