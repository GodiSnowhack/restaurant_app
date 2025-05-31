from sqlalchemy.orm import Session
from typing import List, Dict, Any, Optional
from datetime import datetime
import logging
from app.schemas.orders import OrderCreate
from app.models.order import Order, OrderDish
from app.models.menu import Dish
from sqlalchemy import and_, or_, func, desc
import uuid

# Настройка логгера
logger = logging.getLogger(__name__)

def create_order(db: Session, user_id: int, order_in: OrderCreate) -> Dict[str, Any]:
    """
    Создание нового заказа в базе данных
    
    Args:
        db: Сессия базы данных
        user_id: ID пользователя, создающего заказ
        order_in: Данные заказа
        
    Returns:
        Созданный заказ в виде словаря
    """
    try:
        logger.info(f"Создание нового заказа для пользователя {user_id}")
        logger.debug(f"Данные заказа: {order_in.dict()}")
        
        # Генерируем уникальный код заказа
        order_code = str(uuid.uuid4())[:6].upper()
        
        # Определяем номер стола
        table_number = None
        
        # Если есть код бронирования, получаем номер стола из таблицы reservations
        if order_in.reservation_code:
            from app.services.reservation import get_reservation_by_code
            reservation = get_reservation_by_code(db, order_in.reservation_code)
            if reservation:
                table_number = reservation.table_number
                logger.info(f"Получен номер стола {table_number} из бронирования {order_in.reservation_code}")
        
        # Если номер стола не найден, используем значение по умолчанию
        if table_number is None:
            table_number = 1
            logger.info(f"Номер стола не найден, используем значение по умолчанию: {table_number}")
        
        # Создаем объект заказа
        db_order = Order(
            user_id=user_id,
            table_number=table_number,
            status=order_in.status,
            payment_status="pending",
            payment_method="cash",  # Значение по умолчанию
            total_amount=0.0,
            order_code=order_code,
            reservation_code=order_in.reservation_code,
            customer_name=order_in.customer_name,
            customer_phone=order_in.customer_phone,
            comment=order_in.comment,
            is_urgent=order_in.is_urgent,
            is_group_order=order_in.is_group_order
        )
        
        db.add(db_order)
        db.flush()  # Для получения ID заказа
        
        # Вычисляем общую сумму заказа
        total_amount = 0.0
        processed_dishes = []
        
        # Обрабатываем обычные dishes (только ID блюд)
        if order_in.dishes:
            logger.info(f"Обработка блюд из dishes: {order_in.dishes}")
            for dish_id in order_in.dishes:
                # Получаем блюдо из базы данных
                dish = db.query(Dish).filter(Dish.id == dish_id).first()
                if dish:
                    # Создаем связь между заказом и блюдом (количество = 1 по умолчанию)
                    order_dish = OrderDish(
                        order_id=db_order.id,
                        dish_id=dish_id,
                        quantity=1,  # По умолчанию 1
                        price=dish.price,  # Цена из блюда
                        special_instructions=""
                    )
                    db.add(order_dish)
                    
                    # Добавляем стоимость блюда к общей сумме
                    total_amount += float(dish.price)
                    
                    # Добавляем информацию о блюде в список обработанных
                    processed_dishes.append({
                        "id": dish.id,
                        "dish_id": dish.id,
                        "name": dish.name,
                        "price": float(dish.price),
                        "quantity": 1,
                        "special_instructions": "",
                        "total_price": float(dish.price)
                    })
        
        # Обрабатываем items (объекты с dish_id и quantity)
        if order_in.items:
            logger.info(f"Обработка блюд из items: {[item.dict() for item in order_in.items]}")
            for item in order_in.items:
                # Получаем блюдо из базы данных
                dish = db.query(Dish).filter(Dish.id == item.dish_id).first()
                if dish:
                    # Создаем связь между заказом и блюдом с указанным количеством
                    order_dish = OrderDish(
                        order_id=db_order.id,
                        dish_id=item.dish_id,
                        quantity=item.quantity,
                        price=dish.price,  # Цена из блюда
                        special_instructions=item.special_instructions or ""
                    )
                    db.add(order_dish)
                    
                    # Добавляем стоимость блюда * количество к общей сумме
                    item_total = float(dish.price) * item.quantity
                    total_amount += item_total
                    
                    # Добавляем информацию о блюде в список обработанных
                    processed_dishes.append({
                        "id": dish.id,
                        "dish_id": dish.id,
                        "name": dish.name,
                        "price": float(dish.price),
                        "quantity": item.quantity,
                        "special_instructions": item.special_instructions or "",
                        "total_price": item_total
                    })
        
        # Обновляем общую сумму заказа
        db_order.total_amount = total_amount
        logger.info(f"Общая сумма заказа: {total_amount}")
        
        # Сохраняем изменения
        db.commit()
        db.refresh(db_order)
        
        logger.info(f"Заказ успешно создан, ID: {db_order.id}")
        
        # Форматируем ответ в виде словаря для правильной сериализации
        result = {
            "id": db_order.id,
            "user_id": db_order.user_id,
            "waiter_id": db_order.waiter_id,
            "table_number": db_order.table_number,
            "status": db_order.status,
            "payment_status": db_order.payment_status,
            "payment_method": db_order.payment_method,
            "total_amount": float(db_order.total_amount),
            "comment": db_order.comment,
            "special_instructions": db_order.comment,
            "created_at": db_order.created_at.isoformat() if db_order.created_at else datetime.utcnow().isoformat(),
            "updated_at": db_order.updated_at.isoformat() if db_order.updated_at else None,
            "completed_at": db_order.completed_at.isoformat() if db_order.completed_at else None,
            "customer_name": db_order.customer_name,
            "customer_phone": db_order.customer_phone,
            "order_code": db_order.order_code,
            "is_urgent": db_order.is_urgent or False,
            "is_group_order": db_order.is_group_order or False,
            "items": processed_dishes
        }
        
        return result
        
    except Exception as e:
        db.rollback()
        logger.error(f"Ошибка при создании заказа: {str(e)}")
        raise

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
                # Получаем связанное блюдо, чтобы извлечь его название
                dish = db.query(Dish).filter(Dish.id == item.dish_id).first()
                dish_name = dish.name if dish else f"Блюдо #{item.dish_id}"
                
                items.append({
                    "id": item.id,
                    "dish_id": item.dish_id,
                    "name": dish_name,
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