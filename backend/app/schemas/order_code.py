from typing import Optional
from datetime import datetime
from pydantic import BaseModel, ConfigDict


class OrderCodeBase(BaseModel):
    code: str
    order_id: int
    expires_at: datetime

    model_config = ConfigDict(from_attributes=True)


class OrderCodeCreate(OrderCodeBase):
    waiter_id: int


class OrderCodeUpdate(BaseModel):
    is_used: Optional[bool] = None
    order_id: Optional[int] = None


class OrderCodeResponse(OrderCodeBase):
    id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class OrderCodeVerify(BaseModel):
    code: str 