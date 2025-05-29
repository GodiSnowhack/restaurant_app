from sqlalchemy import create_engine, event
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from pathlib import Path

from app.core.config import settings

# Создаем директорию для базы данных, если она не существует
db_path = Path(settings.SQLITE_DATABASE_URI.replace("sqlite:///", "")).parent
db_path.mkdir(parents=True, exist_ok=True)

# Создаем движок SQLAlchemy для SQLite с оптимизированными настройками
engine = create_engine(
    settings.SQLITE_DATABASE_URI,
    connect_args={
        "check_same_thread": False,  # Разрешаем доступ из разных потоков
        "timeout": 30,               # Таймаут для ожидания блокировки
    },
    # Настройки пула соединений
    pool_size=5,                    # Уменьшаем размер пула для Railway
    max_overflow=10,                # Разрешаем дополнительные соединения при перегрузке
    pool_timeout=30,                # Таймаут ожидания соединения из пула
    pool_recycle=1800,              # Пересоздаем соединения каждые 30 минут
    pool_pre_ping=True,             # Проверяем соединение перед использованием
)

# Оптимизируем SQLite через события подключения
@event.listens_for(engine, "connect")
def optimize_sqlite_connection(dbapi_connection, connection_record):
    # Включаем журнал упреждающей записи (WAL) для поддержки параллельного чтения и записи
    dbapi_connection.execute("PRAGMA journal_mode=WAL")
    
    # Отключаем синхронизацию с диском для повышения производительности
    dbapi_connection.execute("PRAGMA synchronous=NORMAL")
    
    # Включаем внешние ключи
    dbapi_connection.execute("PRAGMA foreign_keys=ON")
    
    # Устанавливаем таймаут для транзакций
    dbapi_connection.execute("PRAGMA busy_timeout=5000")

# Создаем фабрику сессий
SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
    expire_on_commit=False  # Предотвращаем автоматическое устаревание объектов
)

# Базовый класс для создания моделей
Base = declarative_base()

# Функция для создания всех таблиц
def create_tables():
    Base.metadata.create_all(bind=engine)
    
# Функция для очистки и пересоздания схемы БД
def reset_database():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)

# Функция-зависимость для получения сессии БД
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close() 