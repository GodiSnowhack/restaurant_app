from typing import Optional
from pydantic import BaseModel, Field, ConfigDict
from datetime import datetime

class OrderItemBase(BaseModel):
    """Базовая схема для элемента заказа"""
    dish_id: int
    quantity: int = Field(default=1, ge=1)
    special_instructions: Optional[str] = None

class OrderItemCreate(OrderItemBase):
    """Схема для создания элемента заказа"""
    pass

class OrderItemUpdate(OrderItemBase):
    """Схема для обновления элемента заказа"""
    dish_id: Optional[int] = None
    quantity: Optional[int] = Field(default=None, ge=1)
    special_instructions: Optional[str] = None

class OrderItemInDB(OrderItemBase):
    """Схема для элемента заказа в БД"""
    id: int
    order_id: int
    price: float
    created_at: datetime
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)

class OrderItem(OrderItemInDB):
    """Схема для ответа API с элементом заказа"""
    dish_name: str
    dish_image: Optional[str] = None

    model_config = ConfigDict(from_attributes=True) 