from typing import Optional
from datetime import datetime
from pydantic import BaseModel


class OrderCodeBase(BaseModel):
    code: str
    table_number: Optional[int] = None


class OrderCodeCreate(OrderCodeBase):
    waiter_id: int


class OrderCodeUpdate(BaseModel):
    is_used: Optional[bool] = None
    order_id: Optional[int] = None


class OrderCodeResponse(OrderCodeBase):
    id: int
    created_at: datetime
    is_used: bool
    waiter_id: int
    order_id: Optional[int] = None

    class Config:
        from_attributes = True


class OrderCodeVerify(BaseModel):
    code: str 