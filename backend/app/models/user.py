from datetime import datetime
from enum import Enum as PyEnum
from sqlalchemy import Column, Integer, String, Boolean, DateTime, Enum, Date
from sqlalchemy.orm import relationship
import enum

from app.database.session import Base


class UserRole(str, PyEnum):
    CLIENT = "client"
    WAITER = "waiter"
    ADMIN = "admin"


class AgeGroup(str, PyEnum):
    CHILD = "child"         # 0-12 лет
    TEENAGER = "teenager"   # 13-17 лет
    YOUNG = "young"         # 18-25 лет
    ADULT = "adult"         # 26-45 лет
    MIDDLE = "middle"       # 46-65 лет
    SENIOR = "senior"       # 66+ лет


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True)
    phone = Column(String, unique=True, index=True, nullable=True)
    hashed_password = Column(String, nullable=False)
    full_name = Column(String, index=True)
    is_active = Column(Boolean, default=True)
    role = Column(String, default="user")
    
    # Новые поля для хранения даты рождения и возрастной группы
    birthday = Column(Date, nullable=True)
    age_group = Column(Enum(AgeGroup), nullable=True)
    
    # Время создания и обновления
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Связи с другими таблицами
    orders = relationship("Order", foreign_keys="Order.user_id", back_populates="user")
    served_orders = relationship("Order", foreign_keys="Order.waiter_id", back_populates="waiter")
    reservations = relationship("Reservation", back_populates="user")
    feedback = relationship("Feedback", back_populates="user")
    
    # Отношения с отзывами
    reviews = relationship("Review", back_populates="user") 