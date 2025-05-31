from typing import Any, List, Dict, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Request, Body
from sqlalchemy.orm import Session
import json
from pydantic import BaseModel

from app.schemas.orders import OrderCreate, OrderOut, OrderDishItem
from app.services.orders import create_order as create_order_service, get_orders as get_orders_service
from app.models.user import User
from app.database.session import get_db
from app.core.auth import get_current_user

router = APIRouter()

class OrderCreateRequest(BaseModel):
    payment_method: Optional[str] = "cash"
    customer_name: Optional[str] = None
    customer_phone: Optional[str] = None
    dishes: Optional[List[int]] = None
    items: Optional[List[Dict[str, Any]]] = None
    reservation_code: Optional[str] = None
    is_urgent: Optional[bool] = False
    is_group_order: Optional[bool] = False
    comment: Optional[str] = None

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

@router.post("/", response_model=None)
def create_order(
    order_req: Dict[str, Any] = Body(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    """
    Создание нового заказа с обработкой различных форматов данных.
    Номер стола получается автоматически из кода бронирования.
    """
    try:
        print(f"Получены данные заказа: {order_req}")
        
        # Базовые данные заказа
        order_data = {
            "status": "pending"
        }
        
        # Код бронирования (если есть)
        if order_req.get("reservation_code"):
            order_data["reservation_code"] = order_req["reservation_code"]
        
        # Обработка блюд - просто передаем данные как есть
        if order_req.get("dishes"):
            order_data["dishes"] = order_req["dishes"]
        
        # Создаем заказ через сервисный слой
        try:
            order_result = create_order_service(db, current_user.id, OrderCreate(**order_data))
            
            # Возвращаем результат прямо, без валидации Pydantic
            return {
                "success": True,
                "message": "Заказ успешно создан",
                "data": order_result
            }
            
        except Exception as e:
            print(f"Ошибка при создании заказа в сервисе: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Ошибка при создании заказа: {str(e)}"
            )
    except HTTPException:
        raise
    except Exception as e:
        # Логгируем ошибку и возвращаем описательный ответ
        print(f"Общая ошибка при создании заказа: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Непредвиденная ошибка при создании заказа: {str(e)}"
        ) 