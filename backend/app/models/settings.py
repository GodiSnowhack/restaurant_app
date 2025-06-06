from typing import Dict, Any, Optional
from sqlalchemy import Column, Integer, String, Boolean, JSON, Text
from sqlalchemy.sql import func

from app.database.session import Base

class Settings(Base):
    """Модель настроек ресторана"""
    
    __tablename__ = "settings"
    
    id = Column(Integer, primary_key=True, index=True)
    
    # Основные настройки
    restaurant_name = Column(String(255), nullable=False, default="Вкусно и Точка")
    email = Column(String(255), nullable=False, default="info@restaurant.ru")
    phone = Column(String(50), nullable=False, default="+7 (999) 123-45-67")
    address = Column(String(255), nullable=False, default="ул. Пушкина, д. 10, Москва")
    website = Column(String(255), nullable=True)
    
    # Часы работы хранятся в JSON формате
    working_hours = Column(JSON, nullable=True)
    
    # Столы ресторана хранятся в JSON формате
    tables = Column(JSON, nullable=True, default=list)
    
    # Настройки валюты и платежей
    currency = Column(String(10), nullable=False, default="KZT")
    currency_symbol = Column(String(10), nullable=False, default="₸")
    tax_percentage = Column(Integer, nullable=False, default=20)
    min_order_amount = Column(Integer, nullable=False, default=1000)
    delivery_fee = Column(Integer, nullable=False, default=300)
    free_delivery_threshold = Column(Integer, nullable=False, default=3000)
    
    # Флаги включенных функций
    table_reservation_enabled = Column(Boolean, nullable=False, default=True)
    delivery_enabled = Column(Boolean, nullable=False, default=True)
    pickup_enabled = Column(Boolean, nullable=False, default=True)
    
    # Настройки уведомлений
    smtp_host = Column(String(255), nullable=True)
    smtp_port = Column(Integer, nullable=True)
    smtp_user = Column(String(255), nullable=True)
    smtp_password = Column(String(255), nullable=True)
    smtp_from_email = Column(String(255), nullable=True)
    smtp_from_name = Column(String(255), nullable=True)
    
    # Настройки SMS
    sms_api_key = Column(String(255), nullable=True)
    sms_sender = Column(String(50), nullable=True)
    
    # Юридическая информация
    privacy_policy = Column(Text, nullable=True)
    terms_of_service = Column(Text, nullable=True)
    
    def __repr__(self):
        """Строковое представление объекта настроек для логирования"""
        return f"Settings(id={self.id}, restaurant_name='{self.restaurant_name}', email='{self.email}')"
    
    @classmethod
    def get_default_working_hours(cls) -> Dict[str, Any]:
        """Возвращает настройки рабочих часов по умолчанию"""
        return {
            "monday": {"open": "09:00", "close": "22:00", "is_closed": False},
            "tuesday": {"open": "09:00", "close": "22:00", "is_closed": False},
            "wednesday": {"open": "09:00", "close": "22:00", "is_closed": False},
            "thursday": {"open": "09:00", "close": "22:00", "is_closed": False},
            "friday": {"open": "09:00", "close": "23:00", "is_closed": False},
            "saturday": {"open": "10:00", "close": "23:00", "is_closed": False},
            "sunday": {"open": "10:00", "close": "22:00", "is_closed": False}
        }
    
    @classmethod
    def create_default(cls) -> 'Settings':
        """Создает объект настроек со значениями по умолчанию"""
        return cls(
            restaurant_name="Вкусно и Точка",
            email="info@restaurant.ru",
            phone="+7 (999) 123-45-67",
            address="ул. Пушкина, д. 10, Москва",
            website="https://restaurant.ru",
            working_hours={
                "monday": {"open": "09:00", "close": "22:00", "is_closed": False},
                "tuesday": {"open": "09:00", "close": "22:00", "is_closed": False},
                "wednesday": {"open": "09:00", "close": "22:00", "is_closed": False},
                "thursday": {"open": "09:00", "close": "22:00", "is_closed": False},
                "friday": {"open": "09:00", "close": "23:00", "is_closed": False},
                "saturday": {"open": "10:00", "close": "23:00", "is_closed": False},
                "sunday": {"open": "10:00", "close": "22:00", "is_closed": False}
            },
            tables=[
                {
                    "id": 1,
                    "number": 1,
                    "name": "Стол у окна",
                    "capacity": 2,
                    "is_active": True,
                    "position_x": 15,
                    "position_y": 15,
                    "status": "available"
                },
                {
                    "id": 2,
                    "number": 2,
                    "name": "Стол 2",
                    "capacity": 2,
                    "is_active": True,
                    "position_x": 15,
                    "position_y": 35,
                    "status": "available"
                },
                {
                    "id": 3,
                    "number": 3,
                    "name": "Стол 3",
                    "capacity": 4,
                    "is_active": True,
                    "position_x": 35,
                    "position_y": 15,
                    "status": "available"
                },
                {
                    "id": 4,
                    "number": 4,
                    "name": "Стол 4",
                    "capacity": 4,
                    "is_active": True,
                    "position_x": 35,
                    "position_y": 35,
                    "status": "available"
                },
                {
                    "id": 5,
                    "number": 5,
                    "name": "Стол 5",
                    "capacity": 6,
                    "is_active": True,
                    "position_x": 55,
                    "position_y": 15,
                    "status": "available"
                },
                {
                    "id": 6,
                    "number": 6,
                    "name": "Стол 6",
                    "capacity": 6,
                    "is_active": True,
                    "position_x": 55,
                    "position_y": 35,
                    "status": "available"
                },
                {
                    "id": 7,
                    "number": 7,
                    "name": "Стол VIP",
                    "capacity": 8,
                    "is_active": True,
                    "position_x": 75,
                    "position_y": 25,
                    "status": "available"
                }
            ],
            currency="KZT",
            currency_symbol="₸",
            tax_percentage=20,
            min_order_amount=1000,
            delivery_fee=300,
            free_delivery_threshold=3000,
            table_reservation_enabled=True,
            delivery_enabled=True,
            pickup_enabled=True,
            smtp_host="smtp.yandex.ru",
            smtp_port=465,
            smtp_user="notifications@restaurant.ru",
            smtp_password="********",
            smtp_from_email="notifications@restaurant.ru",
            smtp_from_name="Вкусно и Точка",
            sms_api_key="********",
            sms_sender="Restaurant",
            privacy_policy="<p>Политика конфиденциальности...</p>",
            terms_of_service="<p>Условия обслуживания...</p>"
        ) 