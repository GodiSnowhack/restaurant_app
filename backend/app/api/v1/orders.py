from typing import List, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
import logging
from sqlalchemy.sql import text
from sqlalchemy import exc
from datetime import datetime

from app.database.session import get_db
from app.models.user import User, UserRole
from app.models.order import OrderStatus, OrderDish, Order, PaymentMethod
from app.schemas.order import (
    Order as OrderSchema,
    OrderCreate, OrderUpdate,
    Feedback as FeedbackSchema,
    FeedbackCreate,
    OrderResponse
)
from app.services import order as order_service
from app.core.security import get_current_active_user, check_admin_permission, check_waiter_permission

# Настройка логирования
logger = logging.getLogger(__name__)

router = APIRouter()


# Эндпоинты для заказов
@router.get("/", response_model=List[Any])
def read_orders(
    db: Session = Depends(get_db),
    skip: int = 0,
    limit: int = 100,
    status: str = None,
    user_id: int = None,
    start_date: str = None,
    end_date: str = None,
    current_user: User = Depends(get_current_active_user)
):
    """
    Получение списка заказов
    
    Параметры:
    - status: фильтр по статусу заказа
    - user_id: фильтр по ID пользователя
    - start_date: начальная дата для выборки (формат ISO, например "2025-04-08T19:00:00.000Z")
    - end_date: конечная дата для выборки (формат ISO)
    """
    try:
        logger.info(f"Запрос списка заказов. Пользователь: {current_user.id}, роль: {current_user.role}")
        logger.info(f"Параметры: status={status}, user_id={user_id}, start_date={start_date}, end_date={end_date}")
        
        # Проверяем права доступа: обычный пользователь видит только свои заказы
        # Администраторы и официанты видят все заказы
        if current_user.role not in [UserRole.ADMIN, UserRole.WAITER]:
            user_id = current_user.id
            logger.info(f"Фильтрация заказов по user_id={user_id} (обычный пользователь)")

        try:
            # Получаем все заказы сразу с подробной информацией
            orders = db.query(Order).filter(
                ((Order.user_id == user_id) if user_id else True) &
                ((Order.status == status) if status else True)
            ).order_by(Order.created_at.desc())[skip:skip+limit]
            
            # Преобразуем заказы к формату для API ответа
            orders_data = []
            for order in orders:
                try:
                    # Используем ORM вместо прямых запросов
                    order_data = {
                        "id": order.id,
                        "user_id": order.user_id,
                        "waiter_id": order.waiter_id,
                        "table_number": order.table_number,
                        "status": order.status.value if order.status else "",
                        "payment_status": order.payment_status.value if order.payment_status else "",
                        "payment_method": order.payment_method.value if order.payment_method else "",
                        "total_amount": float(order.total_amount) if order.total_amount is not None else 0.0,
                        "created_at": order.created_at.isoformat() if order.created_at else datetime.utcnow().isoformat(),
                        "updated_at": order.updated_at.isoformat() if order.updated_at else None,
                        "completed_at": order.completed_at.isoformat() if order.completed_at else None,
                        "comment": order.comment or "",
                        "customer_name": order.customer_name or "",
                        "customer_phone": order.customer_phone or "",
                        "delivery_address": order.delivery_address or "",
                        "order_code": order.order_code or "",
                        "is_urgent": order.is_urgent or False,
                        "is_group_order": order.is_group_order or False,
                        "items": []
                    }
                    
                    # Добавляем информацию о блюдах
                    for order_dish in order.order_dishes:
                        dish = order_dish.dish
                        if dish:
                            price = float(dish.price) if dish.price is not None else 0.0
                            quantity = order_dish.quantity or 1
                            
                            order_data["items"].append({
                                "id": dish.id,
                                "dish_id": dish.id,
                                "name": dish.name,
                                "price": price,
                                "quantity": quantity,
                                "special_instructions": order_dish.special_instructions or "",
                                "category_id": dish.category_id,
                                "image_url": dish.image_url or "",
                                "description": dish.description or "",
                                "total_price": price * quantity
                            })
                    
                    orders_data.append(order_data)
                except Exception as e:
                    logger.error(f"Ошибка при обработке заказа {order.id}: {str(e)}")
                    # Добавляем минимальную информацию о заказе в случае ошибки
                    orders_data.append({
                        "id": order.id,
                        "status": order.status.value if order.status else "unknown",
                        "created_at": order.created_at.isoformat() if order.created_at else datetime.utcnow().isoformat(),
                        "items": []
                    })
            
            logger.info(f"Успешно подготовлено {len(orders_data)} заказов для ответа")
            return orders_data
                
        except Exception as e:
            logger.error(f"Ошибка при получении заказов: {str(e)}")
            logger.exception(e)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Ошибка при получении заказов: {str(e)}"
            )
            
    except Exception as e:
        logger.exception(f"Ошибка при получении списка заказов: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Внутренняя ошибка сервера: {str(e)}"
        )


@router.post("/", response_model=OrderResponse)
def create_order(
    order_in: OrderCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Создание нового заказа
    """
    # Преобразуем входные данные в словарь и добавляем user_id
    order_data = order_in.dict()
    order_data["user_id"] = current_user.id
    
    # Создаем заказ и возвращаем результат
    result = order_service.create_order(db, order_data)
    return result


@router.get("/{order_id}", response_model=OrderSchema)
def read_order(
    *,
    db: Session = Depends(get_db),
    order_id: int,
    current_user: User = Depends(get_current_active_user)
):
    """
    Получение заказа по ID
    """
    try:
        logger.info(f"Запрос заказа ID {order_id}. Пользователь: {current_user.id}, роль: {current_user.role}")
        
        # Получаем заказ из базы данных с помощью безопасной функции
        order_data = order_service.get_order_detailed(db, order_id)
        
        if not order_data:
            logger.warning(f"Заказ с ID {order_id} не найден")
            raise HTTPException(status_code=404, detail="Заказ не найден")
        
        # Проверяем права доступа: обычный пользователь может видеть только свои заказы
        if current_user.role not in [UserRole.ADMIN, UserRole.WAITER] and \
           order_data.get("user_id") != current_user.id:
            logger.warning(f"Доступ запрещен: пользователь {current_user.id} пытается просмотреть заказ {order_id}")
            raise HTTPException(status_code=403, detail="Недостаточно прав")
        
        # Возвращаем готовый словарь с данными заказа
        return order_data
        
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Ошибка при получении заказа {order_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Внутренняя ошибка сервера: {str(e)}"
        )


@router.put("/{order_id}", response_model=OrderSchema)
def update_order(
    *,
    db: Session = Depends(get_db),
    order_id: int,
    order_in: OrderUpdate,
    current_user: User = Depends(get_current_active_user)
):
    """
    Обновление заказа
    """
    try:
        logger.info(f"Запрос на обновление заказа {order_id}. Пользователь: {current_user.id}, роль: {current_user.role}")
        
        # Сначала проверяем, существует ли заказ, используя ORM
        db_order = db.query(Order).filter(Order.id == order_id).first()
        
        if not db_order:
            logger.warning(f"Заказ с ID {order_id} не найден")
            raise HTTPException(status_code=404, detail="Order not found")
        
        # Проверяем права доступа: только владелец заказа, админ или персонал могут обновлять заказ
        if current_user.role not in [UserRole.ADMIN, UserRole.WAITER] and db_order.user_id != current_user.id:
            logger.warning(f"Доступ запрещен: пользователь {current_user.id} пытается обновить заказ {order_id}")
            raise HTTPException(status_code=403, detail="Not enough permissions")
        
        try:
            # Используем сервисную функцию для обновления заказа
            updated_order = order_service.update_order(db, order_id, order_in)
            
            if not updated_order:
                raise HTTPException(status_code=404, detail="Order not found after update")
            
            # Возвращаем обновленный заказ
            return updated_order
            
        except Exception as e:
            logger.exception(f"Ошибка при обновлении заказа {order_id}: {str(e)}")
            db.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Не удалось обновить заказ: {str(e)}"
            )
            
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Ошибка при обновлении заказа {order_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Внутренняя ошибка сервера: {str(e)}"
        )


@router.delete("/{order_id}", status_code=204)
def delete_order(
    *,
    db: Session = Depends(get_db),
    order_id: int,
    current_user: User = Depends(get_current_active_user)
):
    """
    Удаление заказа
    """
    try:
        logger.info(f"Запрос на удаление заказа {order_id}. Пользователь: {current_user.id}, роль: {current_user.role}")
        
        # Проверяем существование заказа и права доступа
        db_order = db.query(Order).filter(Order.id == order_id).first()
        
        if not db_order:
            logger.warning(f"Заказ с ID {order_id} не найден")
            raise HTTPException(status_code=404, detail="Order not found")
        
        # Проверяем права доступа: только владелец заказа, админ или персонал могут удалять заказ
        if current_user.role not in [UserRole.ADMIN, UserRole.WAITER] and db_order.user_id != current_user.id:
            logger.warning(f"Доступ запрещен: пользователь {current_user.id} пытается удалить заказ {order_id}")
            raise HTTPException(status_code=403, detail="Not enough permissions")
        
        try:
            # Используем сервисную функцию для удаления заказа
            result = order_service.delete_order(db, order_id)
            
            if not result:
                raise HTTPException(status_code=404, detail="Order not found after deletion attempt")
            
            return None
            
        except Exception as e:
            logger.exception(f"Ошибка при удалении заказа {order_id}: {str(e)}")
            db.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Не удалось удалить заказ: {str(e)}"
            )
            
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Ошибка при удалении заказа {order_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Внутренняя ошибка сервера: {str(e)}"
        )


# Эндпоинты для отзывов
@router.post("/feedback", response_model=FeedbackSchema)
def create_feedback(
    *,
    db: Session = Depends(get_db),
    feedback_in: FeedbackCreate,
    current_user: User = Depends(get_current_active_user)
):
    """
    Создание отзыва о заказе или блюде
    """
    return order_service.create_feedback(db, user_id=current_user.id, feedback_in=feedback_in)


@router.get("/dish/{dish_id}/feedback", response_model=List[FeedbackSchema])
def read_dish_feedback(
    dish_id: int,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    """
    Получение отзывов о блюде
    """
    return order_service.get_feedbacks_by_dish(db, dish_id=dish_id, skip=skip, limit=limit)


@router.get("/user/{user_id}/feedback", response_model=List[FeedbackSchema])
def read_user_feedback(
    user_id: int,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Получение отзывов пользователя
    """
    # Проверяем права доступа: пользователь может видеть только свои отзывы
    if current_user.role not in [UserRole.ADMIN] and current_user.id != user_id:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    
    return order_service.get_feedbacks_by_user(db, user_id=user_id, skip=skip, limit=limit) 