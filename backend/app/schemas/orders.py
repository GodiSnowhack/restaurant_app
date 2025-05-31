from pydantic import BaseModel
from datetime import datetime
from typing import List, Optional, Any, Dict

class OrderBase(BaseModel):
    status: str = "pending"

class OrderDishItem(BaseModel):
    dish_id: int
    quantity: int = 1
    special_instructions: Optional[str] = None

class OrderCreate(OrderBase):
    dishes: Optional[List[int]] = []  # простой список ID блюд
    items: Optional[List[OrderDishItem]] = []  # список объектов с dish_id и quantity
    reservation_code: Optional[str] = None  # код бронирования для получения номера стола
    customer_name: Optional[str] = None  # имя клиента
    customer_phone: Optional[str] = None  # телефон клиента
    comment: Optional[str] = None  # комментарий к заказу
    is_urgent: Optional[bool] = False  # срочный заказ
    is_group_order: Optional[bool] = False  # групповой заказ

class OrderOut(BaseModel):
    id: int
    user_id: Optional[int] = None
    waiter_id: Optional[int] = None
    table_number: Optional[int] = None
    status: str = "pending"
    payment_status: Optional[str] = "unpaid"
    payment_method: Optional[str] = "cash"
    total_amount: Optional[float] = 0.0
    comment: Optional[str] = None
    special_instructions: Optional[str] = None
    created_at: str
    updated_at: Optional[str] = None
    completed_at: Optional[str] = None
    customer_name: Optional[str] = None
    customer_phone: Optional[str] = None
    order_code: Optional[str] = None
    is_urgent: Optional[bool] = False
    is_group_order: Optional[bool] = False
    items: List[Dict[str, Any]] = []

    class Config:
        from_attributes = True 