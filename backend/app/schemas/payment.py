from typing import Optional
from pydantic import BaseModel, Field, ConfigDict
from datetime import datetime
from enum import Enum

class PaymentStatus(str, Enum):
    """Статусы платежа"""
    PENDING = "pending"
    PAID = "paid"
    FAILED = "failed"
    REFUNDED = "refunded"

class PaymentMethod(str, Enum):
    """Методы оплаты"""
    CASH = "cash"
    CARD = "card"
    ONLINE = "online"

class PaymentBase(BaseModel):
    """Базовая схема для платежа"""
    order_id: int
    amount: float = Field(ge=0)
    payment_method: PaymentMethod
    status: PaymentStatus = PaymentStatus.PENDING
    transaction_id: Optional[str] = None
    description: Optional[str] = None

class PaymentCreate(PaymentBase):
    """Схема для создания платежа"""
    pass

class PaymentUpdate(BaseModel):
    """Схема для обновления платежа"""
    status: Optional[PaymentStatus] = None
    transaction_id: Optional[str] = None
    description: Optional[str] = None

class PaymentInDB(PaymentBase):
    """Схема для платежа в БД"""
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)

class Payment(PaymentInDB):
    """Схема для ответа API с платежом"""
    pass 