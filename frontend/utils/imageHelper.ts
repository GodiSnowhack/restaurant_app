/**
 * Вспомогательные функции для работы с изображениями
 */

// Базовый URL для статических изображений
export const IMAGE_BASE_URL = "/images";

/**
 * Возвращает URL изображения блюда или URL по умолчанию, если изображение недоступно
 * @param imageUrl URL изображения или null/undefined
 * @returns URL изображения или изображения по умолчанию
 */
export const getDishImageUrl = (imageUrl: string | null | undefined): string => {
  // Если передан URL, используем его
  if (imageUrl) {
    // Если URL уже начинается с /images или http, возвращаем как есть
    if (imageUrl.startsWith('/images') || imageUrl.startsWith('http')) {
      return imageUrl;
    }
    // Иначе добавляем базовый путь
    return `${IMAGE_BASE_URL}/dishes/${imageUrl}`;
  }
  
  // Если изображение не указано, возвращаем изображение-заглушку
  return `${IMAGE_BASE_URL}/placeholder.jpg`;
};

/**
 * Обрабатывает ошибку загрузки изображения, заменяя его на изображение по умолчанию
 * @param event Событие ошибки загрузки изображения
 */
export const handleImageError = (event: React.SyntheticEvent<HTMLImageElement, Event>): void => {
  const img = event.currentTarget;
  img.onerror = null; // Предотвращаем бесконечную рекурсию
  img.src = `${IMAGE_BASE_URL}/placeholder.jpg`;
}; 