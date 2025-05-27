from typing import Any, Dict, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
import logging

from app.database.session import get_db
from app.models.settings import Settings
from app.models.user import User, UserRole
from app.schemas.settings import SettingsCreate, SettingsUpdate, SettingsResponse
from app.services.auth import get_current_user
from app.core.config import settings as app_settings

router = APIRouter()

@router.get("", response_model=SettingsResponse)
def get_settings(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user) if app_settings.ENVIRONMENT == "production" else None
) -> Any:
    """
    Получение настроек ресторана.
    В production требует аутентификацию, в development - нет.
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
            try:
                db_settings = Settings.create_default()
                db.add(db_settings)
                db.commit()
                db.refresh(db_settings)
                logger.info("Дефолтные настройки успешно созданы")
            except Exception as create_error:
                logger.error(f"Ошибка при создании дефолтных настроек: {create_error}")
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"Ошибка при создании дефолтных настроек: {str(create_error)}"
                )
        
        # Проверяем обязательные поля
        required_fields = ['restaurant_name', 'email', 'phone', 'address', 'currency', 'currency_symbol']
        missing_fields = [field for field in required_fields if not getattr(db_settings, field)]
        
        if missing_fields:
            logger.error(f"Отсутствуют обязательные поля: {missing_fields}")
            # Пробуем исправить, обновив настройки дефолтными значениями
            default_settings = Settings.create_default()
            for field in missing_fields:
                setattr(db_settings, field, getattr(default_settings, field))
            db.commit()
            db.refresh(db_settings)
        
        # Проверяем наличие столов и их корректность
        if not db_settings.tables or not isinstance(db_settings.tables, list):
            logger.warning("Отсутствуют данные о столах, добавляем дефолтные")
            default_settings = Settings.create_default()
            db_settings.tables = default_settings.tables
            db.commit()
            db.refresh(db_settings)
        else:
            # Проверяем наличие обязательных полей у столов
            need_update = False
            for table in db_settings.tables:
                if 'number' not in table:
                    table['number'] = table.get('id', 0)
                    need_update = True
                if 'position_x' not in table or 'position_y' not in table:
                    table['position_x'] = 15 + (table.get('id', 1) - 1) * 20
                    table['position_y'] = 15 + (table.get('id', 1) % 2) * 20
                    need_update = True
            
            if need_update:
                logger.info("Обновляем данные столов")
                db.commit()
                db.refresh(db_settings)
        
        # Преобразуем модель в словарь для создания схемы ответа
        settings_dict = {
            "id": db_settings.id,
            "restaurant_name": db_settings.restaurant_name,
            "email": db_settings.email,
            "phone": db_settings.phone,
            "address": db_settings.address,
            "website": db_settings.website,
            "working_hours": db_settings.working_hours,
            "tables": db_settings.tables,
            "currency": db_settings.currency,
            "currency_symbol": db_settings.currency_symbol,
            "tax_percentage": db_settings.tax_percentage,
            "min_order_amount": db_settings.min_order_amount,
            "delivery_fee": db_settings.delivery_fee,
            "free_delivery_threshold": db_settings.free_delivery_threshold,
            "table_reservation_enabled": db_settings.table_reservation_enabled,
            "delivery_enabled": db_settings.delivery_enabled,
            "pickup_enabled": db_settings.pickup_enabled,
            "smtp_host": db_settings.smtp_host,
            "smtp_port": db_settings.smtp_port,
            "smtp_user": db_settings.smtp_user,
            "smtp_password": "********" if db_settings.smtp_password else None,
            "smtp_from_email": db_settings.smtp_from_email,
            "smtp_from_name": db_settings.smtp_from_name,
            "sms_api_key": "********" if db_settings.sms_api_key else None,
            "sms_sender": db_settings.sms_sender,
            "privacy_policy": db_settings.privacy_policy,
            "terms_of_service": db_settings.terms_of_service
        }
        
        # Создаем и возвращаем объект SettingsResponse
        response = SettingsResponse(**settings_dict)
        
        # Создаем безопасную версию настроек для логирования
        safe_settings = {
            "restaurant_name": response.restaurant_name,
            "email": response.email,
            "phone": response.phone,
            "address": response.address,
            "website": response.website,
            "working_hours": response.working_hours,
            "tables_count": len(response.tables) if response.tables else 0,
            "currency": response.currency,
            "currency_symbol": response.currency_symbol,
            "tax_percentage": response.tax_percentage,
            "min_order_amount": response.min_order_amount,
            "delivery_fee": response.delivery_fee,
            "free_delivery_threshold": response.free_delivery_threshold,
            "table_reservation_enabled": response.table_reservation_enabled,
            "delivery_enabled": response.delivery_enabled,
            "pickup_enabled": response.pickup_enabled,
            "smtp_host": response.smtp_host,
            "smtp_port": response.smtp_port,
            "smtp_user": response.smtp_user,
            "smtp_from_email": response.smtp_from_email,
            "smtp_from_name": response.smtp_from_name,
            "sms_sender": response.sms_sender
        }
        
        logger.info(f"Возвращаем настройки: {safe_settings}")
        return response
        
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
    logging.basicConfig(level=logging.INFO)
    logger = logging.getLogger(__name__)
    
    logger.info("Вызов функции update_settings")
    logger.info(f"Пользователь: {current_user.email}, роль: {current_user.role}")
    
    # Проверяем права доступа
    if current_user.role != UserRole.ADMIN:
        logger.warning(f"Попытка обновления настроек пользователем без прав администратора: {current_user.email}")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Недостаточно прав для изменения настроек ресторана",
        )
    
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
            logger.info("Дефолтные настройки успешно созданы")
        
        # Обновляем только переданные поля
        update_data = settings_in.dict(exclude_unset=True)
        logger.info(f"Обновляемые поля: {list(update_data.keys())}")
        
        # Преобразуем URL в строку, если он есть
        if 'website' in update_data and update_data['website']:
            update_data['website'] = str(update_data['website'])
        
        for field, value in update_data.items():
            logger.debug(f"Обновление поля {field}: {value}")
            setattr(db_settings, field, value)
        
        try:
            db.commit()
            db.refresh(db_settings)
            logger.info("Настройки успешно обновлены в базе данных")
        except Exception as db_error:
            logger.error(f"Ошибка при сохранении в базу данных: {db_error}")
            db.rollback()
            raise
        
        # Преобразуем модель в словарь для создания схемы ответа
        settings_dict = {
            "id": db_settings.id,
            "restaurant_name": db_settings.restaurant_name,
            "email": db_settings.email,
            "phone": db_settings.phone,
            "address": db_settings.address,
            "website": db_settings.website,
            "working_hours": db_settings.working_hours,
            "tables": db_settings.tables,
            "currency": db_settings.currency,
            "currency_symbol": db_settings.currency_symbol,
            "tax_percentage": db_settings.tax_percentage,
            "min_order_amount": db_settings.min_order_amount,
            "delivery_fee": db_settings.delivery_fee,
            "free_delivery_threshold": db_settings.free_delivery_threshold,
            "table_reservation_enabled": db_settings.table_reservation_enabled,
            "delivery_enabled": db_settings.delivery_enabled,
            "pickup_enabled": db_settings.pickup_enabled,
            "smtp_host": db_settings.smtp_host,
            "smtp_port": db_settings.smtp_port,
            "smtp_user": db_settings.smtp_user,
            "smtp_password": "********" if db_settings.smtp_password else None,
            "smtp_from_email": db_settings.smtp_from_email,
            "smtp_from_name": db_settings.smtp_from_name,
            "sms_api_key": "********" if db_settings.sms_api_key else None,
            "sms_sender": db_settings.sms_sender,
            "privacy_policy": db_settings.privacy_policy,
            "terms_of_service": db_settings.terms_of_service
        }
        
        # Создаем и возвращаем объект SettingsResponse
        response = SettingsResponse(**settings_dict)
        logger.info("Настройки успешно обновлены и возвращены")
        return response
        
    except Exception as e:
        logger.error(f"Ошибка при обновлении настроек: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Ошибка при обновлении настроек: {str(e)}"
        ) 