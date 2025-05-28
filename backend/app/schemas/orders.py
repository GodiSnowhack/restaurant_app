from typing import List, Optional, Any, Dict, Union
from pydantic import BaseModel, Field, validator
from datetime import datetime
from enum import Enum

# Перечисления для статусов заказа
class OrderStatus(str, Enum):
    PENDING = "pending"
    CONFIRMED = "confirmed"
    PREPARING = "preparing"
    READY = "ready"
    COMPLETED = "completed"
    CANCELLED = "cancelled"

class PaymentStatus(str, Enum):
    PENDING = "pending"
    PAID = "paid"
    REFUNDED = "refunded"
    FAILED = "failed"

class PaymentMethod(str, Enum):
    CARD = "card"
    CASH = "cash"
    ONLINE = "online"

class OrderType(str, Enum):
    DINE_IN = "dine-in"
    DELIVERY = "delivery"
    PICKUP = "pickup"

# Схема для элемента заказа
class OrderItemBase(BaseModel):
    dish_id: int
    quantity: int = Field(gt=0)
    price: float = Field(ge=0)
    special_instructions: Optional[str] = None

class OrderItemCreate(OrderItemBase):
    pass

class OrderItemUpdate(OrderItemBase):
    dish_id: Optional[int] = None
    quantity: Optional[int] = None
    price: Optional[float] = None

class OrderItemResponse(OrderItemBase):
    name: str
    total_price: float

    class Config:
        orm_mode = True

# Схема для заказа
class OrderBase(BaseModel):
    user_id: Optional[int] = None
    waiter_id: Optional[int] = None
    table_number: Optional[int] = None
    payment_method: Optional[PaymentMethod] = None
    customer_name: Optional[str] = None
    customer_phone: Optional[str] = None
    reservation_code: Optional[str] = None
    order_code: Optional[str] = None
    status: OrderStatus = OrderStatus.PENDING
    payment_status: PaymentStatus = PaymentStatus.PENDING
    comment: Optional[str] = None
    is_urgent: Optional[bool] = False
    is_group_order: Optional[bool] = False
    customer_age_group: Optional[str] = None

class OrderCreate(OrderBase):
    items: List[OrderItemCreate]

class OrderUpdate(BaseModel):
    user_id: Optional[int] = None
    waiter_id: Optional[int] = None
    table_number: Optional[int] = None
    payment_method: Optional[PaymentMethod] = None
    customer_name: Optional[str] = None
    customer_phone: Optional[str] = None
    reservation_code: Optional[str] = None
    order_code: Optional[str] = None
    status: Optional[OrderStatus] = None
    payment_status: Optional[PaymentStatus] = None
    comment: Optional[str] = None
    is_urgent: Optional[bool] = None
    is_group_order: Optional[bool] = None
    customer_age_group: Optional[str] = None

class OrderResponse(OrderBase):
    id: int
    created_at: Optional[str] = None
    updated_at: Optional[str] = None
    completed_at: Optional[str] = None
    total_amount: float
    total_price: float
    items: List[OrderItemResponse]
    order_type: OrderType

    class Config:
        orm_mode = True

# Детальная информация о заказе
class OrderDetails(OrderResponse):
    # Можно добавить дополнительные поля, если нужно
    pass

# Базовая схема ответа API
class OrderOut(BaseModel):
    id: int
    message: str = "Заказ успешно создан"

    class Config:
        orm_mode = True 