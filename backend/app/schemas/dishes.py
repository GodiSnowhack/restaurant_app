from pydantic import BaseModel
from typing import Optional

class DishBase(BaseModel):
    name: str
    description: Optional[str] = None
    price: float
    category_id: int

class DishCreate(DishBase):
    pass

class DishOut(DishBase):
    id: int

    class Config:
        from_attributes = True 