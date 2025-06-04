from fastapi import APIRouter, Depends, HTTPException, status, Query, Path
from sqlalchemy.orm import Session
import logging
from typing import List, Dict, Any, Optional

from app.database.session import get_db
from app.models.user import User, UserRole
from app.services import review as review_service
from app.schemas.review import (
    DishReviewCreate,
    OrderReviewCreate,
    ServiceReviewCreate,
    CombinedReviewCreate,
    ReviewResponse,
    OrderWithReviewStatus
)
from app.core.security import get_current_active_user, check_admin_permission, check_waiter_permission

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/reviews", tags=["reviews"])


@router.post("/dish", response_model=ReviewResponse)
def create_dish_review(
    review_data: DishReviewCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Создание отзыва о блюде.
    """
    logger.info(f"Запрос на создание отзыва о блюде от пользователя {current_user.id}")
    
    review = review_service.create_dish_review(db, current_user.id, review_data)
    if not review:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Не удалось создать отзыв о блюде"
        )
    
    return review


@router.post("/order", response_model=ReviewResponse)
def create_order_review(
    review_data: OrderReviewCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Создание отзыва о заказе.
    """
    try:
        logger.info(f"Запрос на создание отзыва о заказе {review_data.order_id} от пользователя {current_user.id}")
        
        review = review_service.create_order_review(db, current_user.id, review_data)
        if not review:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Не удалось создать отзыв о заказе"
            )
        
        return review
    except ValueError as e:
        logger.error(f"Ошибка валидации при создании отзыва о заказе: {str(e)}")
        raise HTTPException(
            status_code=400,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Ошибка при создании отзыва о заказе: {str(e)}")
        logger.exception(e)
        
        # Специальная обработка ошибки блокировки базы данных
        if "database is locked" in str(e).lower():
            raise HTTPException(
                status_code=503,
                detail="База данных временно недоступна. Пожалуйста, повторите попытку через несколько секунд."
            )
        
        raise HTTPException(
            status_code=500,
            detail="Внутренняя ошибка сервера при создании отзыва о заказе"
        )


@router.post("/service", response_model=ReviewResponse)
def create_service_review(
    review_data: ServiceReviewCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Создание отзыва об обслуживании.
    """
    try:
        logger.info(f"Запрос на создание отзыва об обслуживании заказа {review_data.order_id} от пользователя {current_user.id}")
        
        review = review_service.create_service_review(db, current_user.id, review_data)
        if not review:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Не удалось создать отзыв об обслуживании"
            )
        
        return review
    except ValueError as e:
        logger.error(f"Ошибка валидации при создании отзыва об обслуживании: {str(e)}")
        raise HTTPException(
            status_code=400,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Ошибка при создании отзыва об обслуживании: {str(e)}")
        logger.exception(e)
        
        # Специальная обработка ошибки блокировки базы данных
        if "database is locked" in str(e).lower():
            raise HTTPException(
                status_code=503,
                detail="База данных временно недоступна. Пожалуйста, повторите попытку через несколько секунд."
            )
        
        raise HTTPException(
            status_code=500,
            detail="Внутренняя ошибка сервера при создании отзыва об обслуживании"
        )


@router.post("/combined", response_model=ReviewResponse)
def create_combined_review(
    review: CombinedReviewCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Создание комбинированного отзыва о заказе и обслуживании"""
    try:
        logger.info(f"Создание комбинированного отзыва от пользователя {current_user.id}")
        logger.info(f"Данные отзыва: {review.dict()}")
        
        # Создаем отзыв
        db_review = review_service.create_combined_review(
            db=db,
            user_id=current_user.id,
            review_data=review
        )
        
        if not db_review:
            logger.error("Не удалось создать комбинированный отзыв")
            raise HTTPException(
                status_code=400,
                detail="Не удалось создать отзыв"
            )
            
        logger.info(f"Комбинированный отзыв успешно создан: {db_review.id}")
        return db_review
    except ValueError as e:
        logger.error(f"Ошибка валидации при создании комбинированного отзыва: {str(e)}")
        raise HTTPException(
            status_code=400,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Ошибка при создании комбинированного отзыва: {str(e)}")
        logger.exception(e)
        
        # Специальная обработка ошибки блокировки базы данных
        if "database is locked" in str(e).lower():
            raise HTTPException(
                status_code=503,
                detail="База данных временно недоступна. Пожалуйста, повторите попытку через несколько секунд."
            )
        
        raise HTTPException(
            status_code=500,
            detail="Внутренняя ошибка сервера при создании отзыва"
        )


@router.get("/order/{order_id}/status", response_model=OrderWithReviewStatus)
def check_order_review_status(
    order_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Проверка возможности оставить отзыв о заказе.
    """
    logger.info(f"Проверка возможности оставить отзыв о заказе {order_id}")
    
    status = review_service.check_can_review_order(db, order_id)
    return status


@router.get("/waiter/{waiter_id}", response_model=List[ReviewResponse])
def get_waiter_reviews(
    waiter_id: int,
    skip: int = 0,
    limit: int = 20,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Получение списка отзывов об официанте.
    """
    logger.info(f"Запрос на получение отзывов об официанте {waiter_id}")
    
    reviews = review_service.get_reviews_by_waiter(db, waiter_id, skip, limit)
    return reviews


@router.put("/waiter/can-review", response_model=OrderWithReviewStatus)
def can_waiter_add_review(
    order_id: int = Query(..., description="ID заказа"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Проверка возможности официанта оставить отзыв о заказе.
    Официант может оставить отзыв только о заказах, которые были выполнены и оплачены.
    """
    logger.info(f"Проверка возможности официанта {current_user.id} оставить отзыв о заказе {order_id}")
    
    # Проверяем роль пользователя
    if current_user.role != UserRole.WAITER and current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Только официанты и администраторы могут оставлять отзывы о заказах"
        )
    
    status = review_service.check_can_review_order(db, order_id)
    return status 