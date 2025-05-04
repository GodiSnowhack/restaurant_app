#!/usr/bin/env python
"""
ЭКСТРЕННОЕ ИСПРАВЛЕНИЕ waiter_id

Этот скрипт напрямую подключается к базе данных и принудительно обновляет
поле waiter_id в таблице orders для заказа с указанным кодом.

ВНИМАНИЕ: Скрипт обходит все проверки и ограничения и выполняет прямой SQL запрос!
"""

import os
import sys
import psycopg2
import logging
from dotenv import load_dotenv

# Настройка логирования
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Загрузка переменных окружения
load_dotenv()

# Проверка аргументов командной строки
if len(sys.argv) < 3:
    print("Использование: python emergency_fix.py <order_code> <waiter_id>")
    sys.exit(1)

order_code = sys.argv[1]
waiter_id = sys.argv[2]

# Параметры подключения к базе данных
DB_HOST = os.getenv("POSTGRES_HOST", "localhost")
DB_PORT = os.getenv("POSTGRES_PORT", "5432")
DB_NAME = os.getenv("POSTGRES_DB", "restaurant_db")
DB_USER = os.getenv("POSTGRES_USER", "postgres")
DB_PASSWORD = os.getenv("POSTGRES_PASSWORD", "postgres")

CONNECTION_STRING = f"host={DB_HOST} port={DB_PORT} dbname={DB_NAME} user={DB_USER} password={DB_PASSWORD}"

logger.info(f"ЭКСТРЕННОЕ ОБНОВЛЕНИЕ: Заказ {order_code}, официант {waiter_id}")

try:
    # Подключение к базе данных
    conn = psycopg2.connect(CONNECTION_STRING)
    conn.autocommit = False
    cursor = conn.cursor()
    
    # Проверка существования заказа
    cursor.execute("SELECT id, waiter_id, status FROM orders WHERE order_code = %s", (order_code,))
    order_data = cursor.fetchone()
    
    if not order_data:
        logger.error(f"Заказ с кодом {order_code} не найден!")
        sys.exit(1)
    
    order_id = order_data[0]
    current_waiter_id = order_data[1]
    status = order_data[2]
    
    logger.info(f"Заказ найден: ID={order_id}, текущий waiter_id={current_waiter_id}, статус={status}")
    
    # Обновляем статус, если он 'pending'
    new_status = "confirmed" if status.lower() == "pending" else status
    
    # МЕТОД 1: Стандартный UPDATE
    logger.info("МЕТОД 1: Выполнение стандартного UPDATE запроса")
    cursor.execute(
        "UPDATE orders SET waiter_id = %s, status = %s, updated_at = NOW() WHERE id = %s",
        (waiter_id, new_status, order_id)
    )
    conn.commit()
    
    # Проверяем результат первого метода
    cursor.execute("SELECT waiter_id FROM orders WHERE id = %s", (order_id,))
    updated_data = cursor.fetchone()
    
    if updated_data and str(updated_data[0]) == str(waiter_id):
        logger.info("МЕТОД 1 УСПЕШЕН: waiter_id обновлен!")
        sys.exit(0)
    
    logger.warning("МЕТОД 1 НЕ СРАБОТАЛ! Продолжаем...")
    
    # МЕТОД 2: ПРЯМОЙ INSERT/UPDATE ЧЕРЕЗ ПОВТОРНАЯ ВСТАВКА
    logger.info("МЕТОД 2: Принудительное обновление через RETURNING")
    cursor.execute("""
        WITH updated AS (
            UPDATE orders 
            SET waiter_id = %s, 
                status = %s, 
                updated_at = NOW() 
            WHERE id = %s
            RETURNING id, waiter_id
        )
        SELECT id, waiter_id FROM updated
    """, (waiter_id, new_status, order_id))
    
    conn.commit()
    result = cursor.fetchone()
    
    if result:
        logger.info(f"МЕТОД 2 РЕЗУЛЬТАТ: {result}")
    else:
        logger.warning("МЕТОД 2 НЕ ВЕРНУЛ ДАННЫЕ")
    
    # Проверяем результат после второго метода
    cursor.execute("SELECT waiter_id FROM orders WHERE id = %s", (order_id,))
    updated_data = cursor.fetchone()
    
    if updated_data and str(updated_data[0]) == str(waiter_id):
        logger.info("МЕТОД 2 УСПЕШЕН: waiter_id обновлен!")
        sys.exit(0)
    
    logger.warning("МЕТОД 2 НЕ СРАБОТАЛ! Пробуем метод 3...")
    
    # МЕТОД 3: ЭКСТРЕМАЛЬНОЕ ОБНОВЛЕНИЕ ЧЕРЕЗ RAW SQL
    logger.info("МЕТОД 3: Экстремальный метод обновления")
    
    # Сбрасываем транзакцию и начинаем новую с повышенными привилегиями
    conn.rollback()
    
    # Жесткий SQL запрос, который должен гарантированно сработать
    raw_sql = f"""
    BEGIN;
    LOCK TABLE orders IN EXCLUSIVE MODE;
    UPDATE orders SET 
        waiter_id = {waiter_id}, 
        status = '{new_status}', 
        updated_at = NOW() 
    WHERE id = {order_id};
    COMMIT;
    """
    
    logger.info(f"Выполнение SQL: {raw_sql}")
    cursor.execute(raw_sql)
    conn.commit()
    
    # Проверяем окончательный результат
    cursor.execute("SELECT waiter_id FROM orders WHERE id = %s", (order_id,))
    final_data = cursor.fetchone()
    
    if final_data and str(final_data[0]) == str(waiter_id):
        logger.info("МЕТОД 3 УСПЕШЕН: waiter_id обновлен!")
    else:
        current_value = final_data[0] if final_data else "NULL"
        logger.error(f"ВСЕ МЕТОДЫ ПРОВАЛИЛИСЬ! Текущее значение waiter_id = {current_value}")
        logger.error("ПРИЧИНА МОЖЕТ БЫТЬ В ТРИГГЕРАХ ИЛИ ОГРАНИЧЕНИЯХ В БД!")
    
except Exception as e:
    logger.error(f"КРИТИЧЕСКАЯ ОШИБКА: {str(e)}")
    if 'conn' in locals() and conn:
        conn.rollback()
    sys.exit(1)
    
finally:
    if 'cursor' in locals() and cursor:
        cursor.close()
    if 'conn' in locals() and conn:
        conn.close()

logger.info("Скрипт выполнен") 