from typing import Optional
from datetime import datetime
from pydantic import BaseModel, Field, validator
import re

from app.models.reservation import ReservationStatus


# Схемы для бронирования
class ReservationBase(BaseModel):
    table_number: Optional[int] = None
    guests_count: int = Field(..., ge=1)
    reservation_time: datetime
    guest_name: Optional[str] = None
    guest_phone: Optional[str] = None
    comment: Optional[str] = None


class ReservationCreate(BaseModel):
    table_number: Optional[int] = None
    guests_count: int = Field(..., ge=1)
    reservation_time: Optional[datetime] = None
    reservation_date: Optional[str] = None
    reservation_time_str: Optional[str] = Field(None, alias="reservation_time")
    guest_name: Optional[str] = None
    guest_phone: Optional[str] = None
    comment: Optional[str] = None
    reservation_code: Optional[str] = None
    
    @validator('reservation_time', pre=True, always=False)
    def validate_reservation_time(cls, v, values):
        if v is not None:
            return v
            
        # Если reservation_time не задано, пробуем использовать reservation_date и reservation_time_str
        date_str = values.get('reservation_date')
        time_str = values.get('reservation_time_str')
        
        if date_str and time_str:
            try:
                # Попытка объединить дату и время
                combined = f"{date_str}T{time_str}:00"
                return datetime.fromisoformat(combined)
            except Exception as e:
                raise ValueError(f"Неверный формат даты или времени: {e}")
        
        return v
    
    class Config:
        populate_by_name = True


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