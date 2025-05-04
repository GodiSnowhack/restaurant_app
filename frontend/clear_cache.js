// Скрипт для очистки локального кэша
// Выполните этот код в консоли браузера

(function clearAppCache() {
  try {
    // Список ключей кэша, которые нужно очистить
    const cacheKeys = [
      'cached_dishes',
      'cached_categories',
      'cached_orders',
      'dishes_update_time',
      'categories_update_time',
      'orders_update_time',
      'menu_items',
      'menu_categories',
      'cached_menu_items',
      'cached_menu_categories',
      'cached_restaurant_orders',
      'cached_restaurant_tables'
    ];
    
    // Список ключей, которые нужно сохранить при очистке
    const keysToPreserve = [
      'token',
      'refresh_token', // Сохраняем refresh_token
      'user_profile',
      'auth_timestamp',
      'working_hours',
      'restaurant_settings',
      'theme',
      'language'
    ];
    
    // Функция для сохранения выбранных ключей
    function preserveImportantKeys() {
      const preservedData = {};
      
      // Сохраняем важные ключи
      for (const key of keysToPreserve) {
        const value = localStorage.getItem(key);
        if (value) {
          preservedData[key] = value;
        }
      }
      
      return preservedData;
    }

    // Функция для восстановления выбранных ключей
    function restoreImportantKeys(data) {
      // Восстанавливаем важные ключи
      for (const [key, value] of Object.entries(data)) {
        localStorage.setItem(key, value);
      }
    }

    // Сохраняем важные данные перед очисткой
    const preservedData = preserveImportantKeys();

    // Удаляем все кэши
    cacheKeys.forEach(key => {
      if (localStorage.getItem(key)) {
        localStorage.removeItem(key);
        console.log(`✅ Кэш '${key}' успешно очищен`);
      } else {
        console.log(`ℹ️ Кэш '${key}' не найден`);
      }
    });

    // Очищаем другие кэши, которые могут содержать данные о блюдах
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith('cached_dishes_')) {
        localStorage.removeItem(key);
        console.log(`✅ Кэш '${key}' успешно очищен`);
      }
    });

    // Сброс некоторых сетевых диагностических данных
    ['network_diagnostics', 'api_last_errors', 'last_connection_error'].forEach(key => {
      if (localStorage.getItem(key)) {
        localStorage.removeItem(key);
        console.log(`✅ Диагностические данные '${key}' успешно очищены`);
      }
    });

    // Очищаем localStorage
    localStorage.clear();
    console.log('✅ localStorage очищен');
    
    // Восстанавливаем важные ключи
    restoreImportantKeys(preservedData);
    console.log('✅ Важные ключи восстановлены:', Object.keys(preservedData));

    console.log('🎉 Очистка кэша завершена');
    console.log('🔄 Рекомендуется обновить страницу (F5)');
    
    return "Кэш успешно очищен";
  } catch (error) {
    console.error('❌ Ошибка при очистке кэша:', error);
    return "Ошибка при очистке кэша";
  }
})(); 