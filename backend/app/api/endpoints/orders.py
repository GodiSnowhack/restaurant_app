from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.core.security import get_current_active_user
from app.database.session import get_db
from app.models.user import UserRole
from app import crud, models, schemas

router = APIRouter()

@router.get("/", response_model=List[schemas.Order])
def read_orders(
    db: Session = Depends(get_db),
    status: Optional[str] = None,
    start_date: Optional[datetime] = Query(None),
    end_date: Optional[datetime] = Query(None),
    user_id: Optional[int] = None,
    table_number: Optional[int] = None,
    current_user: models.User = Depends(get_current_active_user)
):
    """
    Получить список всех заказов с опциональной фильтрацией
    """
    # Логирование для отладки
    print(f"API запрос заказов с параметрами: status={status}, start_date={start_date}, end_date={end_date}, user_id={user_id}")
    
    if current_user.role not in [UserRole.ADMIN, UserRole.WAITER]:
        # Обычные пользователи могут видеть только свои заказы
        user_id = current_user.id
    
    # Получаем заказы с фильтрацией
    orders = crud.order.get_multi_filtered(
        db=db, 
        status=status, 
        start_date=start_date,
        end_date=end_date,
        user_id=user_id,
        table_number=table_number
    )
    
    # Подробное логирование заказов для отладки
    print(f"Найдено {len(orders)} заказов с фильтрами: status={status}, date range={start_date} to {end_date}, user_id={user_id}")
    for order in orders:
        print(f"Order ID: {order.id}, Status: {order.status}, User ID: {order.user_id}, Table: {order.table_number}, Created: {order.created_at}")
    
    return orders

@router.post("/", response_model=schemas.Order)
def create_order(
    *,
    db: Session = Depends(get_db),
    order_in: schemas.OrderCreate,
    current_user: models.User = Depends(get_current_active_user)
):
    """
    Создать новый заказ
    """
    # Если не указан пользователь, используем текущего пользователя
    if not order_in.user_id and current_user:
        order_in.user_id = current_user.id
        
    # Логирование данных заказа для отладки
    print(f"Создание заказа с данными: {order_in.dict()}")
    
    # Используем специальный метод для создания заказа с элементами
    order = crud.order.create_with_items(db=db, obj_in=order_in)
    
    # Добавляем информацию о пользователе для ответа API
    if order.user_id:
        order.user = db.query(models.User).filter(models.User.id == order.user_id).first()
    
    print(f"Создан заказ ID: {order.id}")
    return order

@router.get("/{order_id}", response_model=schemas.Order)
def read_order(
    *,
    db: Session = Depends(get_db),
    order_id: int,
    current_user: models.User = Depends(get_current_active_user)
):
    """
    Получить информацию о конкретном заказе
    """
    order = crud.order.get(db=db, id=order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    # Проверяем права доступа
    if current_user.role not in [UserRole.ADMIN, UserRole.WAITER]:
        user_id = current_user.id
    
    # Проверяем права доступа
    if current_user.role not in [UserRole.ADMIN, UserRole.WAITER] and order.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="У вас нет прав для просмотра этого заказа"
        )
        
    return order

@router.put("/{order_id}", response_model=schemas.Order)
def update_order(
    *,
    db: Session = Depends(get_db),
    order_id: int,
    order_in: schemas.OrderUpdate,
    current_user: models.User = Depends(get_current_active_user)
):
    """
    Обновить информацию о заказе
    """
    order = crud.order.get(db=db, id=order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    # Проверяем права доступа
    if current_user.role not in [UserRole.ADMIN, UserRole.WAITER]:
        user_id = current_user.id
    
    # Проверяем права доступа
    if current_user.role not in [UserRole.ADMIN, UserRole.WAITER] and order.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="У вас нет прав для изменения этого заказа"
        )
    
    # Логирование для отладки
    print(f"Обновление заказа {order_id} с данными: {order_in.dict(exclude_unset=True)}")
    
    order = crud.order.update(db=db, db_obj=order, obj_in=order_in)
    return order 