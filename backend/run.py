import logging
import uvicorn
import os

from app.database.session import SessionLocal
from app.db.init_db import init_db
from app.core.config import settings

# Настройка логгера
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def main() -> None:
    """
    Запуск приложения с настройками из конфига
    """
    try:
        # Проверяем наличие файла main.py
        if not os.path.exists("main.py"):
            logger.error("Файл main.py не найден в текущей директории")
            raise FileNotFoundError("main.py не найден")
            
        # Инициализируем базу данных
        logger.info("Инициализация базы данных...")
        db = SessionLocal()
        try:
            init_db(db)
        finally:
            db.close()
            
        # Запускаем сервер
        logger.info(f"Запуск сервера на {settings.SERVER_HOST}:{settings.SERVER_PORT}")
        uvicorn.run(
            "main:app",
            host=settings.SERVER_HOST,
            port=settings.SERVER_PORT,
            reload=settings.DEBUG,
            workers=settings.WORKERS_COUNT
        )
    except Exception as e:
        logger.error(f"Ошибка при запуске приложения: {e}")
        raise

if __name__ == "__main__":
    main() 