from typing import Any, Dict, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
import logging

from app.database.session import get_db
from app.models.settings import Settings
from app.models.user import User, UserRole
from app.schemas.settings import SettingsCreate, SettingsUpdate, SettingsResponse, PublicSettings
from app.services.auth import get_current_user

router = APIRouter()

@router.get("/public", response_model=PublicSettings)
def get_public_settings(
    db: Session = Depends(get_db)
) -> Any:
    """
    Получение публичных настроек ресторана.
    """
    logger = logging.getLogger(__name__)
    logger.info("Вызов функции get_public_settings")
    
    try:
        db_settings = db.query(Settings).first()
        
        if not db_settings:
            db_settings = Settings(
                restaurant_name="Вкусно и Точка",
                email="info@restaurant.ru",
                phone="+7 (999) 123-45-67",
                address="ул. Пушкина, д. 10, Москва",
                website="https://restaurant.ru",
                working_hours={
                    "monday": {"open": "09:00", "close": "22:00", "is_closed": False},
                    "tuesday": {"open": "09:00", "close": "22:00", "is_closed": False},
                    "wednesday": {"open": "09:00", "close": "22:00", "is_closed": False},
                    "thursday": {"open": "09:00", "close": "22:00", "is_closed": False},
                    "friday": {"open": "09:00", "close": "23:00", "is_closed": False},
                    "saturday": {"open": "10:00", "close": "23:00", "is_closed": False},
                    "sunday": {"open": "10:00", "close": "22:00", "is_closed": False}
                }
            )
            db.add(db_settings)
            db.commit()
            db.refresh(db_settings)
        
        return PublicSettings(
            restaurant_name=db_settings.restaurant_name,
            email=db_settings.email,
            phone=db_settings.phone,
            address=db_settings.address,
            website=db_settings.website,
            working_hours=db_settings.working_hours
        )
    except Exception as e:
        logger.error(f"Ошибка при получении публичных настроек: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Ошибка при получении публичных настроек"
        )

@router.get("", response_model=SettingsResponse)
def get_settings(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    """
    Получение полных настроек ресторана.
    """
    logger = logging.getLogger(__name__)
    logger.info("Вызов функции get_settings")
    
    try:
        db_settings = db.query(Settings).first()
        
        if not db_settings:
            db_settings = Settings(
                restaurant_name="Вкусно и Точка",
                email="info@restaurant.ru",
                phone="+7 (999) 123-45-67",
                address="ул. Пушкина, д. 10, Москва",
                website="https://restaurant.ru",
                working_hours={
                    "monday": {"open": "09:00", "close": "22:00", "is_closed": False},
                    "tuesday": {"open": "09:00", "close": "22:00", "is_closed": False},
                    "wednesday": {"open": "09:00", "close": "22:00", "is_closed": False},
                    "thursday": {"open": "09:00", "close": "22:00", "is_closed": False},
                    "friday": {"open": "09:00", "close": "23:00", "is_closed": False},
                    "saturday": {"open": "10:00", "close": "23:00", "is_closed": False},
                    "sunday": {"open": "10:00", "close": "22:00", "is_closed": False}
                },
                currency="RUB",
                currency_symbol="₽",
                tax_percentage=20,
                min_order_amount=1000,
                delivery_fee=300,
                free_delivery_threshold=3000,
                table_reservation_enabled=True,
                delivery_enabled=True,
                pickup_enabled=True,
                tables=[],
                smtp_host="smtp.example.com",
                smtp_port=587,
                smtp_user="noreply@restaurant.ru",
                smtp_from_email="noreply@restaurant.ru",
                smtp_from_name="Restaurant",
                sms_sender="RESTAURANT"
            )
            db.add(db_settings)
            db.commit()
            db.refresh(db_settings)
        
        return db_settings
    except Exception as e:
        logger.error(f"Ошибка при получении настроек: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Ошибка при получении настроек"
        )

@router.put("", response_model=SettingsResponse)
def update_settings(
    *,
    db: Session = Depends(get_db),
    settings_in: SettingsUpdate,
    current_user: User = Depends(get_current_user)
) -> Any:
    """
    Обновление настроек ресторана.
    """
    logger = logging.getLogger(__name__)
    logger.info("Вызов функции update_settings")
    logger.info(f"Пользователь: {current_user.email} (role: {current_user.role})")
    logger.info(f"Данные для обновления: {settings_in.dict()}")
    
    # Проверяем роль пользователя
    if not current_user:
        logger.error("Пользователь не авторизован")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Необходима авторизация"
        )
    
    if current_user.role != UserRole.admin:
        logger.warning(f"Попытка обновления настроек пользователем без прав админа: {current_user.email}")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Недостаточно прав для изменения настроек"
        )
    
    try:
        # Получаем текущие настройки
        db_settings = db.query(Settings).first()
        
        if not db_settings:
            logger.error("Настройки не найдены в базе данных")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Настройки не найдены"
            )
        
        # Обновляем только переданные поля
        settings_data = settings_in.dict(exclude_unset=True)
        logger.info(f"Обновляемые поля: {list(settings_data.keys())}")
        
        # Проверяем каждое поле перед обновлением
        for field, value in settings_data.items():
            if hasattr(db_settings, field):
                logger.debug(f"Обновление поля {field}: {value}")
                setattr(db_settings, field, value)
            else:
                logger.warning(f"Попытка обновить несуществующее поле: {field}")
        
        try:
            # Сохраняем изменения
            db.commit()
            db.refresh(db_settings)
            logger.info("Настройки успешно обновлены")
            return db_settings
            
        except Exception as db_error:
            logger.error(f"Ошибка при сохранении в базу данных: {str(db_error)}")
            db.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Ошибка при сохранении настроек в базу данных: {str(db_error)}"
            )
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Неожиданная ошибка при обновлении настроек: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Ошибка при обновлении настроек: {str(e)}"
        ) 