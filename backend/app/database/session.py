from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

from app.core.config import settings

# Создаем движок SQLAlchemy для SQLite
engine = create_engine(
    settings.SQLITE_DATABASE_URI, connect_args={"check_same_thread": False}
)

# Создаем фабрику сессий
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Базовый класс для создания моделей
Base = declarative_base()

# Функция-зависимость для получения сессии БД
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close() 