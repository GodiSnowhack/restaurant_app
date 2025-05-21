FROM python:3.12-slim

WORKDIR /app

# Установка зависимостей
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Копирование кода приложения
COPY . .

# Создаем директорию для базы данных и копируем её
RUN mkdir -p data
COPY restaurant.db data/restaurant.db

# Устанавливаем права на базу данных
RUN chmod 666 data/restaurant.db

# Добавляем текущую директорию в PYTHONPATH
ENV PYTHONPATH=/app/backend

# Определяем порт из переменной окружения или используем 8000 по умолчанию
ENV PORT=8000

# Запуск приложения
CMD uvicorn app.main:app --host 0.0.0.0 --port $PORT --workers 4 