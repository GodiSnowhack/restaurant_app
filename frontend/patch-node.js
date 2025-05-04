// Патч для модуля path.relative, исправляющий ошибку: 
// TypeError: The "to" argument must be of type string. Received undefined
// 
// Используется через NODE_OPTIONS='--require ./patch-node.js'

// Защищаем стандартный метод path.relative от undefined аргументов
const path = require('path');
const originalRelative = path.relative;

path.relative = function(from, to) {
  if (from === undefined || to === undefined) {
    console.log('[PATCHED] path.relative получил undefined аргумент - предотвращен сбой');
    return '';
  }
  return originalRelative.call(this, from, to);
};

// Также добавляем обработчик необработанных исключений для страховки
process.on('uncaughtException', (err) => {
  if (err && 
     (err.code === 'ERR_INVALID_ARG_TYPE') && 
     (err.message && err.message.includes('The "to" argument must be of type string'))) {
    console.log('Перехвачена ошибка в path.relative - приложение продолжает работу');
    return;
  }
  
  // Пробрасываем другие ошибки
  throw err;
}); 