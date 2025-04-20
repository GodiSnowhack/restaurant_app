import logging
from sqlalchemy import text
from app.database.session import SessionLocal, engine

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def migrate_order_dish_table():
    """
    Миграция таблицы order_dish в OrderDish
    """
    db = SessionLocal()
    try:
        # Проверяем, существует ли таблица order_dish
        check_query = "SELECT name FROM sqlite_master WHERE type='table' AND name='order_dish'"
        result = db.execute(text(check_query)).fetchone()
        
        if not result:
            logger.info("Таблица order_dish не найдена. Проверяем наличие OrderDish...")
            check_orderdish_query = "SELECT name FROM sqlite_master WHERE type='table' AND name='OrderDish'"
            orderdish_result = db.execute(text(check_orderdish_query)).fetchone()
            
            if orderdish_result:
                logger.info("Таблица OrderDish уже существует. Миграция не требуется.")
                return
            else:
                logger.info("Создаем новую таблицу OrderDish...")
                # Создаем таблицу OrderDish напрямую
                create_query = """
                CREATE TABLE OrderDish (
                    id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
                    order_id INTEGER NOT NULL,
                    dish_id INTEGER NOT NULL,
                    quantity INTEGER,
                    special_instructions TEXT,
                    FOREIGN KEY(order_id) REFERENCES orders(id) ON DELETE CASCADE,
                    FOREIGN KEY(dish_id) REFERENCES dishes(id) ON DELETE CASCADE
                )
                """
                db.execute(text(create_query))
                db.commit()
                logger.info("Таблица OrderDish успешно создана.")
                return
        
        # Создаем таблицу OrderDish на основе order_dish
        logger.info("Начинаем миграцию таблицы order_dish в OrderDish...")
        
        # Создаем новую таблицу с новым именем
        create_new_table_query = """
        CREATE TABLE IF NOT EXISTS OrderDish (
            id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
            order_id INTEGER NOT NULL,
            dish_id INTEGER NOT NULL,
            quantity INTEGER,
            special_instructions TEXT,
            FOREIGN KEY(order_id) REFERENCES orders(id) ON DELETE CASCADE,
            FOREIGN KEY(dish_id) REFERENCES dishes(id) ON DELETE CASCADE
        )
        """
        db.execute(text(create_new_table_query))
        
        # Копируем данные из старой таблицы в новую
        copy_data_query = """
        INSERT INTO OrderDish (id, order_id, dish_id, quantity, special_instructions)
        SELECT id, order_id, dish_id, quantity, special_instructions FROM order_dish
        """
        db.execute(text(copy_data_query))
        
        # Удаляем старую таблицу
        drop_old_table_query = "DROP TABLE order_dish"
        db.execute(text(drop_old_table_query))
        
        # Создаем необходимые индексы (если были в оригинальной таблице)
        create_index_query = """
        CREATE INDEX IF NOT EXISTS ix_OrderDish_id ON OrderDish (id);
        CREATE INDEX IF NOT EXISTS ix_OrderDish_order_id ON OrderDish (order_id);
        CREATE INDEX IF NOT EXISTS ix_OrderDish_dish_id ON OrderDish (dish_id);
        """
        db.execute(text(create_index_query))
        
        db.commit()
        logger.info("Миграция таблицы order_dish в OrderDish успешно завершена!")
    
    except Exception as e:
        db.rollback()
        logger.error(f"Ошибка при миграции таблицы: {str(e)}")
    finally:
        db.close()

if __name__ == "__main__":
    logger.info("Запуск миграции таблицы order_dish в OrderDish...")
    migrate_order_dish_table()
    logger.info("Миграция завершена.") 