from typing import List, Dict, Any
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.models.user import User, UserRole
from app.core.security import get_current_active_user
from app.services import analytics

router = APIRouter()


@router.get("/sales", response_model=List[Dict[str, Any]])
def get_sales_statistics(
    start_date: datetime = Query(None),
    end_date: datetime = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Получение статистики продаж за период
    """
    # Проверяем права доступа: только администратор может просматривать статистику
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    
    # Если даты не указаны, используем последний месяц
    if not start_date:
        start_date = datetime.now() - timedelta(days=30)
    if not end_date:
        end_date = datetime.now()
    
    return analytics.get_sales_by_period(db, start_date, end_date)


@router.get("/top-dishes", response_model=List[Dict[str, Any]])
def get_top_dishes(
    limit: int = 10,
    start_date: datetime = Query(None),
    end_date: datetime = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Получение топа самых популярных блюд
    """
    # Проверяем права доступа: только администратор может просматривать статистику
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    
    return analytics.get_top_dishes(db, limit, start_date, end_date)


@router.get("/revenue-by-category", response_model=List[Dict[str, Any]])
def get_revenue_by_category(
    start_date: datetime = Query(None),
    end_date: datetime = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Получение выручки по категориям блюд
    """
    # Проверяем права доступа: только администратор может просматривать статистику
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    
    return analytics.get_revenue_by_category(db, start_date, end_date)


@router.get("/dashboard", response_model=Dict[str, Any])
def get_dashboard_statistics(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Получение общей статистики для дашборда администратора
    """
    # Проверяем права доступа: только администратор может просматривать статистику
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    
    # Получаем статистику за последние 30 дней
    end_date = datetime.now()
    start_date = end_date - timedelta(days=30)
    
    # Получаем статистику по заказам за последние 30 дней
    daily_orders = analytics.get_daily_orders(db, days=30)
    
    # Получаем среднюю стоимость заказа
    avg_order_value = analytics.get_avg_order_value(db)
    
    # Получаем статистику по пользователям
    user_stats = analytics.get_user_stats(db)
    
    # Получаем статистику по бронированиям
    reservation_stats = analytics.get_reservation_stats(db)
    
    # Формируем общий ответ
    return {
        "avg_order_value": avg_order_value,
        "daily_orders": daily_orders,
        "user_stats": user_stats,
        "reservation_stats": reservation_stats
    } 