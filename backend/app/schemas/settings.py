from typing import Dict, Any, Optional, List
from pydantic import BaseModel, EmailStr, HttpUrl, Field

class WorkingHoursModel(BaseModel):
    open: str
    close: str
    is_closed: bool

class WorkingHoursDict(BaseModel):
    monday: WorkingHoursModel
    tuesday: WorkingHoursModel
    wednesday: WorkingHoursModel
    thursday: WorkingHoursModel
    friday: WorkingHoursModel
    saturday: WorkingHoursModel
    sunday: WorkingHoursModel

class RestaurantTable(BaseModel):
    """Модель данных для столов ресторана"""
    id: int
    name: str
    capacity: int
    is_active: bool
    position_x: int
    position_y: int
    status: str

class PublicSettings(BaseModel):
    """Схема публичных настроек ресторана"""
    restaurant_name: str
    email: EmailStr
    phone: str
    address: str
    website: Optional[str] = None
    working_hours: Dict[str, WorkingHoursModel]

class SettingsBase(PublicSettings):
    """Базовая схема настроек ресторана"""
    currency: str = "RUB"
    currency_symbol: str = "₽"
    tax_percentage: float = 20.0
    min_order_amount: float = 1000.0
    delivery_fee: float = 300.0
    free_delivery_threshold: float = 3000.0
    table_reservation_enabled: bool = True
    delivery_enabled: bool = True
    pickup_enabled: bool = True
    tables: List[RestaurantTable] = []
    smtp_host: str = "smtp.example.com"
    smtp_port: int = 587
    smtp_user: str = "noreply@restaurant.ru"
    smtp_password: Optional[str] = None
    smtp_from_email: str = "noreply@restaurant.ru"
    smtp_from_name: str = "Restaurant"
    sms_api_key: Optional[str] = None
    sms_sender: str = "RESTAURANT"
    privacy_policy: Optional[str] = None
    terms_of_service: Optional[str] = None

class SettingsCreate(SettingsBase):
    """Схема для создания настроек"""
    pass

class SettingsUpdate(BaseModel):
    """Схема для обновления настроек"""
    restaurant_name: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    website: Optional[str] = None
    working_hours: Optional[Dict[str, WorkingHoursModel]] = None
    currency: Optional[str] = None
    currency_symbol: Optional[str] = None
    tax_percentage: Optional[float] = None
    min_order_amount: Optional[float] = None
    delivery_fee: Optional[float] = None
    free_delivery_threshold: Optional[float] = None
    table_reservation_enabled: Optional[bool] = None
    delivery_enabled: Optional[bool] = None
    pickup_enabled: Optional[bool] = None
    tables: Optional[List[RestaurantTable]] = None
    smtp_host: Optional[str] = None
    smtp_port: Optional[int] = None
    smtp_user: Optional[str] = None
    smtp_password: Optional[str] = None
    smtp_from_email: Optional[str] = None
    smtp_from_name: Optional[str] = None
    sms_api_key: Optional[str] = None
    sms_sender: Optional[str] = None
    privacy_policy: Optional[str] = None
    terms_of_service: Optional[str] = None

class SettingsResponse(SettingsBase):
    """Схема для ответа с настройками"""
    id: int

    class Config:
        orm_mode = True 