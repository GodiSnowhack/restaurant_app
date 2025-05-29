from typing import Any, List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.schemas.orders import OrderCreate, OrderOut
from app.services.orders import create_order, get_orders as get_orders_service
from app.models.user import User
from app.database.session import get_db
from app.core.auth import get_current_user

router = APIRouter()

@router.get("/", response_model=List[OrderOut])
def get_orders(
    db: Session = Depends(get_db),
    skip: int = 0,
    limit: int = 100,
    status: str = None,
    user_id: int = None,
    start_date: str = None,
    end_date: str = None,
    current_user: User = Depends(get_current_user)
):
    """
    Получение списка заказов с возможностью фильтрации
    
    Параметры:
    - status: фильтр по статусу заказа
    - user_id: фильтр по ID пользователя
    - start_date: начальная дата для выборки
    - end_date: конечная дата для выборки
    """
    try:
        # Проверка прав доступа: обычный пользователь видит только свои заказы
        if current_user.role not in ["admin", "waiter"]:
            user_id = current_user.id

        # Получаем заказы через сервисный слой
        orders = get_orders_service(
            db=db,
            skip=skip,
            limit=limit,
            status=status,
            user_id=user_id
        )
        
        return orders
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Ошибка при получении заказов: {str(e)}"
        )

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