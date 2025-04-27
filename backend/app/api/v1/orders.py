from typing import List, Any, Optional, Dict
from fastapi import APIRouter, Depends, HTTPException, status, Query, Path, Body
from sqlalchemy.orm import Session
import logging
from sqlalchemy.sql import text
from sqlalchemy import exc
from datetime import datetime

from app.database.session import get_db
from app.models.user import User, UserRole
from app.models.order import OrderStatus, OrderDish, Order, PaymentMethod
from app.models.menu import Dish
from app.schemas.order import (
    Order as OrderSchema,
    OrderCreate, OrderUpdate,
    Feedback as FeedbackSchema,
    FeedbackCreate,
    OrderResponse,
    OrderReadSchema,
    OrderUpdateSchema,
    OrderStatusUpdateSchema
)
from app.services import order as order_service
from app.core.security import get_current_active_user, check_admin_permission, check_waiter_permission
from app.services.auth import get_current_user
from fastapi import status as http_status

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
            # Используем сервисную функцию вместо прямого запроса
            orders_data = order_service.get_orders(
                db=db, 
                skip=skip, 
                limit=limit, 
                status=status, 
                user_id=user_id
            )
            
            logger.info(f"Успешно получено {len(orders_data)} заказов для ответа")
            return orders_data
                
        except Exception as e:
            logger.error(f"Ошибка при получении заказов: {str(e)}")
            logger.exception(e)
            raise HTTPException(
                status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Ошибка при получении заказов: {str(e)}"
            )
            
    except Exception as e:
        logger.exception(f"Ошибка при получении списка заказов: {str(e)}")
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
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
        
        # Нормализуем данные перед отправкой, чтобы предотвратить ошибки валидации
        # Преобразуем пустые строки в None для числовых полей
        if order_data.get("waiter_id") == "":
            order_data["waiter_id"] = None
        
        if order_data.get("table_number") == "":
            order_data["table_number"] = None
            
        if order_data.get("completed_at") == "":
            order_data["completed_at"] = None
            
        # Проверяем другие поля, которые могут вызвать ошибки валидации
        numeric_fields = ["user_id", "total_amount"]
        for field in numeric_fields:
            if field in order_data and order_data[field] == "":
                order_data[field] = None
        
        # Возвращаем готовый словарь с данными заказа
        return order_data
        
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Ошибка при получении заказа {order_id}: {str(e)}")
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Внутренняя ошибка сервера: {str(e)}"
        )


@router.put("/update/{order_id}", response_model=OrderReadSchema)
def update_order(
    order_id: int,
    order_update: OrderUpdateSchema,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Обновляет существующий заказ."""
    try:
        # Проверка прав доступа
        if current_user.role not in [UserRole.ADMIN, UserRole.WAITER]:
            raise HTTPException(
                status_code=http_status.HTTP_403_FORBIDDEN,
                detail="Недостаточно прав для обновления заказов"
            )

        # Получение и обновление заказа
        updated_order = order_service.update_order(db, order_id, order_update)
        if not updated_order:
            raise HTTPException(
                status_code=http_status.HTTP_404_NOT_FOUND,
                detail=f"Заказ с id {order_id} не найден"
            )
            
        logger.info(f"Заказ {order_id} успешно обновлен пользователем {current_user.email}")
        return updated_order
    except Exception as e:
        logger.error(f"Ошибка при обновлении заказа {order_id}: {str(e)}")
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Ошибка при обновлении заказа: {str(e)}"
        )


@router.put("/status/{order_id}", response_model=Dict[str, Any])
def update_order_status(
    order_id: int,
    status_update: OrderStatusUpdateSchema,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Обновляет статус заказа.
    
    Args:
        order_id: ID заказа
        status_update: Новый статус заказа
        db: Сессия базы данных
        current_user: Текущий пользователь
        
    Returns:
        Обновленный заказ
    """
    try:
        # Логируем начало процесса обновления и все входные данные для отладки
        logger.info(f"Обновление статуса заказа {order_id} на {status_update.status}")
        logger.info(f"Пользователь: ID={current_user.id}, роль={current_user.role}, email={current_user.email}")
        logger.info(f"Полные данные обновления: {status_update.dict()}")
        
        # Проверка прав доступа
        if current_user.role not in [UserRole.ADMIN, UserRole.WAITER]:
            logger.warning(f"Пользователь {current_user.id} с ролью {current_user.role} попытался обновить статус заказа {order_id}")
            raise HTTPException(
                status_code=http_status.HTTP_403_FORBIDDEN,
                detail="Недостаточно прав для обновления статуса заказа"
            )
            
        # Проверяем, существует ли заказ
        existing_order = order_service.get_order_detailed(db, order_id)
        if not existing_order:
            logger.warning(f"Заказ с ID {order_id} не найден при попытке обновить статус")
            raise HTTPException(
                status_code=http_status.HTTP_404_NOT_FOUND,
                detail=f"Заказ с id {order_id} не найден"
            )
        
        # Валидируем статус - принимаем как верхний, так и нижний регистр
        valid_statuses = ["pending", "confirmed", "preparing", "ready", "completed", "cancelled"]
        valid_statuses_upper = [s.upper() for s in valid_statuses]
        
        # Нормализуем статус к нижнему регистру для обработки
        normalized_status = status_update.status.lower()
        
        # Проверяем соответствие допустимым статусам (регистр не имеет значения)
        if normalized_status not in valid_statuses:
            logger.warning(f"Недопустимый статус заказа: {status_update.status} (нормализованный: {normalized_status})")
            logger.warning(f"Разрешенные статусы: {', '.join(valid_statuses)}")
            raise HTTPException(
                status_code=http_status.HTTP_400_BAD_REQUEST,
                detail=f"Недопустимый статус заказа: {status_update.status}. Разрешены: {', '.join(valid_statuses)}"
            )
        
        # Создаем объект обновления с только статусом (всегда в нижнем регистре)
        update_data = {"status": normalized_status}
        logger.info(f"Данные для обновления заказа {order_id}: {update_data}")
        
        # Обновление статуса заказа
        updated_order = order_service.update_order(db, order_id, update_data)
        
        if not updated_order:
            logger.error(f"Не удалось обновить статус заказа {order_id}")
            raise HTTPException(
                status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Не удалось обновить статус заказа"
            )
            
        logger.info(f"Статус заказа {order_id} успешно обновлен на {normalized_status} пользователем {current_user.email}")
        
        # Добавляем информацию об успехе
        result = {
            "success": True,
            "message": f"Статус заказа успешно обновлен на {normalized_status}",
            "order": updated_order
        }
        
        return result
    except HTTPException as he:
        # Пробрасываем HTTP-исключения дальше
        logger.error(f"HTTP ошибка при обновлении статуса заказа {order_id}: {he.detail}")
        raise
    except Exception as e:
        # Логируем и обрабатываем общие исключения
        logger.exception(f"Непредвиденная ошибка при обновлении статуса заказа {order_id}: {str(e)}")
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Внутренняя ошибка сервера при обновлении статуса заказа: {str(e)}"
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
                status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Не удалось удалить заказ: {str(e)}"
            )
            
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Ошибка при удалении заказа {order_id}: {str(e)}")
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
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


@router.get("/raw/{order_id}")
def read_order_raw(
    *,
    db: Session = Depends(get_db),
    order_id: int,
    current_user: User = Depends(get_current_active_user)
):
    """
    Получение заказа по ID без валидации ответа (для отладки).
    Этот эндпоинт возвращает сырые данные заказа без преобразования в модель Pydantic.
    """
    try:
        logger.info(f"Запрос raw заказа ID {order_id}. Пользователь: {current_user.id}, роль: {current_user.role}")
        
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
        
        # Нормализуем данные и возвращаем их напрямую без валидации
        return order_data
        
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Ошибка при получении raw заказа {order_id}: {str(e)}")
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Внутренняя ошибка сервера: {str(e)}"
        )


# Эндпоинт для привязки заказа к официанту по QR-коду
@router.post("/{order_id}/assign", response_model=OrderReadSchema)
def assign_order_to_waiter(
    order_id: int = Path(..., description="ID заказа"),
    order_code: Dict[str, str] = Body(..., description="Код заказа из QR-кода"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Привязка заказа к официанту по QR-коду.
    
    Только пользователи с ролью `WAITER` или `ADMIN` могут привязывать заказы.
    Код заказа должен совпадать с кодом в QR-коде для подтверждения.
    """
    logging.info(f"Попытка привязки заказа #{order_id} к официанту {current_user.id} (роль: {current_user.role})")
    
    # Проверяем права пользователя
    if current_user.role not in [UserRole.WAITER, UserRole.ADMIN]:
        logging.warning(f"Отказано в доступе: пользователь {current_user.id} с ролью {current_user.role} пытается привязать заказ")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Только официанты или администраторы могут привязывать заказы",
        )
    
    # Получаем заказ
    order = order_service.get_order(db, order_id)
    if not order:
        logging.warning(f"Заказ #{order_id} не найден при попытке привязки к официанту {current_user.id}")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Заказ #{order_id} не найден",
        )
    
    # Проверяем код заказа из QR-кода
    if not order.order_code or order.order_code != order_code.get("order_code"):
        logging.warning(f"Неверный код заказа при привязке заказа #{order_id} к официанту {current_user.id}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Неверный код заказа. QR-код недействителен.",
        )
    
    # Проверяем, можно ли привязать заказ
    if order.status in [OrderStatus.COMPLETED, OrderStatus.CANCELLED]:
        logging.warning(f"Невозможно привязать заказ #{order_id} к официанту: заказ имеет статус {order.status}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Невозможно привязать заказ со статусом {order.status}",
        )
    
    # Обновляем waiter_id у заказа
    try:
        order.waiter_id = current_user.id
        
        # Если заказ в статусе PENDING, меняем его на CONFIRMED
        if order.status == OrderStatus.PENDING:
            order.status = OrderStatus.CONFIRMED
            logging.info(f"Статус заказа #{order_id} изменен с PENDING на CONFIRMED")
        
        db.commit()
        db.refresh(order)
        logging.info(f"Заказ #{order_id} успешно привязан к официанту {current_user.id}")
        
        return order
    except Exception as e:
        db.rollback()
        logging.error(f"Ошибка при привязке заказа #{order_id} к официанту {current_user.id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Ошибка при привязке заказа: {str(e)}",
        )


# Эндпоинт для получения заказов, привязанных к текущему официанту
@router.get("/waiter", response_model=List[OrderSchema])
def get_waiter_orders(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    status: Optional[str] = None,
):
    """Get orders for the current waiter."""
    logger.info(f"Getting waiter orders for user {current_user.id}, status: {status}")
    
    if current_user.role != UserRole.waiter:
        logger.error(f"User {current_user.id} is not a waiter")
        raise HTTPException(
            status_code=403, detail="Not enough permissions, waiter role required"
        )
    
    orders_query = db.query(Order).filter(Order.waiter_id == current_user.id)
    
    if status:
        try:
            order_status = OrderStatus[status]
            orders_query = orders_query.filter(Order.status == order_status)
        except KeyError:
            logger.error(f"Invalid order status: {status}")
            raise HTTPException(
                status_code=400, detail=f"Invalid order status: {status}"
            )
    
    try:
        orders = orders_query.all()
        result = []
        
        for order in orders:
            try:
                # Получаем блюда заказа
                order_dishes = db.query(OrderDish).filter(OrderDish.order_id == order.id).all()
                
                # Подготавливаем данные о блюдах
                items = []
                for order_dish in order_dishes:
                    dish = db.query(Dish).filter(Dish.id == order_dish.dish_id).first()
                    if dish:
                        items.append({
                            "id": order_dish.id,
                            "dish_id": order_dish.dish_id,
                            "name": dish.name,
                            "price": order_dish.price,
                            "quantity": order_dish.quantity,
                            "status": order_dish.status.name,
                            "waiter_id": order.waiter_id
                        })
                
                # Формируем данные заказа
                order_data = {
                    "id": order.id,
                    "table_id": order.table_id,
                    "waiter_id": order.waiter_id,
                    "status": order.status.name,
                    "created_at": order.created_at,
                    "total_price": order.total_price,
                    "payment_method": order.payment_method.name if order.payment_method else None,
                    "payment_status": order.payment_status,
                    "items": items
                }
                
                result.append(order_data)
            except Exception as e:
                logger.error(f"Error processing order {order.id}: {str(e)}")
                continue
        
        logger.info(f"Retrieved {len(result)} orders for waiter {current_user.id}")
        return result
    
    except Exception as e:
        logger.error(f"Error retrieving waiter orders: {str(e)}")
        raise HTTPException(
            status_code=500, detail=f"Error retrieving orders: {str(e)}"
        )


# Эндпоинт для привязки заказа к официанту по коду заказа
@router.post("/by-code/{code}/assign", response_model=OrderReadSchema)
def assign_order_to_waiter_by_code(
    code: str = Path(..., description="Код заказа"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Привязка заказа к официанту по коду заказа.
    
    Только пользователи с ролью `WAITER` или `ADMIN` могут привязывать заказы.
    """
    logging.info(f"Попытка привязки заказа по коду {code} к официанту {current_user.id} (роль: {current_user.role})")
    
    # Проверяем права пользователя
    if current_user.role not in [UserRole.WAITER, UserRole.ADMIN]:
        logging.warning(f"Отказано в доступе: пользователь {current_user.id} с ролью {current_user.role} пытается привязать заказ")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Только официанты или администраторы могут привязывать заказы",
        )
    
    # Получаем заказ по коду
    order = db.query(Order).filter(Order.order_code == code).first()
    if not order:
        logging.warning(f"Заказ с кодом '{code}' не найден при попытке привязки к официанту {current_user.id}")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Заказ с кодом '{code}' не найден",
        )
    
    # Проверяем, можно ли привязать заказ
    if order.status in [OrderStatus.COMPLETED, OrderStatus.CANCELLED]:
        logging.warning(f"Невозможно привязать заказ #{order.id} к официанту: заказ имеет статус {order.status}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Невозможно привязать заказ со статусом {order.status}",
        )
    
    # Проверяем, привязан ли заказ уже к другому официанту
    if order.waiter_id and order.waiter_id != current_user.id:
        waiter = db.query(User).filter(User.id == order.waiter_id).first()
        waiter_name = waiter.full_name if waiter else "Другой официант"
        
        logging.warning(f"Заказ #{order.id} уже привязан к официанту {waiter_name} (ID: {order.waiter_id})")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Заказ уже привязан к официанту: {waiter_name}",
        )
    
    # Обновляем waiter_id у заказа
    try:
        order.waiter_id = current_user.id
        
        # Если заказ в статусе PENDING, меняем его на CONFIRMED
        if order.status == OrderStatus.PENDING:
            order.status = OrderStatus.CONFIRMED
            logging.info(f"Статус заказа #{order.id} изменен с PENDING на CONFIRMED")
        
        db.commit()
        db.refresh(order)
        logging.info(f"Заказ #{order.id} успешно привязан к официанту {current_user.id}")
        
        return order
    except Exception as e:
        db.rollback()
        logging.error(f"Ошибка при привязке заказа #{order.id} к официанту {current_user.id} по коду: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Ошибка при привязке заказа: {str(e)}",
        ) 
