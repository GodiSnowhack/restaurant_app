from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field, ConfigDict
from enum import Enum


class ReviewType(str, Enum):
    """Тип отзыва"""
    DISH = "dish"         # Отзыв о блюде
    ORDER = "order"       # Отзыв о заказе
    SERVICE = "service"   # Отзыв об обслуживании
    COMBINED = "combined" # Комбинированный отзыв о заказе и обслуживании


class ReviewBase(BaseModel):
    """Базовая схема для отзывов"""
    comment: Optional[str] = None
    review_type: Optional[str] = Field(default=None, description="Тип отзыва (только для совместимости)")


class DishReviewCreate(ReviewBase):
    """Схема для создания отзыва о блюде"""
    dish_id: int
    rating: float = Field(..., ge=1.0, le=5.0, description="Оценка от 1 до 5")
    review_type: Optional[str] = Field(default=None, description="Тип отзыва (только для совместимости)")
    

class OrderReviewCreate(ReviewBase):
    """Схема для создания отзыва о заказе"""
    order_id: int
    food_rating: float = Field(..., ge=1.0, le=5.0, description="Оценка заказа от 1 до 5")
    review_type: Optional[str] = Field(default=None, description="Тип отзыва (только для совместимости)")


class ServiceReviewCreate(ReviewBase):
    """Схема для создания отзыва об обслуживании"""
    order_id: int
    service_rating: float = Field(..., ge=1.0, le=5.0, description="Оценка обслуживания от 1 до 5")
    review_type: Optional[str] = Field(default=None, description="Тип отзыва (только для совместимости)")


class CombinedReviewCreate(ReviewBase):
    """Схема для создания комбинированного отзыва о заказе и обслуживании"""
    order_id: int
    food_rating: float = Field(..., ge=1.0, le=5.0, description="Оценка заказа от 1 до 5")
    service_rating: float = Field(..., ge=1.0, le=5.0, description="Оценка обслуживания от 1 до 5")
    review_type: Optional[str] = Field(default=None, description="Тип отзыва (только для совместимости)")
    comment: Optional[str] = Field(default=None, description="Комментарий к отзыву")

    def validate_review_type(self):
        """Метод сохранен для совместимости, но не выполняет валидацию"""
        pass


class ReviewResponse(BaseModel):
    """Схема для ответа с данными отзыва"""
    id: int
    user_id: Optional[int] = None
    order_id: Optional[int] = None
    review_type: Optional[str] = Field(default=None, description="Тип отзыва (только для совместимости)")
    food_rating: Optional[float] = None
    service_rating: Optional[float] = None
    created_at: datetime
    
    # Данные о пользователе, оставившем отзыв
    user_name: Optional[str] = None
    
    model_config = ConfigDict(from_attributes=True)


class OrderWithReviewStatus(BaseModel):
    """Информация о статусе отзыва для заказа"""
    order_id: int
    can_review: bool = False
    order_completed: bool = False
    payment_completed: bool = False
    already_reviewed: bool = False
    review: Optional[ReviewResponse] = None 