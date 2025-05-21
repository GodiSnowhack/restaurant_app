import React from 'react';
import {InformationCircleIcon} from '@heroicons/react/24/solid';
import { RestaurantTable } from '../lib/api/types';

interface FloorPlanProps {
  tables: RestaurantTable[];
  selectedTableId?: number | null;
  onTableSelect?: (table: RestaurantTable) => void;
  minGuestCount?: number;
  containerClassName?: string;
  height?: string;
  showBarCounter?: boolean;
  showLegend?: boolean;
  showEntrance?: boolean;
  isPixelPosition?: boolean; // true - позиция в px, false - в процентах
  tableScaleFactor?: number; // Множитель для изменения размера столов
  maxWidth?: number; // Максимальная ширина зала
  maxHeight?: number; // Максимальная высота зала
  percentMultiplier?: number; // Множитель для процентных координат
  isDark?: boolean;
}

const FloorPlan: React.FC<FloorPlanProps> = ({
  tables,
  selectedTableId,
  onTableSelect,
  minGuestCount = 0,
  containerClassName = "h-96",
  height = "h-96",
  showLegend = true,
  showEntrance = true,
  isPixelPosition = true,
  tableScaleFactor = 1.0, // По умолчанию нет изменения размера
  maxWidth = 600, // Максимальная ширина зала по умолчанию
  maxHeight = 400, // Максимальная высота зала по умолчанию
  percentMultiplier = 2, // Уменьшенный множитель для процентных координат
  isDark = false
}) => {
  // Функция для получения стиля стола на основе его статуса и доступности
  const getTableStyle = (table: RestaurantTable) => {
    // Базовые стили
    let baseStyle = 'absolute transform -translate-x-1/2 -translate-y-1/2 rounded-xl flex items-center justify-center text-sm font-medium transition-all duration-200 shadow-md';
    
    // Стили в зависимости от размера стола (с учетом множителя масштабирования)
    let sizeClass = '';
    if (table.capacity <= 2) {
      sizeClass = `w-${Math.max(16, Math.round(20 * tableScaleFactor))} h-${Math.max(16, Math.round(20 * tableScaleFactor))}`;
    } else if (table.capacity <= 4) {
      sizeClass = `w-${Math.max(20, Math.round(24 * tableScaleFactor))} h-${Math.max(20, Math.round(24 * tableScaleFactor))}`;
    } else if (table.capacity <= 6) {
      sizeClass = `w-${Math.max(24, Math.round(28 * tableScaleFactor))} h-${Math.max(24, Math.round(28 * tableScaleFactor))}`;
    } else {
      sizeClass = `w-${Math.max(28, Math.round(32 * tableScaleFactor))} h-${Math.max(28, Math.round(32 * tableScaleFactor))}`;
    }
    
    // Можно также использовать абсолютные размеры через стили:
    const widthPx = table.capacity <= 2 ? 80 * tableScaleFactor :
                     table.capacity <= 4 ? 96 * tableScaleFactor :
                     table.capacity <= 6 ? 112 * tableScaleFactor :
                     128 * tableScaleFactor;
    
    const heightPx = table.capacity <= 2 ? 80 * tableScaleFactor :
                      table.capacity <= 4 ? 96 * tableScaleFactor :
                      table.capacity <= 6 ? 112 * tableScaleFactor :
                      128 * tableScaleFactor;
    
    // Стили в зависимости от статуса
    let statusStyle = '';
    if (!table.is_active) {
      statusStyle = 'bg-gray-200 text-gray-500 cursor-not-allowed border border-gray-300';
    } else if (table.status === 'occupied' || table.status === 'reserved') {
      statusStyle = 'bg-red-100 text-red-700 cursor-not-allowed border-2 border-red-300';
    } else if (minGuestCount > 0 && table.capacity < minGuestCount) {
      statusStyle = 'bg-yellow-100 text-yellow-700 cursor-not-allowed border border-yellow-300';
    } else {
      statusStyle = 'bg-green-100 hover:bg-green-200 text-green-700 cursor-pointer border-2 border-green-300 hover:shadow-lg hover:-translate-y-1';
    }
    
    // Выбранный стол
    if (table.id === selectedTableId) {
      statusStyle = 'bg-blue-500 hover:bg-blue-600 text-white cursor-pointer border-2 border-blue-300 hover:shadow-lg hover:-translate-y-1 animate-pulse';
    }
    
    return {
      className: `${baseStyle} ${statusStyle}`,
      style: {
        width: `${widthPx}px`,
        height: `${heightPx}px`
      }
    };
  };

  // Обработчик выбора стола
  const handleTableClick = (table: RestaurantTable) => {
    if (onTableSelect && table.is_active && table.status === 'available' && (minGuestCount === 0 || table.capacity >= minGuestCount)) {
      onTableSelect(table);
    }
  };

  // Функция для вычисления подходящего размера плана зала
  const floorPlanDimensions = () => {
    if (tables.length === 0) return { width: 100, height: 100 };
    
    // Находим максимальные координаты, чтобы определить размеры плана
    const maxX = Math.max(...tables.map(t => isPixelPosition ? t.position_x : t.position_x * percentMultiplier)) + 40; // Добавим небольшой отступ справа
    const maxY = Math.max(...tables.map(t => isPixelPosition ? t.position_y : t.position_y * percentMultiplier)) + 40; // Добавим небольшой отступ снизу
    
    return {
      width: Math.min(maxWidth, Math.max(100, maxX)), // Ограничиваем максимальной шириной
      height: Math.min(maxHeight, Math.max(100, maxY))  // Ограничиваем максимальной высотой
    };
  };

  const dimensions = floorPlanDimensions();

  return (
    <div className={`relative ${height} bg-gray-50 overflow-auto rounded-md border border-dashed border-gray-300 bg-gradient-to-b from-gray-50 to-gray-100 ${containerClassName}`}>
      {/* Визуальная сетка для ориентации (тонкие линии) */}
      <div className="absolute inset-0" style={{ width: `${dimensions.width}px`, height: `${dimensions.height}px` }}>
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={`grid-hor-${i}`} className="absolute border-t border-gray-100 w-full" style={{ top: `${(i + 1) * 10}%` }}></div>
        ))}
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={`grid-ver-${i}`} className="absolute border-l border-gray-100 h-full" style={{ left: `${(i + 1) * 10}%` }}></div>
        ))}
      </div>

      {/* Декоративные элементы */}
      <div className="absolute top-1/4 left-1/2 transform -translate-x-1/2 -translate-y-1/2 border-b-2 border-gray-300 w-3/4"
           style={{ width: `${dimensions.width * 0.75}px` }}></div>
      <div className="absolute top-1/3 left-0 w-24 h-24 bg-gray-200 rounded-tr-xl rounded-br-xl opacity-80"></div>
      <div className="absolute top-2/3 right-0 w-24 h-24 bg-gray-200 rounded-tl-xl rounded-bl-xl opacity-80"></div>
      
      {/* Вход */}
      {showEntrance && (
        <div className="absolute bottom-12 right-12 bg-blue-100 rounded-md h-16 w-28 flex items-center justify-center text-sm text-blue-700 font-medium border border-blue-200 shadow-inner z-10">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 9l3 3m0 0l-3 3m3-3H8m13 0a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Вход
        </div>
      )}
      
      {/* Столы */}
      {tables.map((table) => {
        const tableStyles = getTableStyle(table);
        
        // Определим позицию с учетом типа координат (проценты или пиксели)
        const posX = isPixelPosition ? table.position_x : (table.position_x * percentMultiplier); // Множитель для процентов
        const posY = isPixelPosition ? table.position_y : (table.position_y * percentMultiplier); // Множитель для процентов
        
        return (
          <div
            key={table.id}
            className={tableStyles.className}
            style={{ 
              ...tableStyles.style,
              left: `${posX}px`, 
              top: `${posY}px` 
            }}
            onClick={() => handleTableClick(table)}
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
        );
      })}
      
      {/* Условные обозначения */}
      {showLegend && (
        <div className={`
          absolute left-4 bottom-4 p-3 rounded-lg shadow-md
          ${isDark ? 'bg-gray-800 border border-gray-700' : 'bg-white border border-gray-200'}
        `}>
          <div className={`text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
            Условные обозначения:
          </div>
          <div className="space-y-2">
          <div className="flex items-center">
              <div className="w-4 h-4 rounded bg-green-200 border border-green-400 mr-2"></div>
              <span className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>Доступно</span>
          </div>
            <div className="flex items-center">
              <div className="w-4 h-4 rounded bg-red-200 border border-red-400 mr-2"></div>
              <span className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>Занято</span>
            </div>
            <div className="flex items-center">
              <div className="w-4 h-4 rounded bg-yellow-200 border border-yellow-400 mr-2"></div>
              <span className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>Недостаточно мест</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FloorPlan; 