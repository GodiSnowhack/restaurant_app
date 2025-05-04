#!/usr/bin/env python
"""
Экстренное исправление проблемы обновления waiter_id в заказах
Этот скрипт обходит ORM и напрямую выполняет SQL-запросы для обновления БД

Использование:
    python fix_waiter_id.py <order_code> <waiter_id>

Пример:
    python fix_waiter_id.py F00691 1
"""

import sys
import os
import logging
import psycopg2
from psycopg2.extras import DictCursor
from dotenv import load_dotenv
from datetime import datetime

# Настройка логирования
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
)
logger = logging.getLogger("db_fix")

# Загрузка переменных окружения
load_dotenv()

# Получение аргументов
if len(sys.argv) < 3:
    print("Использование: python fix_waiter_id.py <order_code> <waiter_id>")
    sys.exit(1)

order_code = sys.argv[1]
waiter_id = int(sys.argv[2])

# Получение параметров подключения к БД из переменных окружения
DB_HOST = os.getenv("POSTGRES_HOST", "localhost")
DB_PORT = os.getenv("POSTGRES_PORT", "5432")
DB_NAME = os.getenv("POSTGRES_DB", "restaurant_db")
DB_USER = os.getenv("POSTGRES_USER", "postgres")
DB_PASSWORD = os.getenv("POSTGRES_PASSWORD", "postgres")

# Подключение к базе данных
try:
    logger.info(f"Подключение к БД {DB_NAME} на {DB_HOST}:{DB_PORT}")
    conn = psycopg2.connect(
        dbname=DB_NAME,
        user=DB_USER,
        password=DB_PASSWORD,
        host=DB_HOST,
        port=DB_PORT
    )
    conn.autocommit = False
    cursor = conn.cursor(cursor_factory=DictCursor)
    logger.info("Подключение успешно установлено")
except Exception as e:
    logger.error(f"Ошибка подключения к БД: {str(e)}")
    sys.exit(1)

try:
    # Проверка существования заказа
    cursor.execute(
        "SELECT id, status, waiter_id FROM orders WHERE order_code = %s",
        (order_code,)
    )
    order = cursor.fetchone()
    
    if not order:
        logger.error(f"Заказ с кодом {order_code} не найден")
        sys.exit(1)
    
    order_id = order['id']
    current_waiter_id = order['waiter_id']
    current_status = order['status']
    
    logger.info(f"Найден заказ ID={order_id}, текущий waiter_id={current_waiter_id}, статус={current_status}")
    
    # Проверка нужно ли обновление
    if current_waiter_id == waiter_id:
        logger.info(f"Заказ уже привязан к официанту {waiter_id}, обновление не требуется")
        sys.exit(0)
    
    # Начало транзакции
    logger.info(f"Начало обновления заказа ID={order_id}, новый waiter_id={waiter_id}")
    
    # Определяем статус
    new_status = "confirmed" if current_status.lower() == "pending" else current_status
    
    # Прямое обновление заказа SQL запросом
    update_query = """
        UPDATE orders 
        SET waiter_id = %s, 
            status = %s, 
            updated_at = NOW() 
        WHERE id = %s
    """
    
    cursor.execute(update_query, (waiter_id, new_status, order_id))
    rows_affected = cursor.rowcount
    logger.info(f"SQL запрос выполнен, затронуто строк: {rows_affected}")
    
    # Проверка успешности обновления
    if rows_affected == 0:
        logger.error("Запрос не обновил ни одной строки!")
        conn.rollback()
        sys.exit(1)
    
    # Коммит транзакции
    conn.commit()
    logger.info("Транзакция успешно завершена")
    
    # Проверка результата
    cursor.execute(
        "SELECT waiter_id FROM orders WHERE id = %s",
        (order_id,)
    )
    updated_order = cursor.fetchone()
    
    if updated_order and updated_order['waiter_id'] == waiter_id:
        logger.info(f"Заказ успешно обновлен! Новый waiter_id: {waiter_id}")
    else:
        new_waiter_id = updated_order['waiter_id'] if updated_order else None
        logger.error(f"Проверка не прошла! Текущий waiter_id: {new_waiter_id}")
        
        # Последняя отчаянная попытка
        logger.warning("Выполнение экстренного обновления...")
        cursor.execute(
            "BEGIN; UPDATE orders SET waiter_id = %s WHERE id = %s; COMMIT;",
            (waiter_id, order_id)
        )
        conn.commit()
        logger.info("Экстренное обновление завершено")
        
except Exception as e:
    logger.error(f"Ошибка при обновлении заказа: {str(e)}")
    conn.rollback()
    sys.exit(1)
finally:
    cursor.close()
    conn.close()
    logger.info("Соединение с БД закрыто")
    
logger.info("Скрипт успешно выполнен") 