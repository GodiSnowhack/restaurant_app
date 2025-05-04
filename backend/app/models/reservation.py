from datetime import datetime
from enum import Enum as PyEnum
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Enum
from sqlalchemy.orm import relationship

from app.database.session import Base


class ReservationStatus(str, PyEnum):
    PENDING = "pending"
    CONFIRMED = "confirmed"
    CANCELLED = "cancelled"
    COMPLETED = "completed"


class Reservation(Base):
    __tablename__ = "reservations"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    table_number = Column(Integer, nullable=True)
    guests_count = Column(Integer, nullable=False)
    reservation_time = Column(DateTime, nullable=False)
    status = Column(String, default=ReservationStatus.PENDING)
    guest_name = Column(String, nullable=True)
    guest_phone = Column(String, nullable=True)
    comment = Column(String, nullable=True)
    reservation_code = Column(String, nullable=True, unique=True)
    
    # Время создания и обновления
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Связи с другими таблицами
    user = relationship("User", back_populates="reservations") 