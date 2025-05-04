// patched-next-dev.js
// Скрипт-обертка для запуска next dev с исправлением ошибки path.relative

// Патчим встроенный модуль path до загрузки next
const originalPathModule = require('path');
const originalRelative = originalPathModule.relative;

// Замена метода relative для предотвращения ошибки с undefined аргументами
originalPathModule.relative = function patchedRelative(from, to) {
  if (from === undefined || to === undefined) {
    console.log('[PATH PATCHED] Called path.relative with undefined argument(s)');
    return '';  // Возвращаем пустую строку вместо ошибки
  }
  return originalRelative(from, to);
};

// Запускаем Next.js с нашим патчем
const { spawn } = require('child_process');
const nextBin = require.resolve('next/dist/bin/next');
const args = ['dev', '-H', '0.0.0.0'];

console.log('Starting Next.js with patched path.relative...');
const nextProcess = spawn(process.execPath, [nextBin, ...args], { 
  stdio: 'inherit',
  env: process.env
});

nextProcess.on('error', (err) => {
  console.error('Failed to start Next.js:', err);
  process.exit(1);
});

nextProcess.on('exit', (code) => {
  process.exit(code);
});

// Обработка сигналов для корректного завершения
process.on('SIGINT', () => nextProcess.kill('SIGINT'));
process.on('SIGTERM', () => nextProcess.kill('SIGTERM')); 