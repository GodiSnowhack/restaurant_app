from typing import List, Dict, Any
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.models.user import User, UserRole
from app.core.security import get_current_active_user
from app.services import analytics

router = APIRouter()

# Вспомогательная функция для конвертации строк в datetime
def parse_date(date_str: str = None) -> datetime:
    """
    Преобразует строку даты в объект datetime.
    Поддерживает ISO форматы и обычные строки формата YYYY-MM-DD.
    
    Args:
        date_str: Строка с датой или объект datetime
        
    Returns:
        Объект datetime или None, если преобразование невозможно
    """
    if date_str is None:
        return None
        
    # Если уже datetime, просто возвращаем
    if isinstance(date_str, datetime):
        return date_str
        
    # Проверяем, что это строка
    if not isinstance(date_str, str):
        print(f"Ошибка: тип аргумента должен быть str, получен {type(date_str)}")
        return None
        
    # Пробуем разные форматы
    try:
        # ISO формат с заменой Z на часовой пояс UTC
        if 'Z' in date_str:
            return datetime.fromisoformat(date_str.replace('Z', '+00:00'))
        # Стандартный ISO формат
        return datetime.fromisoformat(date_str)
    except ValueError:
        try:
            # Формат YYYY-MM-DD
            return datetime.strptime(date_str, "%Y-%m-%d")
        except ValueError:
            print(f"Ошибка: невозможно преобразовать строку '{date_str}' в datetime")
            return None


@router.get("/sales", response_model=List[Dict[str, Any]])
def get_sales_statistics(
    start_date: str = Query(None),
    end_date: str = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Получение статистики продаж за период
    """
    # Проверяем права доступа: только администратор может просматривать статистику
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    
    # Конвертируем даты
    start_datetime = parse_date(start_date)
    end_datetime = parse_date(end_date)
    
    # Если даты не указаны, используем последний месяц
    if not start_datetime:
        start_datetime = datetime.now() - timedelta(days=30)
    if not end_datetime:
        end_datetime = datetime.now()
    
    return analytics.get_sales_by_period(db, start_datetime, end_datetime)


@router.get("/top-dishes", response_model=List[Dict[str, Any]])
def get_top_dishes(
    limit: int = 10,
    start_date: str = Query(None),
    end_date: str = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Получение топа самых популярных блюд
    """
    # Проверяем права доступа: только администратор может просматривать статистику
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    
    # Конвертируем даты
    start_datetime = parse_date(start_date)
    end_datetime = parse_date(end_date)
    
    return analytics.get_top_dishes(db, limit, start_datetime, end_datetime)


@router.get("/revenue-by-category", response_model=List[Dict[str, Any]])
def get_revenue_by_category(
    start_date: str = Query(None),
    end_date: str = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Получение выручки по категориям блюд
    """
    # Проверяем права доступа: только администратор может просматривать статистику
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    
    # Конвертируем даты
    start_datetime = parse_date(start_date)
    end_datetime = parse_date(end_date)
    
    return analytics.get_revenue_by_category(db, start_datetime, end_datetime)


@router.get("/dashboard", response_model=Dict[str, Any])
def get_dashboard_statistics(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Получение общей статистики для дашборда администратора
    """
    # Проверяем права доступа: только администратор может просматривать статистику
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    
    # Получаем статистику за последние 30 дней
    end_date = datetime.now()
    start_date = end_date - timedelta(days=30)
    
    # Получаем статистику по заказам за последние 30 дней
    daily_orders = analytics.get_daily_orders(db, days=30)
    
    # Получаем среднюю стоимость заказа
    avg_order_value = analytics.get_avg_order_value(db)
    
    # Получаем статистику по пользователям
    user_stats = analytics.get_user_stats(db)
    
    # Получаем статистику по бронированиям
    reservation_stats = analytics.get_reservation_stats(db)
    
    # Формируем общий ответ
    return {
        "avg_order_value": avg_order_value,
        "daily_orders": daily_orders,
        "user_stats": user_stats,
        "reservation_stats": reservation_stats
    }


@router.get("/financial", response_model=Dict[str, Any])
def get_financial_metrics(
    start_date: str = Query(None),
    end_date: str = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Получение финансовых метрик
    """
    # Проверяем права доступа: только администратор может просматривать статистику
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    
    try:
        # Логируем входные параметры для отладки
        print(f"Запрос финансовых метрик с параметрами: startDate={start_date}, endDate={end_date}")
        
        # Конвертируем строковые даты в datetime
        start_datetime = parse_date(start_date)
        end_datetime = parse_date(end_date)
        
        # Логируем преобразованные даты
        print(f"Преобразованные даты: start_datetime={start_datetime}, end_datetime={end_datetime}")
        
        # Если даты не указаны или некорректны, используем значения по умолчанию
        if not start_datetime:
            start_datetime = datetime.now() - timedelta(days=30)
            print(f"Используем дату по умолчанию для начала: {start_datetime}")
        if not end_datetime:
            end_datetime = datetime.now()
            print(f"Используем дату по умолчанию для конца: {end_datetime}")
            
        # Используем новую функцию для получения комплексных финансовых метрик
        result = analytics.get_financial_metrics(db, start_datetime, end_datetime)
        return result
    except Exception as e:
        # Логируем ошибку
        print(f"Ошибка при получении финансовых метрик: {e}")
        raise HTTPException(status_code=500, detail=f"Ошибка при получении финансовых метрик: {str(e)}")


@router.get("/menu", response_model=Dict[str, Any])
def get_menu_metrics(
    start_date: str = Query(None),
    end_date: str = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Получение метрик по меню
    """
    # Проверяем права доступа: только администратор может просматривать статистику
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    
    try:
        # Логируем входные параметры для отладки
        print(f"Запрос метрик меню с параметрами: startDate={start_date}, endDate={end_date}")
        
        # Конвертируем строковые даты в datetime
        start_datetime = parse_date(start_date)
        end_datetime = parse_date(end_date)
        
        # Логируем преобразованные даты
        print(f"Преобразованные даты: start_datetime={start_datetime}, end_datetime={end_datetime}")
        
        # Если даты не указаны или некорректны, используем значения по умолчанию
        if not start_datetime:
            start_datetime = datetime.now() - timedelta(days=30)
            print(f"Используем дату по умолчанию для начала: {start_datetime}")
        if not end_datetime:
            end_datetime = datetime.now()
            print(f"Используем дату по умолчанию для конца: {end_datetime}")
        
        # Используем новую функцию для получения комплексных метрик меню
        result = analytics.get_menu_metrics(db, start_datetime, end_datetime)
        return result
    except Exception as e:
        # Логируем ошибку
        print(f"Ошибка при получении метрик меню: {e}")
        raise HTTPException(status_code=500, detail=f"Ошибка при получении метрик меню: {str(e)}")


@router.get("/customers", response_model=Dict[str, Any])
def get_customer_metrics(
    start_date: str = Query(None),
    end_date: str = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Получение метрик по клиентам
    """
    # Проверяем права доступа: только администратор может просматривать статистику
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    
    try:
        # Логируем входные параметры для отладки
        print(f"Запрос метрик клиентов с параметрами: startDate={start_date}, endDate={end_date}")
        
        # Конвертируем строковые даты в datetime
        start_datetime = parse_date(start_date)
        end_datetime = parse_date(end_date)
        
        # Логируем преобразованные даты
        print(f"Преобразованные даты: start_datetime={start_datetime}, end_datetime={end_datetime}")
        
        # Если даты не указаны или некорректны, используем значения по умолчанию
        if not start_datetime:
            start_datetime = datetime.now() - timedelta(days=30)
            print(f"Используем дату по умолчанию для начала: {start_datetime}")
        if not end_datetime:
            end_datetime = datetime.now()
            print(f"Используем дату по умолчанию для конца: {end_datetime}")
        
        # Используем новую функцию для получения комплексных метрик клиентов
        result = analytics.get_customer_metrics(db, start_datetime, end_datetime)
        return result
    except Exception as e:
        # Логируем ошибку
        print(f"Ошибка при получении метрик клиентов: {e}")
        raise HTTPException(status_code=500, detail=f"Ошибка при получении метрик клиентов: {str(e)}")


@router.get("/operational", response_model=Dict[str, Any])
def get_operational_metrics(
    start_date: str = Query(None),
    end_date: str = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Получение операционных метрик
    """
    # Проверяем права доступа: только администратор может просматривать статистику
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    
    try:
        # Логируем входные параметры для отладки
        print(f"Запрос операционных метрик с параметрами: startDate={start_date}, endDate={end_date}")
        
        # Конвертируем строковые даты в datetime
        start_datetime = parse_date(start_date)
        end_datetime = parse_date(end_date)
        
        # Логируем преобразованные даты
        print(f"Преобразованные даты: start_datetime={start_datetime}, end_datetime={end_datetime}")
        
        # Если даты не указаны или некорректны, используем значения по умолчанию
        if not start_datetime:
            start_datetime = datetime.now() - timedelta(days=30)
            print(f"Используем дату по умолчанию для начала: {start_datetime}")
        if not end_datetime:
            end_datetime = datetime.now()
            print(f"Используем дату по умолчанию для конца: {end_datetime}")
        
        # Используем новую функцию для получения комплексных операционных метрик
        result = analytics.get_operational_metrics(db, start_datetime, end_datetime)
        return result
    except Exception as e:
        # Логируем ошибку
        print(f"Ошибка при получении операционных метрик: {e}")
        raise HTTPException(status_code=500, detail=f"Ошибка при получении операционных метрик: {str(e)}")


@router.get("/predictive", response_model=Dict[str, Any])
def get_predictive_metrics(
    start_date: str = Query(None),
    end_date: str = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Получение предиктивных метрик
    """
    # Проверяем права доступа: только администратор может просматривать статистику
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    
    try:
        # Логируем входные параметры для отладки
        print(f"Запрос предиктивных метрик с параметрами: startDate={start_date}, endDate={end_date}")
        
        # Конвертируем строковые даты в datetime
        start_datetime = parse_date(start_date)
        end_datetime = parse_date(end_date)
        
        # Логируем преобразованные даты
        print(f"Преобразованные даты: start_datetime={start_datetime}, end_datetime={end_datetime}")
        
        # Если даты не указаны или некорректны, используем значения по умолчанию
        if not start_datetime:
            start_datetime = datetime.now() - timedelta(days=30)
            print(f"Используем дату по умолчанию для начала: {start_datetime}")
        if not end_datetime:
            end_datetime = datetime.now()
            print(f"Используем дату по умолчанию для конца: {end_datetime}")
        
        # Используем новую функцию для получения комплексных предиктивных метрик
        result = analytics.get_predictive_metrics(db, start_datetime, end_datetime)
        return result
    except Exception as e:
        # Логируем ошибку
        print(f"Ошибка при получении предиктивных метрик: {e}")
        raise HTTPException(status_code=500, detail=f"Ошибка при получении предиктивных метрик: {str(e)}") 