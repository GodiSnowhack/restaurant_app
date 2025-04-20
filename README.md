# Restaurant SPPR

Система поддержки принятия решений для управления рестораном

## Структура проекта

```
restaurant_app/
├── backend/           # Бэкенд на FastAPI
│   ├── app/           # Основной код приложения
│   ├── main.py        # Точка входа FastAPI
│   └── requirements.txt # Зависимости бэкенда
├── data/              # Данные (SQLite база данных)
├── docker/            # Dockerfile для сервисов
└── docker-compose.yml # Конфигурация Docker Compose
```

## Требования

- Python 3.9+
- Redis
- Docker и Docker Compose (опционально)

## Запуск проекта

### Локальный запуск (без Docker)

1. Создайте виртуальное окружение и активируйте его:

```bash
python -m venv venv
source venv/bin/activate  # На Windows: venv\Scripts\activate
```

2. Установите зависимости:

```bash
cd backend
pip install -r requirements.txt
```

3. Запустите приложение:

```bash
python run.py
```

Сервер будет доступен по адресу [http://localhost:8000](http://localhost:8000).  
Документация API: [http://localhost:8000/docs](http://localhost:8000/docs)

### Запуск с Docker Compose

1. Соберите и запустите контейнеры:

```bash
docker-compose up -d
```

2. Сервер будет доступен по адресу [http://localhost:8000](http://localhost:8000).

## Учётные данные по умолчанию

Администратор:
- Email: admin@example.com
- Пароль: admin

## API эндпоинты

Основные разделы API:

- `/api/v1/auth` - Аутентификация и регистрация
- `/api/v1/users` - Управление пользователями
- `/api/v1/menu` - Управление меню (категории, блюда)
- `/api/v1/orders` - Управление заказами
- `/api/v1/reservations` - Бронирование столиков
- `/api/v1/analytics` - Аналитика и отчеты

Полная документация API доступна по адресу [http://localhost:8000/docs](http://localhost:8000/docs) после запуска проекта. 