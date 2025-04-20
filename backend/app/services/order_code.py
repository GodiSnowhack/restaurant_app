import random
import string
from typing import List, Optional
from sqlalchemy.orm import Session

from app.models.order_code import OrderCode
from app.schemas.order_code import OrderCodeCreate, OrderCodeUpdate


def generate_unique_code(db: Session, length: int = 6) -> str:
    """Генерирует уникальный код для заказа"""
    while True:
        # Генерируем случайный код из цифр
        code = ''.join(random.choices(string.digits, k=length))
        
        # Проверяем, что такого кода еще нет в базе
        existing_code = db.query(OrderCode).filter(OrderCode.code == code).first()
        if not existing_code:
            return code


def create_order_code(db: Session, order_code: OrderCodeCreate) -> OrderCode:
    """Создание нового кода заказа"""
    # Генерируем уникальный код, если не предоставлен
    if not order_code.code:
        code = generate_unique_code(db)
    else:
        code = order_code.code
    
    db_order_code = OrderCode(
        code=code,
        table_number=order_code.table_number,
        waiter_id=order_code.waiter_id,
        is_used=False
    )
    
    db.add(db_order_code)
    db.commit()
    db.refresh(db_order_code)
    
    return db_order_code


def get_order_code(db: Session, code_id: int) -> Optional[OrderCode]:
    """Получение кода заказа по ID"""
    return db.query(OrderCode).filter(OrderCode.id == code_id).first()


def get_order_code_by_code(db: Session, code: str) -> Optional[OrderCode]:
    """Получение кода заказа по значению кода"""
    return db.query(OrderCode).filter(OrderCode.code == code).first()


def get_order_codes(
    db: Session, 
    skip: int = 0, 
    limit: int = 100,
    waiter_id: Optional[int] = None,
    is_used: Optional[bool] = None
) -> List[OrderCode]:
    """Получение списка кодов заказов с фильтрацией"""
    query = db.query(OrderCode)
    
    if waiter_id is not None:
        query = query.filter(OrderCode.waiter_id == waiter_id)
    
    if is_used is not None:
        query = query.filter(OrderCode.is_used == is_used)
    
    # Сортируем по дате создания (новые - сначала)
    query = query.order_by(OrderCode.created_at.desc())
    
    return query.offset(skip).limit(limit).all()


def update_order_code(db: Session, code_id: int, code_update: OrderCodeUpdate) -> Optional[OrderCode]:
    """Обновление кода заказа"""
    db_code = get_order_code(db, code_id)
    
    if not db_code:
        return None
    
    # Обновляем поля
    update_data = code_update.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_code, key, value)
    
    db.commit()
    db.refresh(db_code)
    
    return db_code


def mark_code_as_used(db: Session, code: str, order_id: int) -> Optional[OrderCode]:
    """Отмечает код как использованный для конкретного заказа"""
    db_code = get_order_code_by_code(db, code)
    
    if not db_code or db_code.is_used:
        return None
    
    db_code.is_used = True
    db_code.order_id = order_id
    
    db.commit()
    db.refresh(db_code)
    
    return db_code


def delete_order_code(db: Session, code_id: int) -> bool:
    """Удаление кода заказа"""
    db_code = get_order_code(db, code_id)
    
    if not db_code:
        return False
    
    db.delete(db_code)
    db.commit()
    
    return True 