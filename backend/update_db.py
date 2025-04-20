import sqlite3
import os

def add_missing_columns():
    """
    Добавляет недостающие колонки в таблицу orders существующей БД SQLite
    """
    # Текущий каталог скрипта
    current_dir = os.path.dirname(os.path.abspath(__file__))
    # Путь к базе данных - ищем в директории data
    db_path = os.path.join(current_dir, "data", "restaurant.db")
    
    if not os.path.exists(db_path):
        print(f"Ошибка: база данных restaurant.db не найдена в каталоге {os.path.join(current_dir, 'data')}")
        return
    
    print(f"Найдена база данных: {db_path}")
    
    # Подключаемся к базе данных
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    try:
        # Получаем информацию о существующих столбцах таблицы orders
        cursor.execute("PRAGMA table_info(orders)")
        existing_columns = [column[1] for column in cursor.fetchall()]
        
        print(f"Существующие колонки в таблице orders: {existing_columns}")
        
        # Определяем колонки, которые нужно добавить, если их нет
        columns_to_add = {
            "payment_method": "TEXT",
            "customer_name": "TEXT",
            "customer_phone": "TEXT",
            "delivery_address": "TEXT",
            "reservation_code": "TEXT",
            "order_code": "TEXT",
            "comment": "TEXT",
            "is_urgent": "BOOLEAN DEFAULT 0",
            "is_group_order": "BOOLEAN DEFAULT 0",
            "completed_at": "TIMESTAMP"
        }
        
        # Проверяем, нужно ли добавить колонки customer_name и customer_phone еще раз,
        # возможно, они были добавлены, но имеют неправильный тип
        try:
            # Проверяем существующие записи
            cursor.execute("SELECT customer_name, customer_phone FROM orders LIMIT 1")
        except sqlite3.OperationalError:
            # Если произошла ошибка, значит колонки не работают правильно
            print("Колонки customer_name или customer_phone не работают правильно, пробуем пересоздать их")
            try:
                # Создаем временную таблицу без проблемных колонок
                cursor.execute("""
                CREATE TABLE IF NOT EXISTS orders_temp (
                    id INTEGER PRIMARY KEY,
                    user_id INTEGER,
                    waiter_id INTEGER,
                    table_number INTEGER,
                    status TEXT,
                    payment_status TEXT,
                    total_amount REAL,
                    payment_method TEXT,
                    customer_name TEXT,
                    customer_phone TEXT,
                    delivery_address TEXT,
                    reservation_code TEXT,
                    order_code TEXT,
                    comment TEXT,
                    is_urgent BOOLEAN,
                    is_group_order BOOLEAN,
                    created_at TIMESTAMP,
                    updated_at TIMESTAMP,
                    completed_at TIMESTAMP
                )
                """)
                
                # Копируем данные в временную таблицу
                cursor.execute("""
                INSERT INTO orders_temp (id, user_id, waiter_id, table_number, status, payment_status, total_amount,
                                      payment_method, customer_name, customer_phone, delivery_address,
                                      reservation_code, order_code, comment, is_urgent, is_group_order,
                                      created_at, updated_at, completed_at)
                SELECT id, user_id, waiter_id, table_number, status, payment_status, total_amount,
                       payment_method, NULL as customer_name, NULL as customer_phone, delivery_address,
                       reservation_code, order_code, comment, is_urgent, is_group_order,
                       created_at, updated_at, completed_at
                FROM orders
                """)
                
                # Удаляем старую таблицу
                cursor.execute("DROP TABLE orders")
                
                # Переименовываем временную таблицу
                cursor.execute("ALTER TABLE orders_temp RENAME TO orders")
                
                print("Структура таблицы orders полностью обновлена с новыми колонками")
            except sqlite3.OperationalError as e:
                print(f"Не удалось пересоздать таблицу: {e}")
        
        # Добавляем отсутствующие колонки
        for column_name, column_type in columns_to_add.items():
            if column_name not in existing_columns:
                try:
                    cursor.execute(f"ALTER TABLE orders ADD COLUMN {column_name} {column_type}")
                    print(f"Колонка {column_name} успешно добавлена в таблицу orders")
                except sqlite3.OperationalError as e:
                    print(f"Ошибка при добавлении колонки {column_name}: {e}")
        
        # Сохраняем изменения
        conn.commit()
        print("Успешно обновлена структура таблицы orders!")
    
    except Exception as e:
        # В случае ошибки отменяем изменения
        conn.rollback()
        print(f"Произошла ошибка: {e}")
    finally:
        # Закрываем соединение
        conn.close()

if __name__ == "__main__":
    print("Начинаем обновление структуры базы данных...")
    add_missing_columns()
    print("Операция завершена.") 