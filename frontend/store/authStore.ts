/**
 * Модуль для управления состоянием авторизации
 * Реэкспортирует функционал из lib/auth-store.ts
 */

// Импортируем существующий хук из модуля lib
import useAuthStoreOriginal from '../lib/auth-store';

// Реэкспортируем хук под именем useAuthStore для обратной совместимости
export const useAuthStore = useAuthStoreOriginal;

// Экспортируем по умолчанию для поддержки различных типов импорта
export default useAuthStoreOriginal; 