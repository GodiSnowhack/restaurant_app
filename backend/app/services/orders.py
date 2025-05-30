from sqlalchemy.orm import Session
from typing import List, Dict, Any, Optional
from datetime import datetime
import logging
from app.schemas.orders import OrderCreate
from app.models.order import Order, OrderDish
from sqlalchemy import and_, or_, func, desc

# Настройка логгера
logger = logging.getLogger(__name__)

def create_order(db: Session, user_id: int, order_in: OrderCreate) -> Order:
    """
    Создание нового заказа
    """
    # Временная заглушка для тестирования
    return Order(
        id=1,
        user_id=user_id,
        table_number=order_in.table_number,
        status=order_in.status,
        total_amount=100.0
    )

def get_orders(
    db: Session,
    skip: int = 0,
    limit: int = 100,
    status: Optional[str] = None,
    user_id: Optional[int] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None
) -> List[Dict[str, Any]]:
    """
    Получение списка заказов с возможностью фильтрации
    
    Args:
        db: Сессия базы данных
        skip: Количество записей для пропуска
        limit: Максимальное количество записей для возврата
        status: Фильтр по статусу заказа (если указан)
        user_id: Фильтр по ID пользователя (если указан)
        start_date: Начальная дата для выборки (если указана)
        end_date: Конечная дата для выборки (если указана)
        
    Returns:
        Список словарей с данными заказов
    """
    try:
        logger.info(f"Получение заказов с параметрами: skip={skip}, limit={limit}, status={status}, user_id={user_id}, start_date={start_date}, end_date={end_date}")
        
        # Формируем запрос к базе данных
        query = db.query(Order)
        
        # Добавляем условия фильтрации
        if status:
            query = query.filter(func.lower(Order.status) == func.lower(status))
        
        if user_id:
            query = query.filter(Order.user_id == user_id)
        
        # Фильтрация по дате создания
        if start_date:
            try:
                start_date_obj = datetime.fromisoformat(start_date.replace('Z', '+00:00'))
                query = query.filter(Order.created_at >= start_date_obj)
            except ValueError as e:
                logger.error(f"Ошибка при преобразовании начальной даты: {e}")
                
        if end_date:
            try:
                end_date_obj = datetime.fromisoformat(end_date.replace('Z', '+00:00'))
                query = query.filter(Order.created_at <= end_date_obj)
            except ValueError as e:
                logger.error(f"Ошибка при преобразовании конечной даты: {e}")
        
        # Сортировка по дате создания (сначала новые)
        query = query.order_by(desc(Order.created_at))
        
        # Добавляем пагинацию
        query = query.offset(skip).limit(limit)
        
        # Выполняем запрос
        orders = query.all()
        logger.info(f"Найдено {len(orders)} заказов")
        
        # Преобразуем объекты Order в словари
        result = []
        for order in orders:
            # Получаем позиции заказа
            order_dishes = db.query(OrderDish).filter(OrderDish.order_id == order.id).all()
            
            # Формируем список позиций
            items = []
            for item in order_dishes:
                items.append({
                    "id": item.id,
                    "dish_id": item.dish_id,
                    "name": item.dish_name,
                    "quantity": item.quantity,
                    "price": float(item.price),
                    "total_price": float(item.price * item.quantity),
                    "special_instructions": item.special_instructions or ""
                })
            
            # Формируем словарь с данными заказа
            order_dict = {
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
                "items": items
            }
            
            result.append(order_dict)
        
        return result
    
    except Exception as e:
        logger.error(f"Ошибка при получении заказов: {str(e)}")
        # В случае ошибки возвращаем пустой список
        return [] 