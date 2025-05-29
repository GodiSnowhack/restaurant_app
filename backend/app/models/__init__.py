# Сначала импортируем базовые модели
from app.models.user import User, UserRole
from app.models.menu import Category, Allergen, Tag, Dish
from app.models.payment import Payment
from app.models.order import Order, OrderDish, OrderStatus, PaymentStatus, PaymentMethod, OrderType
from app.models.reservation import Reservation, ReservationStatus
from app.models.settings import Settings
from app.models.order_code import OrderCode
from app.models.review import Review
from app.models.order_item import OrderItem

# Экспортируем все модели
__all__ = [
    "User", "UserRole",
    "Category", "Allergen", "Tag", "Dish",
    "Payment",
    "Order", "OrderDish", "OrderStatus", "OrderType", "PaymentStatus", "PaymentMethod",
    "Reservation", "ReservationStatus",
    "Settings", "OrderCode",
    "Review",
    "OrderItem"
] 