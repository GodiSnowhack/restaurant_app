/**
 * Вспомогательные функции для работы с изображениями
 */

// Базовый URL для статических изображений
export const IMAGE_BASE_URL = "/images";

// Путь к заглушке по умолчанию
export const DEFAULT_IMAGE_PATH = `${IMAGE_BASE_URL}/dishes/default.jpg`;

/**
 * Возвращает URL изображения блюда или URL по умолчанию, если изображение недоступно
 * @param imageUrl URL изображения или null/undefined
 * @returns URL изображения или изображения по умолчанию
 */
export const getDishImageUrl = (imageUrl: string | null | undefined): string => {
  // Если изображение не указано, возвращаем изображение-заглушку
  if (!imageUrl) {
    return DEFAULT_IMAGE_PATH;
  }
  
  // Если URL уже начинается с /images или http, возвращаем как есть
  if (imageUrl.startsWith('/images') || imageUrl.startsWith('http')) {
    return imageUrl;
  }
  
  // Если URL соответствует одному из стандартных имен файлов
  const standardImages = ['burger.jpg', 'caesar.jpg', 'borsch.jpg', 'tiramisu.jpg', 'latte.jpg'];
  if (standardImages.includes(imageUrl)) {
    return `${IMAGE_BASE_URL}/dishes/default.jpg`;
  }
  
  // Если имя файла соответствует формату "dish_[timestamp].jpg"
  if (imageUrl.match(/dish_\d+\.jpg/)) {
    return `${IMAGE_BASE_URL}/dishes/${imageUrl}`;
  }
  
  // Иначе добавляем базовый путь
  return `${IMAGE_BASE_URL}/dishes/${imageUrl}`;
};

/**
 * Обрабатывает ошибку загрузки изображения, заменяя его на изображение по умолчанию
 * @param event Событие ошибки загрузки изображения
 */
export const handleImageError = (event: React.SyntheticEvent<HTMLImageElement, Event>): void => {
  const img = event.currentTarget;
  img.onerror = null; // Предотвращаем бесконечную рекурсию
  img.src = DEFAULT_IMAGE_PATH;
  
  // Добавляем дополнительные классы для оформления
  img.classList.add('fallback-image');
}; 