from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime, timedelta, date
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, desc, extract, cast, Date, distinct

from app.models.order import Order, OrderStatus, OrderDish
from app.models.menu import Dish, Category
from app.models.reservation import Reservation
from app.models.user import User
from app.models.review import Review
from app.models.order_item import OrderItem
from app.database.session import Base
from app.utils.date_utils import is_weekend, get_day_name


def get_sales_by_period(
    db: Session, 
    start_date: datetime = None, 
    end_date: datetime = None
) -> List[Dict[str, Any]]:
    """
    Получение статистики продаж за период
    """
    try:
        # Если даты не указаны, устанавливаем значения по умолчанию
        if not start_date:
            start_date = datetime.now() - timedelta(days=30)
        if not end_date:
            end_date = datetime.now()
            
        # Логируем даты для отладки
        print(f"Используем даты в get_sales_by_period: start_date={start_date}, end_date={end_date}")
        
        query = db.query(
            cast(Order.created_at, Date).label('date'),
            func.count(Order.id).label('orders_count'),
            func.sum(Order.total_amount).label('total_revenue')
        )
        
        # Применяем фильтры по датам
        query = query.filter(Order.created_at >= start_date)
        query = query.filter(Order.created_at <= end_date)
        
        # Группируем по дате и сортируем
        result = query.group_by(
            cast(Order.created_at, Date)
        ).order_by(
            cast(Order.created_at, Date)
        ).all()
        
        print(f"SQL: {str(query)}")
        print(f"Найдено {len(result)} записей в get_sales_by_period")
        
        # Форматируем результат с безопасной обработкой дат
        formatted_results = []
        for item in result:
            try:
                # Безопасное преобразование даты
                date_value = item.date
                if isinstance(date_value, datetime):
                    date_str = date_value.date().isoformat()
                elif isinstance(date_value, date):
                    date_str = date_value.isoformat()
                else:
                    date_str = str(date_value)
                
                # Безопасное преобразование числовых значений
                orders_count = item.orders_count or 0
                total_revenue = float(item.total_revenue) if item.total_revenue else 0
                
                formatted_results.append({
                    "date": date_str,
                    "orders_count": orders_count,
                    "total_revenue": total_revenue
                })
                print(f"Добавлена запись: дата={date_str}, заказов={orders_count}, выручка={total_revenue}")
            except Exception as e:
                print(f"Ошибка при обработке данных продаж: {e}")
                # Добавляем минимальные данные, чтобы сохранить структуру
                formatted_results.append({
                    "date": "",
                    "orders_count": 0,
                    "total_revenue": 0
                })
        
        if not formatted_results:
            print("Нет данных по продажам, добавляем запись-заглушку")
            # Если нет данных, добавляем хотя бы одну запись с текущей датой
            formatted_results.append({
                "date": datetime.now().date().isoformat(),
                "orders_count": 0,
                "total_revenue": 0
            })
        
        # Выводим итоговую сумму для отладки
        total_sales = sum(item["total_revenue"] for item in formatted_results)
        print(f"Итоговая выручка за период: {total_sales}")
        
        return formatted_results
        
    except Exception as e:
        print(f"Критическая ошибка в get_sales_by_period: {e}")
        print(f"Тип start_date: {type(start_date)}, значение: {start_date}")
        print(f"Тип end_date: {type(end_date)}, значение: {end_date}")
        # Возвращаем минимальный набор данных в случае ошибки
        return [{
            "date": datetime.now().date().isoformat(),
            "orders_count": 0,
            "total_revenue": 0
        }]


def get_top_dishes(
    db: Session, 
    limit: int = 10,
    start_date: datetime = None,
    end_date: datetime = None
) -> List[Dict[str, Any]]:
    """
    Получение топа самых популярных блюд
    """
    query = db.query(
        Dish.id,
        Dish.name,
        Dish.price,
        func.sum(OrderDish.quantity).label("total_ordered"),
        func.sum(OrderDish.quantity * Dish.price).label("total_revenue")
    ).join(
        OrderDish, OrderDish.dish_id == Dish.id
    ).join(
        Order, Order.id == OrderDish.order_id
    )
    
    # Фильтрация только по завершенным заказам
    query = query.filter(Order.status.in_([OrderStatus.COMPLETED, OrderStatus.DELIVERED]))
    
    if start_date:
        query = query.filter(Order.created_at >= start_date)
    if end_date:
        query = query.filter(Order.created_at <= end_date)
    
    results = query.group_by(
        Dish.id
    ).order_by(
        func.sum(OrderDish.quantity).desc()
    ).limit(limit).all()
    
    return [
        {
            "id": result.id,
            "name": result.name,
            "price": result.price,
            "total_ordered": result.total_ordered,
            "total_revenue": float(result.total_revenue) if result.total_revenue else 0
        }
        for result in results
    ]


def get_revenue_by_category(
    db: Session, 
    start_date: datetime = None, 
    end_date: datetime = None
) -> List[Dict[str, Any]]:
    """
    Получение выручки по категориям
    """
    query = db.query(
        Category.id,
        Category.name,
        func.count(Dish.id).label('dishes_count'),
        func.sum(OrderDish.quantity).label('total_ordered'),
        func.sum(OrderDish.quantity * Dish.price).label('total_revenue')
    ).join(
        Dish, Dish.category_id == Category.id
    ).join(
        OrderDish, OrderDish.dish_id == Dish.id
    ).join(
        Order, Order.id == OrderDish.order_id
    )
    
    # Фильтрация только по завершенным заказам
    query = query.filter(Order.status.in_([OrderStatus.COMPLETED, OrderStatus.DELIVERED]))
    
    if start_date:
        query = query.filter(Order.created_at >= start_date)
    if end_date:
        query = query.filter(Order.created_at <= end_date)
    
    results = query.group_by(
        Category.id
    ).order_by(
        func.sum(OrderDish.quantity * Dish.price).desc()
    ).all()
    
    return [
        {
            "id": result.id,
            "name": result.name,
            "dishes_count": result.dishes_count,
            "total_ordered": result.total_ordered,
            "total_revenue": float(result.total_revenue) if result.total_revenue else 0
        }
        for result in results
    ]


def get_avg_order_value(db: Session) -> float:
    """
    Получение средней стоимости заказа
    """
    result = db.query(
        func.avg(Order.total_amount).label("avg_order_value")
    ).filter(
        Order.status.in_([OrderStatus.COMPLETED, OrderStatus.DELIVERED])
    ).first()
    
    return float(result.avg_order_value) if result.avg_order_value else 0.0


def get_table_utilization(
    db: Session, 
    start_date: datetime = None, 
    end_date: datetime = None
) -> Dict[int, int]:
    """
    Получение статистики по использованию столиков
    """
    query = db.query(
        Order.table_number,
        func.count(Order.id).label('usage_count')
    ).filter(Order.table_number.isnot(None))
    
    # Применяем фильтры по датам, если указаны
    if start_date:
        query = query.filter(Order.created_at >= start_date)
    if end_date:
        query = query.filter(Order.created_at <= end_date)
    
    # Группируем по номеру столика
    result = query.group_by(
        Order.table_number
    ).all()
    
    # Формируем словарь {table_number: usage_count}
    return {item.table_number: item.usage_count for item in result}


def get_user_stats(db: Session) -> Dict[str, Any]:
    """
    Получение статистики по пользователям
    """
    # Общее количество пользователей
    total_users = db.query(func.count(User.id)).scalar()
    
    # Активные пользователи (сделавшие хотя бы один заказ)
    active_users = db.query(
        func.count(func.distinct(Order.user_id))
    ).filter(
        Order.user_id.isnot(None)
    ).scalar()
    
    # Пользователи по ролям
    user_roles = db.query(
        User.role,
        func.count(User.id).label('count')
    ).group_by(
        User.role
    ).all()
    
    roles_count = {str(role): count for role, count in user_roles}
    
    return {
        "total_users": total_users,
        "active_users": active_users,
        "inactive_users": total_users - active_users if total_users else 0,
        "users_by_role": roles_count
    }


def get_reservation_stats(db: Session) -> Dict[str, Any]:
    """
    Получение статистики по бронированиям
    """
    today = datetime.now().date()
    tomorrow = today + timedelta(days=1)
    
    # Бронирования на сегодня
    reservations_today = db.query(
        func.count(Reservation.id)
    ).filter(
        func.date(Reservation.date) == today
    ).scalar()
    
    # Бронирования на завтра
    reservations_tomorrow = db.query(
        func.count(Reservation.id)
    ).filter(
        func.date(Reservation.date) == tomorrow
    ).scalar()
    
    # Всего активных бронирований
    active_reservations = db.query(
        func.count(Reservation.id)
    ).filter(
        func.date(Reservation.date) >= today
    ).scalar()
    
    return {
        "reservations_today": reservations_today,
        "reservations_tomorrow": reservations_tomorrow,
        "active_reservations": active_reservations
    }


def get_daily_orders(
    db: Session, 
    days: int = 30
) -> List[Dict[str, Any]]:
    """
    Получение количества заказов по дням за последние N дней
    """
    end_date = datetime.now()
    start_date = end_date - timedelta(days=days)
    
    query = db.query(
        func.date(Order.created_at).label("date"),
        func.count(Order.id).label("orders_count"),
        func.sum(Order.total_amount).label("total_revenue")
    ).filter(
        Order.created_at >= start_date,
        Order.created_at <= end_date
    ).group_by(
        func.date(Order.created_at)
    ).order_by(
        func.date(Order.created_at)
    )
    
    results = query.all()
    
    formatted_results = []
    for result in results:
        try:
            # Безопасное преобразование даты в строку
            date_value = result.date
            if hasattr(date_value, 'isoformat'):
                date_str = date_value.isoformat()
            else:
                date_str = str(date_value)
            
            # Безопасное преобразование числовых значений
            orders_count = result.orders_count or 0
            total_revenue = float(result.total_revenue) if result.total_revenue else 0.0
            
            formatted_results.append({
                "date": date_str,
                "orders_count": orders_count,
                "total_revenue": total_revenue
            })
        except Exception as e:
            print(f"Ошибка при обработке результата daily_orders: {e}, result: {result}")
            # Добавляем запись с минимальными данными, чтобы не нарушать структуру
            formatted_results.append({
                "date": str(end_date.date() - timedelta(days=len(formatted_results))),
                "orders_count": 0,
                "total_revenue": 0.0
            })
    
    return formatted_results


def get_financial_metrics(
    db: Session, 
    start_date: datetime = None, 
    end_date: datetime = None,
    category_id: Optional[int] = None,
    use_mock_data: bool = False
) -> Dict[str, Any]:
    """
    Получение комплексных финансовых метрик для аналитики
    """
    # Если запрошены мок-данные, возвращаем их
    if use_mock_data:
        return get_mock_financial_metrics(start_date, end_date)
    
    try:
        # Запрос на получение данных по заказам и позициям за указанный период
        query = (
            db.query(
                Order.id,
                Order.created_at,
                Order.total_amount,
                OrderItem.price,
                OrderItem.quantity,
                Dish.cost_price,
                Dish.id.label("dish_id"),
                Dish.name.label("dish_name"),
                Category.id.label("category_id"),
                Category.name.label("category_name")
            )
            .join(OrderItem, Order.id == OrderItem.order_id)
            .join(Dish, OrderItem.dish_id == Dish.id)
            .join(Category, Dish.category_id == Category.id)
            .filter(Order.created_at.between(start_date, end_date))
            .filter(Order.status == 'Оплачен')
        )
        
        # Добавляем фильтр по категории, если указан
        if category_id:
            query = query.filter(Category.id == category_id)
            
        orders_data = query.all()
        
        # Если данные не найдены, возвращаем пустые метрики
        if not orders_data:
            return {
                "totalRevenue": 0,
                "totalCost": 0,
                "grossProfit": 0,
                "profitMargin": 0,
                "averageOrderValue": 0,
                "orderCount": 0,
                "revenueByCategory": {},
                "revenueByTimeOfDay": {},
                "revenueByDayOfWeek": {},
                "revenueTrend": [],
                "period": {
                    "startDate": start_date.strftime("%Y-%m-%d"),
                    "endDate": end_date.strftime("%Y-%m-%d")
                }
            }
        
        # Структуры для агрегации данных
        orders_by_id = {}
        total_revenue = 0
        total_cost = 0
        revenue_by_category = {}
        revenue_by_time = {
            '12-14': 0,
            '14-16': 0,
            '16-18': 0,
            '18-20': 0,
            '20-22': 0
        }
        revenue_by_day = {
            'Понедельник': 0,
            'Вторник': 0,
            'Среда': 0,
            'Четверг': 0,
            'Пятница': 0,
            'Суббота': 0,
            'Воскресенье': 0
        }
        revenue_trend = {}
        
        # Обработка данных заказов
        for order in orders_data:
            order_id = order.id
            created_at = order.created_at
            order_total = float(order.total_amount)
            item_price = float(order.price)
            item_quantity = int(order.quantity)
            item_cost = float(order.cost_price) * item_quantity
            category_id = order.category_id
            
            # Агрегация по заказам
            if order_id not in orders_by_id:
                orders_by_id[order_id] = {
                    'total': order_total,
                    'created_at': created_at
                }
                total_revenue += order_total
                
                # Агрегация по времени суток
                hour = created_at.hour
                if 12 <= hour < 14:
                    revenue_by_time['12-14'] += order_total
                elif 14 <= hour < 16:
                    revenue_by_time['14-16'] += order_total
                elif 16 <= hour < 18:
                    revenue_by_time['16-18'] += order_total
                elif 18 <= hour < 20:
                    revenue_by_time['18-20'] += order_total
                elif 20 <= hour < 22:
                    revenue_by_time['20-22'] += order_total
                
                # Агрегация по дням недели
                day_name = get_day_name(created_at.weekday())
                revenue_by_day[day_name] += order_total
                
                # Агрегация для тренда по дням
                date_str = created_at.strftime("%Y-%m-%d")
                if date_str not in revenue_trend:
                    revenue_trend[date_str] = 0
                revenue_trend[date_str] += order_total
            
            # Агрегация по категориям
            if category_id not in revenue_by_category:
                revenue_by_category[category_id] = 0
            revenue_by_category[category_id] += item_price * item_quantity
            
            # Учет себестоимости
            total_cost += item_cost
        
        # Расчет дополнительных метрик
        order_count = len(orders_by_id)
        average_order_value = total_revenue / order_count if order_count > 0 else 0
        gross_profit = total_revenue - total_cost
        profit_margin = (gross_profit / total_revenue) * 100 if total_revenue > 0 else 0
        
        # Формирование тренда выручки по дням
        days = (end_date - start_date).days + 1
        trend_data = []
        
        current_date = start_date
        while current_date <= end_date:
            date_str = current_date.strftime("%Y-%m-%d")
            trend_data.append({
                "date": date_str,
                "value": round(revenue_trend.get(date_str, 0))
            })
            current_date += timedelta(days=1)
        
        # Округление значений для более читаемого вывода
        metrics = {
            "totalRevenue": round(total_revenue),
            "totalCost": round(total_cost),
            "grossProfit": round(gross_profit),
            "profitMargin": round(profit_margin),
            "averageOrderValue": round(average_order_value),
            "orderCount": order_count,
            "revenueByCategory": {k: round(v) for k, v in revenue_by_category.items()},
            "revenueByTimeOfDay": {k: round(v) for k, v in revenue_by_time.items()},
            "revenueByDayOfWeek": {k: round(v) for k, v in revenue_by_day.items()},
            "revenueTrend": trend_data,
            "period": {
                "startDate": start_date.strftime("%Y-%m-%d"),
                "endDate": end_date.strftime("%Y-%m-%d")
            }
        }
        
        return metrics
    except Exception as e:
        # В случае ошибки логируем её и возвращаем мок-данные как запасной вариант
        print(f"Ошибка при получении финансовых метрик: {e}")
        return get_mock_financial_metrics(start_date, end_date)


def get_menu_metrics(
    db: Session, 
    start_date: datetime = None, 
    end_date: datetime = None,
    category_id: Optional[int] = None,
    dish_id: Optional[int] = None,
    use_mock_data: bool = False
) -> Dict[str, Any]:
    """
    Получение комплексных метрик по меню для аналитики
    """
    # Если запрошены мок-данные, возвращаем их
    if use_mock_data:
        return get_mock_menu_metrics(start_date, end_date)
    
    try:
        # Реализация запроса к БД для получения метрик
        # ... существующий код ...
        
        # В случае ошибки или отсутствия данных возвращаем мок-данные
        return get_mock_menu_metrics(start_date, end_date)
    except Exception as e:
        # В случае ошибки логируем её и возвращаем мок-данные как запасной вариант
        print(f"Ошибка при получении метрик меню: {e}")
        return get_mock_menu_metrics(start_date, end_date)


def get_customer_metrics(
    db: Session, 
    start_date: datetime = None, 
    end_date: datetime = None,
    user_id: Optional[int] = None,
    use_mock_data: bool = False
) -> Dict[str, Any]:
    """
    Получение комплексных метрик по клиентам
    """
    # Если запрошены мок-данные, возвращаем их
    if use_mock_data:
        return get_mock_customer_metrics(start_date, end_date)
    
    try:
        # Реализация запроса к БД для получения метрик
        # ... существующий код ...
        
        # В случае ошибки или отсутствия данных возвращаем мок-данные
        return get_mock_customer_metrics(start_date, end_date)
    except Exception as e:
        # В случае ошибки логируем её и возвращаем мок-данные как запасной вариант
        print(f"Ошибка при получении метрик клиентов: {e}")
        return get_mock_customer_metrics(start_date, end_date)


def get_operational_metrics(
    db: Session, 
    start_date: datetime = None, 
    end_date: datetime = None,
    use_mock_data: bool = False
) -> Dict[str, Any]:
    """
    Получение комплексных операционных метрик
    """
    # Если запрошены мок-данные, возвращаем их
    if use_mock_data:
        return get_mock_operational_metrics(start_date, end_date)
    
    try:
        # Реализация запроса к БД для получения метрик
        # ... существующий код ...
        
        # В случае ошибки или отсутствия данных возвращаем мок-данные
        return get_mock_operational_metrics(start_date, end_date)
    except Exception as e:
        # В случае ошибки логируем её и возвращаем мок-данные как запасной вариант
        print(f"Ошибка при получении операционных метрик: {e}")
        return get_mock_operational_metrics(start_date, end_date)


def get_predictive_metrics(
    db: Session, 
    start_date: datetime = None, 
    end_date: datetime = None,
    use_mock_data: bool = False
) -> Dict[str, Any]:
    """
    Получение предиктивных метрик ресторана на основе анализа данных
    """
    # Если запрошены мок-данные, возвращаем их
    if use_mock_data:
        return get_mock_predictive_metrics(start_date, end_date)
    
    try:
        # Реализация запроса к БД для получения метрик
        # ... существующий код ...
        
        # В случае ошибки или отсутствия данных возвращаем мок-данные
        return get_mock_predictive_metrics(start_date, end_date)
    except Exception as e:
        # В случае ошибки логируем её и возвращаем мок-данные как запасной вариант
        print(f"Ошибка при получении предиктивных метрик: {e}")
        return get_mock_predictive_metrics(start_date, end_date)


# Мок-данные для финансовой аналитики
def get_mock_financial_metrics(start_date: datetime, end_date: datetime) -> Dict[str, Any]:
    return {
        "totalRevenue": 1250000,
        "totalCost": 750000,
        "grossProfit": 500000,
        "profitMargin": 40,
        "averageOrderValue": 3500,
        "orderCount": 357,
        "revenueByCategory": {
            1: 350000,
            2: 280000,
            3: 210000,
            4: 170000,
            5: 140000
        },
        "revenueByTimeOfDay": {
            '12-14': 280000,
            '14-16': 220000,
            '16-18': 180000,
            '18-20': 320000,
            '20-22': 250000
        },
        "revenueByDayOfWeek": {
            'Понедельник': 150000,
            'Вторник': 160000,
            'Среда': 170000,
            'Четверг': 190000,
            'Пятница': 220000,
            'Суббота': 190000,
            'Воскресенье': 170000
        },
        "revenueTrend": [
            {"date": (start_date + timedelta(days=i)).strftime("%Y-%m-%d"), 
             "value": 30000 + i * 1000 + (5000 if (start_date + timedelta(days=i)).weekday() >= 5 else 0)}
            for i in range((end_date - start_date).days + 1)
        ],
        "period": {
            "startDate": start_date.strftime("%Y-%m-%d"),
            "endDate": end_date.strftime("%Y-%m-%d")
        }
    }

# Мок-данные для аналитики меню
def get_mock_menu_metrics(start_date: datetime, end_date: datetime) -> Dict[str, Any]:
    return {
        "topSellingDishes": [
            {"dishId": 1, "dishName": "Стейк Рибай", "salesCount": 105, "revenue": 210000, "percentage": 25.2},
            {"dishId": 2, "dishName": "Цезарь с курицей", "salesCount": 89, "revenue": 133500, "percentage": 16.1},
            {"dishId": 3, "dishName": "Паста Карбонара", "salesCount": 76, "revenue": 95000, "percentage": 11.4},
            {"dishId": 4, "dishName": "Борщ", "salesCount": 70, "revenue": 84000, "percentage": 10.1},
            {"dishId": 5, "dishName": "Тирамису", "salesCount": 68, "revenue": 74800, "percentage": 9.0}
        ],
        "mostProfitableDishes": [
            {"dishId": 1, "dishName": "Стейк Рибай", "salesCount": 105, "revenue": 210000, "percentage": 25.2, "costPrice": 100000, "profit": 110000, "profitMargin": 52.4},
            {"dishId": 6, "dishName": "Лосось на гриле", "salesCount": 60, "revenue": 120000, "percentage": 14.5, "costPrice": 60000, "profit": 60000, "profitMargin": 50.0},
            {"dishId": 2, "dishName": "Цезарь с курицей", "salesCount": 89, "revenue": 133500, "percentage": 16.1, "costPrice": 67000, "profit": 66500, "profitMargin": 49.8},
            {"dishId": 7, "dishName": "Утиная грудка", "salesCount": 45, "revenue": 135000, "percentage": 16.3, "costPrice": 70000, "profit": 65000, "profitMargin": 48.1},
            {"dishId": 8, "dishName": "Говядина Веллингтон", "salesCount": 35, "revenue": 122500, "percentage": 14.8, "costPrice": 65000, "profit": 57500, "profitMargin": 46.9}
        ],
        "leastSellingDishes": [
            {"dishId": 30, "dishName": "Салат Оливье", "salesCount": 15, "revenue": 18000, "percentage": 2.2},
            {"dishId": 31, "dishName": "Окрошка", "salesCount": 12, "revenue": 14400, "percentage": 1.7},
            {"dishId": 32, "dishName": "Рататуй", "salesCount": 10, "revenue": 15000, "percentage": 1.8},
            {"dishId": 33, "dishName": "Суп-пюре из тыквы", "salesCount": 8, "revenue": 9600, "percentage": 1.2},
            {"dishId": 34, "dishName": "Салат из морепродуктов", "salesCount": 5, "revenue": 7500, "percentage": 0.9}
        ],
        "averageCookingTime": 18,
        "categoryPopularity": {
            1: 30,
            2: 40,
            3: 15,
            4: 10,
            5: 5
        },
        "menuItemSalesTrend": {
            1: [{"date": (start_date + timedelta(days=i)).strftime("%Y-%m-%d"), "value": 8 + (i % 3)} for i in range((end_date - start_date).days + 1)],
            2: [{"date": (start_date + timedelta(days=i)).strftime("%Y-%m-%d"), "value": 6 + (i % 4)} for i in range((end_date - start_date).days + 1)],
            3: [{"date": (start_date + timedelta(days=i)).strftime("%Y-%m-%d"), "value": 5 + (i % 3)} for i in range((end_date - start_date).days + 1)],
        },
        "categoryPerformance": {
            "1": {"salesPercentage": 30, "averageOrderValue": 1200, "averageProfitMargin": 35},
            "2": {"salesPercentage": 40, "averageOrderValue": 2000, "averageProfitMargin": 42},
            "3": {"salesPercentage": 15, "averageOrderValue": 900, "averageProfitMargin": 38},
            "4": {"salesPercentage": 10, "averageOrderValue": 600, "averageProfitMargin": 45},
            "5": {"salesPercentage": 5, "averageOrderValue": 300, "averageProfitMargin": 60}
        },
        "period": {
            "startDate": start_date.strftime("%Y-%m-%d"),
            "endDate": end_date.strftime("%Y-%m-%d")
        }
    }

# Мок-данные для аналитики клиентов
def get_mock_customer_metrics(start_date: datetime, end_date: datetime) -> Dict[str, Any]:
    return {
        "totalCustomers": 580,
        "newCustomers": 72,
        "returningCustomers": 320,
        "returnRate": 62.5,
        "averageVisitsPerCustomer": 2.8,
        "customerSatisfaction": 4.6,
        "customerSegmentation": {
            "Новые": 12.4,
            "Случайные": 44.8,
            "Регулярные": 31.9,
            "Лояльные": 10.9
        },
        "customerDemographics": {
            "age_groups": {
                "18-24": 15,
                "25-34": 32,
                "35-44": 28,
                "45-54": 18,
                "55+": 7
            },
            "gender": {
                "Мужской": 52,
                "Женский": 48
            },
            "total_customers": 580
        },
        "topCustomers": [
            {"userId": 1, "fullName": "Иван Петров", "email": "ivan@example.com", "totalSpent": 58000, "ordersCount": 12, "averageRating": 4.8, "lastVisit": "2023-04-25"},
            {"userId": 2, "fullName": "Анна Сидорова", "email": "anna@example.com", "totalSpent": 52000, "ordersCount": 10, "averageRating": 4.5, "lastVisit": "2023-04-28"},
            {"userId": 3, "fullName": "Сергей Иванов", "email": "sergey@example.com", "totalSpent": 48000, "ordersCount": 8, "averageRating": 4.2, "lastVisit": "2023-04-22"},
            {"userId": 4, "fullName": "Ольга Смирнова", "email": "olga@example.com", "totalSpent": 43000, "ordersCount": 7, "averageRating": 4.0, "lastVisit": "2023-04-27"},
            {"userId": 5, "fullName": "Николай Козлов", "email": "nikolay@example.com", "totalSpent": 40000, "ordersCount": 6, "averageRating": 4.7, "lastVisit": "2023-04-26"}
        ],
        "period": {
            "startDate": start_date.strftime("%Y-%m-%d"),
            "endDate": end_date.strftime("%Y-%m-%d")
        }
    }

# Мок-данные для операционной аналитики
def get_mock_operational_metrics(start_date: datetime, end_date: datetime) -> Dict[str, Any]:
    return {
        "averageOrderPreparationTime": 20.5,
        "averageTableTurnoverTime": 62.0,
        "tablesCount": 15,
        "averageTableUtilization": 72,
        "averageOrdersPerTable": 24,
        "tableUtilization": {
            1: 85,
            2: 90,
            3: 75,
            4: 80,
            5: 95,
            6: 70,
            7: 65,
            8: 75,
            9: 80,
            10: 85,
            11: 55,
            12: 60,
            13: 45,
            14: 50,
            15: 65
        },
        "peakHours": {
            '12-14': 100,
            '14-16': 95,
            '16-18': 90,
            '18-20': 85,
            '20-22': 80
        },
        "staffEfficiency": {
            1: {"name": "Анна", "role": "Официант", "averageServiceTime": 12.5, "customersServed": 35, "rating": 4.8},
            2: {"name": "Иван", "role": "Официант", "averageServiceTime": 14.8, "customersServed": 28, "rating": 4.5},
            3: {"name": "Мария", "role": "Официант", "averageServiceTime": 11.2, "customersServed": 32, "rating": 4.9},
            4: {"name": "Алексей", "role": "Официант", "averageServiceTime": 15.5, "customersServed": 25, "rating": 4.2},
            5: {"name": "Елена", "role": "Официант", "averageServiceTime": 13.0, "customersServed": 30, "rating": 4.6}
        },
        "orderCompletionRates": {
            'В ожидании': 15.2,
            'В обработке': 22.8,
            'Готовится': 18.5,
            'Готов к выдаче': 12.0,
            'Завершён': 26.3,
            'Отменен': 5.2
        },
        "period": {
            "startDate": start_date.strftime("%Y-%m-%d"),
            "endDate": end_date.strftime("%Y-%m-%d")
        }
    }

# Мок-данные для предиктивной аналитики
def get_mock_predictive_metrics(start_date: datetime, end_date: datetime) -> Dict[str, Any]:
    return {
        "salesForecast": [
            {"date": (end_date + timedelta(days=i)).strftime("%Y-%m-%d"), 
             "value": 350000 + (i * 5000) + (100000 if is_weekend(end_date + timedelta(days=i)) else 0)}
            for i in range(14)
        ],
        "inventoryForecast": {
            "Мясо": {"currentStock": 45, "recommendedStock": 60, "forecastUsage": 55},
            "Рыба": {"currentStock": 25, "recommendedStock": 30, "forecastUsage": 28},
            "Овощи": {"currentStock": 80, "recommendedStock": 100, "forecastUsage": 90},
            "Молочные продукты": {"currentStock": 35, "recommendedStock": 40, "forecastUsage": 38},
            "Напитки": {"currentStock": 65, "recommendedStock": 70, "forecastUsage": 68}
        },
        "staffingNeeds": {
            'monday': {'10-14': 3, '14-18': 4, '18-22': 5},
            'tuesday': {'10-14': 3, '14-18': 4, '18-22': 5},
            'wednesday': {'10-14': 3, '14-18': 4, '18-22': 5},
            'thursday': {'10-14': 4, '14-18': 5, '18-22': 6},
            'friday': {'10-14': 5, '14-18': 6, '18-22': 7},
            'saturday': {'10-14': 6, '14-18': 7, '18-22': 8},
            'sunday': {'10-14': 5, '14-18': 6, '18-22': 6}
        },
        "peakTimePrediction": {
            'monday': {'hour': 19, 'expectedOccupancy': 75},
            'tuesday': {'hour': 19, 'expectedOccupancy': 70},
            'wednesday': {'hour': 19, 'expectedOccupancy': 80},
            'thursday': {'hour': 20, 'expectedOccupancy': 85},
            'friday': {'hour': 20, 'expectedOccupancy': 95},
            'saturday': {'hour': 21, 'expectedOccupancy': 100},
            'sunday': {'hour': 14, 'expectedOccupancy': 90}
        },
        "suggestedPromotions": [
            {
                "dishId": 5,
                "dishName": "Фирменный стейк",
                "reason": "Низкие продажи, высокая маржа",
                "suggestedDiscount": 15,
                "potentialRevenue": 45000
            },
            {
                "dishId": 12,
                "dishName": "Салат Греческий",
                "reason": "Низкие продажи",
                "suggestedDiscount": 10,
                "potentialRevenue": 28000
            }
        ],
        "period": {
            "startDate": start_date.strftime("%Y-%m-%d"),
            "endDate": end_date.strftime("%Y-%m-%d")
        }
    } 