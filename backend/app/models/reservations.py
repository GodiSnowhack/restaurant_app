from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Boolean, Text, Date, Time
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from datetime import datetime, time, date
from typing import Optional

from app.database.session import Base

class Reservation(Base):
    """Модель бронирования столика"""
    
    __tablename__ = "reservations"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    
    # Информация о бронировании
    guests_count = Column(Integer, nullable=False, default=1)
    reservation_date = Column(Date, nullable=False)
    reservation_time = Column(String(5), nullable=False)  # Формат: "HH:MM"
    status = Column(String(20), nullable=False, default="pending")  # pending, confirmed, completed, cancelled
    
    # Информация о столе
    table_id = Column(Integer, nullable=True)  # ID стола из настроек
    table_number = Column(Integer, nullable=True)  # Номер стола (для обратной совместимости)
    
    # Контактная информация гостя
    guest_name = Column(String(255), nullable=False)
    guest_phone = Column(String(20), nullable=False)
    guest_email = Column(String(255), nullable=True)
    
    # Дополнительная информация
    comments = Column(Text, nullable=True)
    
    # Метаданные
    created_at = Column(DateTime, nullable=False, default=func.now())
    updated_at = Column(DateTime, nullable=False, default=func.now(), onupdate=func.now())
    
    # Отношения
    user = relationship("User", back_populates="reservations")
    
    @property
    def table(self) -> Optional[dict]:
        """
        Получает информацию о столе из настроек (если известен table_id)
        """
        if not self.table_id:
            return None
            
        # Здесь в реальной реализации мы бы получали информацию о столе из настроек
        # Для прототипа возвращаем заглушку
        return {
            "id": self.table_id,
            "name": f"Стол {self.table_id}",
            "capacity": self.guests_count
        }
    
    def __repr__(self):
        return f"<Reservation(id={self.id}, date={self.reservation_date}, time={self.reservation_time}, guests={self.guests_count})>" 