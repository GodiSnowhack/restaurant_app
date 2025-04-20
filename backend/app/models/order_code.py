from datetime import datetime
from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import relationship

from app.database.session import Base


class OrderCode(Base):
    __tablename__ = "order_codes"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String, unique=True, index=True, nullable=False)
    table_number = Column(Integer, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    is_used = Column(Boolean, default=False)
    
    # ID официанта, который создал код
    waiter_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    waiter = relationship("User", foreign_keys=[waiter_id])
    
    # ID заказа, связанного с этим кодом (если код использован)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=True)
    order = relationship("Order", foreign_keys=[order_id], backref="code") 