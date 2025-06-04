from typing import Optional, List, Dict, Any
from sqlalchemy.orm import Session
from datetime import datetime
import logging

from app.models.review import Review, ReviewType
from app.models.order import Order, OrderStatus, PaymentStatus
from app.models.user import User
from app.schemas.review import (
    DishReviewCreate, 
    OrderReviewCreate, 
    ServiceReviewCreate,
    CombinedReviewCreate, 
    ReviewResponse,
    OrderWithReviewStatus
)

logger = logging.getLogger(__name__)


def check_can_review_order(db: Session, order_id: int) -> Dict[str, Any]:
    """
    Проверяет, можно ли оставить отзыв о заказе.
    
    Условия для возможности оставить отзыв:
    1. Заказ завершен (статус completed) или отменен (cancelled)
    2. Статус оплаты не проверяется
    3. Предыдущие отзывы не проверяются
    
    Args:
        db: Сессия базы данных
        order_id: ID заказа
        
    Returns:
        Словарь с информацией о статусе:
        - can_review: можно ли оставить отзыв
        - order_completed: завершен ли заказ
        - payment_completed: всегда True
        - already_reviewed: всегда False
        - review: всегда None
    """
    result = {
        "order_id": order_id,
        "can_review": False,
        "order_completed": False,
        "payment_completed": True,  # Всегда считаем, что оплата завершена
        "already_reviewed": False,  # Всегда считаем, что отзыва нет
        "review": None
    }
    
    try:
        # Получаем заказ
        order = db.query(Order).filter(Order.id == order_id).first()
        if not order:
            logger.warning(f"Заказ с ID {order_id} не найден при проверке возможности оставить отзыв")
            return result
        
        # Проверяем статус заказа
        completed_statuses = [OrderStatus.COMPLETED.value, OrderStatus.CANCELLED.value]
        if order.status and order.status.value in completed_statuses:
            result["order_completed"] = True
            result["can_review"] = True  # Разрешаем отзыв если заказ завершен
        
        return result
        
    except Exception as e:
        logger.error(f"Ошибка при проверке возможности оставить отзыв о заказе {order_id}: {str(e)}")
        logger.exception(e)
        # В случае ошибки все равно разрешаем отправить отзыв
        result["can_review"] = True
        result["order_completed"] = True
        return result


def create_dish_review(db: Session, user_id: int, review_data: DishReviewCreate) -> Optional[Review]:
    """
    Создание отзыва о блюде
    
    Args:
        db: Сессия базы данных
        user_id: ID пользователя, оставляющего отзыв
        review_data: Данные отзыва
        
    Returns:
        Созданный отзыв или None в случае ошибки
    """
    try:
        # Создаем отзыв без поля review_type
        review = Review(
            user_id=user_id,
            dish_id=review_data.dish_id,
            food_rating=review_data.rating,  # используем food_rating для рейтинга блюда
            comment=review_data.comment
        )
        
        db.add(review)
        db.commit()
        db.refresh(review)
        
        return review
    except Exception as e:
        db.rollback()
        logger.error(f"Ошибка при создании отзыва о блюде: {str(e)}")
        logger.exception(e)
        return None


def create_order_review(db: Session, user_id: int, review_data: OrderReviewCreate) -> Optional[Review]:
    """
    Создание отзыва о заказе
    
    Args:
        db: Сессия базы данных
        user_id: ID пользователя, оставляющего отзыв
        review_data: Данные отзыва
        
    Returns:
        Созданный отзыв или None в случае ошибки
    """
    # Максимальное количество попыток
    max_retries = 3
    retry_count = 0
    
    while retry_count < max_retries:
        try:
            # Создаем отзыв без дополнительных проверок и без поля review_type
            review = Review(
                user_id=user_id,
                order_id=review_data.order_id,
                food_rating=review_data.food_rating,
                comment=review_data.comment
            )
            
            # Открываем вложенную транзакцию
            db.begin_nested()
            
            db.add(review)
            db.commit()
            db.refresh(review)
            
            return review
        except Exception as e:
            db.rollback()
            retry_count += 1
            
            # Если это ошибка блокировки SQLite
            if "database is locked" in str(e).lower():
                logger.warning(f"База данных заблокирована при создании отзыва о заказе. Попытка {retry_count} из {max_retries}")
                import time
                # Ждем перед повторной попыткой
                time.sleep(1)
                continue
                
            logger.error(f"Ошибка при создании отзыва о заказе: {str(e)}")
            logger.exception(e)
            return None
    
    # Если все попытки исчерпаны
    logger.error(f"Не удалось создать отзыв о заказе после {max_retries} попыток")
    return None


def create_service_review(db: Session, user_id: int, review_data: ServiceReviewCreate) -> Optional[Review]:
    """
    Создание отзыва об обслуживании
    
    Args:
        db: Сессия базы данных
        user_id: ID пользователя, оставляющего отзыв
        review_data: Данные отзыва
        
    Returns:
        Созданный отзыв или None в случае ошибки
    """
    # Максимальное количество попыток
    max_retries = 3
    retry_count = 0
    
    while retry_count < max_retries:
        try:
            # Проверяем, что указанный официант действительно обслуживал заказ
            order = db.query(Order).filter(Order.id == review_data.order_id).first()
            if not order or order.waiter_id != review_data.waiter_id:
                logger.warning(f"Официант {review_data.waiter_id} не обслуживал заказ {review_data.order_id}")
                return None
                
            # Создаем отзыв без поля review_type
            review = Review(
                user_id=user_id,
                order_id=review_data.order_id,
                waiter_id=review_data.waiter_id,
                service_rating=review_data.service_rating,
                comment=review_data.comment
            )
            
            # Открываем вложенную транзакцию
            db.begin_nested()
            
            db.add(review)
            db.commit()
            db.refresh(review)
            
            return review
        except Exception as e:
            db.rollback()
            retry_count += 1
            
            # Если это ошибка блокировки SQLite
            if "database is locked" in str(e).lower():
                logger.warning(f"База данных заблокирована при создании отзыва об обслуживании. Попытка {retry_count} из {max_retries}")
                import time
                # Ждем перед повторной попыткой
                time.sleep(1)
                continue
                
            logger.error(f"Ошибка при создании отзыва об обслуживании: {str(e)}")
            logger.exception(e)
            return None
    
    # Если все попытки исчерпаны
    logger.error(f"Не удалось создать отзыв об обслуживании после {max_retries} попыток")
    return None


def create_combined_review(db: Session, user_id: int, review_data: CombinedReviewCreate) -> Optional[Review]:
    """
    Создание комбинированного отзыва о заказе и обслуживании
    
    Args:
        db: Сессия базы данных
        user_id: ID пользователя, оставляющего отзыв
        review_data: Данные отзыва
        
    Returns:
        Созданный отзыв или None в случае ошибки
    """
    try:
        logger.info(f"Создание комбинированного отзыва: user_id={user_id}, data={review_data.dict()}")
        
        # Проверяем существование заказа
        order = db.query(Order).filter(Order.id == review_data.order_id).first()
        if not order:
            logger.error(f"Заказ {review_data.order_id} не найден")
            raise ValueError(f"Заказ {review_data.order_id} не найден")
                
        # Создаем отзыв
        review = Review(
            user_id=user_id,
            order_id=review_data.order_id,
            food_rating=review_data.food_rating,
            service_rating=review_data.service_rating,
            comment=review_data.comment
        )
        
        # Открываем новую транзакцию для изоляции
        db.begin_nested()
        
        db.add(review)
        db.commit()
        db.refresh(review)
        
        logger.info(f"Комбинированный отзыв успешно создан: {review.id}")
        return review
        
    except Exception as e:
        db.rollback()
        logger.error(f"Ошибка при создании комбинированного отзыва: {str(e)}")
        logger.exception(e)
        raise


def get_reviews_by_waiter(db: Session, waiter_id: int, skip: int = 0, limit: int = 20) -> List[Dict[str, Any]]:
    """
    Получение списка отзывов об обслуживании для конкретного официанта
    
    Args:
        db: Сессия базы данных
        waiter_id: ID официанта
        skip: Смещение для пагинации
        limit: Максимальное количество отзывов
        
    Returns:
        Список отзывов
    """
    try:
        # Получаем отзывы с service_rating для указанного официанта
        reviews = db.query(Review).filter(
            Review.waiter_id == waiter_id,
            Review.service_rating.isnot(None)  # Фильтруем отзывы, где указан рейтинг обслуживания
        ).order_by(
            Review.created_at.desc()
        ).offset(skip).limit(limit).all()
        
        # Преобразуем отзывы в формат ответа
        result = []
        for review in reviews:
            # Получаем информацию о пользователе
            user = db.query(User).filter(User.id == review.user_id).first()
            user_name = user.full_name if user else None
            
            # Формируем словарь с данными отзыва
            review_dict = {
                "id": review.id,
                "user_id": review.user_id,
                "order_id": review.order_id,
                "waiter_id": review.waiter_id,
                "review_type": "service",  # Для обратной совместимости
                "service_rating": review.service_rating,
                "comment": review.comment,
                "created_at": review.created_at,
                "user_name": user_name
            }
            
            result.append(review_dict)
            
        return result
    except Exception as e:
        logger.error(f"Ошибка при получении отзывов для официанта {waiter_id}: {str(e)}")
        logger.exception(e)
        return [] 