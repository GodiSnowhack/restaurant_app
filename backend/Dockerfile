FROM python:3.12-slim

WORKDIR /app

# Установка необходимых системных зависимостей
RUN apt-get update && apt-get install -y \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Установка зависимостей
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Копирование кода приложения
COPY . .

# Добавляем текущую директорию в PYTHONPATH
ENV PYTHONPATH=/app

# Определяем порт из переменной окружения или используем 8000 по умолчанию
ENV PORT=8000

# Запуск приложения
CMD uvicorn app.main:app --host 0.0.0.0 --port $PORT --workers 4 