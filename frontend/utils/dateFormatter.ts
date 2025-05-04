/**
 * Форматирует дату из формата ISO (YYYY-MM-DD) в формат для отображения (DD.MM.YYYY)
 */
export const formatDateToDisplay = (isoDate: string): string => {
  try {
    const date = new Date(isoDate);
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${year}-${month}-${day}`;
  } catch (e) {
    console.error('Ошибка при форматировании даты:', e);
    return '';
  }
};

/**
 * Форматирует дату из формата для отображения (DD.MM.YYYY) в формат ISO (YYYY-MM-DD)
 */
export const formatDateToISO = (displayDate: string): string => {
  if (!displayDate) return '';
  
  // Если дата уже в формате ISO, просто возвращаем её
  if (/^\d{4}-\d{2}-\d{2}$/.test(displayDate)) {
    return displayDate;
  }
  
  try {
    // Предполагаем, что входная дата может быть в формате DD.MM.YYYY
    if (displayDate.includes('.')) {
      const [day, month, year] = displayDate.split('.');
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }
    
    // Если передана дата из input[type="date"], она уже будет в формате YYYY-MM-DD
    return displayDate;
  } catch (e) {
    console.error('Ошибка при форматировании даты в ISO:', e);
    return '';
  }
};

/**
 * Форматирует дату для отображения пользователю
 * 
 * @param dateString - Строка даты в ISO формате
 * @param options - Дополнительные настройки форматирования
 * @returns Отформатированная строка даты и времени
 */
export function formatDate(
  dateString: string | Date | undefined,
  options: {
    withTime?: boolean;
    locale?: string;
  } = {}
): string {
  if (!dateString) return 'Н/Д';

  try {
    const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
    
    // Проверяем валидность даты
    if (isNaN(date.getTime())) {
      return 'Некорректная дата';
    }
    
    const locale = options.locale || 'ru-RU';
    
    // Форматируем дату
    const dateFormatter = new Intl.DateTimeFormat(locale, {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    
    // Если нужно отображать время, добавляем его
    if (options.withTime) {
      const timeFormatter = new Intl.DateTimeFormat(locale, {
        hour: '2-digit',
        minute: '2-digit'
      });
      
      return `${dateFormatter.format(date)}, ${timeFormatter.format(date)}`;
    }
    
    return dateFormatter.format(date);
  } catch (error) {
    console.error('Ошибка при форматировании даты:', error);
    return 'Ошибка форматирования даты';
  }
}

/**
 * Рассчитывает, сколько времени прошло с указанной даты в человеко-понятном формате
 * 
 * @param dateString - Строка даты в ISO формате или объект Date
 * @param locale - Локаль для форматирования
 * @returns Строка с указанием прошедшего времени (например, "5 минут назад", "2 часа назад")
 */
export function timeAgo(
  dateString: string | Date | undefined,
  locale: string = 'ru-RU'
): string {
  if (!dateString) return 'Н/Д';

  try {
    const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
    
    // Проверяем валидность даты
    if (isNaN(date.getTime())) {
      return 'Некорректная дата';
    }
    
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    
    // Менее минуты
    if (diff < 60 * 1000) {
      return 'только что';
    }
    
    // Менее часа
    if (diff < 60 * 60 * 1000) {
      const minutes = Math.floor(diff / (60 * 1000));
      return `${minutes} ${pluralize(minutes, 'минуту', 'минуты', 'минут')} назад`;
    }
    
    // Менее суток
    if (diff < 24 * 60 * 60 * 1000) {
      const hours = Math.floor(diff / (60 * 60 * 1000));
      return `${hours} ${pluralize(hours, 'час', 'часа', 'часов')} назад`;
    }
    
    // Менее недели
    if (diff < 7 * 24 * 60 * 60 * 1000) {
      const days = Math.floor(diff / (24 * 60 * 60 * 1000));
      return `${days} ${pluralize(days, 'день', 'дня', 'дней')} назад`;
    }
    
    // Для более старых дат возвращаем обычную дату
    return formatDate(date);
  } catch (error) {
    console.error('Ошибка при расчете времени:', error);
    return 'Ошибка расчета времени';
  }
}

/**
 * Вспомогательная функция для правильного склонения русских слов
 */
function pluralize(
  count: number,
  one: string,
  few: string,
  many: string
): string {
  if (count % 10 === 1 && count % 100 !== 11) {
    return one;
  }
  if ([2, 3, 4].includes(count % 10) && ![12, 13, 14].includes(count % 100)) {
    return few;
  }
  return many;
} 