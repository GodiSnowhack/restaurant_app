from datetime import datetime
from enum import Enum as PyEnum
from sqlalchemy import Column, Integer, String, Boolean, DateTime, Enum
from sqlalchemy.orm import relationship

from app.database.session import Base


class UserRole(str, PyEnum):
    CLIENT = "client"
    WAITER = "waiter"
    ADMIN = "admin"


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    phone = Column(String, unique=True, index=True, nullable=True)
    hashed_password = Column(String, nullable=False)
    full_name = Column(String, index=True)
    is_active = Column(Boolean, default=True)
    role = Column(String, default=UserRole.CLIENT)
    
    # Время создания и обновления
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Связи с другими таблицами
    orders = relationship("Order", foreign_keys="Order.user_id", back_populates="user")
    served_orders = relationship("Order", foreign_keys="Order.waiter_id", back_populates="waiter")
    reservations = relationship("Reservation", back_populates="user")
    feedback = relationship("Feedback", back_populates="user") 