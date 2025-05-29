# Сначала импортируем базовые модели
from app.database.session import Base

# Затем импортируем модели в порядке их зависимостей
from app.models.user import User, UserRole
from app.models.menu import Category, Allergen, Tag, Dish
from app.models.payment import Payment
from app.models.order import Order, OrderDish, OrderStatus, PaymentStatus, PaymentMethod, OrderType
from app.models.order_item import OrderItem
from app.models.reservation import Reservation, ReservationStatus
from app.models.settings import Settings
from app.models.order_code import OrderCode
from app.models.review import Review

# Экспортируем все модели
__all__ = [
    "Base",
    "User", "UserRole",
    "Category", "Allergen", "Tag", "Dish",
    "Payment",
    "Order", "OrderDish", "OrderStatus", "OrderType", "PaymentStatus", "PaymentMethod",
    "OrderItem",
    "Reservation", "ReservationStatus",
    "Settings", "OrderCode",
    "Review"
] 