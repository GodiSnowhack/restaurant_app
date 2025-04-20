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

class SettingsBase(BaseModel):
    """Базовая схема настроек ресторана"""
    restaurant_name: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    website: Optional[HttpUrl] = None
    
    working_hours: Optional[Dict[str, Dict[str, Any]]] = None
    tables: Optional[List[RestaurantTable]] = None
    
    currency: Optional[str] = None
    currency_symbol: Optional[str] = None
    tax_percentage: Optional[int] = None
    min_order_amount: Optional[int] = None
    delivery_fee: Optional[int] = None
    free_delivery_threshold: Optional[int] = None
    
    table_reservation_enabled: Optional[bool] = None
    delivery_enabled: Optional[bool] = None
    pickup_enabled: Optional[bool] = None
    
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
    restaurant_name: str
    email: EmailStr
    phone: str
    address: str
    
    working_hours: Dict[str, Dict[str, Any]]
    
    currency: str
    currency_symbol: str
    tax_percentage: int
    min_order_amount: int
    delivery_fee: int
    free_delivery_threshold: int
    
    table_reservation_enabled: bool
    delivery_enabled: bool
    pickup_enabled: bool

class SettingsUpdate(SettingsBase):
    """Схема для обновления настроек"""
    pass

class SettingsResponse(SettingsBase):
    """Схема для ответа с настройками"""
    id: int
    
    class Config:
        from_attributes = True 