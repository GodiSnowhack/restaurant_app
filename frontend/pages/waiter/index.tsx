'use client';

import {useState, useEffect} from 'react';
import {NextPage} from 'next';
import {useRouter} from 'next/router';
import Link from 'next/link';
import Layout from '../../components/Layout';
import useAuthStore from '../../lib/auth-store';
import {ArrowPathIcon as RefreshIcon, ClipboardDocumentIcon as ClipboardCopyIcon, TrashIcon, CheckCircleIcon} from '@heroicons/react/24/solid';
import {orderCodesApi, settingsApi} from '../../lib/api';
import {InformationCircleIcon, QrCodeIcon} from '@heroicons/react/24/outline';
import { useTheme } from '@/lib/theme-context';
import FloorPlan from '../../components/FloorPlan';
import type { RestaurantTable } from '../../components/FloorPlan';

// Тип для кода заказа
interface OrderCode {
  id: number;
  code: string;
  table_number?: number;
  created_at: string;
  is_used: boolean;
}

// Добавим тип для данных стола из API
interface TableFromAPI {
  id?: number;
  number?: number;
  name?: string;
  capacity?: number;
  is_active?: boolean;
  position_x?: number;
  position_y?: number;
  status?: string;
  table_number?: number;
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
  const { isDark } = useTheme();

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
          console.log('Оригинальные данные столов:', settings.tables);
          
          // Создаем карту для равномерного расположения столов
          const totalTables = settings.tables.length;
          const cols = Math.ceil(Math.sqrt(totalTables)); // Примерное количество столбцов
          const spacingX = 120; // Расстояние между столами по X
          const spacingY = 100; // Расстояние между столами по Y
          
          // Преобразуем данные столов в формат совместимый с RestaurantTable
          const formattedTables: RestaurantTable[] = settings.tables.map((table: TableFromAPI, index: number) => {
            // Убедимся, что у нас есть номер стола и он числовой
            const tableNumber = typeof table.number === 'number' ? table.number : 
                              typeof table.table_number === 'number' ? table.table_number :
                              typeof table.id === 'number' ? table.id : index + 1;
            
            // Получаем имя стола с учетом русских названий мест
            const getTableNameWithCapacity = (num: number, capacity: number) => {
              const placeWord = capacity === 1 ? 'место' : 
                              capacity < 5 ? 'места' : 'мест';
              return `Стол №${num} (${capacity} ${placeWord})`;
            };
            
            // Создаем имя стола - либо используем готовое, либо генерируем формат "Стол №X (Y мест)"
            const tableName = table.name || getTableNameWithCapacity(tableNumber, table.capacity || 4);
            
            // Вычисляем координаты стола, если они не заданы
            let posX = typeof table.position_x === 'number' ? table.position_x : 0;
            let posY = typeof table.position_y === 'number' ? table.position_y : 0;
            
            // Если координаты не заданы, размещаем столы в сетку
            if (posX === 0 && posY === 0) {
              const row = Math.floor(index / cols);
              const col = index % cols;
              posX = 50 + col * spacingX; // Начинаем с отступа 50px и размещаем по сетке
              posY = 50 + row * spacingY; // Начинаем с отступа 50px и размещаем по сетке
            }
            
            // Создаем объект, соответствующий интерфейсу RestaurantTable
            const formattedTable: RestaurantTable = {
              id: table.id || tableNumber,
              number: tableNumber,
              name: tableName,
              capacity: table.capacity || 4,
              is_active: true,
              position_x: posX,
              position_y: posY,
              status: (table.status as 'available' | 'reserved' | 'occupied') || 'available'
            };
            
            console.log('Форматированный стол:', formattedTable);
            return formattedTable;
          });
          
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
      // Если выбран стол, находим его номер по id
      let tableNum: number | undefined = undefined;
      if (tableNumber) {
        const selectedTable = tables.find(t => t.id === tableNumber);
        if (selectedTable) {
          tableNum = selectedTable.number;
        }
      }
      
      const newCode = await orderCodesApi.createCode(tableNum);
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

  // Функция для выбора стола
  const handleTableSelect = (tableId: number) => {
    setTableNumber(tableId);
  };

  return (
    <Layout title="Панель официанта">
      <div className="container mx-auto px-4 py-8">
        <h1 className={`text-3xl font-bold mb-6 ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>
          Панель официанта
        </h1>
        
        {error && (
          <div className={`
            border px-4 py-3 rounded relative mb-4
            ${isDark ? 'bg-red-900/50 border-red-800 text-red-100' : 'bg-red-100 border-red-400 text-red-700'}
          `} role="alert">
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
        <div className={`
          rounded-lg shadow-md p-6 mb-8
          ${isDark ? 'bg-gray-800 border border-gray-700' : 'bg-white'}
        `}>
          <h2 className={`text-xl font-semibold mb-4 ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>
            Генерация кода для заказа
          </h2>
          
          <div className="mb-4">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-2 gap-2">
              <label htmlFor="tableNumber" className={`
                block text-sm font-medium
                ${isDark ? 'text-gray-300' : 'text-gray-700'}
              `}>
                Номер столика (опционально)
              </label>
              <button 
                type="button"
                onClick={() => setShowFloorPlan(!showFloorPlan)}
                className={`
                  text-sm font-medium flex items-center self-start sm:self-auto
                  ${isDark ? 'text-primary-400 hover:text-primary-300' : 'text-primary hover:text-primary-dark'}
                `}
              >
                <InformationCircleIcon className="h-4 w-4 mr-1" />
                {showFloorPlan ? 'Скрыть' : 'Показать'} схему зала
              </button>
            </div>
            
            <select
              id="tableNumber"
              value={tableNumber || ''}
              onChange={(e) => setTableNumber(e.target.value ? Number(e.target.value) : undefined)}
              className={`
                block w-full rounded-md shadow-sm py-2 px-3
                ${isDark 
                  ? 'bg-gray-700 border-gray-600 text-gray-100 focus:ring-primary-400 focus:border-primary-400' 
                  : 'border-gray-300 focus:ring-primary focus:border-primary'}
              `}
            >
              <option value="">Выберите столик (опционально)</option>
              {tables.filter(t => t.is_active).map(table => (
                <option key={table.id} value={table.id}>
                  Стол {table.number} - {table.capacity} {table.capacity === 1 ? 'место' : table.capacity < 5 ? 'места' : 'мест'}
                  {table.status !== 'available' && ` (${table.status === 'reserved' ? 'забронирован' : 'занят'})`}
                </option>
              ))}
            </select>
          </div>
          
          {/* Схема расположения столов */}
          {showFloorPlan && (
            <div className={`
              my-4 rounded-lg p-4
              ${isDark ? 'bg-gray-800/80 border-gray-700' : 'border border-gray-300 bg-white'}
            `}>
              <h3 className={`
                text-lg font-medium mb-4 flex items-center
                ${isDark ? 'text-gray-100' : 'text-gray-900'}
              `}>
                <InformationCircleIcon className={`
                  h-5 w-5 mr-2
                  ${isDark ? 'text-primary-400' : 'text-primary'}
                `} />
                Интерактивная схема зала
              </h3>
              
              <div className={`
                flex justify-center rounded-lg overflow-hidden
                ${isDark ? 'bg-gray-900' : 'bg-gray-50'}
              `}>
                <FloorPlan 
                  tables={tables}
                  selectedTableId={tableNumber}
                  onTableSelect={handleTableSelect}
                  height="h-96"
                  containerClassName={`
                    w-full max-w-4xl mx-auto p-4
                    ${isDark ? 'bg-gray-900' : 'bg-white'}
                  `}
                  showBarCounter={true}
                  showLegend={true}
                  showEntrance={true}
                  isPixelPosition={false}
                  tableScaleFactor={0.9}
                  maxWidth={500}
                  maxHeight={350}
                  percentMultiplier={2.5}
                  isDark={isDark}
                />
              </div>
              
              <p className={`
                text-sm mt-4 p-3 rounded-lg border
                ${isDark 
                  ? 'bg-gray-900 border-gray-700 text-gray-300' 
                  : 'bg-gray-50 border-gray-200 text-gray-500'
                }
              `}>
                <svg xmlns="http://www.w3.org/2000/svg" className={`
                  h-5 w-5 inline-block mr-1
                  ${isDark ? 'text-blue-400' : 'text-blue-500'}
                `} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Кликните на доступный стол (зеленый), чтобы выбрать его для генерации кода заказа.
              </p>
            </div>
          )}
          
          <button
            onClick={generateNewCode}
            className={`
              mt-4 w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white
              ${isDark 
                ? 'bg-primary-500 hover:bg-primary-400 focus:ring-2 focus:ring-offset-2 focus:ring-primary-400' 
                : 'bg-primary hover:bg-primary-dark focus:ring-2 focus:ring-offset-2 focus:ring-primary'}
            `}
          >
            Сгенерировать новый код
          </button>
        </div>
        
        {/* Блок сканирования QR-кода заказа */}
        <div className={`
          rounded-lg shadow-md p-6 mb-8
          ${isDark ? 'bg-gray-800 border border-gray-700' : 'bg-white'}
        `}>
          <h2 className={`text-xl font-semibold mb-4 ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>
            Сканирование QR-кода заказа
          </h2>
          
          <div className="flex flex-col md:flex-row gap-8">
            <div className="w-full md:w-1/2">
              <p className={`mb-4 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                Отсканируйте QR-код заказа клиента, чтобы привязать его к вашему аккаунту и начать обслуживание.
              </p>
              
              <ul className={`list-disc pl-5 space-y-1 text-sm mb-4 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                <li>Попросите клиента показать QR-код заказа</li>
                <li>Держите камеру ровно и на расстоянии 15-30 см от кода</li>
                <li>После успешного сканирования вы будете перенаправлены на страницу заказа</li>
              </ul>
              
              <div className="flex justify-center md:justify-start">
                <Link 
                  href="/waiter/scan" 
                  className={`
                    py-2 px-4 rounded-md transition duration-200 flex items-center
                    ${isDark 
                      ? 'bg-primary-500 text-white hover:bg-primary-400' 
                      : 'bg-primary text-white hover:bg-primary-dark'}
                  `}
                >
                  <QrCodeIcon className="h-5 w-5 mr-2" />
                  Сканировать QR-код
                </Link>
              </div>
            </div>
            
            <div className="w-full md:w-1/2 flex justify-center">
              <div className={`
                w-full max-w-xs h-64 rounded-lg flex flex-col items-center justify-center
                ${isDark ? 'bg-gray-900' : 'bg-gray-100'}
              `}>
                <QrCodeIcon className={`h-20 w-20 ${isDark ? 'text-gray-600' : 'text-gray-400'}`} />
                <p className={`text-sm mt-4 text-center px-4 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                  Нажмите кнопку "Сканировать QR-код", чтобы открыть сканер камеры
                </p>
              </div>
            </div>
          </div>
        </div>
        
        {/* Список кодов */}
        <div className={`
          rounded-lg shadow-md p-6
          ${isDark ? 'bg-gray-800 border border-gray-700' : 'bg-white'}
        `}>
          <div className="flex justify-between items-center mb-4">
            <h2 className={`text-xl font-semibold ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>
              Активные коды заказов
            </h2>
            <button
              onClick={fetchOrderCodes}
              className={`
                hover:text-primary-dark transition-colors
                ${isDark ? 'text-primary-400 hover:text-primary-300' : 'text-primary'}
              `}
              title="Обновить список"
            >
              <RefreshIcon className="h-5 w-5" />
            </button>
          </div>
          
          {loading ? (
            <div className="flex justify-center py-8">
              <div className={`
                animate-spin rounded-full h-12 w-12 border-t-2 border-b-2
                ${isDark ? 'border-primary-400' : 'border-primary'}
              `}></div>
            </div>
          ) : orderCodes.length === 0 ? (
            <div className={`text-center py-8 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
              Нет активных кодов. Сгенерируйте новый код.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className={`
                min-w-full divide-y
                ${isDark ? 'divide-gray-700' : 'divide-gray-200'}
              `}>
                <thead className={isDark ? 'bg-gray-900/50' : 'bg-gray-50'}>
                  <tr>
                    <th className={`
                      px-6 py-3 text-left text-xs font-medium uppercase tracking-wider
                      ${isDark ? 'text-gray-400' : 'text-gray-500'}
                    `}>
                      Код
                    </th>
                    <th className={`
                      px-6 py-3 text-left text-xs font-medium uppercase tracking-wider
                      ${isDark ? 'text-gray-400' : 'text-gray-500'}
                    `}>
                      Столик
                    </th>
                    <th className={`
                      px-6 py-3 text-left text-xs font-medium uppercase tracking-wider
                      ${isDark ? 'text-gray-400' : 'text-gray-500'}
                    `}>
                      Создан
                    </th>
                    <th className={`
                      px-6 py-3 text-left text-xs font-medium uppercase tracking-wider
                      ${isDark ? 'text-gray-400' : 'text-gray-500'}
                    `}>
                      Статус
                    </th>
                    <th className={`
                      px-6 py-3 text-left text-xs font-medium uppercase tracking-wider
                      ${isDark ? 'text-gray-400' : 'text-gray-500'}
                    `}>
                      Действия
                    </th>
                  </tr>
                </thead>
                <tbody className={`
                  divide-y
                  ${isDark ? 'divide-gray-700' : 'divide-gray-200'}
                `}>
                  {orderCodes.map((codeItem) => (
                    <tr key={codeItem.id} className={`
                      ${codeItem.is_used 
                        ? isDark ? 'bg-gray-900/50' : 'bg-gray-50'
                        : isDark ? 'bg-gray-800' : 'bg-white'}
                    `}>
                      <td className={`
                        px-6 py-4 whitespace-nowrap
                        ${isDark ? 'text-gray-100' : 'text-gray-900'}
                      `}>
                        <div className="text-lg font-mono font-bold">{codeItem.code}</div>
                      </td>
                      <td className={`
                        px-6 py-4 whitespace-nowrap
                        ${isDark ? 'text-gray-300' : 'text-gray-500'}
                      `}>
                        {codeItem.table_number ? `Столик №${codeItem.table_number}` : '—'}
                      </td>
                      <td className={`
                        px-6 py-4 whitespace-nowrap
                        ${isDark ? 'text-gray-300' : 'text-gray-500'}
                      `}>
                        {formatDate(codeItem.created_at)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {codeItem.is_used ? (
                          <span className={`
                            inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
                            ${isDark 
                              ? 'bg-green-900/50 text-green-100' 
                              : 'bg-green-100 text-green-800'}
                          `}>
                            <CheckCircleIcon className="h-4 w-4 mr-1" />
                            Использован
                          </span>
                        ) : (
                          <span className={`
                            inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
                            ${isDark 
                              ? 'bg-blue-900/50 text-blue-100' 
                              : 'bg-blue-100 text-blue-800'}
                          `}>
                            Активен
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <button
                          onClick={() => deleteCode(codeItem.id)}
                          className={`
                            text-sm px-3 py-1 rounded-md border transition-colors
                            ${isDark 
                              ? 'border-gray-600 text-gray-300 hover:bg-gray-700' 
                              : 'border-gray-300 text-gray-700 hover:bg-gray-100'}
                          `}
                        >
                          Удалить
                        </button>
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