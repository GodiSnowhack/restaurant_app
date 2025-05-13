/**
 * Утилиты для работы с приложением
 */

/**
 * Получает базовый URL API бэкенда из переменных окружения или использует значение по умолчанию
 * @returns {string} URL API бэкенда
 */
export function getBackendUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';
}

/**
 * Форматирует дату в локальный формат
 * @param {string | Date} date - Дата для форматирования
 * @returns {string} Отформатированная дата
 */
export function formatDate(date: string | Date): string {
  if (!date) return '';
  return new Date(date).toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

/**
 * Форматирует время в локальный формат
 * @param {string | Date} date - Дата/время для форматирования
 * @returns {string} Отформатированное время
 */
export function formatTime(date: string | Date): string {
  if (!date) return '';
  return new Date(date).toLocaleTimeString('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Форматирует цену в рублях
 * @param {number} price - Цена для форматирования
 * @returns {string} Отформатированная цена с символом рубля
 */
export function formatPrice(price: number): string {
  if (typeof price !== 'number') return '0 ₽';
  return `${price.toLocaleString('ru-RU')} ₽`;
}

/**
 * Получает сокращённое имя пользователя (имя и первую букву фамилии)
 * @param {string} fullName - Полное имя пользователя
 * @returns {string} Сокращённое имя
 */
export function getShortName(fullName: string): string {
  if (!fullName) return '';
  
  const parts = fullName.trim().split(' ');
  if (parts.length === 1) return parts[0];
  
  return `${parts[0]} ${parts[1].charAt(0)}.`;
}

/**
 * Проверяет, является ли строка действительным URL
 * @param {string} url - URL для проверки
 * @returns {boolean} true, если URL действителен
 */
export function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * Получает первые буквы имени для аватара
 * @param {string} name - Имя пользователя
 * @returns {string} Инициалы
 */
export function getInitials(name: string): string {
  if (!name) return '';
  
  const parts = name.trim().split(' ');
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  
  return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase();
}

export const isMobileDevice = (): boolean => {
  if (typeof window === 'undefined') return false;
  
  return (
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent
    ) ||
    (window.innerWidth <= 768 && 'ontouchstart' in window)
  );
}; 