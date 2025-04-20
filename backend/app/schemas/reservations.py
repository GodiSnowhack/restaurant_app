from typing import Optional, List
from datetime import datetime, time, date
from pydantic import BaseModel, Field, validator, EmailStr

class ReservationBase(BaseModel):
    """Базовая схема для бронирования"""
    guests_count: int = Field(..., gt=0, description="Количество гостей")
    reservation_date: date = Field(..., description="Дата бронирования")
    reservation_time: str = Field(..., description="Время бронирования")
    guest_name: str = Field(..., description="Имя гостя")
    guest_phone: str = Field(..., description="Телефон гостя")
    guest_email: Optional[EmailStr] = Field(None, description="Email гостя")
    table_id: Optional[int] = Field(None, description="ID стола (опционально)")
    table_number: Optional[int] = Field(None, description="Номер стола (опционально)")
    comments: Optional[str] = Field(None, description="Комментарий к бронированию")
    
    @validator('reservation_time')
    def validate_time_format(cls, v):
        """Проверка правильности формата времени"""
        try:
            # Если передано время в формате HH:MM
            if ':' in v:
                hours, minutes = map(int, v.split(':'))
                if not (0 <= hours < 24 and 0 <= minutes < 60):
                    raise ValueError("Неверный формат времени")
            else:
                raise ValueError("Время должно быть в формате HH:MM")
            return v
        except Exception:
            raise ValueError("Время должно быть в формате HH:MM")

class ReservationCreate(ReservationBase):
    """Схема для создания бронирования"""
    user_id: Optional[int] = Field(None, description="ID пользователя (опционально)")

class ReservationUpdate(BaseModel):
    """Схема для обновления бронирования"""
    guests_count: Optional[int] = Field(None, gt=0, description="Количество гостей")
    reservation_date: Optional[date] = Field(None, description="Дата бронирования")
    reservation_time: Optional[str] = Field(None, description="Время бронирования")
    guest_name: Optional[str] = Field(None, description="Имя гостя")
    guest_phone: Optional[str] = Field(None, description="Телефон гостя")
    guest_email: Optional[EmailStr] = Field(None, description="Email гостя")
    table_id: Optional[int] = Field(None, description="ID стола")
    table_number: Optional[int] = Field(None, description="Номер стола")
    status: Optional[str] = Field(None, description="Статус бронирования")
    comments: Optional[str] = Field(None, description="Комментарий к бронированию")

    @validator('reservation_time')
    def validate_time_format(cls, v):
        """Проверка правильности формата времени"""
        if v is None:
            return v
        try:
            # Если передано время в формате HH:MM
            if ':' in v:
                hours, minutes = map(int, v.split(':'))
                if not (0 <= hours < 24 and 0 <= minutes < 60):
                    raise ValueError("Неверный формат времени")
            else:
                raise ValueError("Время должно быть в формате HH:MM")
            return v
        except Exception:
            raise ValueError("Время должно быть в формате HH:MM")

class TableInfoResponse(BaseModel):
    """Информация о столе для ответа"""
    id: int
    name: str
    capacity: int
    
    class Config:
        from_attributes = True

class ReservationResponse(ReservationBase):
    """Схема для ответа с бронированием"""
    id: int
    user_id: Optional[int] = None
    status: str
    created_at: datetime
    updated_at: datetime
    table: Optional[TableInfoResponse] = None
    
    class Config:
        from_attributes = True

class ReservationListResponse(BaseModel):
    """Схема для списка бронирований"""
    items: List[ReservationResponse]
    total: int
    
    class Config:
        from_attributes = True 