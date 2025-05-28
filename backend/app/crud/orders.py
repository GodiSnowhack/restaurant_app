from typing import List, Optional, Dict, Any, Union
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, func
from datetime import datetime, timedelta

from ..models.order import Order, OrderDish
from ..models.user import User
from ..schemas.orders import OrderCreate, OrderUpdate, OrderResponse

# Получить все заказы с фильтрацией
def get_all_orders(
    db: Session, 
    skip: int = 0, 
    limit: int = 100, 
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    status: Optional[str] = None,
    user_id: Optional[int] = None,
    current_user: Optional[User] = None
) -> List[Order]:
    """
    Получить все заказы с возможностью фильтрации по датам и статусу.
    Если указан current_user и он не админ, возвращаем только его заказы.
    """
    query = db.query(Order)
    
    # Применяем фильтры
    if start_date:
        query = query.filter(Order.created_at >= start_date)
    
    if end_date:
        query = query.filter(Order.created_at <= end_date)
    
    if status:
        query = query.filter(Order.status == status)
    
    if user_id:
        query = query.filter(Order.user_id == user_id)
    
    # Проверяем права доступа
    if current_user and current_user.role.lower() != "admin":
        # Если пользователь не админ, он может видеть только свои заказы
        # или заказы, где он официант
        query = query.filter(
            or_(
                Order.user_id == current_user.id,
                Order.waiter_id == current_user.id
            )
        )
    
    # Сортировка и пагинация
    return query.order_by(Order.created_at.desc()).offset(skip).limit(limit).all()

# Получить заказ по ID
def get_order_by_id(db: Session, order_id: int) -> Optional[Order]:
    """Получить заказ по его ID"""
    return db.query(Order).filter(Order.id == order_id).first()

# Создать новый заказ
def create_order(db: Session, order_create: OrderCreate, user_id: Optional[int] = None) -> Order:
    """Создать новый заказ"""
    # Рассчитываем итоговую сумму заказа
    total_amount = sum(item.price * item.quantity for item in order_create.items)
    
    # Создаем новый заказ
    db_order = Order(
        user_id=user_id or order_create.user_id,
        waiter_id=order_create.waiter_id,
        table_number=order_create.table_number,
        payment_method=order_create.payment_method.value if order_create.payment_method else None,
        customer_name=order_create.customer_name,
        customer_phone=order_create.customer_phone,
        reservation_code=order_create.reservation_code,
        order_code=order_create.order_code,
        status=order_create.status.value,
        payment_status=order_create.payment_status.value,
        total_amount=total_amount,
        comment=order_create.comment,
        is_urgent=order_create.is_urgent,
        is_group_order=order_create.is_group_order,
        customer_age_group=order_create.customer_age_group,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow()
    )
    
    # Добавляем заказ в базу данных
    db.add(db_order)
    db.commit()
    db.refresh(db_order)
    
    # Добавляем элементы заказа
    for item in order_create.items:
        db_order_item = OrderDish(
            order_id=db_order.id,
            dish_id=item.dish_id,
            quantity=item.quantity,
            price=item.price,
            special_instructions=item.special_instructions,
            created_at=datetime.utcnow()
        )
        db.add(db_order_item)
    
    db.commit()
    db.refresh(db_order)
    
    return db_order

# Обновить заказ
def update_order(db: Session, order_id: int, order_update: OrderUpdate) -> Optional[Order]:
    """Обновить заказ по его ID"""
    db_order = get_order_by_id(db, order_id)
    if not db_order:
        return None
    
    # Обновляем только предоставленные поля
    update_data = order_update.dict(exclude_unset=True)
    
    # Обрабатываем enum значения
    if "payment_method" in update_data and update_data["payment_method"]:
        update_data["payment_method"] = update_data["payment_method"].value
    
    if "status" in update_data and update_data["status"]:
        update_data["status"] = update_data["status"].value
        # Если статус изменен на "completed", устанавливаем время завершения
        if update_data["status"] == "completed" and db_order.status != "completed":
            update_data["completed_at"] = datetime.utcnow()
    
    if "payment_status" in update_data and update_data["payment_status"]:
        update_data["payment_status"] = update_data["payment_status"].value
    
    # Обновляем время изменения
    update_data["updated_at"] = datetime.utcnow()
    
    # Применяем обновления к объекту заказа
    for key, value in update_data.items():
        setattr(db_order, key, value)
    
    db.commit()
    db.refresh(db_order)
    
    return db_order

# Удалить заказ
def delete_order(db: Session, order_id: int) -> bool:
    """Удалить заказ по его ID"""
    db_order = get_order_by_id(db, order_id)
    if not db_order:
        return False
    
    db.delete(db_order)
    db.commit()
    
    return True

# Получить статистику заказов
def get_orders_stats(
    db: Session, 
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None
) -> Dict[str, Any]:
    """Получить статистику заказов за указанный период"""
    query = db.query(Order)
    
    if start_date:
        query = query.filter(Order.created_at >= start_date)
    
    if end_date:
        query = query.filter(Order.created_at <= end_date)
    
    # Общее количество заказов
    total_orders = query.count()
    
    # Статистика по статусам
    status_stats = {}
    for status in ["pending", "confirmed", "preparing", "ready", "completed", "cancelled"]:
        count = query.filter(Order.status == status).count()
        status_stats[status] = count
    
    # Статистика по методам оплаты
    payment_method_stats = {}
    for method in ["card", "cash", "online"]:
        count = query.filter(Order.payment_method == method).count()
        payment_method_stats[method] = count
    
    # Общая сумма заказов
    total_amount = db.query(func.sum(Order.total_amount)).filter(Order.status != "cancelled").scalar() or 0
    
    return {
        "total_orders": total_orders,
        "status_stats": status_stats,
        "payment_method_stats": payment_method_stats,
        "total_amount": total_amount
    } 