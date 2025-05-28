/**
 * Форматирует дату в ISO строку для отправки на сервер
 * @param date Объект даты или строка с датой
 * @returns ISO строка даты
 */
export const formatDateToISO = (date: Date | string): string => {
  if (typeof date === 'string') {
    return new Date(date).toISOString();
  }
  return date.toISOString();
};

/**
 * Форматирует дату в локальный формат для отображения
 * @param date Строка даты в ISO формате или объект Date
 * @param includeTime Включать ли время в результат
 * @returns Отформатированная строка даты
 */
export const formatDateToLocal = (
  date: string | Date | undefined,
  includeTime: boolean = true
): string => {
  if (!date) return '';
  
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  if (includeTime) {
    return dateObj.toLocaleString('ru-RU', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }
  
  return dateObj.toLocaleDateString('ru-RU', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
};

/**
 * Получает начало и конец дня для указанной даты
 * @param date Объект даты
 * @returns Объект с датами начала и конца дня
 */
export const getDayStartEnd = (date: Date): { start: Date; end: Date } => {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);
  
  return { start, end };
};

/**
 * Получает начало и конец недели для указанной даты
 * @param date Объект даты
 * @returns Объект с датами начала и конца недели
 */
export const getWeekStartEnd = (date: Date): { start: Date; end: Date } => {
  const start = new Date(date);
  const day = start.getDay();
  const diff = start.getDate() - day + (day === 0 ? -6 : 1); // Настраиваем на понедельник
  
  start.setDate(diff);
  start.setHours(0, 0, 0, 0);
  
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  
  return { start, end };
};

/**
 * Получает начало и конец месяца для указанной даты
 * @param date Объект даты
 * @returns Объект с датами начала и конца месяца
 */
export const getMonthStartEnd = (date: Date): { start: Date; end: Date } => {
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  start.setHours(0, 0, 0, 0);
  
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  end.setHours(23, 59, 59, 999);
  
  return { start, end };
};

/**
 * Проверяет, что дата находится в пределах указанного диапазона
 * @param date Дата для проверки
 * @param start Начало диапазона
 * @param end Конец диапазона
 * @returns true, если дата в диапазоне
 */
export const isDateInRange = (
  date: Date | string,
  start: Date | string,
  end: Date | string
): boolean => {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  const startObj = typeof start === 'string' ? new Date(start) : start;
  const endObj = typeof end === 'string' ? new Date(end) : end;
  
  return dateObj >= startObj && dateObj <= endObj;
}; 