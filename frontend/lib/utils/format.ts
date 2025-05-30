/**
 * Функция для форматирования денежных значений
 * @param amount - Сумма для форматирования
 * @param locale - Локаль для форматирования (по умолчанию ru-RU)
 * @param currency - Валюта для форматирования (по умолчанию RUB)
 * @returns Отформатированная строка с суммой и символом валюты
 */
export const formatCurrency = (
  amount: number | string,
  locale: string = 'ru-RU',
  currency: string = 'RUB'
): string => {
  // Преобразуем строку в число, если необходимо
  const numericAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
  
  // Проверяем, является ли значение числом
  if (isNaN(numericAmount)) return '0 ₽';
  
  try {
    // Используем Intl.NumberFormat для форматирования
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(numericAmount);
  } catch (error) {
    console.error('Ошибка при форматировании валюты:', error);
    // Возвращаем базовое форматирование в случае ошибки
    return `${Math.round(numericAmount)} ₽`;
  }
};

/**
 * Функция для форматирования процентов
 * @param value - Значение для форматирования
 * @param locale - Локаль для форматирования (по умолчанию ru-RU)
 * @returns Отформатированная строка с процентами
 */
export const formatPercent = (
  value: number | string,
  locale: string = 'ru-RU'
): string => {
  // Преобразуем строку в число, если необходимо
  const numericValue = typeof value === 'string' ? parseFloat(value) : value;
  
  // Проверяем, является ли значение числом
  if (isNaN(numericValue)) return '0%';
  
  try {
    // Используем Intl.NumberFormat для форматирования
    return new Intl.NumberFormat(locale, {
      style: 'percent',
      minimumFractionDigits: 0,
      maximumFractionDigits: 1
    }).format(numericValue / 100);
  } catch (error) {
    console.error('Ошибка при форматировании процентов:', error);
    // Возвращаем базовое форматирование в случае ошибки
    return `${Math.round(numericValue)}%`;
  }
};

/**
 * Функция для форматирования даты
 * @param date - Дата для форматирования
 * @param locale - Локаль для форматирования (по умолчанию ru-RU)
 * @param options - Опции форматирования
 * @returns Отформатированная строка с датой
 */
export const formatDate = (
  date: Date | string,
  locale: string = 'ru-RU',
  options?: Intl.DateTimeFormatOptions
): string => {
  if (!date) return 'Не указано';
  
  try {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    
    // Проверяем валидность даты
    if (isNaN(dateObj.getTime())) return 'Некорректная дата';
    
    // Используем Intl.DateTimeFormat для форматирования
    const defaultOptions: Intl.DateTimeFormatOptions = {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    };
    
    return new Intl.DateTimeFormat(locale, options || defaultOptions).format(dateObj);
  } catch (error) {
    console.error('Ошибка при форматировании даты:', error);
    return 'Некорректная дата';
  }
}; 