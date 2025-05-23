from typing import Any, Dict, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
import logging

from app.database.session import get_db
from app.models.settings import Settings
from app.models.user import User, UserRole
from app.schemas.settings import SettingsCreate, SettingsUpdate, SettingsResponse
from app.services.auth import get_current_user

router = APIRouter()

@router.get("", response_model=SettingsResponse)
def get_settings(
    db: Session = Depends(get_db)
) -> Any:
    """
    Получение настроек ресторана.
    """
    logging.basicConfig(level=logging.INFO)
    logger = logging.getLogger(__name__)
    
    logger.info("Вызов функции get_settings")
    
    try:
        # Ищем настройки в базе данных
        logger.info("Поиск настроек в базе данных")
        db_settings = db.query(Settings).first()
        
        # Если настройки не найдены, создаем их с дефолтными значениями
        if not db_settings:
            logger.info("Настройки не найдены, создаем дефолтные")
            db_settings = Settings.create_default()
            db.add(db_settings)
            db.commit()
            db.refresh(db_settings)
        
        logger.info(f"Возвращаем настройки: {db_settings}")
        return db_settings
    except Exception as e:
        logger.error(f"Ошибка при получении настроек: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Ошибка при получении настроек: {str(e)}"
        )

@router.put("", response_model=SettingsResponse)
def update_settings(
    settings_in: SettingsUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    """
    Обновление настроек ресторана.
    Доступно только для администраторов.
    """
    # Проверяем права доступа
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Недостаточно прав для изменения настроек ресторана",
        )
    
    try:
        # Ищем настройки в базе данных
        db_settings = db.query(Settings).first()
        
        # Если настройки не найдены, создаем их с дефолтными значениями
        if not db_settings:
            db_settings = Settings.create_default()
            db.add(db_settings)
            db.commit()
            db.refresh(db_settings)
        
        # Обновляем только переданные поля
        for field, value in settings_in.dict(exclude_unset=True).items():
            setattr(db_settings, field, value)
        
        db.commit()
        db.refresh(db_settings)
        
        return db_settings
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Ошибка при обновлении настроек: {str(e)}"
        ) 