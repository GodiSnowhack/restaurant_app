from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.database.session import get_db
from app.services.auth import get_current_user
from app.models.user import User
from app.models.order import Order, OrderStatus, PaymentStatus
from app.schemas.order import OrderResponse

router = APIRouter()

@router.get("/orders", response_model=List[OrderResponse])
async def get_waiter_orders(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if current_user.role != "waiter":
        raise HTTPException(status_code=403, detail="Not enough permissions")
    
    orders = db.query(Order).filter(
        Order.waiter_id == current_user.id
    ).order_by(Order.created_at.desc()).all()
    
    return orders

@router.post("/orders/{order_id}/take")
async def take_order(
    order_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if current_user.role != "waiter":
        raise HTTPException(status_code=403, detail="Not enough permissions")
    
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    if order.waiter_id is not None:
        raise HTTPException(status_code=400, detail="Order is already taken by another waiter")
    
    order.waiter_id = current_user.id
    order.status = OrderStatus.PROCESSING
    db.commit()
    
    return {"message": "Order taken successfully"}

@router.post("/orders/{order_id}/confirm-payment")
async def confirm_payment(
    order_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if current_user.role != "waiter":
        raise HTTPException(status_code=403, detail="Not enough permissions")
    
    order = db.query(Order).filter(
        Order.id == order_id,
        Order.waiter_id == current_user.id
    ).first()
    
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    if order.payment_status == PaymentStatus.PAID:
        raise HTTPException(status_code=400, detail="Order is already paid")
    
    order.payment_status = PaymentStatus.PAID
    db.commit()
    
    return {"message": "Payment confirmed successfully"}

@router.post("/orders/{order_id}/complete")
async def complete_order(
    order_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if current_user.role != "waiter":
        raise HTTPException(status_code=403, detail="Not enough permissions")
    
    order = db.query(Order).filter(
        Order.id == order_id,
        Order.waiter_id == current_user.id
    ).first()
    
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    if order.payment_status != PaymentStatus.PAID:
        raise HTTPException(status_code=400, detail="Order must be paid before completion")
    
    order.status = OrderStatus.DELIVERED
    db.commit()
    
    return {"message": "Order completed successfully"} 