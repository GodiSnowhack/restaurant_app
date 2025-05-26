from pydantic import BaseModel
from datetime import datetime
from typing import List, Optional

class OrderBase(BaseModel):
    table_number: int
    status: str = "pending"

class OrderCreate(OrderBase):
    dishes: List[int]  # список ID блюд

class OrderOut(OrderBase):
    id: int
    created_at: datetime
    total_price: float
    dishes: List[int]  # список ID блюд

    class Config:
        from_attributes = True 