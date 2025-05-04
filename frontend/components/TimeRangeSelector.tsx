import React, { useState } from 'react';
import { TimeRangeFilter } from '../types/analytics';
import { CalendarIcon } from '@heroicons/react/24/outline';

interface TimeRangeSelectorProps {
  value: TimeRangeFilter;
  onChange: (value: TimeRangeFilter) => void;
  onCustomRangeChange?: (dates: [Date | null, Date | null]) => void;
  customRange?: [Date | null, Date | null];
  className?: string;
}

/**
 * Компонент выбора временного диапазона для аналитики
 */
const TimeRangeSelector: React.FC<TimeRangeSelectorProps> = ({
  value,
  onChange,
  onCustomRangeChange,
  customRange = [null, null],
  className = ''
}) => {
  const [showDatePicker, setShowDatePicker] = useState(false);

  const options: { value: TimeRangeFilter; label: string }[] = [
    { value: 'today', label: 'Сегодня' },
    { value: 'week', label: 'Неделя' },
    { value: 'month', label: 'Месяц' },
    { value: 'quarter', label: 'Квартал' },
    { value: 'year', label: 'Год' },
    { value: 'custom', label: 'Произвольный' }
  ];

  // Функция для отображения выбранного диапазона дат
  const formatCustomRange = (): string => {
    if (customRange[0] && customRange[1]) {
      const formatDate = (date: Date) => {
        return date.toLocaleDateString('ru-RU', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric'
        });
      };
      return `${formatDate(customRange[0])} - ${formatDate(customRange[1])}`;
    }
    return 'Выберите даты';
  };

  // Обработчик изменения дат при произвольном диапазоне
  const handleDateChange = (start: Date | null, end: Date | null) => {
    if (onCustomRangeChange && start && end) {
      onCustomRangeChange([start, end]);
      setShowDatePicker(false);
    }
  };

  return (
    <div className={`flex flex-col ${className}`}>
      <div className="flex flex-wrap gap-2 mb-2">
        {options.map(option => (
          <button
            key={option.value}
            type="button"
            onClick={() => {
              onChange(option.value);
              if (option.value === 'custom') {
                setShowDatePicker(true);
              } else {
                setShowDatePicker(false);
              }
            }}
            className={`px-3 py-2 text-sm rounded-md transition-colors ${
              value === option.value
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      {value === 'custom' && (
        <div className="flex items-center mt-2">
          <CalendarIcon className="h-5 w-5 text-gray-500 mr-2" />
          <div 
            className="text-sm cursor-pointer p-2 border border-gray-300 rounded-md hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700"
            onClick={() => setShowDatePicker(!showDatePicker)}
          >
            {formatCustomRange()}
          </div>
          
          {showDatePicker && (
            <div className="absolute z-10 mt-1 bg-white dark:bg-gray-800 shadow-lg rounded-md p-2 border border-gray-300 dark:border-gray-600">
              {/* Здесь можно добавить компонент выбора дат */}
              <div className="flex space-x-2 mt-2">
                <input 
                  type="date" 
                  className="p-2 text-sm border border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  onChange={(e) => {
                    const startDate = e.target.value ? new Date(e.target.value) : null;
                    if (customRange[1]) {
                      handleDateChange(startDate, customRange[1]);
                    }
                  }}
                  value={customRange[0] ? customRange[0].toISOString().split('T')[0] : ''}
                />
                <input 
                  type="date" 
                  className="p-2 text-sm border border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  onChange={(e) => {
                    const endDate = e.target.value ? new Date(e.target.value) : null;
                    if (customRange[0]) {
                      handleDateChange(customRange[0], endDate);
                    }
                  }}
                  value={customRange[1] ? customRange[1].toISOString().split('T')[0] : ''}
                  min={customRange[0] ? customRange[0].toISOString().split('T')[0] : ''}
                />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default TimeRangeSelector; 