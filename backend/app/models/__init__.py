# Сначала импортируем базовые модели и перечисления
from app.models.order import OrderStatus, PaymentStatus, PaymentMethod
from app.models.user import User, UserRole
from app.models.menu import Category, Allergen, Tag, Dish

# Затем импортируем модели, которые зависят от перечислений
from app.models.payment import Payment
from app.models.order import Order, OrderDish
from app.models.reservation import Reservation, ReservationStatus
from app.models.settings import Settings
from app.models.order_code import OrderCode
from app.models.review import Review

# Экспортируем все модели
__all__ = [
    "User", "UserRole",
    "Category", "Allergen", "Tag", "Dish",
    "Payment",
    "Order", "OrderDish", "OrderStatus", "PaymentStatus", "PaymentMethod",
    "Reservation", "ReservationStatus",
    "Settings", "OrderCode",
    "Review"
] 