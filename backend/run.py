import logging
import uvicorn
import os
import sys

from app.database.session import SessionLocal
from app.core.init_db import init_db
from app.core.config import settings

# Настройка логгера
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def main() -> None:
    """
    Запуск приложения с настройками из конфига
    """
    try:
        # Переходим в корневую директорию проекта
        backend_dir = os.path.dirname(os.path.abspath(__file__))
        project_root = os.path.dirname(backend_dir)
        os.chdir(project_root)
        logger.info(f"Изменена рабочая директория на: {os.getcwd()}")
        
        # Проверяем наличие директории data
        if not os.path.exists("data"):
            os.makedirs("data")
            logger.info("Создана директория data")
        
        # Проверяем наличие файла main.py
        if not os.path.exists(os.path.join(backend_dir, "main.py")):
            logger.error("Файл main.py не найден в директории backend")
            raise FileNotFoundError("main.py не найден")
        
        # Переходим обратно в директорию backend для запуска сервера
        os.chdir(backend_dir)
        logger.info(f"Изменена рабочая директория для запуска сервера: {os.getcwd()}")
            
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