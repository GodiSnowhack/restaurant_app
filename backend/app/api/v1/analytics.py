from typing import List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from datetime import datetime, timedelta

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
        
    # Очистим строку от лишних пробелов
    date_str = date_str.strip()
    
    # Защита от пустых строк
    if not date_str:
        return None
        
    # Пробуем разные форматы
    try:
        # ISO формат с заменой Z на часовой пояс UTC
        if 'Z' in date_str:
            return datetime.fromisoformat(date_str.replace('Z', '+00:00'))
        
        # Для формата YYYY-MM-DD
        if len(date_str) == 10 and date_str[4] == '-' and date_str[7] == '-':
            return datetime.strptime(date_str, "%Y-%m-%d")
            
        # Стандартный ISO формат
        return datetime.fromisoformat(date_str)
    except ValueError as e:
        print(f"Ошибка при преобразовании даты '{date_str}': {e}")
        
        try:
            # Формат YYYY-MM-DD
            return datetime.strptime(date_str, "%Y-%m-%d")
        except ValueError:
            print(f"Ошибка: невозможно преобразовать строку '{date_str}' в datetime")
            return None
    except Exception as e:
        print(f"Неожиданная ошибка при обработке даты '{date_str}': {e}")
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
def get_financial_analytics(
    start_date: str = None,
    end_date: str = None,
    category_id: int = None,
    use_mock_data: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Возвращает финансовую аналитику ресторана
    """
    try:
        # Преобразуем строковые даты в объекты datetime
        start = datetime.strptime(start_date, "%Y-%m-%d") if start_date else datetime.now() - timedelta(days=30)
        end = datetime.strptime(end_date, "%Y-%m-%d") if end_date else datetime.now()
        
        return analytics.get_financial_metrics(db, start, end, category_id, use_mock_data)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ошибка при получении финансовой аналитики: {str(e)}")


@router.get("/menu", response_model=Dict[str, Any])
def get_menu_analytics(
    start_date: str = None,
    end_date: str = None,
    category_id: int = None,
    dish_id: int = None,
    use_mock_data: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Возвращает аналитику по меню ресторана
    """
    try:
        # Преобразуем строковые даты в объекты datetime
        start = datetime.strptime(start_date, "%Y-%m-%d") if start_date else datetime.now() - timedelta(days=30)
        end = datetime.strptime(end_date, "%Y-%m-%d") if end_date else datetime.now()
        
        return analytics.get_menu_metrics(db, start, end, category_id, dish_id, use_mock_data)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ошибка при получении аналитики меню: {str(e)}")


@router.get("/customers", response_model=Dict[str, Any])
def get_customers_analytics(
    start_date: str = None,
    end_date: str = None,
    user_id: int = None,
    use_mock_data: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Возвращает аналитику по клиентам ресторана
    """
    try:
        # Преобразуем строковые даты в объекты datetime
        start = datetime.strptime(start_date, "%Y-%m-%d") if start_date else datetime.now() - timedelta(days=30)
        end = datetime.strptime(end_date, "%Y-%m-%d") if end_date else datetime.now()
        
        return analytics.get_customer_metrics(db, start, end, user_id, use_mock_data)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ошибка при получении аналитики клиентов: {str(e)}")


@router.get("/operational", response_model=Dict[str, Any])
def get_operational_analytics(
    start_date: str = None,
    end_date: str = None,
    use_mock_data: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Возвращает операционную аналитику ресторана
    """
    try:
        # Преобразуем строковые даты в объекты datetime
        start = datetime.strptime(start_date, "%Y-%m-%d") if start_date else datetime.now() - timedelta(days=30)
        end = datetime.strptime(end_date, "%Y-%m-%d") if end_date else datetime.now()
        
        return analytics.get_operational_metrics(db, start, end, use_mock_data)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ошибка при получении операционной аналитики: {str(e)}")


@router.get("/predictive", response_model=Dict[str, Any])
def get_predictive_analytics(
    start_date: str = None,
    end_date: str = None,
    use_mock_data: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Возвращает предиктивную аналитику ресторана
    """
    try:
        # Преобразуем строковые даты в объекты datetime
        start = datetime.strptime(start_date, "%Y-%m-%d") if start_date else datetime.now() - timedelta(days=30)
        end = datetime.strptime(end_date, "%Y-%m-%d") if end_date else datetime.now()
        
        return analytics.get_predictive_metrics(db, start, end, use_mock_data)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ошибка при получении предиктивной аналитики: {str(e)}")


@router.get("/dashboard")
def get_dashboard_analytics(
    start_date: str = None,
    end_date: str = None,
    use_mock_data: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Возвращает сводную аналитику для дашборда
    """
    try:
        # Преобразуем строковые даты в объекты datetime
        start = datetime.strptime(start_date, "%Y-%m-%d") if start_date else datetime.now() - timedelta(days=30)
        end = datetime.strptime(end_date, "%Y-%m-%d") if end_date else datetime.now()
        
        # Собираем базовые метрики из различных источников для дашборда
        financial = analytics.get_financial_metrics(db, start, end, None, use_mock_data)
        menu = analytics.get_menu_metrics(db, start, end, None, None, use_mock_data)
        customers = analytics.get_customer_metrics(db, start, end, None, use_mock_data)
        
        # Формируем сводку для дашборда
        dashboard_data = {
            "summary": {
                "totalRevenue": financial.get("totalRevenue", 0),
                "totalOrders": financial.get("orderCount", 0),
                "averageCheck": financial.get("averageOrderValue", 0),
                "customersCount": customers.get("totalCustomers", 0)
            },
            "period": {
                "startDate": start_date or (start.isoformat().split("T")[0]),
                "endDate": end_date or (end.isoformat().split("T")[0])
            }
        }
        
        return dashboard_data
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ошибка при получении данных дашборда: {str(e)}") 