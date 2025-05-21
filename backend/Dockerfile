FROM python:3.12-slim

WORKDIR /app

# Установка зависимостей
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Копирование кода приложения
COPY . .

# Создаем директорию для базы данных и копируем её
RUN mkdir -p backend/data
COPY backend/data/restaurant.db backend/data/restaurant.db

# Устанавливаем права на базу данных
RUN chmod 666 backend/data/restaurant.db

# Добавляем текущую директорию в PYTHONPATH
ENV PYTHONPATH=/app

# Определяем порт из переменной окружения или используем 8000 по умолчанию
ENV PORT=8000

# Запуск приложения
CMD uvicorn app.main:app --host 0.0.0.0 --port $PORT --workers 4 