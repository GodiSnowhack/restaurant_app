from typing import Any, List, Optional, Dict
from fastapi import APIRouter, Depends, HTTPException, Query, Path, Body, status
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from sqlalchemy import and_, or_, func

from app.schemas.orders import OrderCreate, OrderOut, OrderResponse, OrderDetails
from app.services.orders import create_order
from app.models.user import User
from app.database.session import get_db
from app.core.auth import get_current_user, get_current_active_user
from app.crud import orders as orders_crud
from app.models import Order, OrderDish, Dish

router = APIRouter()

@router.get("/", response_model=List[OrderResponse])
async def get_orders(
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    user_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Получить список заказов с фильтрацией по датам и другим параметрам.
    Администраторы видят все заказы, официанты - только свои заказы.
    """
    try:
        # Преобразование строковых дат в datetime объекты, если они предоставлены
        start_datetime = datetime.fromisoformat(start_date.replace('Z', '+00:00')) if start_date else None
        end_datetime = datetime.fromisoformat(end_date.replace('Z', '+00:00')) if end_date else None
        
        # Проверка роли пользователя
        is_admin = current_user.role.lower() == "admin"
        
        # Базовый запрос для получения заказов
        query = db.query(Order)
        
        # Применение фильтров
        if start_datetime:
            query = query.filter(Order.created_at >= start_datetime)
        
        if end_datetime:
            query = query.filter(Order.created_at <= end_datetime)
        
        if status:
            query = query.filter(Order.status == status)
        
        if user_id:
            query = query.filter(Order.user_id == user_id)
        
        # Если пользователь не админ, показываем только его заказы или заказы, где он официант
        if not is_admin:
            query = query.filter(
                or_(
                    Order.user_id == current_user.id,
                    Order.waiter_id == current_user.id
                )
            )
        
        # Получаем все заказы
        orders = query.order_by(Order.created_at.desc()).all()
        
        # Подготавливаем ответ с данными о блюдах для каждого заказа
        result = []
        
        for order in orders:
            # Получаем элементы заказа
            order_items = db.query(OrderDish).filter(OrderDish.order_id == order.id).all()
            
            # Подготавливаем информацию о каждом элементе
            items = []
            for item in order_items:
                dish = db.query(Dish).filter(Dish.id == item.dish_id).first()
                dish_name = dish.name if dish else f"Блюдо #{item.dish_id}"
                
                item_data = {
                    "dish_id": item.dish_id,
                    "quantity": item.quantity,
                    "price": item.price,
                    "name": dish_name,
                    "total_price": item.price * item.quantity,
                    "special_instructions": item.special_instructions
                }
                items.append(item_data)
            
            # Вычисляем общую сумму заказа
            total_price = sum(item["total_price"] for item in items)
            
            # Создаем объект заказа с элементами
            order_data = {
                "id": order.id,
                "user_id": order.user_id,
                "waiter_id": order.waiter_id,
                "status": order.status,
                "payment_status": order.payment_status,
                "payment_method": order.payment_method,
                "order_type": "dine-in" if order.table_number else "delivery",
                "total_amount": total_price,
                "total_price": total_price,
                "created_at": order.created_at.isoformat() if order.created_at else None,
                "updated_at": order.updated_at.isoformat() if order.updated_at else None,
                "completed_at": order.completed_at.isoformat() if order.completed_at else None,
                "items": items,
                "table_number": order.table_number,
                "customer_name": order.customer_name,
                "customer_phone": order.customer_phone,
                "reservation_code": order.reservation_code,
                "order_code": order.order_code,
                "comment": order.comment,
                "is_urgent": order.is_urgent,
                "is_group_order": order.is_group_order
            }
            
            result.append(order_data)
        
        return result
    
    except Exception as e:
        # Подробное логирование ошибки
        print(f"Ошибка при получении заказов: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Ошибка при получении заказов: {str(e)}"
        )

@router.get("/{order_id}", response_model=OrderDetails)
async def get_order(
    order_id: int = Path(..., title="ID заказа", ge=1),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Получить детальную информацию о конкретном заказе по его ID.
    """
    try:
        # Проверка роли пользователя
        is_admin = current_user.role.lower() == "admin"
        
        # Получаем заказ
        order = db.query(Order).filter(Order.id == order_id).first()
        
        if not order:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Заказ с ID {order_id} не найден"
            )
        
        # Проверяем права доступа
        if not is_admin and order.user_id != current_user.id and order.waiter_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="У вас нет прав для просмотра этого заказа"
            )
        
        # Получаем элементы заказа
        order_items = db.query(OrderDish).filter(OrderDish.order_id == order.id).all()
        
        # Подготавливаем информацию о каждом элементе
        items = []
        for item in order_items:
            dish = db.query(Dish).filter(Dish.id == item.dish_id).first()
            dish_name = dish.name if dish else f"Блюдо #{item.dish_id}"
            
            item_data = {
                "dish_id": item.dish_id,
                "quantity": item.quantity,
                "price": item.price,
                "name": dish_name,
                "total_price": item.price * item.quantity,
                "special_instructions": item.special_instructions
            }
            items.append(item_data)
        
        # Вычисляем общую сумму заказа
        total_price = sum(item["total_price"] for item in items)
        
        # Создаем полный ответ
        order_data = {
            "id": order.id,
            "user_id": order.user_id,
            "waiter_id": order.waiter_id,
            "status": order.status,
            "payment_status": order.payment_status,
            "payment_method": order.payment_method,
            "order_type": "dine-in" if order.table_number else "delivery",
            "total_amount": total_price,
            "total_price": total_price,
            "created_at": order.created_at.isoformat() if order.created_at else None,
            "updated_at": order.updated_at.isoformat() if order.updated_at else None,
            "completed_at": order.completed_at.isoformat() if order.completed_at else None,
            "items": items,
            "table_number": order.table_number,
            "customer_name": order.customer_name,
            "customer_phone": order.customer_phone,
            "reservation_code": order.reservation_code,
            "order_code": order.order_code,
            "comment": order.comment,
            "is_urgent": order.is_urgent,
            "is_group_order": order.is_group_order
        }
        
        return order_data
    
    except HTTPException:
        raise
    except Exception as e:
        print(f"Ошибка при получении заказа: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Ошибка при получении заказа: {str(e)}"
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