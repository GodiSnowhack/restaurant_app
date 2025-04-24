'use client';

import {useState, useEffect} from 'react';
import {NextPage} from 'next';
import {useRouter} from 'next/router';
import Link from 'next/link';
import Layout from '../../components/Layout';
import useAuthStore from '../../lib/auth-store';
import {ArrowPathIcon as RefreshIcon, ClipboardDocumentIcon as ClipboardCopyIcon, TrashIcon, CheckCircleIcon} from '@heroicons/react/24/solid';
import {orderCodesApi, settingsApi, RestaurantSettings} from '../../lib/api';
import {InformationCircleIcon, QrCodeIcon} from '@heroicons/react/24/outline';

// Тип для кода заказа
interface OrderCode {
  id: number;
  code: string;
  table_number?: number;
  created_at: string;
  is_used: boolean;
}

// Используем тип таблицы из настроек ресторана
type RestaurantTable = {
  id: number;
  number: number;
  capacity: number;
  name: string;
  is_active: boolean;
  position_x: number;
  position_y: number;
  status: 'available' | 'reserved' | 'occupied';
}

const WaiterPage: NextPage = () => {
  const router = useRouter();
  const { user, isAuthenticated } = useAuthStore();
  const [orderCodes, setOrderCodes] = useState<OrderCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [tableNumber, setTableNumber] = useState<number | undefined>(undefined);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tables, setTables] = useState<RestaurantTable[]>([]);
  const [showFloorPlan, setShowFloorPlan] = useState(false);

  // Проверка прав доступа
  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/auth/login');
      return;
    }

    if (user?.role !== 'waiter' && user?.role !== 'admin') {
      router.push('/');
      return;
    }

    // Загрузка существующих кодов
    fetchOrderCodes();
  }, [isAuthenticated, user, router]);

  // Загрузка схемы столов из настроек
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const settings = await settingsApi.getSettings();
        if (settings?.tables) {
          // Преобразуем таблицы из API в наш локальный формат
          const formattedTables = settings.tables.map(table => ({
            id: table.id || 0,
            number: table.number,
            capacity: table.capacity,
            name: `Стол ${table.number}`,
            is_active: true,
            position_x: Math.random() * 80 + 10, // Случайные позиции для примера
            position_y: Math.random() * 80 + 10,
            status: (table.status as 'available' | 'reserved' | 'occupied') || 'available'
          }));
          setTables(formattedTables);
        }
      } catch (error) {
        console.error('Ошибка при загрузке настроек столов:', error);
      }
    };
    
    loadSettings();
  }, []);

  // Функция для загрузки кодов заказов
  const fetchOrderCodes = async () => {
    setLoading(true);
    setError(null);
    try {
      const codes = await orderCodesApi.getCodes();
      setOrderCodes(codes);
    } catch (err: any) {
      console.error('Ошибка при загрузке кодов заказов:', err);
      setError(err.response?.data?.detail || 'Ошибка при загрузке кодов заказов');
    } finally {
      setLoading(false);
    }
  };

  // Функция для генерации нового кода
  const generateNewCode = async () => {
    setError(null);
    try {
      const newCode = await orderCodesApi.createCode(tableNumber);
      setOrderCodes([newCode, ...orderCodes]);
      // Сбрасываем поле ввода номера столика
      setTableNumber(undefined);
    } catch (err: any) {
      console.error('Ошибка при создании кода заказа:', err);
      setError(err.response?.data?.detail || 'Ошибка при создании кода заказа');
    }
  };

  // Функция для копирования кода в буфер обмена
  const copyCodeToClipboard = (code: string) => {
    navigator.clipboard.writeText(code)
      .then(() => {
        setCopiedCode(code);
        setTimeout(() => setCopiedCode(null), 2000);
      })
      .catch(err => {
        console.error('Не удалось скопировать код:', err);
        setError('Не удалось скопировать код в буфер обмена');
      });
  };

  // Функция для удаления кода
  const deleteCode = async (id: number) => {
    setError(null);
    try {
      await orderCodesApi.deleteCode(id);
      setOrderCodes(orderCodes.filter(code => code.id !== id));
    } catch (err: any) {
      console.error('Ошибка при удалении кода заказа:', err);
      setError(err.response?.data?.detail || 'Ошибка при удалении кода заказа');
    }
  };

  // Форматирование даты
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  // Вспомогательная функция для получения стиля стола на основе его статуса
  const getTableStyle = (table: RestaurantTable) => {
    // Базовые стили
    let baseStyle = 'absolute transform -translate-x-1/2 -translate-y-1/2 rounded-xl flex items-center justify-center text-sm font-medium transition-all duration-200 shadow-md';
    let sizeClass = '';
    
    // Размер в зависимости от вместимости
    if (table.capacity <= 2) {
      sizeClass = 'w-20 h-20';
    } else if (table.capacity <= 4) {
      sizeClass = 'w-24 h-24';
    } else {
      sizeClass = 'w-28 h-28';
    }
    
    // Стиль в зависимости от статуса
    let statusStyle = '';
    if (!table.is_active) {
      statusStyle = 'bg-gray-200 text-gray-500 cursor-not-allowed border border-gray-300';
    } else if (table.status === 'occupied') {
      statusStyle = 'bg-red-100 text-red-700 cursor-not-allowed border-2 border-red-300';
    } else if (table.status === 'reserved') {
      statusStyle = 'bg-yellow-100 text-yellow-700 cursor-not-allowed border-2 border-yellow-300';
    } else {
      statusStyle = 'bg-green-100 hover:bg-green-200 text-green-700 cursor-pointer border-2 border-green-300 hover:shadow-lg hover:-translate-y-1';
    }
    
    // Если стол выбран
    if (table.id === tableNumber) {
      statusStyle = 'bg-blue-500 hover:bg-blue-600 text-white cursor-pointer border-2 border-blue-300 hover:shadow-lg hover:-translate-y-1 animate-pulse';
    }
    
    return `${baseStyle} ${sizeClass} ${statusStyle}`;
  };
  
  // Функция для выбора стола
  const handleTableSelect = (table: RestaurantTable) => {
    if (table.is_active && table.status === 'available') {
      setTableNumber(table.id);
    }
  };

  return (
    <Layout title="Панель официанта">
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-6">Панель официанта</h1>
        
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4" role="alert">
            <strong className="font-bold">Ошибка! </strong>
            <span className="block sm:inline">{error}</span>
            <button 
              className="absolute top-0 bottom-0 right-0 px-4 py-3"
              onClick={() => setError(null)}
            >
              <span className="text-xl">&times;</span>
            </button>
          </div>
        )}
        
        {/* Форма для генерации кода */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">Генерация кода для заказа</h2>
          
          <div className="mb-4">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-2 gap-2">
              <label htmlFor="tableNumber" className="block text-sm font-medium text-gray-700">
                Номер столика (опционально)
              </label>
              <button 
                type="button"
                onClick={() => setShowFloorPlan(!showFloorPlan)}
                className="text-sm font-medium text-primary flex items-center self-start sm:self-auto"
              >
                <InformationCircleIcon className="h-4 w-4 mr-1" />
                {showFloorPlan ? 'Скрыть' : 'Показать'} схему зала
              </button>
            </div>
            
            <select
              id="tableNumber"
              value={tableNumber || ''}
              onChange={(e) => setTableNumber(e.target.value ? Number(e.target.value) : undefined)}
              className="block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary focus:border-primary"
            >
              <option value="">Выберите столик (опционально)</option>
              {tables.filter(t => t.is_active).map(table => (
                <option key={table.id} value={table.id}>
                  {table.name} - {table.capacity} {table.capacity === 1 ? 'место' : table.capacity < 5 ? 'места' : 'мест'}
                  {table.status !== 'available' && ` (${table.status === 'reserved' ? 'забронирован' : 'занят'})`}
                </option>
              ))}
            </select>
          </div>
          
          {/* Схема расположения столов */}
          {showFloorPlan && (
            <div className="my-4 border border-gray-300 rounded-lg p-4 bg-gray-50">
              <h3 className="text-sm font-medium mb-3 text-gray-700 flex items-center">
                <InformationCircleIcon className="h-4 w-4 mr-1 text-primary" />
                Интерактивная схема зала
              </h3>
              <div className="relative w-full h-80 bg-white overflow-hidden rounded-md border border-dashed border-gray-300 bg-gradient-to-b from-gray-50 to-gray-100">
                {/* Фон ресторана */}
                <div className="absolute top-0 left-0 w-full h-full">
                  {/* Декоративные элементы */}
                  <div className="absolute top-1/4 left-1/2 transform -translate-x-1/2 -translate-y-1/2 border-b-2 border-gray-300 w-3/4"></div>
                  <div className="absolute top-1/3 left-0 w-24 h-24 bg-gray-200 rounded-tr-xl rounded-br-xl opacity-80"></div>
                  <div className="absolute top-2/3 right-0 w-24 h-24 bg-gray-200 rounded-tl-xl rounded-bl-xl opacity-80"></div>
                  
                  {/* Вход */}
                  <div className="absolute bottom-12 right-12 bg-blue-100 rounded-md h-16 w-28 flex items-center justify-center text-sm text-blue-700 font-medium border border-blue-200 shadow-inner">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 9l3 3m0 0l-3 3m3-3H8m13 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Вход
                  </div>
                  
                  {/* Барная стойка */}
                  <div className="absolute top-4 left-4 bg-amber-100 rounded-lg h-12 w-48 flex items-center justify-center text-sm text-amber-700 font-medium border border-amber-200">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
                          {table.status === 'reserved' ? 'Забронирован' : 'Занят'}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                
                {/* Условные обозначения */}
                <div className="absolute bottom-2 left-2 bg-white bg-opacity-90 p-2 rounded-md text-xs space-y-1 shadow-sm border border-gray-200">
                  <div className="font-medium text-gray-700 mb-1">Условные обозначения:</div>
                  <div className="flex items-center">
                    <span className="inline-block w-3 h-3 bg-green-100 mr-1 rounded border border-green-300"></span>
                    <span>Доступно</span>
                  </div>
                  <div className="flex items-center">
                    <span className="inline-block w-3 h-3 bg-red-100 mr-1 rounded border border-red-300"></span>
                    <span>Занято</span>
                  </div>
                  <div className="flex items-center">
                    <span className="inline-block w-3 h-3 bg-yellow-100 mr-1 rounded border border-yellow-300"></span>
                    <span>Забронировано</span>
                  </div>
                  <div className="flex items-center">
                    <span className="inline-block w-3 h-3 bg-blue-500 mr-1 rounded border border-blue-300"></span>
                    <span>Выбранный стол</span>
                  </div>
                </div>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Кликните на доступный стол (зеленый), чтобы выбрать его для генерации кода заказа.
              </p>
            </div>
          )}
          
          <button
            onClick={generateNewCode}
            className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-primary hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
          >
            <RefreshIcon className="h-5 w-5 mr-2" />
            Сгенерировать новый код
          </button>
        </div>
        
        {/* Блок сканирования QR-кода заказа */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">Сканирование QR-кода заказа</h2>
          
          <div className="flex flex-col md:flex-row items-start gap-6">
            <div className="w-full md:w-1/2">
              <p className="text-gray-600 mb-4">
                Отсканируйте QR-код заказа клиента, чтобы привязать его к вашему аккаунту и начать обслуживание.
              </p>
              
              <ul className="list-disc pl-5 space-y-1 text-sm text-gray-600 mb-4">
                <li>Попросите клиента показать QR-код заказа</li>
                <li>Держите камеру ровно и на расстоянии 15-30 см от кода</li>
                <li>После успешного сканирования вы будете перенаправлены на страницу заказа</li>
              </ul>
              
              <div className="flex justify-center md:justify-start">
                <Link href="/waiter/scan" className="bg-primary text-white py-2 px-4 rounded-md hover:bg-primary-dark transition duration-200 flex items-center">
                  <QrCodeIcon className="h-5 w-5 mr-2" />
                  Сканировать QR-код
                </Link>
              </div>
            </div>
            
            <div className="w-full md:w-1/2 flex justify-center">
              <div className="w-full max-w-xs h-64 bg-gray-100 rounded-lg flex flex-col items-center justify-center">
                <QrCodeIcon className="h-20 w-20 text-gray-400" />
                <p className="text-gray-500 text-sm mt-4 text-center px-4">
                  Нажмите кнопку "Сканировать QR-код", чтобы открыть сканер камеры
                </p>
              </div>
            </div>
          </div>
        </div>
        
        {/* Список кодов */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Активные коды заказов</h2>
            <button
              onClick={fetchOrderCodes}
              className="text-primary hover:text-primary-dark"
              title="Обновить список"
            >
              <RefreshIcon className="h-5 w-5" />
            </button>
          </div>
          
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
            </div>
          ) : orderCodes.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              Нет активных кодов. Сгенерируйте новый код.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Код
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Столик
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Создан
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Статус
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Действия
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {orderCodes.map((codeItem) => (
                    <tr key={codeItem.id} className={codeItem.is_used ? 'bg-gray-50' : ''}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-lg font-mono font-bold">{codeItem.code}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {codeItem.table_number ? `Столик №${codeItem.table_number}` : '—'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {formatDate(codeItem.created_at)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {codeItem.is_used ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            <CheckCircleIcon className="h-4 w-4 mr-1" />
                            Использован
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            Активен
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center space-x-3">
                          <button
                            onClick={() => copyCodeToClipboard(codeItem.code)}
                            className={`text-gray-600 hover:text-primary ${copiedCode === codeItem.code ? 'text-green-600' : ''}`}
                            title={copiedCode === codeItem.code ? 'Скопировано!' : 'Копировать код'}
                          >
                            <ClipboardCopyIcon className="h-5 w-5" />
                          </button>
                          {!codeItem.is_used && (
                            <button
                              onClick={() => deleteCode(codeItem.id)}
                              className="text-red-600 hover:text-red-800"
                              title="Удалить код"
                            >
                              <TrashIcon className="h-5 w-5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default WaiterPage; 