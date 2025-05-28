// Функция инициализации состояния авторизации
const initializeAuth = async () => {
  console.log('AuthStore: Начало инициализации');
  
  // Отключаем демо-режим
  try {
    localStorage.removeItem('force_demo_data');
  } catch (e) {
    console.error('AuthStore: Ошибка при отключении демо-режима:', e);
  }
  
  // ... existing code ...
} 