/**
 * Скрипт для исправления ошибки в watchpack в Next.js
 * Используется как preload модуль с опцией -r в node
 */

// Перехватываем метод path.relative до его использования watchpack
const path = require('path');
const originalRelative = path.relative;

// Заменяем метод на безопасную версию, которая не вызывает ошибку при undefined аргументах
path.relative = function safeRelative(from, to) {
  if (from === undefined || to === undefined) {
    // Вместо ошибки возвращаем пустую строку
    console.warn('PATCHED: path.relative получил undefined аргумент - предотвращение сбоя');
    return '';
  }
  return originalRelative(from, to);
};

console.log('✓ Патч для watchpack успешно применен'); 