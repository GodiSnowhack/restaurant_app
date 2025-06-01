from typing import Any, List, Dict, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Request, Body
from sqlalchemy.orm import Session
import json
from pydantic import BaseModel

from app.schemas.orders import OrderCreate, OrderOut, OrderDishItem
from app.services.orders import create_order as create_order_service, get_orders as get_orders_service
from app.models.user import User
from app.models.order import Order, OrderDish
from app.models.menu import Dish
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

@router.get("/{order_id}", response_model=OrderOut)
def get_order_by_id(
    order_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Получение информации о конкретном заказе по ID
    """
    try:
        # Проверяем наличие заказа в базе данных
        order = db.query(Order).filter(Order.id == order_id).first()
        
        if not order:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Заказ с ID {order_id} не найден"
            )
        
        # Проверка прав доступа
        if current_user.role not in ["admin", "waiter"] and order.user_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="У вас нет прав на просмотр этого заказа"
            )
        
        # Получаем позиции заказа
        order_dishes = db.query(OrderDish).filter(OrderDish.order_id == order_id).all()
        
        # Формируем список позиций
        items = []
        for item in order_dishes:
            # Получаем связанное блюдо
            dish = db.query(Dish).filter(Dish.id == item.dish_id).first()
            dish_name = dish.name if dish else f"Блюдо #{item.dish_id}"
            
            items.append({
                "id": item.id,
                "dish_id": item.dish_id,
                "name": dish_name,
                "quantity": item.quantity,
                "price": float(item.price),
                "total_price": float(item.price * item.quantity),
                "special_instructions": item.special_instructions or ""
            })
        
        # Формируем ответ
        order_data = {
            "id": order.id,
            "user_id": order.user_id,
            "waiter_id": order.waiter_id,
            "table_number": order.table_number,
            "status": order.status,
            "payment_status": order.payment_status,
            "payment_method": order.payment_method,
            "total_amount": float(order.total_amount),
            "comment": order.comment,
            "special_instructions": order.comment,
            "created_at": order.created_at.isoformat() if order.created_at else None,
            "updated_at": order.updated_at.isoformat() if order.updated_at else None,
            "completed_at": order.completed_at.isoformat() if order.completed_at else None,
            "customer_name": order.customer_name or "",
            "customer_phone": order.customer_phone or "",
            "order_code": order.order_code or "",
            "is_urgent": order.is_urgent or False,
            "is_group_order": order.is_group_order or False,
            "items": items
        }
        
        return order_data
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Ошибка при получении заказа: {str(e)}"
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
        
        # Добавляем данные о клиенте
        if order_req.get("customer_name"):
            order_data["customer_name"] = order_req["customer_name"]
        else:
            order_data["customer_name"] = current_user.full_name
            
        if order_req.get("customer_phone"):
            order_data["customer_phone"] = order_req["customer_phone"]
        else:
            order_data["customer_phone"] = current_user.phone
            
        # Добавляем комментарий, если есть
        if order_req.get("comment"):
            order_data["comment"] = order_req["comment"]
            
        # Добавляем флаги срочности и группового заказа, если есть
        if order_req.get("is_urgent") is not None:
            order_data["is_urgent"] = order_req["is_urgent"]
            
        if order_req.get("is_group_order") is not None:
            order_data["is_group_order"] = order_req["is_group_order"]
        
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

@router.put("/{order_id}/payment-status", response_model=Dict[str, Any])
def update_order_payment_status(
    order_id: int,
    payment_update: Dict[str, Any] = Body(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Обновление статуса оплаты заказа
    """
    try:
        # Проверяем наличие заказа в базе данных
        order = db.query(Order).filter(Order.id == order_id).first()
        
        if not order:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Заказ с ID {order_id} не найден"
            )
        
        # Проверка прав доступа
        if current_user.role not in ["admin", "waiter"] and order.user_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="У вас нет прав на изменение этого заказа"
            )
        
        # Получаем новый статус оплаты
        new_status = payment_update.get("status")
        if not new_status:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Не указан статус оплаты"
            )
        
        # Валидируем статус
        valid_statuses = ["pending", "paid", "failed", "refunded"]
        if new_status.lower() not in valid_statuses:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Недопустимый статус оплаты. Допустимые значения: {', '.join(valid_statuses)}"
            )
        
        # Обновляем статус оплаты
        order.payment_status = new_status.lower()
        
        # Если заказ был оплачен, обновляем соответствующие поля
        if new_status.lower() == "paid":
            from datetime import datetime
            order.updated_at = datetime.utcnow()
            
            # Если заказ был в статусе "ready" и оплачен, автоматически меняем на "completed"
            if order.status == "ready":
                order.status = "completed"
                order.completed_at = datetime.utcnow()
        
        # Сохраняем изменения
        db.commit()
        
        # Получаем обновленный заказ
        order = db.query(Order).filter(Order.id == order_id).first()
        
        # Получаем позиции заказа для ответа
        order_dishes = db.query(OrderDish).filter(OrderDish.order_id == order_id).all()
        
        # Формируем список позиций
        items = []
        for item in order_dishes:
            # Получаем связанное блюдо
            dish = db.query(Dish).filter(Dish.id == item.dish_id).first()
            dish_name = dish.name if dish else f"Блюдо #{item.dish_id}"
            
            items.append({
                "id": item.id,
                "dish_id": item.dish_id,
                "name": dish_name,
                "quantity": item.quantity,
                "price": float(item.price),
                "total_price": float(item.price * item.quantity),
                "special_instructions": item.special_instructions or ""
            })
        
        # Формируем ответ
        return {
            "id": order.id,
            "user_id": order.user_id,
            "waiter_id": order.waiter_id,
            "table_number": order.table_number,
            "status": order.status,
            "payment_status": order.payment_status,
            "payment_method": order.payment_method,
            "total_amount": float(order.total_amount),
            "comment": order.comment,
            "created_at": order.created_at.isoformat() if order.created_at else None,
            "updated_at": order.updated_at.isoformat() if order.updated_at else None,
            "completed_at": order.completed_at.isoformat() if order.completed_at else None,
            "customer_name": order.customer_name or "",
            "customer_phone": order.customer_phone or "",
            "order_code": order.order_code or "",
            "is_urgent": order.is_urgent or False,
            "is_group_order": order.is_group_order or False,
            "items": items
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Ошибка при обновлении статуса оплаты заказа: {str(e)}"
        ) 