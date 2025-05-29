from sqlalchemy import Column, Integer, Float, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database.session import Base


class OrderItem(Base):
    __tablename__ = "order_items"
    
    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id", ondelete="CASCADE"), nullable=False)
    dish_id = Column(Integer, ForeignKey("dishes.id", ondelete="CASCADE"), nullable=False)
    quantity = Column(Integer, default=1)
    price = Column(Float, nullable=False)  # Цена на момент заказа
    created_at = Column(DateTime, default=func.now())
    
    # Отношения
    order = relationship("app.models.order.Order", back_populates="order_items")
    dish = relationship("app.models.menu.Dish", back_populates="order_items") 