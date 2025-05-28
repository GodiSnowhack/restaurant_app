from typing import Any, List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.schemas.orders import OrderCreate, OrderOut
from app.services.orders import create_order
from app.models.user import User
from app.database.session import get_db
from app.core.auth import get_current_user

router = APIRouter()

@router.get("/", response_model=List[OrderOut])
def get_orders(db: Session = Depends(get_db)):
    return {"message": "Orders endpoint"}

@router.post("/", response_model=OrderOut)
def create_order(
    order_in: OrderCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    """
    Создание нового заказа.
    """
    # Создаем заказ
    try:
        order = create_order(db, current_user.id, order_in)
        return order
    except Exception as e:
        # Логгируем ошибку и возвращаем описательный ответ
        print(f"Ошибка при создании заказа: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Ошибка при создании заказа: {str(e)}"
        ) 