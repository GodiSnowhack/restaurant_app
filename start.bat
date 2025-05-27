@echo off
echo Запуск проекта Restaurant SPPR...

REM Переходим в корневую директорию проекта
cd %~dp0

REM Проверка наличия директорий для бэкенда
if not exist backend\data mkdir backend\data
echo Директория backend\data проверена

REM Проверка наличия базы данных для бэкенда
if not exist backend\data\restaurant.db (
  echo База данных backend\data\restaurant.db не найдена. Создаем новую...
  type NUL > backend\data\restaurant.db
  echo Файл базы данных backend\data\restaurant.db создан
)

REM Проверка установленных модулей frontend
echo Проверка модулей frontend...
if not exist frontend\node_modules (
  echo Модули frontend не найдены. Устанавливаем...
  cd frontend
  call npm install
  cd ..
  echo Модули frontend установлены
) else (
  echo Модули frontend уже установлены
)

echo Запуск бэкенда...
REM Запускаем Uvicorn напрямую, находясь в директории backend
REM Используем app.main:app для указания на FastAPI приложение в backend/app/main.py
REM Добавляем --reload для автоматической перезагрузки при изменениях кода
start cmd /k "cd backend && uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload"

echo Запуск фронтенда...
start cmd /k "cd frontend && npm run dev"

echo Приложение запущено!
echo Бэкенд: http://localhost:8000
echo Фронтенд: http://localhost:3000 