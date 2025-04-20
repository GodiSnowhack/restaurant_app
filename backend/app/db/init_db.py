import logging
from sqlalchemy.orm import Session

from app.database.session import engine, Base
from app.models.user import User, UserRole
from app.models.menu import Category, Dish
from app.models.order import Order, Feedback
from app.models.reservation import Reservation
from app.models.settings import Settings
from app.models.order_code import OrderCode

logger = logging.getLogger(__name__)

def init_db(db: Session) -> None:
    """
    Инициализация БД - создание таблиц и начальных данных
    """
    # Важно импортировать все модели перед созданием таблиц, 
    # даже если мы их не используем в этом файле напрямую
    
    # Перед созданием таблиц принудительно импортируем все модели
    from app.models.user import User
    from app.models.order import Order, Feedback
    from app.models.menu import Category, Dish, Allergen, Tag, IngredientGroup, Ingredient
    from app.models.reservation import Reservation
    from app.models.order_code import OrderCode
    from app.models.settings import Settings
    
    # Создание таблиц
    Base.metadata.create_all(bind=engine)
    logger.info("База данных инициализирована")
    
    # Инициализация настроек
    init_settings(db)
    
def init_settings(db: Session) -> None:
    """
    Инициализация настроек ресторана
    """
    # Проверяем, есть ли уже запись с настройками
    settings = db.query(Settings).first()
    if not settings:
        # Создаем настройки по умолчанию
        settings = Settings.create_default()
        db.add(settings)
        db.commit()
        logger.info("Созданы настройки ресторана по умолчанию")
    else:
        logger.info("Настройки ресторана уже существуют") 