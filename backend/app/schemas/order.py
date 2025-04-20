from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel, Field
from enum import Enum

from app.models.order import OrderStatus, PaymentStatus
from app.schemas.menu import DishShortResponse


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
class OrderBase(BaseModel):
    user_id: Optional[int] = None
    waiter_id: Optional[int] = None
    table_number: Optional[int] = None
    status: Optional[str] = "pending"
    payment_status: Optional[str] = "pending"
    payment_method: Optional[str] = None
    total_amount: Optional[float] = 0.0
    comment: Optional[str] = None
    is_urgent: Optional[bool] = False
    is_group_order: Optional[bool] = False
    order_type: Optional[str] = "dine-in"
    customer_name: Optional[str] = None
    customer_phone: Optional[str] = None
    delivery_address: Optional[str] = None
    reservation_code: Optional[str] = None
    order_code: Optional[str] = None


class OrderCreate(OrderBase):
    items: Optional[List[OrderItemCreate]] = []


class OrderUpdate(BaseModel):
    user_id: Optional[int] = None
    waiter_id: Optional[int] = None
    table_number: Optional[int] = None
    status: Optional[str] = None
    payment_status: Optional[str] = None
    payment_method: Optional[str] = None
    total_amount: Optional[float] = None
    comment: Optional[str] = None
    is_urgent: Optional[bool] = None
    is_group_order: Optional[bool] = None
    order_type: Optional[str] = None
    customer_name: Optional[str] = None
    customer_phone: Optional[str] = None
    delivery_address: Optional[str] = None
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
    updated_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    user: Optional[UserBasic] = None
    items: Optional[List[OrderItemInDB]] = []

    class Config:
        from_attributes = True


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
    PROCESSING = "processing"
    DELIVERED = "delivered"
    CANCELLED = "cancelled"


class PaymentStatus(str, Enum):
    PENDING = "pending"
    PAID = "paid"
    FAILED = "failed"


class OrderItem(OrderItemBase):
    id: int
    order_id: int
    dish_name: str
    dish_image: Optional[str] = None

    class Config:
        orm_mode = True


class OrderResponse(BaseModel):
    id: int
    user_id: Optional[int] = None
    waiter_id: Optional[int] = None
    table_number: Optional[int] = None
    status: str = "pending"
    payment_status: str = "pending"
    payment_method: Optional[str] = None
    special_instructions: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    total_price: float = 0.0
    items: List[dict] = []
    delivery_address: Optional[str] = None
    phone_number: Optional[str] = None
    is_delivery: Optional[bool] = False
    order_type: Optional[str] = "dine-in"
    user: Optional[dict] = None

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
            "order_type": obj.order_type,
            "customer_name": obj.customer_name,
            "customer_phone": obj.customer_phone,
            "delivery_address": obj.delivery_address,
            "reservation_code": obj.reservation_code,
            "order_code": obj.order_code,
            "created_at": obj.created_at,
            "updated_at": obj.updated_at,
            "completed_at": obj.completed_at,
            "user": obj.user,
            "items": [
                {
                    "dish_id": item.id,
                    "name": item.name,
                    "price": item.price,
                    "quantity": next((od.quantity for od in obj.order_dishes if od.dish_id == item.id), 1),
                    "special_instructions": next((od.special_instructions for od in obj.order_dishes if od.dish_id == item.id), None)
                }
                for item in obj.items
            ]
        }
        return cls(**data) 