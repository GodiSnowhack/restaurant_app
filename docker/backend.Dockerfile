FROM python:3.9-slim

WORKDIR /app

# Установка зависимостей для производительности
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir uvicorn gunicorn

# Копирование файлов зависимостей
COPY ./backend/requirements.txt /app/requirements.txt

# Установка зависимостей
RUN pip install --no-cache-dir -r requirements.txt

# Копирование кода приложения
COPY ./backend /app/

# Запуск приложения через Gunicorn
CMD ["gunicorn", "app.main:app", "--workers", "4", "--worker-class", "uvicorn.workers.UvicornWorker", "--bind", "0.0.0.0:8000"] 