from typing import Optional
from datetime import datetime
from pydantic import BaseModel, Field

from app.models.reservation import ReservationStatus


# Схемы для бронирования
class ReservationBase(BaseModel):
    table_number: Optional[int] = None
    guests_count: int = Field(..., ge=1)
    reservation_time: datetime
    guest_name: Optional[str] = None
    guest_phone: Optional[str] = None
    comment: Optional[str] = None


class ReservationCreate(ReservationBase):
    reservation_code: Optional[str] = None


class ReservationUpdate(ReservationBase):
    table_number: Optional[int] = None
    guests_count: Optional[int] = None
    reservation_time: Optional[datetime] = None
    status: Optional[ReservationStatus] = None


class ReservationResponse(ReservationBase):
    id: int
    user_id: int
    status: ReservationStatus
    created_at: datetime
    updated_at: datetime
    reservation_code: Optional[str] = None

    class Config:
        from_attributes = True 


# Создаем специальную схему для обхода проблемы валидации
class ReservationRawResponse(ReservationBase):
    id: int
    user_id: int
    status: str  # В этой схеме используем строку вместо строгого перечисления
    created_at: datetime
    updated_at: datetime
    reservation_code: Optional[str] = None

    class Config:
        from_attributes = True 