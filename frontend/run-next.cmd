@echo off

:: Скрипт для запуска Next.js с патчем path.relative
echo Запуск Next.js с защитой от ошибки path.relative...

:: Устанавливаем переменную среды для предзагрузки нашего патча
set NODE_OPTIONS=--require ./patch-node.js

:: Запускаем Next.js
npx next dev -H 0.0.0.0

:: Восстанавливаем переменную среды
set NODE_OPTIONS=

echo Завершение работы... 