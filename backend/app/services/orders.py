from sqlalchemy.orm import Session
from app.schemas.orders import OrderCreate
from app.models.order import Order

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
        total_price=100.0
    ) 