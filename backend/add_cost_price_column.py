import sqlite3
import os

def add_cost_price_column():
    """
    Добавляет колонку cost_price в таблицу dishes существующей БД SQLite
    """
    # Текущий каталог скрипта
    current_dir = os.path.dirname(os.path.abspath(__file__))
    # Путь к базе данных - ищем в каталоге data рядом с backend
    db_path = os.path.join(os.path.dirname(current_dir), "data", "restaurant.db")
    
    if not os.path.exists(db_path):
        print(f"Ошибка: база данных restaurant.db не найдена в каталоге {os.path.join(os.path.dirname(current_dir), 'data')}")
        return
    
    print(f"Найдена база данных: {db_path}")
    
    # Подключаемся к базе данных
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    try:
        # Получаем информацию о существующих столбцах таблицы dishes
        cursor.execute("PRAGMA table_info(dishes)")
        existing_columns = [column[1] for column in cursor.fetchall()]
        
        print(f"Существующие колонки в таблице dishes: {existing_columns}")
        
        # Добавляем колонку cost_price, если её нет
        if "cost_price" not in existing_columns:
            try:
                cursor.execute("ALTER TABLE dishes ADD COLUMN cost_price REAL")
                print("Колонка cost_price успешно добавлена в таблицу dishes")
            except sqlite3.OperationalError as e:
                print(f"Ошибка при добавлении колонки cost_price: {e}")
        else:
            print("Колонка cost_price уже существует в таблице dishes")
        
        # Сохраняем изменения
        conn.commit()
        print("Успешно обновлена структура таблицы dishes!")
    
    except Exception as e:
        # В случае ошибки отменяем изменения
        conn.rollback()
        print(f"Произошла ошибка: {e}")
    finally:
        # Закрываем соединение
        conn.close()

if __name__ == "__main__":
    print("Начинаем добавление колонки cost_price в таблицу dishes...")
    add_cost_price_column()
    print("Операция завершена.") 