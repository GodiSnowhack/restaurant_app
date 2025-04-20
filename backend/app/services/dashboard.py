from datetime import datetime, date
from sqlalchemy import func
from app.models.order import Order
from app.models.user import User
from app.models.menu import Dish
from app.models.reservation import Reservation
from app.database.session import get_db

def get_dashboard_stats():
    db = next(get_db())
    
    # Получаем текущую дату
    today = date.today()
    
    # Заказы за сегодня
    orders_today = db.query(Order).filter(
        func.date(Order.created_at) == today
    ).count()
    
    # Всего заказов
    orders_total = db.query(Order).count()
    
    # Выручка за сегодня
    revenue = db.query(func.sum(Order.total_amount)).filter(
        func.date(Order.created_at) == today,
        Order.payment_status == 'paid'
    ).scalar() or 0
    
    # Бронирования на сегодня
    reservations_today = db.query(Reservation).filter(
        func.date(Reservation.reservation_time) == today
    ).count()
    
    # Количество пользователей
    users_count = db.query(User).count()
    
    # Количество блюд
    dishes_count = db.query(Dish).count()
    
    return {
        "ordersToday": orders_today,
        "ordersTotal": orders_total,
        "revenue": float(revenue),
        "reservationsToday": reservations_today,
        "users": users_count,
        "dishes": dishes_count
    } 