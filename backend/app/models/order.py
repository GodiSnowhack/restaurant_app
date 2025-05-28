from datetime import datetime
from enum import Enum as PyEnum
from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Enum, Boolean, Table, Text, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum
from typing import List, Optional

from app.database.session import Base


class OrderStatus(str, PyEnum):
    PENDING = "pending"
    NEW = "new"
    CONFIRMED = "confirmed"
    COOKING = "cooking"
    PREPARING = "preparing"
    IN_PROGRESS = "in_progress"
    READY = "ready"
    DELIVERED = "delivered"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class PaymentStatus(str, PyEnum):
    PENDING = "pending"
    PAID = "paid"
    FAILED = "failed"
    REFUNDED = "refunded"


class PaymentMethod(str, PyEnum):
    CASH = "cash"
    CARD = "card"
    ONLINE = "online"


class OrderType(str, PyEnum):
    DINE_IN = "dine_in"
    TAKEAWAY = "takeaway"
    DELIVERY = "delivery"


class OrderDish(Base):
    __tablename__ = "order_dish"

    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id", ondelete="CASCADE"), nullable=False)
    dish_id = Column(Integer, ForeignKey("dishes.id", ondelete="CASCADE"), nullable=False)
    quantity = Column(Integer, default=1)
    special_instructions = Column(Text, nullable=True)
    price = Column(Float, nullable=False)  # Цена блюда на момент заказа
    
    # Связи с явным указанием back_populates
    order = relationship("Order", back_populates="order_dishes")
    dish = relationship("app.models.menu.Dish", back_populates="order_dishes")

    def __repr__(self):
        return f"<OrderDish {self.id}: order={self.order_id}, dish={self.dish_id}, qty={self.quantity}>"


class Order(Base):
    __tablename__ = "orders"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    waiter_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    table_number = Column(Integer, nullable=True)
    payment_method = Column(String(6), nullable=True)
    customer_name = Column(String, nullable=True)
    customer_phone = Column(String, nullable=True)
    reservation_code = Column(String, nullable=True)
    order_code = Column(String, nullable=True)
    status = Column(String(9), default="pending")
    payment_status = Column(String(8), default="pending")
    total_amount = Column(Float, nullable=True)
    comment = Column(Text, nullable=True)
    is_urgent = Column(Boolean, default=False)
    is_group_order = Column(Boolean, default=False)
    customer_age_group = Column(String, nullable=True)
    
    # Временные метки
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    
    # Связь с пользователями
    user = relationship("User", foreign_keys=[user_id], back_populates="orders")
    waiter = relationship("User", foreign_keys=[waiter_id], back_populates="waiter_orders")
    
    # Связь с элементами заказа
    items = relationship("OrderDish", back_populates="order", cascade="all, delete-orphan")
    
    # Связь с платежами
    payments = relationship("Payment", back_populates="order", cascade="all, delete-orphan")
    
    def __repr__(self):
        return f"<Order {self.id}: {self.status}>"

    def to_dict(self):
        from datetime import datetime
        # Обеспечиваем наличие значения created_at
        if self.created_at is None:
            self.created_at = datetime.utcnow()
            
        return {
            "id": self.id,
            "user_id": self.user_id,
            "waiter_id": self.waiter_id,
            "table_number": self.table_number,
            "status": self.status,
            "total_amount": self.total_amount,
            "comment": self.comment,
            "created_at": self.created_at.isoformat() if self.created_at else datetime.utcnow().isoformat(),
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "completed_at": self.completed_at.isoformat() if self.completed_at else None,
            "payment_status": self.payment_status,
            "payment_method": self.payment_method,
            "customer_name": self.customer_name,
            "customer_phone": self.customer_phone,
            "reservation_code": self.reservation_code,
            "order_code": self.order_code,
            "is_urgent": self.is_urgent,
            "is_group_order": self.is_group_order,
            "items": [
                {
                    "dish_id": item.dish_id,
                    "name": item.dish.name,
                    "price": item.price,
                    "quantity": item.quantity,
                    "special_instructions": item.special_instructions
                }
                for item in self.items
            ]
        }


class Feedback(Base):
    __tablename__ = "feedbacks"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    dish_id = Column(Integer, ForeignKey("dishes.id"), nullable=True)
    rating = Column(Integer, nullable=False)  # От 1 до 5
    comment = Column(String, nullable=True)
    
    # Время создания
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Связи с другими таблицами
    user = relationship("User", back_populates="feedback")
    # Используем строковое имя с полным модулем
    dish = relationship("app.models.menu.Dish", back_populates="feedbacks")