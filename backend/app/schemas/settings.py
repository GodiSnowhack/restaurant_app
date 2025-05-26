from typing import Dict, Any, Optional, List
from pydantic import BaseModel, EmailStr, HttpUrl, Field, ConfigDict

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

class SettingsBase(BaseModel):
    """Базовая схема настроек ресторана"""
    restaurant_name: str = Field(default="Вкусно и Точка")
    email: EmailStr = Field(default="info@restaurant.ru")
    phone: str = Field(default="+7 (999) 123-45-67")
    address: str = Field(default="ул. Пушкина, д. 10, Москва")
    website: Optional[str] = None
    
    working_hours: Dict[str, Dict[str, Any]] = Field(default_factory=lambda: {
        "monday": {"open": "09:00", "close": "22:00", "is_closed": False},
        "tuesday": {"open": "09:00", "close": "22:00", "is_closed": False},
        "wednesday": {"open": "09:00", "close": "22:00", "is_closed": False},
        "thursday": {"open": "09:00", "close": "22:00", "is_closed": False},
        "friday": {"open": "09:00", "close": "23:00", "is_closed": False},
        "saturday": {"open": "10:00", "close": "23:00", "is_closed": False},
        "sunday": {"open": "10:00", "close": "22:00", "is_closed": False}
    })
    
    tables: List[RestaurantTable] = Field(default_factory=list)
    
    currency: str = Field(default="KZT")
    currency_symbol: str = Field(default="₸")
    tax_percentage: int = Field(default=20)
    min_order_amount: int = Field(default=1000)
    delivery_fee: int = Field(default=300)
    free_delivery_threshold: int = Field(default=3000)
    
    table_reservation_enabled: bool = Field(default=True)
    delivery_enabled: bool = Field(default=True)
    pickup_enabled: bool = Field(default=True)
    
    smtp_host: Optional[str] = None
    smtp_port: Optional[int] = None
    smtp_user: Optional[str] = None
    smtp_password: Optional[str] = None
    smtp_from_email: Optional[EmailStr] = None
    smtp_from_name: Optional[str] = None
    
    sms_api_key: Optional[str] = None
    sms_sender: Optional[str] = None
    
    privacy_policy: Optional[str] = None
    terms_of_service: Optional[str] = None

class SettingsCreate(SettingsBase):
    """Схема для создания настроек"""
    pass

class SettingsUpdate(SettingsBase):
    """Схема для обновления настроек"""
    restaurant_name: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    currency: Optional[str] = None
    currency_symbol: Optional[str] = None
    tax_percentage: Optional[int] = None
    min_order_amount: Optional[int] = None
    delivery_fee: Optional[int] = None
    free_delivery_threshold: Optional[int] = None
    table_reservation_enabled: Optional[bool] = None
    delivery_enabled: Optional[bool] = None
    pickup_enabled: Optional[bool] = None

class SettingsResponse(SettingsBase):
    """Схема для ответа с настройками"""
    id: int
    
    model_config = ConfigDict(from_attributes=True) 