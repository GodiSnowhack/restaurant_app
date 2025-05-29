from typing import Any, List
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
import logging
from datetime import datetime, timedelta

from app.schemas.orders import OrderCreate, OrderOut
from app.services.orders import create_order
from app.models.user import User, UserRole
from app.database.session import get_db
from app.core.auth import get_current_user
from app.services import order as order_service

# Настройка логирования
logger = logging.getLogger(__name__)

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
    Получение списка заказов
    
    Параметры:
    - status: фильтр по статусу заказа
    - user_id: фильтр по ID пользователя
    - start_date: начальная дата для выборки (формат YYYY-MM-DD)
    - end_date: конечная дата для выборки (формат YYYY-MM-DD)
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
            # Используем сервисную функцию для получения заказов
            orders_data = order_service.get_orders(
                db=db, 
                skip=skip, 
                limit=limit, 
                status=status, 
                user_id=user_id,
                start_date=start_date,
                end_date=end_date
            )
            
            # Проверяем, что функция вернула список, а не объект
            if not isinstance(orders_data, list):
                logger.warning("Сервис вернул не список. Преобразуем в список.")
                if orders_data and isinstance(orders_data, dict):
                    orders_data = [orders_data]
                else:
                    orders_data = []
            
            logger.info(f"Успешно получено {len(orders_data)} заказов для ответа")
            return orders_data
                
        except Exception as e:
            logger.error(f"Ошибка при получении заказов: {str(e)}")
            logger.exception(e)
            # Возвращаем пустой список вместо ошибки
            return []
            
    except Exception as e:
        logger.exception(f"Ошибка при получении списка заказов: {str(e)}")
        # Возвращаем пустой список вместо ошибки
        return []

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