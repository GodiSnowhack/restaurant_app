from typing import List, Optional, Union
from datetime import datetime
from pydantic import BaseModel, Field, ConfigDict
from enum import Enum

from app.models.order import OrderStatus, PaymentStatus
from app.schemas.menu import DishShortResponse
from .order_item import OrderItem
from .payment import Payment


# Схемы для элементов заказа
class OrderItemBase(BaseModel):
    dish_id: int
    quantity: int = 1
    special_instructions: Optional[str] = None


class OrderItemCreate(OrderItemBase):
    pass


class OrderItemUpdate(OrderItemBase):
    dish_id: Optional[int] = None
    quantity: Optional[int] = None


class OrderItemResponse(OrderItemBase):
    id: int
    price: float
    dish: DishShortResponse

    class Config:
        from_attributes = True


# Схемы для заказов
class OrderDishBase(BaseModel):
    dish_id: int
    quantity: int = 1
    special_instructions: Optional[str] = None
    price: float


class OrderDishCreate(OrderDishBase):
    pass


class OrderDish(OrderDishBase):
    id: int
    order_id: int
    
    model_config = ConfigDict(from_attributes=True)


class OrderBase(BaseModel):
    user_id: Optional[int] = None
    waiter_id: Optional[int] = None
    table_number: Optional[int] = None
    status: Optional[str] = "pending"
    payment_status: Optional[PaymentStatus] = PaymentStatus.PENDING
    payment_method: Optional[str] = None
    total_amount: Optional[float] = 0.0
    comment: Optional[str] = None
    is_urgent: Optional[bool] = False
    is_group_order: Optional[bool] = False
    customer_name: Optional[str] = None
    customer_phone: Optional[str] = None
    reservation_code: Optional[str] = None
    order_code: Optional[str] = None
    customer_age_group: Optional[str] = None


class OrderCreate(BaseModel):
    user_id: Optional[int] = None
    waiter_id: Optional[int] = None
    table_number: Optional[int] = None
    status: Optional[str] = "pending"
    payment_status: Optional[PaymentStatus] = PaymentStatus.PENDING
    payment_method: Optional[str] = None
    total_amount: Optional[float] = 0.0
    comment: Optional[str] = None
    is_urgent: Optional[bool] = False
    is_group_order: Optional[bool] = False
    customer_name: Optional[str] = None
    customer_phone: Optional[str] = None
    reservation_code: Optional[str] = None
    order_code: Optional[str] = None
    customer_age_group: Optional[str] = None
    # Поддержка разных форматов запросов
    items: Optional[List[OrderDishCreate]] = []
    dishes: Optional[Union[List[OrderDishCreate], List[int]]] = []


class OrderUpdate(OrderBase):
    user_id: Optional[int] = None
    waiter_id: Optional[int] = None
    table_number: Optional[int] = None
    status: Optional[str] = None
    payment_status: Optional[PaymentStatus] = None
    payment_method: Optional[str] = None
    total_amount: Optional[float] = None
    comment: Optional[str] = None
    is_urgent: Optional[bool] = None
    is_group_order: Optional[bool] = None
    customer_name: Optional[str] = None
    customer_phone: Optional[str] = None
    reservation_code: Optional[str] = None
    order_code: Optional[str] = None
    items: Optional[List[OrderItemUpdate]] = None


class OrderItemInDB(OrderItemBase):
    dish_id: int
    name: Optional[str] = None
    price: Optional[float] = None

    class Config:
        from_attributes = True


class UserBasic(BaseModel):
    id: int
    full_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None

    class Config:
        from_attributes = True


class Order(OrderBase):
    id: int
    created_at: datetime
    updated_at: datetime
    completed_at: Optional[datetime] = None
    user: Optional[UserBasic] = None
    items: List[OrderDish] = []
    payments: List[Payment] = []
    waiter_id: Optional[int] = None
    table_number: Optional[int] = None
    user_id: Optional[int] = None

    class Config:
        orm_mode = True


# Класс для обратной совместимости
class OrderResponseWithItems(Order):
    """Схема для заказа с подробной информацией об элементах заказа"""
    pass


# Схемы для отзывов
class FeedbackBase(BaseModel):
    dish_id: Optional[int] = None
    order_id: Optional[int] = None
    rating: int = Field(..., ge=1, le=5)
    comment: Optional[str] = None
    image_url: Optional[str] = None


class FeedbackCreate(FeedbackBase):
    pass


class Feedback(FeedbackBase):
    id: int
    user_id: int
    created_at: datetime

    class Config:
        from_attributes = True


# Alias for backward compatibility
FeedbackResponse = Feedback


class OrderStatus(str, Enum):
    PENDING = "pending"
    NEW = "new"
    CONFIRMED = "confirmed"
    COOKING = "cooking"
    PREPARING = "preparing"
    IN_PROGRESS = "in_progress"
    READY = "ready"
    DELIVERED = "delivered"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class PaymentStatus(str, Enum):
    PENDING = "pending"
    PAID = "paid"
    FAILED = "failed"
    REFUNDED = "refunded"


class PaymentMethod(str, Enum):
    CASH = "cash"
    CARD = "card"
    ONLINE = "online"


class OrderItem(OrderItemBase):
    id: int
    order_id: Optional[int] = None
    dish_id: int
    name: Optional[str] = None
    dish_name: Optional[str] = None
    dish_image: Optional[str] = None
    price: float
    quantity: int = 1
    special_instructions: Optional[str] = None
    description: Optional[str] = None
    category_id: Optional[int] = None
    total_price: Optional[float] = None
    price_formatted: Optional[str] = None
    total_price_formatted: Optional[str] = None

    class Config:
        from_attributes = True


class OrderResponse(BaseModel):
    id: int
    user_id: Optional[int] = None
    waiter_id: Optional[int] = None
    table_number: Optional[int] = None
    status: str = "pending"
    payment_status: str = "pending"
    payment_method: Optional[str] = None
    total_amount: float = 0.0
    comment: Optional[str] = None
    is_urgent: Optional[bool] = False
    is_group_order: Optional[bool] = False
    customer_name: Optional[str] = None
    customer_phone: Optional[str] = None
    reservation_code: Optional[str] = None
    order_code: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    items: List[OrderItem] = []
    user: Optional[UserBasic] = None

    class Config:
        from_attributes = True

    @classmethod
    def from_orm(cls, obj):
        # Преобразуем объект Order в словарь
        data = {
            "id": obj.id,
            "user_id": obj.user_id,
            "waiter_id": obj.waiter_id,
            "table_number": obj.table_number,
            "status": obj.status,
            "payment_status": obj.payment_status,
            "payment_method": obj.payment_method,
            "total_amount": obj.total_amount,
            "comment": obj.comment,
            "is_urgent": obj.is_urgent,
            "is_group_order": obj.is_group_order,
            "customer_name": obj.customer_name,
            "customer_phone": obj.customer_phone,
            "reservation_code": obj.reservation_code,
            "order_code": obj.order_code,
            "created_at": obj.created_at,
            "updated_at": obj.updated_at,
            "completed_at": obj.completed_at,
            "user": obj.user,
            "items": [
                {
                    "id": od.id,
                    "dish_id": od.dish_id,
                    "name": od.dish.name if od.dish else f"Блюдо #{od.dish_id}",
                    "dish_name": od.dish.name if od.dish else f"Блюдо #{od.dish_id}",
                    "price": float(od.price),
                    "quantity": od.quantity,
                    "special_instructions": od.special_instructions,
                    "dish_image": od.dish.image_url if od.dish else None,
                    "description": od.dish.description if od.dish else None,
                    "category_id": od.dish.category_id if od.dish else None,
                    "total_price": float(od.price) * od.quantity,
                    "price_formatted": f"{float(od.price)} ₸",
                    "total_price_formatted": f"{float(od.price) * od.quantity} ₸",
                    "order_id": obj.id
                }
                for od in obj.order_dishes
            ]
        }
        return cls(**data)


# Схемы для заказов обновления статуса
class OrderStatusUpdateSchema(BaseModel):
    status: str = Field(..., description="Новый статус заказа")


# Схемы для чтения заказов
class OrderReadSchema(OrderBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    items: Optional[List[OrderItemResponse]] = []
    
    class Config:
        from_attributes = True
        
    def to_dict(self):
        """Преобразует модель в словарь для ответа API"""
        return {
            "id": self.id,
            "user_id": self.user_id,
            "waiter_id": self.waiter_id,
            "table_number": self.table_number,
            "status": self.status,
            "payment_status": self.payment_status,
            "payment_method": self.payment_method,
            "total_amount": self.total_amount,
            "comment": self.comment,
            "is_urgent": self.is_urgent,
            "is_group_order": self.is_group_order,
            "customer_name": self.customer_name,
            "customer_phone": self.customer_phone,
            "reservation_code": self.reservation_code,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "completed_at": self.completed_at.isoformat() if self.completed_at else None,
            "items": [item.dict() for item in self.items] if self.items else []
        }


# Схема для обновления заказа с API
class OrderUpdateSchema(BaseModel):
    user_id: Optional[int] = None
    waiter_id: Optional[int] = None
    table_number: Optional[int] = None
    status: Optional[str] = None
    payment_status: Optional[PaymentStatus] = None
    payment_method: Optional[str] = None
    total_amount: Optional[float] = None
    comment: Optional[str] = None
    is_urgent: Optional[bool] = None
    is_group_order: Optional[bool] = None
    customer_name: Optional[str] = None
    customer_phone: Optional[str] = None
    items: Optional[List[OrderItemUpdate]] = None
    
    class Config:
        from_attributes = True 