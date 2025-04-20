@echo off
echo Запуск проекта Restaurant SPPR...

REM Переходим в корневую директорию проекта
cd %~dp0

REM Проверка наличия директорий
if not exist data mkdir data
echo Директория data проверена

REM Проверка наличия базы данных
if not exist data\restaurant.db (
  echo База данных не найдена. Создаем новую...
  copy NUL data\restaurant.db
  echo Файл базы данных создан
)

echo Запуск бэкенда...
start cmd /k "cd backend && python run.py"

echo Запуск фронтенда...
start cmd /k "cd frontend && npm run dev"

echo Приложение запущено!
echo Бэкенд: http://localhost:8000
echo Фронтенд: http://localhost:3000 