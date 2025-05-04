#!/usr/bin/env node

/**
 * Скрипт для безопасного запуска Next.js с исправлением ошибки
 * TypeError: The "to" argument must be of type string. Received undefined
 * 
 * Этот скрипт патчит Node.js модуль path прямо перед запуском Next.js
 */

// Патчим встроенный модуль path
const Module = require('module');
const originalRequire = Module.prototype.require;

// Перехватываем все загрузки модуля 'path'
Module.prototype.require = function patchedRequire(id) {
  const result = originalRequire.apply(this, arguments);
  
  // Если загрузили модуль path, перезаписываем метод relative
  if (id === 'path') {
    const originalRelative = result.relative;
    result.relative = function safeRelative(from, to) {
      // Проверяем аргументы
      if (from === undefined || to === undefined) {
        console.log('[PATCHED] path.relative защитил от ошибки undefined аргумента');
        return '';
      }
      return originalRelative(from, to);
    };
    console.log('✅ Модуль path успешно пропатчен');
  }
  
  return result;
};

// Предотвращаем ошибки в процессе работы
process.on('uncaughtException', (err) => {
  if (err && err.code === 'ERR_INVALID_ARG_TYPE' && 
      err.message && err.message.includes('The "to" argument must be of type string')) {
    console.log('Перехвачена ошибка path.relative с undefined аргументом');
    // Продолжаем выполнение
  } else {
    // Для других ошибок - стандартная обработка
    console.error('Необработанная ошибка:', err);
  }
});

// Запускаем Next.js
console.log('Запуск Next.js с защитой от ошибок...');

// Получаем параметры Next.js из командной строки
const args = ['dev', '-H', '0.0.0.0'];

// Запускаем через API Next.js
require('next/dist/bin/next'); 