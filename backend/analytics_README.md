# Генератор данных для аналитики ресторана

Этот инструмент предназначен для генерации синтетических данных о работе ресторана, которые могут быть использованы для проведения анализа и создания отчетов.

## Возможности

- Генерация синтетических данных о заказах, клиентах, блюдах и персонале
- Создание данных с реалистичными параметрами (пиковые часы, дни недели, сезонность)
- Возможность использования существующей базы данных ресторана
- Сохранение данных в CSV-файлы для дальнейшего анализа
- Генерация базовых отчетов и визуализаций

## Требования

Для работы генератора данных необходимы следующие библиотеки:

```bash
pip install sqlalchemy pandas numpy faker tqdm
```

Для создания визуализаций также потребуются:

```bash
pip install matplotlib seaborn
```

## Использование

### Базовое использование:

```bash
python generate_analytics_data.py
```

По умолчанию скрипт:
- Пытается подключиться к базе данных PostgreSQL на localhost
- Генерирует данные за последние 180 дней
- Сохраняет результаты в директорию `analytics_data`
- Создает отчеты и визуализации

### Параметры командной строки:

```bash
python generate_analytics_data.py --db-url "postgresql://user:password@host:port/dbname" --days 90 --output "my_data" --seed 123
```

Доступные параметры:

- `--db-url` - URL для подключения к базе данных
- `--days` - Количество дней для генерации данных (по умолчанию: 180)
- `--output` - Путь для сохранения файлов (по умолчанию: analytics_data)
- `--no-analysis` - Не генерировать отчеты и визуализации
- `--seed` - Seed для генератора случайных чисел (по умолчанию: 42)
- `--save-to-db` - Сохранить данные в базу данных SQLite (по умолчанию: включено)
- `--no-save-to-db` - Не сохранять данные в базу данных SQLite
- `--no-csv` - Не сохранять данные в CSV-файлы

По умолчанию скрипт сохраняет данные как в CSV-файлы, так и в базу данных SQLite, расположенную в `restaurant_app/data/restaurant.db`.

## Структура выходных данных

### CSV-файлы

Скрипт генерирует следующие файлы:

- `orders.csv` - Данные о заказах
- `order_items.csv` - Данные о позициях заказов
- `revenue.csv` - Данные о выручке
- `dish_popularity.csv` - Данные о популярности блюд

### База данных SQLite

Скрипт создает следующие таблицы в базе данных `restaurant.db`:

- `analytics_orders` - Данные о заказах
- `analytics_order_items` - Данные о позициях заказов
- `analytics_revenue` - Данные о выручке
- `analytics_dish_popularity` - Данные о популярности блюд

Эти таблицы можно использовать для SQL-запросов и анализа данных с помощью инструментов работы с SQLite, таких как SQLite Browser или прямых SQL-запросов из Python.

Пример SQL-запроса для анализа популярности блюд по категориям:

```sql
SELECT 
    category,
    SUM(quantity) as total_ordered,
    SUM(amount) as total_revenue,
    COUNT(DISTINCT dish_id) as dish_count,
    ROUND(SUM(amount) / SUM(quantity), 2) as avg_price_per_unit
FROM 
    analytics_dish_popularity
GROUP BY 
    category
ORDER BY 
    total_revenue DESC;
```

Пример запроса через Python:

```python
import sqlite3
import pandas as pd

# Подключение к базе данных
db_path = 'restaurant_app/data/restaurant.db'
conn = sqlite3.connect(db_path)

# Выполнение запроса и получение результатов в pandas DataFrame
query = """
SELECT 
    strftime('%Y-%m-%d', date) as order_date,
    SUM(amount) as daily_revenue,
    COUNT(DISTINCT order_id) as orders_count,
    ROUND(SUM(amount) / COUNT(DISTINCT order_id), 2) as avg_check
FROM 
    analytics_revenue
GROUP BY 
    order_date
ORDER BY 
    order_date;
"""
df = pd.read_sql_query(query, conn)

# Закрытие соединения
conn.close()

# Анализ данных с помощью pandas
print(df.head())
```

### Отчеты и визуализации

Если не используется флаг `--no-analysis`, скрипт создает директорию `reports` в выходной директории, содержащую:

- `daily_revenue.png` - График динамики ежедневной выручки
- `weekday_revenue.png` - График выручки по дням недели
- `hourly_revenue.png` - График выручки по часам
- `top_dishes.png` - Топ-10 самых популярных блюд
- `category_revenue.png` - Выручка по категориям блюд
- `revenue_summary.txt` - Текстовый сводный отчет о выручке

## Настройка генерации

Вы можете изменить параметры генерации данных, отредактировав словарь `CONFIG` в начале файла:

- `DAYS_PAST` - Количество дней для генерации данных
- `CUSTOMERS` - Количество клиентов
- `WAITERS` - Количество официантов
- `ORDERS_PER_DAY` - Количество заказов в день (для будней и выходных)
- `OPENING_HOUR` и `CLOSING_HOUR` - Рабочие часы ресторана
- `PEAK_HOURS` - Распределение пиковых часов
- `ORDER_STATUS_CHANCES` - Вероятности различных статусов заказов
- `DISHES_PER_ORDER` - Распределение количества блюд в заказе

## Примеры использования данных

Сгенерированные данные можно использовать для:

1. Анализа продаж и выручки
2. Выявления самых популярных блюд
3. Определения пиковых часов работы
4. Анализа эффективности работы персонала
5. Выявления сезонных трендов
6. Прогнозирования спроса

## Дальнейший анализ

Для более глубокого анализа данных рекомендуется использовать специализированные инструменты:

- Python (pandas, scikit-learn) - для углубленного анализа и машинного обучения
- Jupyter Notebook - для интерактивной аналитики
- Power BI, Tableau или Redash - для создания интерактивных дашбордов
- Excel - для базового анализа и создания отчетов 