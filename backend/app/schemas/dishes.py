from pydantic import BaseModel, ConfigDict
from typing import Optional

class DishBase(BaseModel):
    name: str
    description: Optional[str] = None
    price: float
    category_id: int

    model_config = ConfigDict(from_attributes=True)

class DishCreate(DishBase):
    pass

class DishOut(DishBase):
    id: int

    model_config = ConfigDict(from_attributes=True) 