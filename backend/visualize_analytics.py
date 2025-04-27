#!/usr/bin/env python
# -*- coding: utf-8 -*-

"""
Визуализация аналитических данных ресторана.
Этот скрипт создает диаграммы и отчеты на основе CSV-файлов, 
сгенерированных программой generate_analytics_data.py.
"""

import os
import sys
import argparse
import pandas as pd
import numpy as np
from pathlib import Path
import matplotlib.pyplot as plt
import seaborn as sns
from datetime import datetime, timedelta

def load_data(data_dir):
    """Загружает данные из CSV-файлов."""
    data = {}
    
    # Проверяем наличие всех необходимых файлов
    required_files = ["orders.csv", "order_items.csv", "revenue.csv", "dish_popularity.csv"]
    missing_files = [f for f in required_files if not os.path.exists(os.path.join(data_dir, f))]
    
    if missing_files:
        raise FileNotFoundError(f"Отсутствуют необходимые файлы: {', '.join(missing_files)}")
    
    # Загружаем данные
    data["orders"] = pd.read_csv(os.path.join(data_dir, "orders.csv"))
    data["order_items"] = pd.read_csv(os.path.join(data_dir, "order_items.csv"))
    data["revenue"] = pd.read_csv(os.path.join(data_dir, "revenue.csv"))
    data["dish_popularity"] = pd.read_csv(os.path.join(data_dir, "dish_popularity.csv"))
    
    # Преобразуем даты
    for date_col in ["date", "order_datetime"]:
        for df_name in data:
            if date_col in data[df_name].columns:
                data[df_name][date_col] = pd.to_datetime(data[df_name][date_col])
    
    return data

def create_basic_reports(data, output_dir):
    """Создает базовые отчеты по данным."""
    # Создаем директорию для отчетов, если она не существует
    reports_dir = os.path.join(output_dir, "reports")
    if not os.path.exists(reports_dir):
        os.makedirs(reports_dir)
    
    # Настройки для графиков
    plt.style.use('ggplot')
    sns.set(style="whitegrid")
    
    revenue_df = data["revenue"]
    dish_popularity_df = data["dish_popularity"]
    
    # Добавляем день недели
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
    plt.close()
    
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
    plt.close()
    
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
    plt.close()
    
    # 4. Топ-10 самых популярных блюд
    plt.figure(figsize=(12, 8))
    
    top_dishes = dish_popularity_df.groupby("dish_name")["quantity"].sum().sort_values(ascending=False).head(10)
    
    sns.barplot(x=top_dishes.values, y=top_dishes.index)
    plt.title("Топ-10 самых популярных блюд")
    plt.xlabel("Количество заказов")
    plt.ylabel("")
    plt.tight_layout()
    plt.savefig(os.path.join(reports_dir, "top_dishes.png"))
    plt.close()
    
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
    plt.close()
    
    # 6. Сравнение будних и выходных дней
    plt.figure(figsize=(8, 6))
    weekend_vs_weekday = revenue_df.groupby("is_weekend")["amount"].mean()
    
    sns.barplot(x=["Будни", "Выходные"], y=weekend_vs_weekday.values)
    plt.title("Средняя выручка: будни vs выходные")
    plt.xlabel("")
    plt.ylabel("Средняя выручка (руб.)")
    plt.tight_layout()
    plt.savefig(os.path.join(reports_dir, "weekend_vs_weekday.png"))
    plt.close()
    
    # 7. Тренд среднего чека
    plt.figure(figsize=(12, 6))
    
    # Группируем по неделям для более наглядного тренда
    revenue_df["week"] = revenue_df["date"].dt.isocalendar().week
    revenue_df["year"] = revenue_df["date"].dt.isocalendar().year
    revenue_df["yearweek"] = revenue_df["year"].astype(str) + "-" + revenue_df["week"].astype(str).str.zfill(2)
    
    avg_check_by_week = revenue_df.groupby("yearweek")["amount"].mean()
    
    plt.plot(avg_check_by_week.values)
    plt.title("Динамика среднего чека по неделям")
    plt.xlabel("Неделя")
    plt.ylabel("Средний чек (руб.)")
    plt.xticks(range(0, len(avg_check_by_week), max(1, len(avg_check_by_week) // 10)),
               avg_check_by_week.index[::max(1, len(avg_check_by_week) // 10)], rotation=45)
    plt.tight_layout()
    plt.savefig(os.path.join(reports_dir, "avg_check_trend.png"))
    plt.close()
    
    print(f"Базовые отчеты созданы в директории {reports_dir}")

def create_advanced_reports(data, output_dir):
    """Создает расширенные отчеты по данным."""
    # Создаем директорию для отчетов, если она не существует
    reports_dir = os.path.join(output_dir, "reports")
    if not os.path.exists(reports_dir):
        os.makedirs(reports_dir)
    
    revenue_df = data["revenue"]
    dish_popularity_df = data["dish_popularity"]
    orders_df = data["orders"]
    
    # 1. Тепловая карта дней недели и часов
    plt.figure(figsize=(14, 8))
    
    # Добавляем день недели как число (0 = понедельник, 6 = воскресенье)
    revenue_df["weekday"] = revenue_df["date"].dt.weekday
    
    # Создаем сводную таблицу: дни недели x часы
    pivot_data = revenue_df.pivot_table(
        index="weekday",
        columns="hour",
        values="amount",
        aggfunc="sum",
        fill_value=0
    )
    
    # Переименовываем индексы для удобства
    weekday_names = ["Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота", "Воскресенье"]
    pivot_data.index = [weekday_names[i] for i in pivot_data.index]
    
    # Отрисовываем тепловую карту
    sns.heatmap(pivot_data, cmap="YlOrRd", annot=True, fmt=".0f", linewidths=.5)
    plt.title("Тепловая карта выручки по дням недели и часам")
    plt.xlabel("Час дня")
    plt.ylabel("День недели")
    plt.tight_layout()
    plt.savefig(os.path.join(reports_dir, "weekday_hour_heatmap.png"))
    plt.close()
    
    # 2. Анализ прибыльности
    plt.figure(figsize=(12, 8))
    
    # Создаем DataFrame с прибыльностью по категориям
    profit_by_category = revenue_df.groupby("date")["profit"].sum()
    profit_ma = profit_by_category.rolling(window=7).mean()
    
    plt.plot(profit_by_category.index, profit_by_category.values, label="Ежедневная прибыль")
    plt.plot(profit_ma.index, profit_ma.values, label="7-дневная скользящая средняя", color="red")
    plt.title("Динамика прибыли")
    plt.xlabel("Дата")
    plt.ylabel("Прибыль (руб.)")
    plt.legend()
    plt.tight_layout()
    plt.savefig(os.path.join(reports_dir, "profit_trend.png"))
    plt.close()
    
    # 3. Средний чек и количество блюд
    plt.figure(figsize=(10, 6))
    
    # Объединяем данные
    order_stats = pd.merge(
        orders_df,
        data["order_items"].groupby("order_id")["dish_id"].count().reset_index(name="dish_count"),
        on="order_id",
        how="left"
    )
    
    # Группируем по неделям
    order_stats["date"] = pd.to_datetime(order_stats["order_datetime"]).dt.date
    order_stats["week"] = pd.to_datetime(order_stats["order_datetime"]).dt.isocalendar().week
    order_stats["year"] = pd.to_datetime(order_stats["order_datetime"]).dt.isocalendar().year
    order_stats["yearweek"] = order_stats["year"].astype(str) + "-" + order_stats["week"].astype(str).str.zfill(2)
    
    # Рассчитываем средние значения
    avg_dishes = order_stats.groupby("yearweek")["dish_count"].mean()
    avg_check = order_stats.groupby("yearweek")["total_amount"].mean()
    
    # Создаем график с двумя осями Y
    fig, ax1 = plt.subplots(figsize=(12, 6))
    
    color = 'tab:blue'
    ax1.set_xlabel('Неделя')
    ax1.set_ylabel('Средний чек (руб.)', color=color)
    ax1.plot(avg_check.values, color=color)
    ax1.tick_params(axis='y', labelcolor=color)
    
    ax2 = ax1.twinx()
    
    color = 'tab:red'
    ax2.set_ylabel('Среднее количество блюд', color=color)
    ax2.plot(avg_dishes.values, color=color)
    ax2.tick_params(axis='y', labelcolor=color)
    
    plt.title("Динамика среднего чека и количества блюд в заказе")
    plt.xticks(range(0, len(avg_check), max(1, len(avg_check) // 10)),
               avg_check.index[::max(1, len(avg_check) // 10)], rotation=45)
    fig.tight_layout()
    plt.savefig(os.path.join(reports_dir, "avg_check_and_dishes.png"))
    plt.close()
    
    # 4. Топ официантов по продажам
    plt.figure(figsize=(12, 8))
    
    # Группируем по официантам
    waiter_stats = revenue_df.groupby("waiter_id").agg({
        "amount": ["sum", "mean", "count"],
        "profit": ["sum", "mean"]
    })
    
    waiter_stats.columns = ["total_revenue", "avg_check", "orders_count", "total_profit", "avg_profit"]
    waiter_stats = waiter_stats.sort_values("total_revenue", ascending=False)
    
    top_waiters = waiter_stats.head(10)
    
    plt.figure(figsize=(12, 6))
    plt.bar(range(len(top_waiters)), top_waiters["total_revenue"])
    plt.xlabel("Официант ID")
    plt.ylabel("Общая выручка (руб.)")
    plt.title("Топ-10 официантов по выручке")
    plt.xticks(range(len(top_waiters)), top_waiters.index)
    plt.tight_layout()
    plt.savefig(os.path.join(reports_dir, "top_waiters.png"))
    plt.close()
    
    # 5. Корреляция между количеством блюд и чеком
    plt.figure(figsize=(10, 8))
    
    # Удаляем выбросы для лучшей визуализации (если есть)
    filtered_stats = order_stats[(order_stats["dish_count"] <= 15) & (order_stats["total_amount"] <= 20000)]
    
    plt.scatter(filtered_stats["dish_count"], filtered_stats["total_amount"], alpha=0.5)
    plt.xlabel("Количество блюд в заказе")
    plt.ylabel("Сумма заказа (руб.)")
    plt.title("Корреляция между количеством блюд и суммой заказа")
    
    # Добавляем линию тренда
    z = np.polyfit(filtered_stats["dish_count"], filtered_stats["total_amount"], 1)
    p = np.poly1d(z)
    plt.plot(range(1, 16), p(range(1, 16)), "r--", linewidth=2)
    
    correlation = filtered_stats["dish_count"].corr(filtered_stats["total_amount"])
    plt.text(10, 2000, f"Корреляция: {correlation:.2f}", fontsize=12)
    
    plt.tight_layout()
    plt.savefig(os.path.join(reports_dir, "correlation_dishes_amount.png"))
    plt.close()
    
    print(f"Расширенные отчеты созданы в директории {reports_dir}")

def generate_summary_report(data, output_dir):
    """Создает текстовый сводный отчет."""
    reports_dir = os.path.join(output_dir, "reports")
    if not os.path.exists(reports_dir):
        os.makedirs(reports_dir)
    
    revenue_df = data["revenue"]
    dish_popularity_df = data["dish_popularity"]
    orders_df = data["orders"]
    order_items_df = data["order_items"]
    
    # Определяем период анализа
    start_date = revenue_df["date"].min()
    end_date = revenue_df["date"].max()
    
    with open(os.path.join(reports_dir, "summary_report.txt"), "w", encoding="utf-8") as f:
        f.write("Сводный аналитический отчет по ресторану\n")
        f.write("=====================================\n\n")
        
        f.write(f"Период анализа: {start_date.strftime('%d.%m.%Y')} - {end_date.strftime('%d.%m.%Y')}\n")
        f.write(f"Общее количество дней: {(end_date - start_date).days + 1}\n\n")
        
        f.write("1. Финансовые показатели\n")
        f.write("------------------------\n")
        f.write(f"Общая выручка: {revenue_df['amount'].sum():,.2f} руб.\n")
        f.write(f"Общая себестоимость: {revenue_df['cost'].sum():,.2f} руб.\n")
        f.write(f"Общая прибыль: {revenue_df['profit'].sum():,.2f} руб.\n")
        f.write(f"Рентабельность: {revenue_df['profit'].sum() / revenue_df['amount'].sum() * 100:,.2f}%\n")
        f.write(f"Средняя наценка: {(revenue_df['profit'].sum() / revenue_df['cost'].sum() * 100):,.2f}%\n\n")
        
        f.write(f"Средняя дневная выручка: {revenue_df.groupby(revenue_df['date'].dt.date)['amount'].sum().mean():,.2f} руб.\n")
        f.write(f"Средний чек: {revenue_df['amount'].mean():,.2f} руб.\n")
        f.write(f"Медианный чек: {revenue_df['amount'].median():,.2f} руб.\n\n")
        
        f.write("2. Показатели заказов\n")
        f.write("--------------------\n")
        f.write(f"Общее количество заказов: {len(orders_df)}\n")
        f.write(f"Завершенные заказы: {len(orders_df[orders_df['status'] == 'completed'])} ({len(orders_df[orders_df['status'] == 'completed']) / len(orders_df) * 100:,.2f}%)\n")
        f.write(f"Отмененные заказы: {len(orders_df[orders_df['status'] == 'cancelled'])} ({len(orders_df[orders_df['status'] == 'cancelled']) / len(orders_df) * 100:,.2f}%)\n")
        f.write(f"Средняя конверсия заказов: {len(orders_df[orders_df['status'] == 'completed']) / len(orders_df) * 100:,.2f}%\n\n")
        
        avg_items_per_order = order_items_df.groupby("order_id")["quantity"].sum().mean()
        f.write(f"Среднее количество позиций в заказе: {avg_items_per_order:,.2f}\n")
        f.write(f"Среднее количество блюд в заказе: {order_items_df['quantity'].sum() / len(orders_df):,.2f}\n\n")
        
        f.write("3. Временные показатели\n")
        f.write("----------------------\n")
        f.write("Выручка по дням недели:\n")
        
        weekday_revenue = revenue_df.groupby(revenue_df["date"].dt.day_name())["amount"].sum()
        weekday_revenue_pct = weekday_revenue / weekday_revenue.sum() * 100
        weekday_order = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
        days_ru = {
            "Monday": "Понедельник",
            "Tuesday": "Вторник",
            "Wednesday": "Среда",
            "Thursday": "Четверг",
            "Friday": "Пятница",
            "Saturday": "Суббота",
            "Sunday": "Воскресенье"
        }
        
        for day in weekday_order:
            if day in weekday_revenue:
                f.write(f"  - {days_ru[day]}: {weekday_revenue[day]:,.2f} руб. ({weekday_revenue_pct[day]:,.2f}%)\n")
        
        f.write("\nВыручка в будни vs выходные:\n")
        weekend_mask = revenue_df["date"].dt.weekday >= 5  # 5 = суббота, 6 = воскресенье
        weekday_total = revenue_df.loc[~weekend_mask, "amount"].sum()
        weekend_total = revenue_df.loc[weekend_mask, "amount"].sum()
        f.write(f"  - Будни (пн-пт): {weekday_total:,.2f} руб. ({weekday_total / (weekday_total + weekend_total) * 100:,.2f}%)\n")
        f.write(f"  - Выходные (сб-вс): {weekend_total:,.2f} руб. ({weekend_total / (weekday_total + weekend_total) * 100:,.2f}%)\n\n")
        
        f.write("Пиковые часы по выручке:\n")
        hourly_revenue = revenue_df.groupby("hour")["amount"].sum().sort_values(ascending=False)
        for hour, revenue in hourly_revenue[:3].items():
            f.write(f"  - {hour}:00 - {hour+1}:00: {revenue:,.2f} руб. ({revenue / hourly_revenue.sum() * 100:,.2f}%)\n")
        
        f.write("\n4. Популярность блюд\n")
        f.write("------------------\n")
        f.write("Топ-5 блюд по количеству заказов:\n")
        top_dishes_by_quantity = dish_popularity_df.groupby("dish_name")["quantity"].sum().sort_values(ascending=False).head(5)
        for dish, quantity in top_dishes_by_quantity.items():
            f.write(f"  - {dish}: {quantity} шт.\n")
        
        f.write("\nТоп-5 блюд по выручке:\n")
        top_dishes_by_revenue = dish_popularity_df.groupby("dish_name")["amount"].sum().sort_values(ascending=False).head(5)
        for dish, amount in top_dishes_by_revenue.items():
            f.write(f"  - {dish}: {amount:,.2f} руб.\n")
        
        f.write("\nВыручка по категориям блюд:\n")
        category_revenue = dish_popularity_df.groupby("category")["amount"].sum().sort_values(ascending=False)
        category_revenue_pct = category_revenue / category_revenue.sum() * 100
        for category, amount in category_revenue.items():
            f.write(f"  - {category}: {amount:,.2f} руб. ({category_revenue_pct[category]:,.2f}%)\n")
        
        f.write("\n5. Клиенты и персонал\n")
        f.write("--------------------\n")
        f.write(f"Количество клиентов: {revenue_df['customer_id'].nunique()}\n")
        f.write(f"Количество официантов: {revenue_df['waiter_id'].nunique()}\n\n")
        
        f.write("Топ-5 официантов по выручке:\n")
        top_waiters = revenue_df.groupby("waiter_id")["amount"].sum().sort_values(ascending=False).head(5)
        for waiter_id, amount in top_waiters.items():
            f.write(f"  - Официант #{waiter_id}: {amount:,.2f} руб.\n")
        
        f.write("\nТоп-5 официантов по количеству заказов:\n")
        top_waiters_by_orders = revenue_df.groupby("waiter_id")["order_id"].count().sort_values(ascending=False).head(5)
        for waiter_id, count in top_waiters_by_orders.items():
            f.write(f"  - Официант #{waiter_id}: {count} заказов\n")
        
        f.write("\nТоп-5 клиентов по выручке:\n")
        top_customers = revenue_df.groupby("customer_id")["amount"].sum().sort_values(ascending=False).head(5)
        for customer_id, amount in top_customers.items():
            f.write(f"  - Клиент #{customer_id}: {amount:,.2f} руб.\n")
        
        f.write("\n6. Рекомендации\n")
        f.write("---------------\n")
        
        # Определяем наименее прибыльные дни
        weekday_profit = revenue_df.groupby(revenue_df["date"].dt.day_name())["profit"].sum()
        weekday_profit_per_order = revenue_df.groupby(revenue_df["date"].dt.day_name()).agg({"profit": "sum", "order_id": "count"})
        weekday_profit_per_order["profit_per_order"] = weekday_profit_per_order["profit"] / weekday_profit_per_order["order_id"]
        least_profitable_day = weekday_profit_per_order["profit_per_order"].idxmin()
        
        f.write(f"1. Наименее прибыльный день недели: {days_ru.get(least_profitable_day, least_profitable_day)}. Рекомендуется пересмотреть\n   маркетинговую стратегию или провести специальные акции в этот день.\n\n")
        
        # Определяем часы с наименьшей посещаемостью
        hourly_orders = revenue_df.groupby("hour")["order_id"].count()
        least_busy_hours = hourly_orders[hourly_orders.index.isin(range(11, 22))].nsmallest(3)
        
        f.write("2. Часы с наименьшей посещаемостью в рабочее время:\n")
        for hour, count in least_busy_hours.items():
            f.write(f"   - {hour}:00 - {hour+1}:00: {count} заказов\n")
        f.write("   Рекомендуется рассмотреть возможность проведения акций типа \"счастливые часы\"\n   в это время для привлечения клиентов.\n\n")
        
        # Определяем наименее популярные категории
        category_orders = dish_popularity_df.groupby("category")["quantity"].sum()
        least_popular_categories = category_orders.nsmallest(2)
        
        f.write("3. Наименее популярные категории блюд:\n")
        for category, count in least_popular_categories.items():
            f.write(f"   - {category}: {count} заказов\n")
        f.write("   Рекомендуется обновить меню этих категорий или улучшить их маркетинговое продвижение.\n\n")
        
        f.write("4. Общие рекомендации:\n")
        f.write("   - Разработать программу лояльности для постоянных клиентов\n")
        f.write("   - Анализировать эффективность работы персонала и внедрить систему мотивации\n")
        f.write("   - Оптимизировать меню, исключив непопулярные и низкорентабельные позиции\n")
        f.write("   - Проводить регулярные маркетинговые акции в периоды низкой посещаемости\n")
    
    print(f"Сводный отчет создан: {os.path.join(reports_dir, 'summary_report.txt')}")

def main():
    """Основная функция программы."""
    parser = argparse.ArgumentParser(description="Визуализация аналитических данных ресторана")
    parser.add_argument("--data-dir", type=str, default="analytics_data",
                        help="Директория с CSV-файлами данных (по умолчанию: analytics_data)")
    parser.add_argument("--output-dir", type=str, default=None,
                        help="Директория для сохранения отчетов (по умолчанию: та же, что и data-dir)")
    parser.add_argument("--basic-only", action="store_true", 
                        help="Создать только базовые отчеты")
    parser.add_argument("--advanced-only", action="store_true",
                        help="Создать только расширенные отчеты")
    parser.add_argument("--no-summary", action="store_true",
                        help="Не генерировать текстовый сводный отчет")
    
    args = parser.parse_args()
    
    data_dir = args.data_dir
    output_dir = args.output_dir if args.output_dir else data_dir
    
    # Проверяем наличие директории с данными
    if not os.path.exists(data_dir):
        print(f"Ошибка: директория {data_dir} не найдена.")
        sys.exit(1)
    
    try:
        # Загружаем данные
        print(f"Загрузка данных из {data_dir}...")
        data = load_data(data_dir)
        
        # Создаем отчеты
        if not args.advanced_only:
            print("Создание базовых отчетов...")
            create_basic_reports(data, output_dir)
        
        if not args.basic_only:
            print("Создание расширенных отчетов...")
            create_advanced_reports(data, output_dir)
        
        if not args.no_summary:
            print("Создание сводного отчета...")
            generate_summary_report(data, output_dir)
        
        print(f"Все отчеты успешно созданы в {os.path.join(output_dir, 'reports')}")
        
    except Exception as e:
        print(f"Ошибка при создании отчетов: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main() 