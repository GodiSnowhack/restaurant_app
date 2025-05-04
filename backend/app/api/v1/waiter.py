from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.database.session import get_db
from app.services.auth import get_current_user
from app.models.user import User
from app.models.order import Order, OrderStatus, PaymentStatus
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

@router.get("/orders", response_model=List[OrderResponse])
async def get_waiter_orders(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if current_user.role != "waiter":
        raise HTTPException(status_code=403, detail="Not enough permissions")
    
    try:
        logger.info(f"Получение заказов для официанта ID: {current_user.id}")
        
        # Получаем заказы официанта, отсортированные по времени создания
        orders = db.query(Order).filter(
            Order.waiter_id == current_user.id
        ).order_by(Order.created_at.desc()).all()
        
        if not orders:
            logger.info(f"Заказы для официанта {current_user.id} не найдены")
            return []
            
        result = []
        for order in orders:
            # Получаем блюда из заказа
            items = []
            
            # Рассчитываем общую сумму
            total_amount = 0
            
            for order_dish in order.order_dishes:
                try:
                    # Получаем информацию о блюде
                    dish = order_dish.dish
                    dish_name = dish.name if dish else f"Блюдо #{order_dish.dish_id}"
                    dish_price = float(order_dish.price)
                    quantity = int(order_dish.quantity)
                    
                    # Рассчитываем стоимость позиции
                    item_total = dish_price * quantity
                    total_amount += item_total
                    
                    # Создаем позицию заказа
                    dish_item = {
                        "id": order_dish.id,
                        "dish_id": order_dish.dish_id,
                        "name": dish_name,
                        "price": dish_price,
                        "price_formatted": f"{dish_price} ₸",
                        "quantity": quantity,
                        "total_price": item_total,
                        "total_price_formatted": f"{item_total} ₸"
                    }
                    items.append(dish_item)
                except Exception as e:
                    logger.error(f"Ошибка при обработке блюда заказа: {str(e)}")
            
            # Если сумма в БД отличается от рассчитанной, обновляем её
            if not order.total_amount or abs(order.total_amount - total_amount) > 0.01:
                try:
                    order.total_amount = total_amount
                    db.commit()
                    logger.info(f"Обновлена сумма заказа ID:{order.id} в БД: {total_amount}")
                except Exception as e:
                    logger.error(f"Ошибка при обновлении суммы заказа ID:{order.id}: {str(e)}")
            
            # Формируем данные заказа
            order_data = {
                "id": order.id,
                "table_number": order.table_number or 0,
                "status": str(order.status) if order.status else "pending",
                "order_status": str(order.status) if order.status else "pending",
                "payment_status": str(order.payment_status) if order.payment_status else "pending",
                "payment_method": str(order.payment_method) if order.payment_method else None,
                "waiter_id": order.waiter_id,
                "user_id": order.user_id,
                "created_at": order.created_at,
                "updated_at": order.updated_at,
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
                "order_type": "dine-in"
            }
            
            # Логируем детали заказа для отладки
            logger.info(f"Заказ ID:{order.id} - Итоговая сумма: {total_amount}, "
                        f"Имя клиента: {order.customer_name or 'Не указано'}, "
                        f"Телефон: {order.customer_phone or 'Не указан'}, "
                        f"Количество позиций: {len(items)}")
            
            result.append(order_data)
            
        logger.info(f"Успешно получено {len(result)} заказов для официанта {current_user.id}")
        return result
        
    except Exception as e:
        logger.error(f"Ошибка при получении заказов официанта: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Ошибка получения заказов: {str(e)}")

@router.post("/orders/{order_id}/take")
async def take_order(
    order_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if current_user.role != "waiter":
        raise HTTPException(status_code=403, detail="Not enough permissions")
    
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    if order.waiter_id is not None:
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
    if current_user.role != "waiter":
        raise HTTPException(status_code=403, detail="Not enough permissions")
    
    order = db.query(Order).filter(
        Order.id == order_id,
        Order.waiter_id == current_user.id
    ).first()
    
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    if order.payment_status == PaymentStatus.PAID:
        raise HTTPException(status_code=400, detail="Order is already paid")
    
    order.payment_status = PaymentStatus.PAID
    db.commit()
    
    return {"message": "Payment confirmed successfully"}

@router.post("/orders/{order_id}/complete")
async def complete_order(
    order_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if current_user.role != "waiter":
        raise HTTPException(status_code=403, detail="Not enough permissions")
    
    order = db.query(Order).filter(
        Order.id == order_id,
        Order.waiter_id == current_user.id
    ).first()
    
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    if order.payment_status != PaymentStatus.PAID:
        raise HTTPException(status_code=400, detail="Order must be paid before completion")
    
    order.status = OrderStatus.DELIVERED
    db.commit()
    
    return {"message": "Order completed successfully"} 