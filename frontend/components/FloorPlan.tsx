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
  isPixelPosition?: boolean;
  tableScaleFactor?: number;
  maxWidth?: number;
  maxHeight?: number;
  percentMultiplier?: number;
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
  tableScaleFactor = 1.0,
  maxWidth = 800,
  maxHeight = 600,
  percentMultiplier = 1,
  isDark = false
}) => {
  // Функция для масштабирования координат
  const scalePosition = (position: number, isX: boolean) => {
    const scale = isX ? maxWidth / 800 : maxHeight / 600;
    return position * scale;
  };

  // Функция для получения стиля стола на основе его статуса и доступности
  const getTableStyle = (table: RestaurantTable) => {
    // Базовые стили
    const baseStyle = 'absolute transform -translate-x-1/2 -translate-y-1/2 rounded-xl flex items-center justify-center text-sm font-medium transition-all duration-200 shadow-md';
    
    // Размеры стола в зависимости от вместимости
    const widthPx = table.capacity <= 2 ? 80 * tableScaleFactor :
                    table.capacity <= 4 ? 96 * tableScaleFactor :
                    table.capacity <= 6 ? 112 * tableScaleFactor :
                    128 * tableScaleFactor;
    
    const heightPx = widthPx; // Делаем столы квадратными для лучшего вида
    
    // Стили в зависимости от статуса
    let statusStyle = '';
    if (!table.is_active) {
      statusStyle = isDark 
        ? 'bg-gray-800 text-gray-400 cursor-not-allowed border border-gray-700'
        : 'bg-gray-200 text-gray-500 cursor-not-allowed border border-gray-300';
    } else if (table.status === 'occupied' || table.status === 'reserved') {
      statusStyle = isDark
        ? 'bg-red-900/30 text-red-400 cursor-not-allowed border-2 border-red-800'
        : 'bg-red-100 text-red-700 cursor-not-allowed border-2 border-red-300';
    } else if (minGuestCount > 0 && table.capacity < minGuestCount) {
      statusStyle = isDark
        ? 'bg-yellow-900/30 text-yellow-400 cursor-not-allowed border border-yellow-800'
        : 'bg-yellow-100 text-yellow-700 cursor-not-allowed border border-yellow-300';
    } else {
      statusStyle = isDark
        ? 'bg-green-900/30 hover:bg-green-900/50 text-green-400 cursor-pointer border-2 border-green-800 hover:shadow-lg hover:-translate-y-1'
        : 'bg-green-100 hover:bg-green-200 text-green-700 cursor-pointer border-2 border-green-300 hover:shadow-lg hover:-translate-y-1';
    }
    
    // Выбранный стол
    if (table.id === selectedTableId) {
      statusStyle = isDark
        ? 'bg-blue-900/50 hover:bg-blue-900/70 text-blue-300 cursor-pointer border-2 border-blue-700 hover:shadow-lg hover:-translate-y-1 animate-pulse'
        : 'bg-blue-500 hover:bg-blue-600 text-white cursor-pointer border-2 border-blue-300 hover:shadow-lg hover:-translate-y-1 animate-pulse';
    }

    // Позиционирование стола с учетом масштабирования
    const position = {
      left: isPixelPosition 
        ? `${scalePosition(table.position_x, true)}px` 
        : `${table.position_x}%`,
      top: isPixelPosition 
        ? `${scalePosition(table.position_y, false)}px` 
        : `${table.position_y}%`
    };
    
    return {
      className: `${baseStyle} ${statusStyle}`,
      style: {
        width: `${widthPx}px`,
        height: `${heightPx}px`,
        ...position
      }
    };
  };

  // Обработчик выбора стола
  const handleTableClick = (table: RestaurantTable) => {
    if (onTableSelect && table.is_active && table.status === 'available' && (minGuestCount === 0 || table.capacity >= minGuestCount)) {
      onTableSelect(table);
    }
  };

  return (
    <div className={`relative ${height} ${containerClassName}`}>
      <div className="absolute inset-0 w-full h-full">
        {/* Сетка для ориентации */}
        <div className="absolute inset-0 grid grid-cols-10 grid-rows-10">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={`grid-row-${i}`} className="w-full h-full border-t border-gray-200/10" />
          ))}
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={`grid-col-${i}`} className="w-full h-full border-l border-gray-200/10" />
          ))}
        </div>

        {/* Столы */}
        {tables.map((table) => {
          const tableStyles = getTableStyle(table);
          return (
            <div
              key={table.id}
              className={tableStyles.className}
              style={tableStyles.style}
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

        {/* Вход */}
        {showEntrance && (
          <div className={`
            absolute bottom-4 right-4 
            ${isDark ? 'bg-blue-900/30 text-blue-400 border-blue-800' : 'bg-blue-100 text-blue-700 border-blue-200'} 
            rounded-md h-12 w-24 flex items-center justify-center text-sm font-medium border shadow-inner
          `}>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 9l3 3m0 0l-3 3m3-3H8m13 0a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Вход
          </div>
        )}

        {/* Легенда */}
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
                <div className={`w-4 h-4 rounded ${isDark ? 'bg-green-900/50 border-green-700' : 'bg-green-200 border-green-400'} border mr-2`}></div>
                <span className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>Доступно</span>
              </div>
              <div className="flex items-center">
                <div className={`w-4 h-4 rounded ${isDark ? 'bg-red-900/50 border-red-700' : 'bg-red-200 border-red-400'} border mr-2`}></div>
                <span className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>Занято</span>
              </div>
              <div className="flex items-center">
                <div className={`w-4 h-4 rounded ${isDark ? 'bg-yellow-900/50 border-yellow-700' : 'bg-yellow-200 border-yellow-400'} border mr-2`}></div>
                <span className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>Недостаточно мест</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default FloorPlan; 