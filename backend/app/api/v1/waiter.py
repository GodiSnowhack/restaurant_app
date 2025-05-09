from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from typing import List
from app.database.session import get_db
from app.services.auth import get_current_user
from app.models.user import User
from app.models.order import Order, OrderStatus, PaymentStatus, OrderDish
from app.models.menu import Dish
from app.schemas.order import OrderResponse
import logging
from sqlalchemy.sql import text

router = APIRouter()

logger = logging.getLogger(__name__)

# Новый экстренный маршрут для принудительного обновления waiter_id
@router.post("/emergency-assign", status_code=200)
async def emergency_assign_order(
    order_code: str,
    waiter_id: int,
    db: Session = Depends(get_db)
):
    """
    ЭКСТРЕННЫЙ маршрут для принудительного обновления waiter_id.
    Выполняет прямой SQL запрос, минуя ORM и ограничения.
    """
    logger.warning(f"ЭКСТРЕННОЕ обновление заказа с кодом {order_code}, waiter_id={waiter_id}")
    
    try:
        # Получаем информацию о заказе
        check_query = text("SELECT id, status, waiter_id FROM orders WHERE order_code = :code")
        result = db.execute(check_query, {"code": order_code})
        order_data = result.fetchone()
        
        if not order_data:
            logger.error(f"Заказ с кодом {order_code} не найден")
            return {"success": False, "message": "Заказ не найден"}
        
        order_id = order_data[0]
        current_status = order_data[1]
        current_waiter_id = order_data[2]
        
        logger.info(f"Найден заказ: ID={order_id}, статус={current_status}, текущий waiter_id={current_waiter_id}")
        
        # Если уже привязан к этому официанту
        if current_waiter_id == waiter_id:
            return {
                "success": True, 
                "message": f"Заказ уже привязан к официанту {waiter_id}",
                "order_id": order_id,
                "waiter_id": waiter_id
            }
        
        # Определяем новый статус
        new_status = "confirmed" if current_status.lower() == "pending" else current_status
        
        # Выполняем SQL запрос с LOCK TABLE
        update_query = text("""
        BEGIN;
        LOCK TABLE orders IN EXCLUSIVE MODE;
        UPDATE orders 
        SET waiter_id = :waiter_id, 
            status = :status, 
            updated_at = NOW() 
        WHERE id = :order_id;
        COMMIT;
        """)
        
        db.execute(update_query, {
            "waiter_id": waiter_id,
            "status": new_status,
            "order_id": order_id
        })
        db.commit()
        
        # Проверяем результат
        verify_query = text("SELECT waiter_id FROM orders WHERE id = :order_id")
        verify_result = db.execute(verify_query, {"order_id": order_id})
        verify_data = verify_result.fetchone()
        
        if verify_data and verify_data[0] == waiter_id:
            logger.info(f"Заказ {order_id} успешно привязан к официанту {waiter_id}")
            return {
                "success": True,
                "message": f"Заказ успешно привязан к официанту {waiter_id}",
                "order_id": order_id,
                "waiter_id": waiter_id,
                "status": new_status
            }
        else:
            current_value = verify_data[0] if verify_data else None
            logger.error(f"Обновление не удалось! Текущее значение waiter_id = {current_value}")
            
            # Последняя отчаянная попытка
            try:
                logger.warning("Экстренная попытка через RAW SQL")
                raw_query = f"""
                UPDATE orders
                SET waiter_id = {waiter_id},
                    updated_at = NOW()
                WHERE id = {order_id}
                """
                db.execute(raw_query)
                db.commit()
                
                return {
                    "success": True,
                    "message": "Заказ привязан экстренным методом",
                    "order_id": order_id,
                    "waiter_id": waiter_id,
                    "status": new_status
                }
            except Exception as raw_error:
                logger.critical(f"Экстренная попытка не удалась: {str(raw_error)}")
                
            return {
                "success": False,
                "message": "Не удалось обновить заказ. Обратитесь к администратору.",
                "current_value": current_value
            }
    
    except Exception as e:
        logger.error(f"Ошибка при экстренном обновлении: {str(e)}")
        db.rollback()
        return {"success": False, "message": f"Ошибка: {str(e)}"}

def normalize_status(status):
    """Нормализует статус заказа"""
    if not status:
        return "pending"
    
    # Приводим к нижнему регистру
    status = str(status).lower()
    
    # Маппинг статусов
    status_mapping = {
        "new": "new",
        "confirmed": "confirmed",
        "cooking": "cooking",
        "preparing": "preparing",
        "in_progress": "in_progress",
        "ready": "ready",
        "delivered": "delivered",
        "completed": "completed",
        "cancelled": "cancelled",
        "pending": "pending"
    }
    
    return status_mapping.get(status, "pending")

@router.get("/orders", response_model=List[OrderResponse])
async def get_waiter_orders(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    try:
        logger.info(f"Получение заказов для пользователя ID: {current_user.id}, роль: {current_user.role}")
        
        # Проверяем роль пользователя
        if current_user.role not in ["waiter", "admin"]:
            logger.warning(f"Отказано в доступе пользователю {current_user.id} с ролью {current_user.role}")
            raise HTTPException(
                status_code=403,
                detail="Недостаточно прав для просмотра заказов"
            )
        
        # Получаем заказы с помощью join
        query = (
            db.query(Order)
            .options(joinedload(Order.order_dishes).joinedload(OrderDish.dish))
        )
        
        if current_user.role == "admin":
            orders = query.order_by(Order.created_at.desc()).all()
            logger.info(f"Администратор {current_user.id} запросил все заказы")
        else:
            orders = query.filter(
                Order.waiter_id == current_user.id
            ).order_by(Order.created_at.desc()).all()
            logger.info(f"Официант {current_user.id} запросил свои заказы")
        
        if not orders:
            logger.info(f"Заказы для пользователя {current_user.id} не найдены")
            return []
            
        result = []
        for order in orders:
            try:
                # Получаем блюда из заказа
                items = []
                total_amount = 0
                
                logger.info(f"Обработка заказа ID:{order.id}, количество блюд: {len(order.order_dishes)}")
                
                for order_dish in order.order_dishes:
                    try:
                        dish = order_dish.dish
                        if not dish:
                            logger.warning(f"Блюдо не найдено для order_dish.id={order_dish.id}")
                            # Добавляем заглушку для удаленного блюда
                            dish_item = {
                                "id": order_dish.id,
                                "dish_id": order_dish.dish_id,
                                "name": f"Блюдо #{order_dish.dish_id} (удалено)",
                                "dish_name": f"Блюдо #{order_dish.dish_id} (удалено)",
                                "dish_image": "",
                                "price": float(order_dish.price),
                                "price_formatted": f"{float(order_dish.price)} ₸",
                                "quantity": int(order_dish.quantity),
                                "total_price": float(order_dish.price) * int(order_dish.quantity),
                                "total_price_formatted": f"{float(order_dish.price) * int(order_dish.quantity)} ₸",
                                "special_instructions": order_dish.special_instructions or "",
                                "order_id": order.id
                            }
                        else:
                            dish_price = float(order_dish.price)
                            quantity = int(order_dish.quantity)
                            
                            # Рассчитываем стоимость позиции
                            item_total = dish_price * quantity
                            total_amount += item_total
                            
                            # Создаем позицию заказа
                            dish_item = {
                                "id": order_dish.id,
                                "dish_id": dish.id,
                                "name": dish.name,
                                "dish_name": dish.name,
                                "dish_image": dish.image_url or "",
                                "price": dish_price,
                                "price_formatted": f"{dish_price} ₸",
                                "quantity": quantity,
                                "total_price": item_total,
                                "total_price_formatted": f"{item_total} ₸",
                                "special_instructions": order_dish.special_instructions or "",
                                "order_id": order.id,
                                "description": dish.description or "",
                                "category_id": dish.category_id
                            }
                        
                        items.append(dish_item)
                        logger.debug(f"Добавлено блюдо {dish_item['name']} к заказу {order.id}")
                    except Exception as e:
                        logger.error(f"Ошибка при обработке блюда заказа {order.id}: {str(e)}")
                        continue
                
                # Если сумма в БД отличается от рассчитанной, обновляем её
                if not order.total_amount or abs(order.total_amount - total_amount) > 0.01:
                    try:
                        db.query(Order).filter(Order.id == order.id).update({"total_amount": total_amount})
                        db.commit()
                        logger.info(f"Обновлена сумма заказа ID:{order.id} в БД: {total_amount}")
                    except Exception as e:
                        logger.error(f"Ошибка при обновлении суммы заказа ID:{order.id}: {str(e)}")
                
                # Нормализуем статусы
                status = normalize_status(order.status)
                payment_status = str(order.payment_status).lower() if order.payment_status else "pending"
                payment_method = str(order.payment_method).lower() if order.payment_method else None
                
                # Формируем данные заказа
                order_data = {
                    "id": order.id,
                    "table_number": order.table_number or 0,
                    "status": status,
                    "order_status": status,
                    "payment_status": payment_status,
                    "payment_method": payment_method,
                    "waiter_id": order.waiter_id,
                    "user_id": order.user_id,
                    "created_at": order.created_at,
                    "updated_at": order.updated_at,
                    "completed_at": order.completed_at,
                    "items": items,
                    "total": total_amount,
                    "total_price": total_amount,
                    "total_amount": total_amount,
                    "total_sum": total_amount,
                    "total_formatted": f"{total_amount} ₸",
                    "total_price_formatted": f"{total_amount} ₸",
                    "total_amount_formatted": f"{total_amount} ₸",
                    "total_sum_formatted": f"{total_amount} ₸",
                    "customer_name": order.customer_name or "Клиент",
                    "customer_phone": order.customer_phone or "",
                    "name": order.customer_name or "Клиент",
                    "phone": order.customer_phone or "",
                    "order_type": "dine-in",
                    "comment": order.comment,
                    "is_urgent": order.is_urgent,
                    "is_group_order": order.is_group_order,
                    "reservation_code": order.reservation_code,
                    "order_code": order.order_code
                }
                result.append(order_data)
                logger.info(f"Заказ ID:{order.id} успешно обработан, блюд: {len(items)}")
            except Exception as e:
                logger.error(f"Ошибка при обработке заказа {order.id}: {str(e)}")
                continue
            
        logger.info(f"Успешно получено {len(result)} заказов для пользователя {current_user.id}")
        return result
        
    except Exception as e:
        logger.error(f"Ошибка при получении заказов пользователя: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Ошибка получения заказов: {str(e)}")

@router.post("/orders/{order_id}/take")
async def take_order(
    order_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if current_user.role != "waiter" and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Not enough permissions")
    
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    if order.waiter_id is not None and current_user.role != "admin":
        raise HTTPException(status_code=400, detail="Order is already taken by another waiter")
    
    order.waiter_id = current_user.id
    order.status = OrderStatus.PROCESSING
    db.commit()
    
    return {"message": "Order taken successfully"}

@router.post("/orders/{order_id}/confirm-payment")
async def confirm_payment(
    order_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if current_user.role != "waiter" and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Not enough permissions")
    
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    # Администратор может подтверждать любой заказ, официант только свои
    if current_user.role != "admin" and order.waiter_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized for this order")
    
    order.payment_status = PaymentStatus.PAID
    db.commit()
    
    return {"status": "success", "message": "Payment confirmed"}

@router.post("/orders/{order_id}/complete")
async def complete_order(
    order_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if current_user.role != "waiter" and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Not enough permissions")
    
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    # Администратор может завершать любой заказ, официант только свои
    if current_user.role != "admin" and order.waiter_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized for this order")
    
    order.status = OrderStatus.COMPLETED
    db.commit()
    
    return {"status": "success", "message": "Order completed"} 