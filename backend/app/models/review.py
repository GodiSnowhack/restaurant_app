from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Text, Enum
from sqlalchemy.orm import relationship
from datetime import datetime
import enum
from app.database.session import Base


class ReviewType(str, enum.Enum):
    """Тип отзыва"""
    DISH = "dish"         # Отзыв о блюде
    ORDER = "order"       # Отзыв о заказе
    SERVICE = "service"   # Отзыв об обслуживании
    COMBINED = "combined" # Комбинированный отзыв о заказе и обслуживании


class Review(Base):
    """Модель для хранения отзывов пользователей о ресторане и блюдах"""
    __tablename__ = "reviews"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=True)
    
    # Рейтинги
    service_rating = Column(Float, nullable=True)  # Оценка обслуживания от 1 до 5
    food_rating = Column(Float, nullable=True)   # Оценка еды/заказа от 1 до 5
    
    comment = Column(Text, nullable=True)  # Текстовый комментарий
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Отношения
    user = relationship("User", back_populates="reviews")
    order = relationship("Order", back_populates="review") 