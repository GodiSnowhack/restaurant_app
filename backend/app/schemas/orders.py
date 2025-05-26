from pydantic import BaseModel, ConfigDict
from typing import Optional, List
from datetime import datetime

class OrderBase(BaseModel):
    user_id: int
    items: List[dict]
    total: float

    model_config = ConfigDict(from_attributes=True)

class OrderCreate(OrderBase):
    dishes: List[int]  # список ID блюд

class OrderOut(OrderBase):
    id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True) 