from sqlalchemy import create_engine, event
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

from app.core.config import settings

# Создаем движок SQLAlchemy для SQLite с оптимизированными настройками
engine = create_engine(
    settings.SQLITE_DATABASE_URI, 
    connect_args={
        "check_same_thread": False,  # Разрешаем доступ из разных потоков
        "timeout": 60,               # Увеличиваем таймаут для ожидания блокировки (было 30, стало 60)
    },
    # Настройки пула соединений
    pool_size=20,                    # Увеличиваем размер пула соединений
    max_overflow=30,                 # Разрешаем дополнительные соединения при перегрузке
    pool_timeout=30,                 # Таймаут ожидания соединения из пула
    pool_recycle=1800,               # Пересоздаем соединения каждые 30 минут
    pool_pre_ping=True,              # Проверяем соединение перед использованием
)

# Оптимизируем SQLite через события подключения
@event.listens_for(engine, "connect")
def optimize_sqlite_connection(dbapi_connection, connection_record):
    # Включаем журнал упреждающей записи (WAL) для поддержки параллельного чтения и записи
    dbapi_connection.execute("PRAGMA journal_mode=WAL")
    
    # Отключаем синхронизацию с диском для повышения производительности
    # (может привести к потере данных при сбое питания, но увеличит скорость)
    dbapi_connection.execute("PRAGMA synchronous=NORMAL")
    
    # Разрешаем кэширование для повышения производительности
    dbapi_connection.execute("PRAGMA cache_size=-2000")  # ~2MB кэша
    
    # Включаем внешние ключи
    dbapi_connection.execute("PRAGMA foreign_keys=ON")
    
    # Устанавливаем таймаут для транзакций
    dbapi_connection.execute("PRAGMA busy_timeout=10000")  # 10 секунд (было 5 секунд)
    
    # Используем временные таблицы в памяти
    dbapi_connection.execute("PRAGMA temp_store=MEMORY")

# Создаем фабрику сессий с дополнительными настройками
SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
    expire_on_commit=False  # Предотвращаем автоматическое устаревание объектов
)

# Базовый класс для создания моделей
Base = declarative_base()

# Функция-зависимость для получения сессии БД
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close() 