import logging
from sqlalchemy.orm import Session

from app.core.config import settings
from app.database.session import Base, engine
from app.services.user import get_user_by_email, create_user
from app.schemas.user import UserCreate
from app.models.user import User, UserRole
from app.models.menu import Category, Dish, Allergen, Tag
from app.models.order import Order, Feedback, OrderStatus, PaymentStatus
from app.models.reservation import Reservation, ReservationStatus
from app.models.settings import Settings

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def init_db(db: Session) -> None:
    """Инициализация базы данных"""
    # Создаем таблицы
    Base.metadata.create_all(bind=engine)
    logger.info("Таблицы в БД созданы")
    
    # Создаем администратора, если его нет
    create_admin(db)
    
    # Создаем тестовые данные, если нужно
    if settings.ENVIRONMENT == "development":
        create_test_data(db)


def create_admin(db: Session) -> None:
    """Создание пользователя-администратора"""
    admin_email = settings.FIRST_SUPERUSER
    admin = get_user_by_email(db, admin_email)
    
    if not admin:
        user_in = UserCreate(
            email=admin_email,
            password=settings.FIRST_SUPERUSER_PASSWORD,
            phone="87051543514",
            full_name="Admin User",
            role=UserRole.ADMIN
        )
        admin = create_user(db, user_in)
        logger.info(f"Создан пользователь-администратор: {admin_email}")
    else:
        logger.info(f"Пользователь-администратор уже существует: {admin_email}")


def create_test_data(db: Session) -> None:
    """Создание тестовых данных для разработки"""
    # Проверяем, есть ли уже категории
    if db.query(Category).count() > 0:
        logger.info("Тестовые данные уже существуют, пропускаем")
        return
    
    logger.info("Создание тестовых данных...")
    
    # Создаем категории
    categories = [
        Category(name="Закуски", description="Легкие закуски к столу"),
        Category(name="Салаты", description="Свежие салаты"),
        Category(name="Супы", description="Горячие супы"),
        Category(name="Основные блюда", description="Основные блюда из мяса, рыбы и птицы"),
        Category(name="Гарниры", description="Гарниры к основным блюдам"),
        Category(name="Десерты", description="Сладкие десерты"),
        Category(name="Напитки", description="Прохладительные и горячие напитки")
    ]
    db.add_all(categories)
    db.commit()
    
    # Создаем аллергены
    allergens = [
        Allergen(name="Глютен", description="Содержит глютен"),
        Allergen(name="Молоко", description="Содержит лактозу"),
        Allergen(name="Яйца", description="Содержит яйца"),
        Allergen(name="Орехи", description="Содержит орехи"),
        Allergen(name="Соя", description="Содержит сою"),
        Allergen(name="Морепродукты", description="Содержит морепродукты")
    ]
    db.add_all(allergens)
    db.commit()
    
    # Создаем теги
    tags = [
        Tag(name="Острое"),
        Tag(name="Веганское"),
        Tag(name="Вегетарианское"),
        Tag(name="Сезонное"),
        Tag(name="Фирменное"),
        Tag(name="Детское"),
        Tag(name="Без глютена")
    ]
    db.add_all(tags)
    db.commit()
    
    # Создаем блюда
    dishes = [
        # Закуски
        Dish(
            name="Тарталетки с красной икрой",
            description="Хрустящие тарталетки с красной икрой и сливочным маслом",
            price=1500.0,
            cost_price=1000.0,
            category_id=1,
            is_vegetarian=False,
            is_vegan=False,
            cooking_time=15,
            calories=320
        ),
        Dish(
            name="Брускетта с томатами и базиликом",
            description="Поджаренный хлеб с томатами, базиликом и оливковым маслом",
            price=1400.0,
            cost_price=800.0,
            category_id=1,
            is_vegetarian=True,
            is_vegan=True,
            cooking_time=10,
            calories=250
        ),
        # Салаты
        Dish(
            name="Цезарь с курицей",
            description="Классический салат с курицей, сыром пармезан и соусом цезарь",
            price=1300.0,
            cost_price=600.0,
            category_id=2,
            is_vegetarian=False,
            is_vegan=False,
            cooking_time=15,
            calories=380
        ),
        Dish(
            name="Греческий салат",
            description="Традиционный греческий салат с сыром фета и оливками",
            price=1500.0,
            cost_price=800.0,
            category_id=2,
            is_vegetarian=True,
            is_vegan=False,
            cooking_time=10,
            calories=320
        ),
        # Супы
        Dish(
            name="Борщ",
            description="Традиционный борщ со сметаной и гренками",
            price=2000.0,
            cost_price=1200.0,
            category_id=3,
            is_vegetarian=False,
            is_vegan=False,
            cooking_time=30,
            calories=420
        ),
        Dish(
            name="Грибной крем-суп",
            description="Нежный крем-суп из белых грибов",
            price=2300.0,
            cost_price=1300.0,
            category_id=3,
            is_vegetarian=True,
            is_vegan=False,
            cooking_time=25,
            calories=380
        ),
        # Основные блюда
        Dish(
            name="Стейк Рибай",
            description="Сочный стейк из мраморной говядины",
            price=3000.0,
            cost_price=1800.0,
            category_id=4,
            is_vegetarian=False,
            is_vegan=False,
            cooking_time=20,
            calories=550
        ),
        Dish(
            name="Лосось на гриле",
            description="Филе лосося, приготовленное на гриле, с лимонным соусом",
            price=3500.0,
            cost_price=2200.0,
            category_id=4,
            is_vegetarian=False,
            is_vegan=False,
            cooking_time=25,
            calories=450
        ),
        # Гарниры
        Dish(
            name="Картофельное пюре",
            description="Нежное картофельное пюре со сливочным маслом",
            price=2000.0,
            cost_price=1200.0,
            category_id=5,
            is_vegetarian=True,
            is_vegan=False,
            cooking_time=15,
            calories=250
        ),
        Dish(
            name="Овощи на гриле",
            description="Ассорти из сезонных овощей, приготовленных на гриле",
            price=2200.0,
            cost_price=1200.0,
            category_id=5,
            is_vegetarian=True,
            is_vegan=True,
            cooking_time=15,
            calories=180
        ),
        # Десерты
        Dish(
            name="Чизкейк Нью-Йорк",
            description="Классический чизкейк с ягодным соусом",
            price=1800.0,
            cost_price=1000.0,
            category_id=6,
            is_vegetarian=True,
            is_vegan=False,
            cooking_time=0,
            calories=450
        ),
        Dish(
            name="Тирамису",
            description="Традиционный итальянский десерт с кофейным вкусом",
            price=1900.0,
            cost_price=1000.0,
            category_id=6,
            is_vegetarian=True,
            is_vegan=False,
            cooking_time=0,
            calories=420
        ),
        # Напитки
        Dish(
            name="Свежевыжатый апельсиновый сок",
            description="Натуральный сок из спелых апельсинов",
            price=900.0,
            cost_price=500.0,
            category_id=7,
            is_vegetarian=True,
            is_vegan=True,
            cooking_time=5,
            calories=120
        ),
        Dish(
            name="Капучино",
            description="Классический капучино с молочной пенкой",
            price=700.0,
            cost_price=400.0,
            category_id=7,
            is_vegetarian=True,
            is_vegan=False,
            cooking_time=5,
            calories=150
        )
    ]
    db.add_all(dishes)
    db.commit()
    
    try:
        # Добавляем аллергены к блюдам
        if len(dishes) > 0:
            dishes[0].allergens = [allergens[2]]  # Тарталетки - яйца
        if len(dishes) > 2:
            dishes[2].allergens = [allergens[1], allergens[2]]  # Цезарь - молоко, яйца
        if len(dishes) > 3:
            dishes[3].allergens = [allergens[1]]  # Греческий - молоко
        if len(dishes) > 10:
            dishes[10].allergens = [allergens[0], allergens[1], allergens[2]]  # Чизкейк - глютен, молоко, яйца
        if len(dishes) > 11:
            dishes[11].allergens = [allergens[0], allergens[1], allergens[2]]  # Тирамису - глютен, молоко, яйца
        if len(dishes) > 13:
            dishes[13].allergens = [allergens[1]]  # Капучино - молоко
        
        # Добавляем теги к блюдам
        if len(dishes) > 1:
            dishes[1].tags = [tags[1], tags[2]]  # Брускетта - веганское, вегетарианское
        if len(dishes) > 3:
            dishes[3].tags = [tags[2]]  # Греческий - вегетарианское
        if len(dishes) > 5:
            dishes[5].tags = [tags[2]]  # Грибной - вегетарианское
        if len(dishes) > 6:
            dishes[6].tags = [tags[4]]  # Стейк - фирменное
        if len(dishes) > 9:
            dishes[9].tags = [tags[1], tags[2], tags[6]]  # Овощи - веганское, вегетарианское, без глютена
    except Exception as e:
        logger.error(f"Ошибка при добавлении аллергенов или тегов: {e}")
    
    db.commit()
    
    logger.info("Тестовые данные успешно созданы")
    

if __name__ == "__main__":
    # Импортируем модели для SQLAlchemy
    from app.database.session import SessionLocal
    
    db = SessionLocal()
    init_db(db)
    db.close() 