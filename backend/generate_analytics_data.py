#!/usr/bin/env python
# -*- coding: utf-8 -*-

"""
Генератор данных для аналитики ресторана.
Этот скрипт создает аналитические данные на основе реальной структуры базы данных ресторана.
Данные могут использоваться для проведения аналитики и исследования бизнес-процессов.
"""

import os
import sys
import random
import datetime
import argparse
import pandas as pd
import numpy as np
from pathlib import Path
from sqlalchemy import create_engine, text
from faker import Faker
from tqdm import tqdm

# Настройки генерации
CONFIG = {
    # Периоды времени (в днях)
    "DAYS_PAST": 180,  # Полгода данных
    "START_DATE": None,  # Будет установлено при запуске скрипта
    "END_DATE": None,   # Будет установлено при запуске скрипта
    
    # Количество генерируемых записей
    "CUSTOMERS": 500,
    "WAITERS": 15,
    "ORDERS_PER_DAY": {
        "weekday": {"min": 15, "max": 30},
        "weekend": {"min": 30, "max": 60}
    },
    
    # Рабочие часы ресторана
    "OPENING_HOUR": 10,  # 10:00
    "CLOSING_HOUR": 23,  # 23:00
    
    # Распределение заказов по времени
    "PEAK_HOURS": {
        "lunch": {"start": 12, "end": 14, "weight": 0.3},
        "dinner": {"start": 18, "end": 21, "weight": 0.5},
        "normal": {"weight": 0.2}
    },
    
    # Вероятности событий
    "ORDER_STATUS_CHANCES": {
        "completed": 0.85,    # Завершенные заказы
        "cancelled": 0.05,    # Отмененные заказы
        "pending": 0.1,       # Незавершенные заказы
    },
    
    # Распределение размеров заказа
    "DISHES_PER_ORDER": {
        "min": 1,
        "max": 8,
        "avg": 3
    },
    
    # Вероятность повторного посещения
    "RETURNING_CUSTOMER_CHANCE": 0.7,
    
    # Пути вывода данных
    "OUTPUT_DIR": Path("analytics_data"),
}

# Инициализация генератора фейковых данных
fake = Faker('ru_RU')
rand = random.Random(42)  # Фиксированный seed для воспроизводимости

# Настройка подключения к БД
def get_db_engine(db_url=None):
    """Создает соединение с базой данных."""
    if db_url is None:
        # По умолчанию используем SQLite базу данных в директории data
        db_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), 
                              'data', 'restaurant.db')
        db_url = f'sqlite:///{db_path}'
        print(f"Используем SQLite базу данных: {db_path}")
    
    return create_engine(db_url)

# Генерация случайной даты в заданном интервале
def random_date(start_date, end_date):
    """Генерирует случайную дату между start_date и end_date."""
    time_delta = end_date - start_date
    random_days = rand.randrange(time_delta.days)
    return start_date + datetime.timedelta(days=random_days)

# Генерация случайного времени с учетом пиковых часов
def random_time(peak_hours=CONFIG["PEAK_HOURS"]):
    """Генерирует случайное время с учетом пиковых часов."""
    r = rand.random()
    
    if r < peak_hours["lunch"]["weight"]:
        # Обеденное время
        hour = rand.randint(peak_hours["lunch"]["start"], peak_hours["lunch"]["end"] - 1)
        minute = rand.randint(0, 59)
    elif r < peak_hours["lunch"]["weight"] + peak_hours["dinner"]["weight"]:
        # Ужин
        hour = rand.randint(peak_hours["dinner"]["start"], peak_hours["dinner"]["end"] - 1)
        minute = rand.randint(0, 59)
    else:
        # Обычное время
        hour = rand.randint(CONFIG["OPENING_HOUR"], CONFIG["CLOSING_HOUR"] - 1)
        while (peak_hours["lunch"]["start"] <= hour < peak_hours["lunch"]["end"] or
               peak_hours["dinner"]["start"] <= hour < peak_hours["dinner"]["end"]):
            hour = rand.randint(CONFIG["OPENING_HOUR"], CONFIG["CLOSING_HOUR"] - 1)
        minute = rand.randint(0, 59)
    
    return datetime.time(hour, minute)

# Функция для извлечения данных из БД
def fetch_data(engine):
    """Получает необходимые данные из базы данных."""
    data = {}
    
    with engine.connect() as conn:
        # Получение клиентов
        result = conn.execute(text("SELECT id, full_name, created_at FROM users WHERE role = 'client'"))
        data["customers"] = [{"id": row[0], "name": row[1], "created_at": row[2]} 
                            for row in result]
        
        # Если клиентов недостаточно, создаем новых
        if len(data["customers"]) < 50:
            print("В базе данных недостаточно клиентов. Создаются синтетические данные.")
            data["customers"] = generate_customers(CONFIG["CUSTOMERS"])
        
        # Получение официантов
        result = conn.execute(text("SELECT id, full_name FROM users WHERE role = 'waiter'"))
        data["waiters"] = [{"id": row[0], "name": row[1]} for row in result]
        
        # Если официантов недостаточно, создаем новых
        if len(data["waiters"]) < 5:
            print("В базе данных недостаточно официантов. Создаются синтетические данные.")
            data["waiters"] = generate_waiters(CONFIG["WAITERS"])
        
        # Получение столиков
        result = conn.execute(text("SELECT id, table_number, capacity FROM tables"))
        data["tables"] = [{"id": row[0], "table_number": row[1], "capacity": row[2]} 
                         for row in result]
        
        # Если столиков недостаточно, создаем новые
        if len(data["tables"]) < 5:
            print("В базе данных недостаточно столиков. Создаются синтетические данные.")
            data["tables"] = generate_tables(20)
        
        # Получение блюд
        result = conn.execute(text("""
            SELECT d.id, d.name, d.price, d.cost_price, c.name as category 
            FROM dishes d
            JOIN categories c ON d.category_id = c.id
        """))
        data["dishes"] = [{"id": row[0], "name": row[1], "price": row[2], 
                          "cost_price": row[3], "category": row[4]} 
                         for row in result]
        
        # Если блюд недостаточно, создаем новые
        if len(data["dishes"]) < 20:
            print("В базе данных недостаточно блюд. Создаются синтетические данные.")
            # Получаем категории или создаем их
            result = conn.execute(text("SELECT id, name FROM categories"))
            categories = [{"id": row[0], "name": row[1]} for row in result]
            
            if not categories:
                categories = generate_categories()
                
            data["dishes"] = generate_dishes(categories, 50)
    
    return data

# Генерация клиентов
def generate_customers(count):
    """Генерирует список клиентов."""
    customers = []
    
    for i in range(count):
        gender = "male" if rand.random() < 0.5 else "female"
        first_name = fake.first_name_male() if gender == "male" else fake.first_name_female()
        last_name = fake.last_name_male() if gender == "male" else fake.last_name_female()
        
        customers.append({
            "id": i + 1,
            "name": f"{first_name} {last_name}",
            "created_at": random_date(CONFIG["START_DATE"], CONFIG["END_DATE"]),
            "gender": gender,
            "age_group": random_age_group()
        })
    
    return customers

# Генерация официантов
def generate_waiters(count):
    """Генерирует список официантов."""
    waiters = []
    
    for i in range(count):
        gender = "male" if rand.random() < 0.5 else "female"
        first_name = fake.first_name_male() if gender == "male" else fake.first_name_female()
        last_name = fake.last_name_male() if gender == "male" else fake.last_name_female()
        
        waiters.append({
            "id": i + 1,
            "name": f"{first_name} {last_name}",
            "gender": gender
        })
    
    return waiters

# Генерация столиков
def generate_tables(count):
    """Генерирует список столиков."""
    tables = []
    
    for i in range(count):
        capacity = 2
        if i % 5 == 0:
            capacity = 4
        elif i % 10 == 0:
            capacity = 6
        elif i % 15 == 0:
            capacity = 8
        
        tables.append({
            "id": i + 1,
            "table_number": i + 1,
            "capacity": capacity
        })
    
    return tables

# Генерация категорий блюд
def generate_categories():
    """Генерирует список категорий блюд."""
    categories = [
        {"id": 1, "name": "Супы"},
        {"id": 2, "name": "Салаты"},
        {"id": 3, "name": "Горячие блюда"},
        {"id": 4, "name": "Десерты"},
        {"id": 5, "name": "Напитки"},
        {"id": 6, "name": "Закуски"},
        {"id": 7, "name": "Гарниры"},
        {"id": 8, "name": "Алкогольные напитки"}
    ]
    
    return categories

# Генерация блюд
def generate_dishes(categories, count):
    """Генерирует список блюд."""
    dishes = []
    dish_names = {
        "Супы": ["Борщ", "Солянка", "Уха", "Крем-суп грибной", "Щи", "Окрошка"],
        "Салаты": ["Цезарь", "Греческий", "Оливье", "Винегрет", "Крабовый"],
        "Горячие блюда": ["Стейк", "Паста Карбонара", "Плов", "Пельмени", "Жаркое"],
        "Десерты": ["Тирамису", "Чизкейк", "Штрудель", "Мороженое", "Панна-котта"],
        "Напитки": ["Кофе", "Чай", "Лимонад", "Сок", "Компот"],
        "Закуски": ["Брускетта", "Тартар", "Карпаччо", "Сырная тарелка"],
        "Гарниры": ["Картофельное пюре", "Рис", "Овощи гриль", "Гречка"],
        "Алкогольные напитки": ["Вино", "Пиво", "Виски", "Коньяк", "Водка"]
    }
    
    for i in range(count):
        category = rand.choice(categories)
        category_name = category["name"]
        
        # Выбираем базовое имя блюда из соответствующей категории
        base_names = dish_names.get(category_name, ["Блюдо"])
        base_name = rand.choice(base_names)
        
        # Добавляем уточнение для разнообразия
        adjectives = ["Фирменное", "Традиционное", "Домашнее", "Острое", "Нежное", "Классическое", "Пикантное"]
        prefix = ""
        if rand.random() < 0.3:
            prefix = rand.choice(adjectives) + " "
        
        price = round(rand.uniform(500, 3000), -1)  # Округляем до 10
        cost_price = round(price * rand.uniform(0.3, 0.6), -1)  # 30-60% от цены
        
        dishes.append({
            "id": i + 1,
            "name": f"{prefix}{base_name}",
            "price": price,
            "cost_price": cost_price,
            "category": category_name
        })
    
    return dishes

# Генерация возрастной группы
def random_age_group():
    """Генерирует случайную возрастную группу."""
    groups = ["18-24", "25-34", "35-44", "45-54", "55-64", "65+"]
    weights = [0.15, 0.3, 0.25, 0.15, 0.1, 0.05]
    
    return rand.choices(groups, weights=weights, k=1)[0]

# Генерация заказов
def generate_orders(data):
    """Генерирует заказы на основе входных данных."""
    orders = []
    order_items = []
    revenue_data = []
    dish_popularity = []
    
    # Настраиваем прогресс-бар для наглядности
    days = (CONFIG["END_DATE"] - CONFIG["START_DATE"]).days
    
    print("Генерация заказов...")
    for day_idx in tqdm(range(days)):
        current_date = CONFIG["START_DATE"] + datetime.timedelta(days=day_idx)
        
        # Определяем, является ли день выходным
        is_weekend = current_date.weekday() >= 5  # 5,6 = сб,вс
        
        # Определяем количество заказов на день
        if is_weekend:
            num_orders = rand.randint(CONFIG["ORDERS_PER_DAY"]["weekend"]["min"], 
                                    CONFIG["ORDERS_PER_DAY"]["weekend"]["max"])
        else:
            num_orders = rand.randint(CONFIG["ORDERS_PER_DAY"]["weekday"]["min"], 
                                     CONFIG["ORDERS_PER_DAY"]["weekday"]["max"])
        
        # Создаем заказы на текущий день
        for _ in range(num_orders):
            # Определяем статус заказа
            status_roll = rand.random()
            if status_roll < CONFIG["ORDER_STATUS_CHANCES"]["completed"]:
                status = "completed"
            elif status_roll < CONFIG["ORDER_STATUS_CHANCES"]["completed"] + CONFIG["ORDER_STATUS_CHANCES"]["cancelled"]:
                status = "cancelled"
            else:
                status = "pending"
            
            # Выбираем клиента (с большей вероятностью выбираем тех, кто уже был ранее)
            customer = rand.choice(data["customers"])
            
            # Выбираем официанта
            waiter = rand.choice(data["waiters"])
            
            # Выбираем столик
            table = rand.choice(data["tables"])
            
            # Генерируем время заказа
            order_time = random_time()
            order_datetime = datetime.datetime.combine(current_date, order_time)
            
            # Создаем заказ
            order_id = len(orders) + 1
            order = {
                "id": order_id,
                "customer_id": customer["id"],
                "customer_name": customer["name"],
                "waiter_id": waiter["id"],
                "waiter_name": waiter["name"],
                "table_id": table["id"],
                "table_number": table["table_number"],
                "order_datetime": order_datetime,
                "status": status,
                "total_amount": 0  # Будет обновлено после добавления позиций
            }
            
            # Добавляем блюда в заказ
            num_items = rand.randint(CONFIG["DISHES_PER_ORDER"]["min"], CONFIG["DISHES_PER_ORDER"]["max"])
            selected_dishes = rand.sample(data["dishes"], min(num_items, len(data["dishes"])))
            
            order_total = 0
            order_cost = 0
            
            for dish in selected_dishes:
                quantity = rand.randint(1, 3)
                price_per_unit = dish["price"]
                cost_per_unit = dish["cost_price"] if dish.get("cost_price") else price_per_unit * 0.4
                amount = price_per_unit * quantity
                
                order_total += amount
                order_cost += cost_per_unit * quantity
                
                order_item = {
                    "order_id": order_id,
                    "dish_id": dish["id"],
                    "dish_name": dish["name"],
                    "category": dish["category"],
                    "quantity": quantity,
                    "price_per_unit": price_per_unit,
                    "cost_per_unit": cost_per_unit,
                    "amount": amount
                }
                
                order_items.append(order_item)
                
                # Собираем данные о популярности блюд
                dish_popularity.append({
                    "date": current_date,
                    "dish_id": dish["id"],
                    "dish_name": dish["name"],
                    "category": dish["category"],
                    "quantity": quantity,
                    "amount": amount
                })
            
            # Обновляем общую сумму заказа
            order["total_amount"] = order_total
            order["cost_amount"] = order_cost
            order["profit"] = order_total - order_cost
            
            # Для завершенных заказов добавляем данные о выручке
            if status == "completed":
                revenue_data.append({
                    "date": current_date,
                    "order_id": order_id,
                    "amount": order_total,
                    "cost": order_cost,
                    "profit": order_total - order_cost,
                    "table_number": table["table_number"],
                    "customer_id": customer["id"],
                    "waiter_id": waiter["id"],
                    "hour": order_time.hour,
                    "is_weekend": is_weekend
                })
            
            orders.append(order)
    
    return {
        "orders": orders,
        "order_items": order_items,
        "revenue_data": revenue_data,
        "dish_popularity": dish_popularity
    }

# Сохранение данных в CSV файлы
def save_data_to_csv(data, output_dir):
    """Сохраняет данные в CSV файлы."""
    # Создаем директорию, если она не существует
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)
    
    # Сохраняем данные о заказах
    orders_df = pd.DataFrame(data["orders"])
    orders_df.to_csv(os.path.join(output_dir, "orders.csv"), index=False)
    
    # Сохраняем данные о позициях заказов
    order_items_df = pd.DataFrame(data["order_items"])
    order_items_df.to_csv(os.path.join(output_dir, "order_items.csv"), index=False)
    
    # Сохраняем данные о выручке
    revenue_df = pd.DataFrame(data["revenue_data"])
    revenue_df.to_csv(os.path.join(output_dir, "revenue.csv"), index=False)
    
    # Сохраняем данные о популярности блюд
    dish_popularity_df = pd.DataFrame(data["dish_popularity"])
    dish_popularity_df.to_csv(os.path.join(output_dir, "dish_popularity.csv"), index=False)
    
    print(f"Данные успешно сохранены в директорию {output_dir}")
    print(f"- Заказы: {len(data['orders'])}")
    print(f"- Позиции заказов: {len(data['order_items'])}")
    print(f"- Записи о выручке: {len(data['revenue_data'])}")

# Сохранение данных непосредственно в базу данных SQLite
def save_data_to_db(data, engine):
    """Сохраняет сгенерированные данные непосредственно в базу данных."""
    print("Сохранение данных в базу данных...")
    
    # Преобразуем данные в pandas DataFrames
    orders_df = pd.DataFrame(data["orders"])
    order_items_df = pd.DataFrame(data["order_items"])
    revenue_df = pd.DataFrame(data["revenue_data"])
    dish_popularity_df = pd.DataFrame(data["dish_popularity"])
    
    # Преобразуем даты в строки для SQLite
    for df in [orders_df, revenue_df, dish_popularity_df]:
        for col in df.columns:
            if isinstance(df[col].iloc[0] if not df.empty else None, (datetime.date, datetime.datetime)):
                df[col] = df[col].astype(str)
    
    with engine.begin() as conn:
        # Создаем таблицы для аналитики, если их еще нет
        conn.execute(text("""
        CREATE TABLE IF NOT EXISTS analytics_orders (
            id INTEGER PRIMARY KEY,
            customer_id INTEGER,
            customer_name TEXT,
            waiter_id INTEGER,
            waiter_name TEXT,
            table_id INTEGER,
            table_number INTEGER,
            order_datetime TEXT,
            status TEXT,
            total_amount REAL,
            cost_amount REAL,
            profit REAL
        );
        """))
        
        conn.execute(text("""
        CREATE TABLE IF NOT EXISTS analytics_order_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            order_id INTEGER,
            dish_id INTEGER,
            dish_name TEXT,
            category TEXT,
            quantity INTEGER,
            price_per_unit REAL,
            cost_per_unit REAL,
            amount REAL,
            FOREIGN KEY (order_id) REFERENCES analytics_orders(id)
        );
        """))
        
        conn.execute(text("""
        CREATE TABLE IF NOT EXISTS analytics_revenue (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            date TEXT,
            order_id INTEGER,
            amount REAL,
            cost REAL,
            profit REAL,
            table_number INTEGER,
            customer_id INTEGER,
            waiter_id INTEGER,
            hour INTEGER,
            is_weekend INTEGER,
            FOREIGN KEY (order_id) REFERENCES analytics_orders(id)
        );
        """))
        
        conn.execute(text("""
        CREATE TABLE IF NOT EXISTS analytics_dish_popularity (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            date TEXT,
            dish_id INTEGER,
            dish_name TEXT,
            category TEXT,
            quantity INTEGER,
            amount REAL
        );
        """))
        
        # Очищаем таблицы перед вставкой новых данных
        conn.execute(text("DELETE FROM analytics_order_items"))
        conn.execute(text("DELETE FROM analytics_revenue"))
        conn.execute(text("DELETE FROM analytics_dish_popularity"))
        conn.execute(text("DELETE FROM analytics_orders"))
        
        # Сохраняем данные
        orders_df.to_sql('analytics_orders', conn, if_exists='append', index=False)
        order_items_df.to_sql('analytics_order_items', conn, if_exists='append', index=False)
        revenue_df.to_sql('analytics_revenue', conn, if_exists='append', index=False)
        dish_popularity_df.to_sql('analytics_dish_popularity', conn, if_exists='append', index=False)
    
    print(f"Данные успешно сохранены в базу данных")
    print(f"- Заказы: {len(data['orders'])}")
    print(f"- Позиции заказов: {len(data['order_items'])}")
    print(f"- Записи о выручке: {len(data['revenue_data'])}")
    print(f"- Данные о популярности блюд: {len(data['dish_popularity'])}")

# Анализ и визуализация данных
def analyze_data(data, output_dir):
    """Проводит базовый анализ данных и создает визуализации."""
    try:
        import matplotlib.pyplot as plt
        import seaborn as sns
        from matplotlib.ticker import FuncFormatter
        
        # Настройки для графиков
        plt.style.use('ggplot')
        sns.set(style="whitegrid")
        
        # Создаем директорию для отчетов, если она не существует
        reports_dir = os.path.join(output_dir, "reports")
        if not os.path.exists(reports_dir):
            os.makedirs(reports_dir)
        
        # Преобразуем данные о выручке в DataFrame
        revenue_df = pd.DataFrame(data["revenue_data"])
        revenue_df["date"] = pd.to_datetime(revenue_df["date"])
        revenue_df["day_of_week"] = revenue_df["date"].dt.day_name()
        
        # 1. Динамика выручки по дням
        plt.figure(figsize=(12, 6))
        daily_revenue = revenue_df.groupby(revenue_df["date"].dt.date)["amount"].sum()
        
        # Добавляем 7-дневную скользящую среднюю
        daily_revenue_ma = daily_revenue.rolling(window=7).mean()
        
        daily_revenue.plot(label="Ежедневная выручка")
        daily_revenue_ma.plot(color="red", label="7-дневная скользящая средняя")
        
        plt.title("Динамика ежедневной выручки")
        plt.xlabel("Дата")
        plt.ylabel("Выручка (руб.)")
        plt.legend()
        plt.tight_layout()
        plt.savefig(os.path.join(reports_dir, "daily_revenue.png"))
        
        # 2. Выручка по дням недели
        plt.figure(figsize=(10, 6))
        day_order = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
        days_ru = {
            "Monday": "Понедельник",
            "Tuesday": "Вторник",
            "Wednesday": "Среда",
            "Thursday": "Четверг",
            "Friday": "Пятница",
            "Saturday": "Суббота",
            "Sunday": "Воскресенье"
        }
        
        weekday_revenue = revenue_df.groupby("day_of_week")["amount"].sum()
        weekday_revenue = weekday_revenue.reindex(day_order)
        weekday_revenue.index = weekday_revenue.index.map(days_ru)
        
        sns.barplot(x=weekday_revenue.index, y=weekday_revenue.values)
        plt.title("Выручка по дням недели")
        plt.xlabel("День недели")
        plt.ylabel("Общая выручка (руб.)")
        plt.xticks(rotation=45)
        plt.tight_layout()
        plt.savefig(os.path.join(reports_dir, "weekday_revenue.png"))
        
        # 3. Выручка по часам
        plt.figure(figsize=(12, 6))
        hourly_revenue = revenue_df.groupby("hour")["amount"].sum()
        
        sns.barplot(x=hourly_revenue.index, y=hourly_revenue.values)
        plt.title("Выручка по часам")
        plt.xlabel("Час дня")
        plt.ylabel("Общая выручка (руб.)")
        plt.xticks(range(min(revenue_df["hour"]), max(revenue_df["hour"]) + 1))
        plt.tight_layout()
        plt.savefig(os.path.join(reports_dir, "hourly_revenue.png"))
        
        # 4. Топ-10 самых популярных блюд
        plt.figure(figsize=(12, 8))
        dish_popularity_df = pd.DataFrame(data["dish_popularity"])
        
        top_dishes = dish_popularity_df.groupby("dish_name")["quantity"].sum().sort_values(ascending=False).head(10)
        
        sns.barplot(x=top_dishes.values, y=top_dishes.index)
        plt.title("Топ-10 самых популярных блюд")
        plt.xlabel("Количество заказов")
        plt.ylabel("")
        plt.tight_layout()
        plt.savefig(os.path.join(reports_dir, "top_dishes.png"))
        
        # 5. Выручка по категориям блюд
        plt.figure(figsize=(12, 6))
        category_revenue = dish_popularity_df.groupby("category")["amount"].sum().sort_values(ascending=False)
        
        sns.barplot(x=category_revenue.index, y=category_revenue.values)
        plt.title("Выручка по категориям блюд")
        plt.xlabel("Категория")
        plt.ylabel("Выручка (руб.)")
        plt.xticks(rotation=45)
        plt.tight_layout()
        plt.savefig(os.path.join(reports_dir, "category_revenue.png"))
        
        # 6. Создаем сводный отчет о выручке
        with open(os.path.join(reports_dir, "revenue_summary.txt"), "w", encoding="utf-8") as f:
            f.write("Сводный отчет о выручке\n")
            f.write("======================\n\n")
            
            f.write(f"Период анализа: {CONFIG['START_DATE'].strftime('%d.%m.%Y')} - {CONFIG['END_DATE'].strftime('%d.%m.%Y')}\n\n")
            
            f.write("Общие показатели:\n")
            f.write(f"- Общая выручка: {revenue_df['amount'].sum():,.2f} руб.\n")
            f.write(f"- Общая себестоимость: {revenue_df['cost'].sum():,.2f} руб.\n")
            f.write(f"- Общая прибыль: {revenue_df['profit'].sum():,.2f} руб.\n")
            f.write(f"- Средняя наценка: {(revenue_df['profit'].sum() / revenue_df['cost'].sum() * 100):,.2f}%\n")
            f.write(f"- Общее количество заказов: {len(data['orders'])}\n")
            f.write(f"- Завершенные заказы: {len([o for o in data['orders'] if o['status'] == 'completed'])}\n")
            f.write(f"- Отмененные заказы: {len([o for o in data['orders'] if o['status'] == 'cancelled'])}\n")
            f.write(f"- Средний чек: {revenue_df['amount'].mean():,.2f} руб.\n\n")
            
            f.write("Лучшие дни:\n")
            best_days = revenue_df.groupby(revenue_df["date"].dt.date)["amount"].sum().sort_values(ascending=False).head(5)
            for date, amount in best_days.items():
                f.write(f"- {date.strftime('%d.%m.%Y')}: {amount:,.2f} руб.\n")
            
            f.write("\nЛучшие блюда по выручке:\n")
            best_dishes = dish_popularity_df.groupby("dish_name")["amount"].sum().sort_values(ascending=False).head(5)
            for dish, amount in best_dishes.items():
                f.write(f"- {dish}: {amount:,.2f} руб.\n")
                
            f.write("\nЛучшие официанты по выручке:\n")
            waiter_revenue = revenue_df.groupby("waiter_id")["amount"].sum().sort_values(ascending=False)
            for idx, (waiter_id, amount) in enumerate(waiter_revenue.items(), 1):
                if idx > 5:
                    break
                waiter_name = next((w["name"] for w in data["base_data"]["waiters"] if w["id"] == waiter_id), f"Официант #{waiter_id}")
                f.write(f"- {waiter_name}: {amount:,.2f} руб.\n")
        
        print(f"Отчеты сгенерированы и сохранены в директории {reports_dir}")
        
    except ImportError:
        print("Для создания визуализаций необходимы библиотеки matplotlib и seaborn.")
        print("Установите их с помощью команды:")
        print("pip install matplotlib seaborn")

# Основная функция
def main():
    """Основная функция программы."""
    parser = argparse.ArgumentParser(description="Генератор данных для аналитики ресторана")
    parser.add_argument("--db-url", type=str, help="URL для подключения к базе данных")
    parser.add_argument("--days", type=int, default=CONFIG["DAYS_PAST"], 
                        help=f"Количество дней для генерации данных (по умолчанию: {CONFIG['DAYS_PAST']})")
    parser.add_argument("--output", type=str, default=str(CONFIG["OUTPUT_DIR"]),
                        help=f"Путь для сохранения файлов (по умолчанию: {CONFIG['OUTPUT_DIR']})")
    parser.add_argument("--no-analysis", action="store_true", 
                        help="Не генерировать отчеты и визуализации")
    parser.add_argument("--seed", type=int, default=42,
                        help="Seed для генератора случайных чисел (по умолчанию: 42)")
    parser.add_argument("--save-to-db", action="store_true", default=True,
                        help="Сохранить данные в базу данных SQLite (по умолчанию: True)")
    parser.add_argument("--no-save-to-db", action="store_true",
                        help="Не сохранять данные в базу данных SQLite")
    parser.add_argument("--no-csv", action="store_true",
                        help="Не сохранять данные в CSV-файлы")
    
    args = parser.parse_args()
    
    # Настройка генератора случайных чисел
    random.seed(args.seed)
    rand.seed(args.seed)
    
    # Настройка периода времени
    CONFIG["END_DATE"] = datetime.datetime.now().date()
    CONFIG["START_DATE"] = CONFIG["END_DATE"] - datetime.timedelta(days=args.days)
    CONFIG["OUTPUT_DIR"] = Path(args.output)
    
    print(f"Генерация данных для периода: {CONFIG['START_DATE']} - {CONFIG['END_DATE']}")
    
    # Получение соединения с БД
    engine = None
    try:
        engine = get_db_engine(args.db_url)
        print("Получение данных из базы данных...")
        base_data = fetch_data(engine)
    except Exception as e:
        print(f"Ошибка при подключении к базе данных: {e}")
        print("Создаются полностью синтетические данные...")
        
        base_data = {
            "customers": generate_customers(CONFIG["CUSTOMERS"]),
            "waiters": generate_waiters(CONFIG["WAITERS"]),
            "tables": generate_tables(20),
            "dishes": generate_dishes(generate_categories(), 50)
        }
    
    # Генерация данных о заказах
    order_data = generate_orders(base_data)
    
    # Объединяем все данные
    all_data = {
        "base_data": base_data,
        "orders": order_data["orders"],
        "order_items": order_data["order_items"],
        "revenue_data": order_data["revenue_data"],
        "dish_popularity": order_data["dish_popularity"]
    }
    
    # Сохранение данных в CSV, если не отключено
    if not args.no_csv:
        save_data_to_csv(all_data, CONFIG["OUTPUT_DIR"])
    
    # Сохранение данных в БД, если включено
    if args.save_to_db and not args.no_save_to_db:
        if engine is None:
            try:
                engine = get_db_engine(args.db_url)
            except Exception as e:
                print(f"Ошибка при подключении к базе данных для сохранения: {e}")
        
        if engine is not None:
            save_data_to_db(all_data, engine)
    
    # Анализ данных (если не отключен)
    if not args.no_analysis:
        print("Создание отчетов и визуализаций...")
        analyze_data(all_data, CONFIG["OUTPUT_DIR"])
    
    print("Генерация данных завершена успешно!")

if __name__ == "__main__":
    main() 