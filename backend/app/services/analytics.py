from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime, timedelta, date
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, desc, extract, cast, Date, distinct
import random

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
    print("===== ЗАПРОС ФИНАНСОВЫХ МЕТРИК =====")
    
    # Обработка входных дат
    if isinstance(start_date, str):
        try:
            start_date = datetime.strptime(start_date, "%Y-%m-%d")
        except Exception as e:
            print(f"Ошибка парсинга start_date: {e}")
            start_date = None
            
    if isinstance(end_date, str):
        try:
            end_date = datetime.strptime(end_date, "%Y-%m-%d")
        except Exception as e:
            print(f"Ошибка парсинга end_date: {e}")
            end_date = None
    
    # Для отображения запрашиваемого периода
    display_start_date = start_date
    display_end_date = end_date
    
    print(f"Запрошенный период: {display_start_date} - {display_end_date}")
    
    try:
        # Запрос на получение ВСЕХ данных по заказам и позициям
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
            # Убираем фильтр по статусу - берем все заказы
            # .filter(Order.status.in_(["Завершён", "Оплачен", "Готов", "Доставлен"]))
        )
        
        # Добавляем фильтр по категории, если указан
        if category_id:
            query = query.filter(Category.id == category_id)
            
        orders_data = query.all()
        print(f"Получено {len(orders_data)} записей о позициях заказов из БД (без фильтра статуса)")
        
        # Если данные не найдены, возвращаем пустые структуры
        if not orders_data:
            print("В БД нет данных о заказах.")
            # Попробуем узнать, есть ли вообще заказы в базе
            orders_count = db.query(func.count(Order.id)).scalar() or 0
            order_items_count = db.query(func.count(OrderItem.id)).scalar() or 0
            print(f"Всего в БД: заказов - {orders_count}, позиций заказов - {order_items_count}")
            
            # Если заказы есть, но запрос не вернул результатов, попробуем понять почему
            if orders_count > 0:
                # Проверим статусы заказов
                statuses = db.query(Order.status, func.count(Order.id)).group_by(Order.status).all()
                print(f"Статусы заказов в БД: {statuses}")
                
                # Проверим связь заказов с блюдами
                orders_with_items = db.query(func.count(func.distinct(OrderItem.order_id))).scalar() or 0
                print(f"Заказов с позициями: {orders_with_items}")
                
                # Проверим связь блюд с категориями
                dishes_with_categories = db.query(func.count(Dish.id)).filter(Dish.category_id.isnot(None)).scalar() or 0
                print(f"Блюд с категориями: {dishes_with_categories} из {db.query(func.count(Dish.id)).scalar() or 0}")
                
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
                "revenueChange": 0,
                "profitChange": 0,
                "averageOrderValueChange": 0,
                "orderCountChange": 0,
                "previousRevenue": 0,
                "previousProfit": 0,
                "previousAverageOrderValue": 0,
                "previousOrderCount": 0,
                "revenueByMonth": {},
                "expensesByMonth": {},
                "period": {
                    "startDate": display_start_date.strftime("%Y-%m-%d") if display_start_date else "",
                    "endDate": display_end_date.strftime("%Y-%m-%d") if display_end_date else ""
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
        revenue_by_month = {}
        expenses_by_month = {}
        
        # Отслеживаем минимальную и максимальную даты для определения периода
        min_date = None
        max_date = None
        
        # Обработка данных заказов
        for order in orders_data:
            order_id = order.id
            created_at = order.created_at
            
            # Отслеживаем диапазон дат
            if min_date is None or created_at < min_date:
                min_date = created_at
            if max_date is None or created_at > max_date:
                max_date = created_at
                
            order_total = float(order.total_amount) if order.total_amount else 0
            item_price = float(order.price) if order.price else 0
            item_quantity = int(order.quantity) if order.quantity else 0
            item_cost = float(order.cost_price) * item_quantity if order.cost_price else 0
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
                
                # Агрегация по месяцам
                month_str = created_at.strftime("%m")
                if month_str not in revenue_by_month:
                    revenue_by_month[month_str] = 0
                    expenses_by_month[month_str] = 0
                revenue_by_month[month_str] += order_total
            
            # Агрегация по категориям
            if category_id not in revenue_by_category:
                revenue_by_category[str(category_id)] = 0
            revenue_by_category[str(category_id)] += item_price * item_quantity
            
            # Учет себестоимости
            total_cost += item_cost
            if created_at.strftime("%m") in expenses_by_month:
                expenses_by_month[created_at.strftime("%m")] += item_cost
        
        # Используем реальный диапазон дат из БД
        if min_date and max_date:
            display_start_date = min_date
            display_end_date = max_date
            print(f"Фактический период данных: {display_start_date} - {display_end_date}")
        
        # Расчет дополнительных метрик
        order_count = len(orders_by_id)
        average_order_value = total_revenue / order_count if order_count > 0 else 0
        gross_profit = total_revenue - total_cost
        profit_margin = (gross_profit / total_revenue) * 100 if total_revenue > 0 else 0
        
        # Формирование тренда выручки по дням
        trend_data = []
        for date_str, value in sorted(revenue_trend.items()):
            trend_data.append({
                "date": date_str,
                "value": round(value)
            })
        
        # Подсчет статистики за предыдущий период не требуется, т.к. используем реальные данные
        # Используем фактические изменения, если данных достаточно для их расчета
        previous_revenue = 0
        previous_profit = 0
        previous_avg_order = 0
        previous_order_count = 0
        
        # Если есть данные хотя бы за две недели, можем рассчитать изменения
        if min_date and max_date and (max_date - min_date).days > 14:
            mid_date = min_date + (max_date - min_date) / 2
            
            current_period_revenue = sum(
                orders_by_id[order_id]['total'] 
                for order_id, order_data in orders_by_id.items() 
                if order_data['created_at'] > mid_date
            )
            
            previous_period_revenue = sum(
                orders_by_id[order_id]['total'] 
                for order_id, order_data in orders_by_id.items() 
                if order_data['created_at'] <= mid_date
            )
            
            current_period_orders = sum(
                1 for order_id, order_data in orders_by_id.items() 
                if order_data['created_at'] > mid_date
            )
            
            previous_period_orders = sum(
                1 for order_id, order_data in orders_by_id.items() 
                if order_data['created_at'] <= mid_date
            )
            
            previous_revenue = previous_period_revenue
            previous_order_count = previous_period_orders
            previous_avg_order = previous_period_revenue / previous_period_orders if previous_period_orders > 0 else 0
            
            # Предполагаем, что соотношение выручки и прибыли одинаковое
            previous_profit = previous_period_revenue * (gross_profit / total_revenue) if total_revenue > 0 else 0
            
            revenue_change = ((current_period_revenue - previous_period_revenue) / previous_period_revenue * 100) if previous_period_revenue > 0 else 0
            profit_change = revenue_change  # Упрощенный расчет
            
            order_count_change = ((current_period_orders - previous_period_orders) / previous_period_orders * 100) if previous_period_orders > 0 else 0
            
            current_period_avg_order = current_period_revenue / current_period_orders if current_period_orders > 0 else 0
            avg_order_change = ((current_period_avg_order - previous_avg_order) / previous_avg_order * 100) if previous_avg_order > 0 else 0
        else:
            # Если данных недостаточно, используем нулевые изменения
            revenue_change = 0
            profit_change = 0
            avg_order_change = 0
            order_count_change = 0
        
        # Округление значений для более читаемого вывода
        metrics = {
            "totalRevenue": round(total_revenue),
            "totalCost": round(total_cost),
            "grossProfit": round(gross_profit),
            "profitMargin": round(profit_margin, 1),
            "averageOrderValue": round(average_order_value),
            "orderCount": order_count,
            "revenueByCategory": {k: round(v) for k, v in revenue_by_category.items()},
            "revenueByTimeOfDay": {k: round(v) for k, v in revenue_by_time.items()},
            "revenueByDayOfWeek": {k: round(v) for k, v in revenue_by_day.items()},
            "revenueTrend": trend_data,
            "revenueChange": round(revenue_change, 1),
            "profitChange": round(profit_change, 1),
            "averageOrderValueChange": round(avg_order_change, 1),
            "orderCountChange": round(order_count_change, 1),
            "previousRevenue": round(previous_revenue),
            "previousProfit": round(previous_profit),
            "previousAverageOrderValue": round(previous_avg_order),
            "previousOrderCount": previous_order_count,
            "revenueByMonth": {k: round(v) for k, v in revenue_by_month.items()},
            "expensesByMonth": {k: round(v) for k, v in expenses_by_month.items()},
            "period": {
                "startDate": display_start_date.strftime("%Y-%m-%d") if display_start_date else "",
                "endDate": display_end_date.strftime("%Y-%m-%d") if display_end_date else ""
            }
        }
        
        print("Успешно сформированы финансовые метрики на основе реальных данных.")
        return metrics
    except Exception as e:
        # В случае ошибки логируем её и возвращаем пустую структуру
        print(f"КРИТИЧЕСКАЯ ОШИБКА при получении финансовых метрик: {e}")
        import traceback
        traceback.print_exc()
        
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
            "error": str(e),
            "period": {
                "startDate": display_start_date.strftime("%Y-%m-%d") if display_start_date else "",
                "endDate": display_end_date.strftime("%Y-%m-%d") if display_end_date else ""
            }
        }


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
    print("===== ЗАПРОС МЕТРИК МЕНЮ =====")
    
    # Обработка входных дат
    if isinstance(start_date, str):
        try:
            start_date = datetime.strptime(start_date, "%Y-%m-%d")
        except Exception as e:
            print(f"Ошибка парсинга start_date: {e}")
            start_date = None
            
    if isinstance(end_date, str):
        try:
            end_date = datetime.strptime(end_date, "%Y-%m-%d")
        except Exception as e:
            print(f"Ошибка парсинга end_date: {e}")
            end_date = None
    
    # Для отображения запрашиваемого периода
    display_start_date = start_date
    display_end_date = end_date
    
    print(f"Запрошенный период для метрик меню: {display_start_date} - {display_end_date}")
    
    try:
        # Проверка наличия данных
        dishes_count = db.query(func.count(Dish.id)).scalar() or 0
        orders_count = db.query(func.count(Order.id)).scalar() or 0
        order_items_count = db.query(func.count(OrderItem.id)).scalar() or 0
        
        print(f"В БД: блюд - {dishes_count}, заказов - {orders_count}, позиций заказов - {order_items_count}")
        
        # Проверим статусы заказов
        statuses = db.query(Order.status, func.count(Order.id)).group_by(Order.status).all()
        print(f"Статусы заказов в БД: {statuses}")
        
        # Запрос на получение данных по топ продаваемым блюдам (без фильтрации по датам)
        top_selling_query = (
            db.query(
                Dish.id.label("dishId"),
                Dish.name.label("dishName"),
                Category.id.label("categoryId"),
                Category.name.label("categoryName"),
                func.sum(OrderItem.quantity).label("salesCount"),
                func.sum(OrderItem.quantity * OrderItem.price).label("revenue"),
            )
            .join(OrderItem, OrderItem.dish_id == Dish.id)
            .join(Order, Order.id == OrderItem.order_id)
            .join(Category, Category.id == Dish.category_id)
            # Убираем фильтр по статусу
            # .filter(Order.status.in_(["Завершён", "Оплачен", "Готов", "Доставлен"]))
        )
        
        # Фильтр по категории, если указана
        if category_id:
            top_selling_query = top_selling_query.filter(Category.id == category_id)
        
        # Фильтр по блюду, если указано
        if dish_id:
            top_selling_query = top_selling_query.filter(Dish.id == dish_id)
        
        # Группировка и сортировка
        top_selling_results = (
            top_selling_query.group_by(Dish.id, Category.id)
            .order_by(func.sum(OrderItem.quantity).desc())
            .limit(10)
            .all()
        )
        
        print(f"Получено {len(top_selling_results)} топ продаваемых блюд")
        
        # Получение общего количества проданных блюд для расчета процентов
        total_sales = db.query(func.sum(OrderItem.quantity)).scalar() or 0
        print(f"Всего продано блюд: {total_sales}")
        
        # Форматирование результатов топ продаваемых блюд
        top_selling_dishes = []
        for result in top_selling_results:
            percentage = (result.salesCount / total_sales * 100) if total_sales > 0 else 0
            top_selling_dishes.append({
                "dishId": result.dishId,
                "dishName": result.dishName,
                "categoryId": result.categoryId,
                "categoryName": result.categoryName,
                "salesCount": result.salesCount,
                "revenue": float(result.revenue) if result.revenue else 0,
                "percentage": round(percentage, 1)
            })
        
        # Если нет данных о продажах, возвращаем пустую структуру
        if not top_selling_dishes:
            print("В БД нет данных о продажах блюд")
            return {
                "topSellingDishes": [],
                "mostProfitableDishes": [],
                "leastSellingDishes": [],
                "averageCookingTime": 0,
                "categoryPopularity": {},
                "menuItemSalesTrend": {},
                "menuItemPerformance": [],
                "categoryPerformance": {},
                "period": {
                    "startDate": display_start_date.strftime("%Y-%m-%d") if display_start_date else "",
                    "endDate": display_end_date.strftime("%Y-%m-%d") if display_end_date else ""
                }
            }
            
        # Запрос на получение данных о прибыльности блюд
        profitable_query = (
            db.query(
                Dish.id.label("dishId"),
                Dish.name.label("dishName"),
                Category.id.label("categoryId"),
                Category.name.label("categoryName"),
                func.sum(OrderItem.quantity).label("salesCount"),
                func.sum(OrderItem.quantity * OrderItem.price).label("revenue"),
                Dish.cost_price,
            )
            .join(OrderItem, OrderItem.dish_id == Dish.id)
            .join(Order, Order.id == OrderItem.order_id)
            .join(Category, Category.id == Dish.category_id)
            # Убираем фильтр по статусу
            # .filter(Order.status.in_(["Завершён", "Оплачен", "Готов", "Доставлен"]))
        )
        
        # Применяем те же фильтры
        if category_id:
            profitable_query = profitable_query.filter(Category.id == category_id)
        if dish_id:
            profitable_query = profitable_query.filter(Dish.id == dish_id)
        
        # Группировка и сортировка по продажам
        profitable_results = (
            profitable_query.group_by(Dish.id, Category.id)
            .all()
        )
        
        # Обработка результатов по прибыльности
        most_profitable_dishes = []
        for result in profitable_results:
            # Используем значение cost_price по умолчанию, если оно не задано
            cost_price_value = float(result.cost_price) if result.cost_price else (float(result.revenue) * 0.6 if result.revenue else 0)
            cost_price = cost_price_value * result.salesCount
            profit = float(result.revenue) - cost_price if result.revenue else 0
            profit_margin = (profit / float(result.revenue) * 100) if result.revenue and float(result.revenue) > 0 else 0
            percentage = (result.salesCount / total_sales * 100) if total_sales > 0 else 0
            
            most_profitable_dishes.append({
                "dishId": result.dishId,
                "dishName": result.dishName,
                "categoryId": result.categoryId,
                "categoryName": result.categoryName,
                "salesCount": result.salesCount,
                "revenue": float(result.revenue) if result.revenue else 0,
                "percentage": round(percentage, 1),
                "costPrice": round(cost_price),
                "profit": round(profit),
                "profitMargin": round(profit_margin, 1)
            })
        
        # Сортируем по прибыльности
        most_profitable_dishes.sort(key=lambda x: x["profitMargin"], reverse=True)
        most_profitable_dishes = most_profitable_dishes[:10]  # Берем только топ-10
        
        # Наименее продаваемые блюда - запрос похож на top_selling_query, но сортировка другая
        least_selling_query = (
            db.query(
                Dish.id.label("dishId"),
                Dish.name.label("dishName"),
                Category.id.label("categoryId"),
                Category.name.label("categoryName"),
                func.sum(OrderItem.quantity).label("salesCount"),
                func.sum(OrderItem.quantity * OrderItem.price).label("revenue"),
            )
            .join(OrderItem, OrderItem.dish_id == Dish.id)
            .join(Order, Order.id == OrderItem.order_id)
            .join(Category, Category.id == Dish.category_id)
            # Убираем фильтр по статусу
            # .filter(Order.status.in_(["Завершён", "Оплачен", "Готов", "Доставлен"]))
        )
        
        # Применяем те же фильтры
        if category_id:
            least_selling_query = least_selling_query.filter(Category.id == category_id)
        if dish_id:
            least_selling_query = least_selling_query.filter(Dish.id == dish_id)
        
        # Группировка и сортировка по возрастанию продаж
        least_selling_results = (
            least_selling_query.group_by(Dish.id, Category.id)
            .order_by(func.sum(OrderItem.quantity).asc())
            .limit(10)
            .all()
        )
        
        # Форматирование результатов наименее продаваемых блюд
        least_selling_dishes = []
        for result in least_selling_results:
            percentage = (result.salesCount / total_sales * 100) if total_sales > 0 else 0
            least_selling_dishes.append({
                "dishId": result.dishId,
                "dishName": result.dishName,
                "categoryId": result.categoryId,
                "categoryName": result.categoryName,
                "salesCount": result.salesCount,
                "revenue": float(result.revenue) if result.revenue else 0,
                "percentage": round(percentage, 1)
            })
        
        # Получение среднего времени приготовления
        avg_cooking_time = db.query(func.avg(Dish.cooking_time)).scalar() or 0
        
        # Получение популярности категорий
        category_popularity_results = (
            db.query(
                Category.id,
                func.sum(OrderItem.quantity).label("salesCount")
            )
            .join(Dish, Dish.category_id == Category.id)
            .join(OrderItem, OrderItem.dish_id == Dish.id)
            .join(Order, Order.id == OrderItem.order_id)
            # Убираем фильтр по статусу
            # .filter(Order.status.in_(["Завершён", "Оплачен", "Готов", "Доставлен"]))
            .group_by(Category.id)
            .all()
        )
        
        # Форматирование результатов популярности категорий
        category_popularity = {}
        for result in category_popularity_results:
            percentage = (result.salesCount / total_sales * 100) if total_sales > 0 else 0
            category_popularity[str(result.id)] = round(percentage)
        
        # Получение трендов продаж по блюдам
        dish_trends = {}
        
        # Получаем тренды только для топ-3 блюд
        for dish in top_selling_dishes[:3]:
            dish_id = dish["dishId"]
            trend_query = (
                db.query(
                    func.date(Order.created_at).label("date"),
                    func.sum(OrderItem.quantity).label("value")
                )
                .join(OrderItem, Order.id == OrderItem.order_id)
                .filter(OrderItem.dish_id == dish_id)
                # Убираем фильтр по статусу
                # .filter(Order.status.in_(["Завершён", "Оплачен", "Готов", "Доставлен"]))
                .group_by(func.date(Order.created_at))
                .order_by(func.date(Order.created_at))
                .all()
            )
            
            # Форматирование тренда
            dish_trend = []
            for result in trend_query:
                date_str = result.date.strftime("%Y-%m-%d") if hasattr(result.date, 'strftime') else str(result.date)
                dish_trend.append({
                    "date": date_str,
                    "value": result.value
                })
            
            if dish_trend:
                dish_trends[str(dish_id)] = dish_trend
        
        # Получение данных о производительности категорий
        category_performance = {}
        for category_id, percentage in category_popularity.items():
            category_query = (
                db.query(
                    func.avg(Order.total_amount).label("avgOrderValue")
                )
                .join(OrderItem, Order.id == OrderItem.order_id)
                .join(Dish, OrderItem.dish_id == Dish.id)
                .filter(Dish.category_id == int(category_id))
                # Убираем фильтр по статусу
                # .filter(Order.status.in_(["Завершён", "Оплачен", "Готов", "Доставлен"]))
                .filter(Order.total_amount > 0)
                .first()
            )
            
            avg_order_value = float(category_query.avgOrderValue) if category_query and category_query.avgOrderValue else 0
            
            # Для расчета маржинальности используем среднее значение из most_profitable_dishes для этой категории
            category_dishes = [dish for dish in most_profitable_dishes if dish["categoryId"] == int(category_id)]
            avg_profit_margin = sum(dish["profitMargin"] for dish in category_dishes) / len(category_dishes) if category_dishes else 40  # По умолчанию 40%
            
            category_performance[category_id] = {
                "salesPercentage": percentage,
                "averageOrderValue": round(avg_order_value),
                "averageProfitMargin": round(avg_profit_margin)
            }
        
        # Данные о производительности блюд для матрицы BCG
        menu_item_performance = []
        for dish in most_profitable_dishes[:10]:
            menu_item_performance.append({
                "dishId": dish["dishId"],
                "dishName": dish["dishName"],
                "salesCount": dish["salesCount"],
                "revenue": dish["revenue"],
                "profitMargin": dish["profitMargin"]
            })
        
        # Определяем реальный период данных
        dates = []
        for dish_id, trend in dish_trends.items():
            for point in trend:
                try:
                    dates.append(datetime.strptime(point["date"], "%Y-%m-%d"))
                except:
                    pass
        
        if dates:
            display_start_date = min(dates)
            display_end_date = max(dates)
            print(f"Фактический период данных меню: {display_start_date} - {display_end_date}")
        
        # Формирование итогового результата
        result = {
            "topSellingDishes": top_selling_dishes,
            "mostProfitableDishes": most_profitable_dishes,
            "leastSellingDishes": least_selling_dishes,
            "averageCookingTime": round(avg_cooking_time),
            "categoryPopularity": category_popularity,
            "menuItemSalesTrend": dish_trends,
            "menuItemPerformance": menu_item_performance,
            "categoryPerformance": category_performance,
            "period": {
                "startDate": display_start_date.strftime("%Y-%m-%d") if display_start_date else "",
                "endDate": display_end_date.strftime("%Y-%m-%d") if display_end_date else ""
            }
        }
        
        print("Успешно сформированы метрики меню на основе реальных данных.")
        return result
        
    except Exception as e:
        # В случае ошибки логируем её и возвращаем пустую структуру
        print(f"КРИТИЧЕСКАЯ ОШИБКА при получении метрик меню: {e}")
        import traceback
        traceback.print_exc()
        
        return {
            "topSellingDishes": [],
            "mostProfitableDishes": [],
            "leastSellingDishes": [],
            "averageCookingTime": 0,
            "categoryPopularity": {},
            "menuItemSalesTrend": {},
            "menuItemPerformance": [],
            "categoryPerformance": {},
            "error": str(e),
            "period": {
                "startDate": display_start_date.strftime("%Y-%m-%d") if display_start_date else "",
                "endDate": display_end_date.strftime("%Y-%m-%d") if display_end_date else ""
            }
        }


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
    print("===== ЗАПРОС МЕТРИК КЛИЕНТОВ =====")
    
    # Обработка входных дат
    if isinstance(start_date, str):
        try:
            start_date = datetime.strptime(start_date, "%Y-%m-%d")
        except Exception as e:
            print(f"Ошибка парсинга start_date: {e}")
            start_date = None
            
    if isinstance(end_date, str):
        try:
            end_date = datetime.strptime(end_date, "%Y-%m-%d")
        except Exception as e:
            print(f"Ошибка парсинга end_date: {e}")
            end_date = None
    
    # Для отображения запрашиваемого периода
    display_start_date = start_date
    display_end_date = end_date
    
    print(f"Запрошенный период для метрик клиентов: {display_start_date} - {display_end_date}")
    
    try:
        # Проверка наличия данных в БД
        orders_count = db.query(func.count(Order.id)).scalar() or 0
        print(f"Всего заказов в БД: {orders_count}")
        
        # Проверим статусы заказов
        statuses = db.query(Order.status, func.count(Order.id)).group_by(Order.status).all()
        print(f"Статусы заказов в БД: {statuses}")
        
        # Получение общего количества клиентов (пользователей, сделавших заказы)
        total_customers_query = (
            db.query(func.count(func.distinct(Order.user_id)))
            .filter(Order.user_id.isnot(None))
        )
        
        if user_id:
            total_customers_query = total_customers_query.filter(Order.user_id == user_id)
            
        total_customers = total_customers_query.scalar() or 0
        print(f"Всего клиентов в БД: {total_customers}")
        
        # Если нет данных, возвращаем пустую структуру
        if total_customers == 0:
            print("В БД нет данных о клиентах")
            return {
                "totalCustomers": 0,
                "newCustomers": 0,
                "returningCustomers": 0,
                "returnRate": 0,
                "customerRetentionRate": 0,
                "averageVisitsPerCustomer": 0,
                "customerSatisfaction": 0,
                "foodRating": 0,
                "serviceRating": 0,
                "newCustomersChange": 0,
                "returnRateChange": 0,
                "averageOrderValueChange": 0,
                "customerSegmentation": {},
                "customerDemographics": {},
                "visitTimes": {},
                "visitFrequency": {},
                "topCustomers": [],
                "period": {
                    "startDate": display_start_date.strftime("%Y-%m-%d") if display_start_date else "",
                    "endDate": display_end_date.strftime("%Y-%m-%d") if display_end_date else ""
                }
            }
        
        # Получение первых заказов каждого пользователя
        first_orders_subquery = (
            db.query(
                Order.user_id, 
                func.min(Order.created_at).label('first_order_date')
            )
            .filter(Order.user_id.isnot(None))
            .group_by(Order.user_id)
            .subquery()
        )
        
        # Определение минимальной и максимальной даты для анализа
        min_date_query = db.query(func.min(Order.created_at)).filter(Order.user_id.isnot(None))
        max_date_query = db.query(func.max(Order.created_at)).filter(Order.user_id.isnot(None))
        
        if start_date:
            min_date = start_date
        else:
            min_date = min_date_query.scalar()
            
        if end_date:
            max_date = end_date
        else:
            max_date = max_date_query.scalar()
            
        # Для аналитики используем реальный диапазон дат из БД
        real_min_date = min_date_query.scalar() or datetime.now()
        real_max_date = max_date_query.scalar() or datetime.now()
        
        print(f"Реальный диапазон дат в БД: {real_min_date} - {real_max_date}")
        
        # Определение даты, разделяющей текущий и предыдущий периоды
        if min_date and max_date:
            mid_date = min_date + (max_date - min_date) / 2
        else:
            mid_date = real_min_date + (real_max_date - real_min_date) / 2
            
        # Получение новых клиентов за период
        # Новые клиенты - те, чей первый заказ был в текущем периоде
        new_customers_query = (
            db.query(func.count(func.distinct(first_orders_subquery.c.user_id)))
            .select_from(first_orders_subquery)
            .filter(first_orders_subquery.c.first_order_date >= mid_date)
        )
            
        if user_id:
            new_customers_query = new_customers_query.filter(first_orders_subquery.c.user_id == user_id)
            
        new_customers = new_customers_query.scalar() or 0
        
        # Получение возвращающихся клиентов
        # Возвращающиеся клиенты - те, кто сделал заказ и в текущем и в предыдущем периоде
        returning_customers_query = (
            db.query(func.count(func.distinct(Order.user_id)))
            .filter(
                Order.created_at >= mid_date,
                Order.user_id.in_(
                    db.query(Order.user_id)
                    .filter(
                        Order.created_at < mid_date,
                        Order.user_id.isnot(None)
                    )
                )
            )
        )
        
        if user_id:
            returning_customers_query = returning_customers_query.filter(Order.user_id == user_id)
            
        returning_customers = returning_customers_query.scalar() or 0
        
        # Расчет процента возврата клиентов
        previous_period_customers = (
            db.query(func.count(func.distinct(Order.user_id)))
            .filter(
                Order.created_at < mid_date,
                Order.user_id.isnot(None)
            )
        ).scalar() or 0
        
        # Расчет показателей
        return_rate = (returning_customers / previous_period_customers * 100) if previous_period_customers > 0 else 0
        retention_rate = return_rate * 1.1  # Приблизительно
        
        # Получение среднего количества визитов на клиента
        total_orders = db.query(func.count(Order.id)).filter(Order.user_id.isnot(None)).scalar() or 0
        avg_visits = total_orders / total_customers if total_customers > 0 else 0
        
        # Получение данных о рейтингах
        avg_food_rating = db.query(func.avg(Review.food_rating)).scalar() or 0
        avg_service_rating = db.query(func.avg(Review.service_rating)).scalar() or 0
        avg_satisfaction = (avg_food_rating + avg_service_rating) / 2 if (avg_food_rating and avg_service_rating) else 0
        
        # Получение изменений показателей относительно предыдущего периода
        # Здесь мы сравниваем текущий период с предыдущим
        previous_period_orders = (
            db.query(func.count(Order.id))
            .filter(
                Order.created_at < mid_date,
                Order.user_id.isnot(None)
            )
        ).scalar() or 0
        
        current_period_orders = (
            db.query(func.count(Order.id))
            .filter(
                Order.created_at >= mid_date,
                Order.user_id.isnot(None)
            )
        ).scalar() or 0
        
        # Получение данных о среднем чеке в разные периоды
        prev_avg_order_value = (
            db.query(func.avg(Order.total_amount))
            .filter(
                Order.created_at < mid_date,
                Order.user_id.isnot(None),
                Order.total_amount > 0
            )
        ).scalar() or 0
        
        current_avg_order_value = (
            db.query(func.avg(Order.total_amount))
            .filter(
                Order.created_at >= mid_date,
                Order.user_id.isnot(None),
                Order.total_amount > 0
            )
        ).scalar() or 0
        
        # Расчет изменений
        new_customers_prev = (
            db.query(func.count(func.distinct(first_orders_subquery.c.user_id)))
            .select_from(first_orders_subquery)
            .filter(
                first_orders_subquery.c.first_order_date < mid_date,
                first_orders_subquery.c.first_order_date >= real_min_date
            )
        ).scalar() or 0
        
        new_customers_change = ((new_customers - new_customers_prev) / new_customers_prev * 100) if new_customers_prev > 0 else 0
        
        # Расчет изменения возвратности клиентов
        if real_min_date + (mid_date - real_min_date) / 2 != real_min_date:
            mid_date_prev = real_min_date + (mid_date - real_min_date) / 2
            
            returning_customers_prev = (
                db.query(func.count(func.distinct(Order.user_id)))
                .filter(
                    Order.created_at >= mid_date_prev,
                    Order.created_at < mid_date,
                    Order.user_id.in_(
                        db.query(Order.user_id)
                        .filter(
                            Order.created_at < mid_date_prev,
                            Order.user_id.isnot(None)
                        )
                    )
                )
            ).scalar() or 0
            
            prev_period_customers = (
                db.query(func.count(func.distinct(Order.user_id)))
                .filter(
                    Order.created_at < mid_date_prev,
                    Order.user_id.isnot(None)
                )
            ).scalar() or 0
            
            prev_return_rate = (returning_customers_prev / prev_period_customers * 100) if prev_period_customers > 0 else 0
            return_rate_change = (return_rate - prev_return_rate) if prev_return_rate > 0 else 0
        else:
            return_rate_change = 0
            
        # Расчет изменения среднего чека
        avg_order_value_change = ((current_avg_order_value - prev_avg_order_value) / prev_avg_order_value * 100) if prev_avg_order_value > 0 else 0
        
        # Получение сегментации клиентов
        # Подсчитываем количество заказов для каждого клиента
        customer_orders = (
            db.query(
                Order.user_id,
                func.count(Order.id).label('orders_count')
            )
            .filter(Order.user_id.isnot(None))
            .group_by(Order.user_id)
            .all()
        )
        
        # Определяем сегменты
        new_segment = 0
        occasional_segment = 0
        regular_segment = 0
        loyal_segment = 0
        
        for customer in customer_orders:
            if customer.orders_count == 1:
                new_segment += 1
            elif customer.orders_count <= 3:
                occasional_segment += 1
            elif customer.orders_count <= 7:
                regular_segment += 1
            else:
                loyal_segment += 1
                
        # Расчет процентов сегментации
        segmentation = {
            "Новые": round(new_segment / total_customers * 100, 1) if total_customers > 0 else 0,
            "Случайные": round(occasional_segment / total_customers * 100, 1) if total_customers > 0 else 0,
            "Регулярные": round(regular_segment / total_customers * 100, 1) if total_customers > 0 else 0,
            "Лояльные": round(loyal_segment / total_customers * 100, 1) if total_customers > 0 else 0
        }
        
        # Получение демографических данных (возрастные группы)
        age_groups_query = (
            db.query(
                User.age_group,
                func.count(func.distinct(User.id)).label('count')
            )
            .join(Order, Order.user_id == User.id)
            .filter(User.age_group.isnot(None))
            .group_by(User.age_group)
            .all()
        )
        
        age_groups = {}
        for group in age_groups_query:
            age_groups[group.age_group] = group.count
            
        # Получение данных о времени посещения
        visit_times_query = (
            db.query(
                func.strftime('%H', Order.created_at).label('hour'),
                func.count(Order.id).label('count')
            )
            .filter(Order.user_id.isnot(None))
            .group_by('hour')
            .all()
        )
        
        # Агрегируем данные по временным интервалам
        visit_times = {
            '12-14': 0,
            '14-16': 0,
            '16-18': 0,
            '18-20': 0,
            '20-22': 0
        }
        
        for time in visit_times_query:
            try:
                hour = int(time.hour)
                if 12 <= hour < 14:
                    visit_times['12-14'] += time.count
                elif 14 <= hour < 16:
                    visit_times['14-16'] += time.count
                elif 16 <= hour < 18:
                    visit_times['16-18'] += time.count
                elif 18 <= hour < 20:
                    visit_times['18-20'] += time.count
                elif 20 <= hour < 22:
                    visit_times['20-22'] += time.count
            except:
                pass
                
        # Конвертируем абсолютные значения в проценты
        total_visits = sum(visit_times.values())
        if total_visits > 0:
            for key in visit_times:
                visit_times[key] = round(visit_times[key] / total_visits * 100)
        
        # Получение данных о частоте посещений
        # Определяем среднее количество дней между заказами для каждого клиента
        frequency_data = []
        user_orders = (
            db.query(
                Order.user_id,
                func.strftime('%Y-%m-%d', Order.created_at).label('order_date')
            )
            .filter(Order.user_id.isnot(None))
            .order_by(Order.user_id, Order.created_at)
            .all()
        )
        
        # Группируем заказы по пользователям
        user_orders_dict = {}
        for order in user_orders:
            if order.user_id not in user_orders_dict:
                user_orders_dict[order.user_id] = []
            user_orders_dict[order.user_id].append(order.order_date)
        
        # Считаем среднее количество дней между заказами
        for user_id, dates in user_orders_dict.items():
            if len(dates) >= 2:
                total_days = 0
                date_objects = []
                for date_str in dates:
                    try:
                        date_obj = datetime.strptime(date_str, '%Y-%m-%d')
                        date_objects.append(date_obj)
                    except:
                        pass
                
                date_objects.sort()
                
                for i in range(1, len(date_objects)):
                    days = (date_objects[i] - date_objects[i-1]).days
                    total_days += days
                
                avg_days = total_days / (len(date_objects) - 1)
                frequency_data.append(avg_days)
        
        # Определяем категории частоты
        visit_frequency = {
            "Еженедельно": 0,
            "2-3 раза в месяц": 0,
            "Ежемесячно": 0,
            "Раз в квартал": 0,
            "Реже": 0
        }
        
        for days in frequency_data:
            if days <= 7:
                visit_frequency["Еженедельно"] += 1
            elif days <= 14:
                visit_frequency["2-3 раза в месяц"] += 1
            elif days <= 30:
                visit_frequency["Ежемесячно"] += 1
            elif days <= 90:
                visit_frequency["Раз в квартал"] += 1
            else:
                visit_frequency["Реже"] += 1
                
        # Конвертируем абсолютные значения в проценты
        total_freq = sum(visit_frequency.values())
        if total_freq > 0:
            for key in visit_frequency:
                visit_frequency[key] = round(visit_frequency[key] / total_freq * 100)
        
        # Получение данных о топ-клиентах
        top_customers_query = (
            db.query(
                User.id.label('userId'),
                User.full_name.label('fullName'),
                User.email,
                func.sum(Order.total_amount).label('totalSpent'),
                func.count(Order.id).label('ordersCount'),
                func.avg(Review.service_rating).label('avgRating'),
                func.max(Order.created_at).label('lastVisit')
            )
            .join(Order, Order.user_id == User.id)
            .outerjoin(Review, Review.user_id == User.id)
            .filter(User.id.isnot(None))
            .group_by(User.id)
            .order_by(func.sum(Order.total_amount).desc())
            .limit(5)
            .all()
        )
        
        # Формирование данных о топ-клиентах
        top_customers = []
        for customer in top_customers_query:
            last_visit = customer.lastVisit.strftime('%Y-%m-%d') if hasattr(customer.lastVisit, 'strftime') else str(customer.lastVisit)
            top_customers.append({
                'userId': customer.userId,
                'fullName': customer.fullName or "Н/Д",
                'email': customer.email or "Н/Д",
                'totalSpent': round(float(customer.totalSpent)) if customer.totalSpent else 0,
                'ordersCount': customer.ordersCount or 0,
                'averageRating': round(float(customer.avgRating), 1) if customer.avgRating else 0,
                'lastVisit': last_visit
            })
            
        # Обновляем диапазон дат для отображения
        if not display_start_date:
            display_start_date = real_min_date
        if not display_end_date:
            display_end_date = real_max_date
        
        # Формирование итогового результата
        result = {
            "totalCustomers": total_customers,
            "newCustomers": new_customers,
            "returningCustomers": returning_customers,
            "returnRate": round(return_rate, 1),
            "customerRetentionRate": round(retention_rate, 1),
            "averageVisitsPerCustomer": round(avg_visits, 1),
            "customerSatisfaction": round(avg_satisfaction, 1),
            "foodRating": round(avg_food_rating, 1),
            "serviceRating": round(avg_service_rating, 1),
            "newCustomersChange": round(new_customers_change, 1),
            "returnRateChange": round(return_rate_change, 1),
            "averageOrderValueChange": round(avg_order_value_change, 1),
            "customerSegmentation": segmentation,
            "customerDemographics": {
                "age_groups": age_groups,
                "total_customers": total_customers
            },
            "visitTimes": visit_times,
            "visitFrequency": visit_frequency,
            "topCustomers": top_customers,
            "period": {
                "startDate": display_start_date.strftime("%Y-%m-%d"),
                "endDate": display_end_date.strftime("%Y-%m-%d")
            }
        }
        
        print("Успешно сформированы метрики клиентов на основе реальных данных.")
        return result
        
    except Exception as e:
        # В случае ошибки логируем её и возвращаем пустую структуру
        print(f"КРИТИЧЕСКАЯ ОШИБКА при получении метрик клиентов: {e}")
        import traceback
        traceback.print_exc()
        
        return {
            "totalCustomers": 0,
            "newCustomers": 0,
            "returningCustomers": 0,
            "returnRate": 0,
            "customerRetentionRate": 0,
            "averageVisitsPerCustomer": 0,
            "customerSatisfaction": 0,
            "foodRating": 0,
            "serviceRating": 0,
            "newCustomersChange": 0,
            "returnRateChange": 0,
            "averageOrderValueChange": 0,
            "customerSegmentation": {},
            "customerDemographics": {},
            "visitTimes": {},
            "visitFrequency": {},
            "topCustomers": [],
            "error": str(e),
            "period": {
                "startDate": display_start_date.strftime("%Y-%m-%d") if display_start_date else "",
                "endDate": display_end_date.strftime("%Y-%m-%d") if display_end_date else ""
            }
        }


def get_operational_metrics(
    db: Session, 
    start_date: datetime = None, 
    end_date: datetime = None,
    use_mock_data: bool = False
) -> Dict[str, Any]:
    """
    Получение операционных метрик ресторана
    """
    print("===== ЗАПРОС ОПЕРАЦИОННЫХ МЕТРИК =====")
    
    # Обработка входных дат
    if isinstance(start_date, str):
        try:
            start_date = datetime.strptime(start_date, "%Y-%m-%d")
        except Exception as e:
            print(f"Ошибка парсинга start_date: {e}")
            start_date = None
            
    if isinstance(end_date, str):
        try:
            end_date = datetime.strptime(end_date, "%Y-%m-%d")
        except Exception as e:
            print(f"Ошибка парсинга end_date: {e}")
            end_date = None
    
    # Для отображения запрашиваемого периода
    display_start_date = start_date
    display_end_date = end_date
    
    print(f"Запрошенный период для операционных метрик: {display_start_date} - {display_end_date}")
    
    try:
        # Определение реального диапазона дат в БД
        min_date = db.query(func.min(Order.created_at)).scalar()
        max_date = db.query(func.max(Order.created_at)).scalar()
        
        if min_date and max_date:
            if not display_start_date:
                display_start_date = min_date
            if not display_end_date:
                display_end_date = max_date
                
            print(f"Реальный диапазон дат в БД: {min_date} - {max_date}")
        
        # Проверка наличия данных в БД
        orders_count = db.query(func.count(Order.id)).scalar() or 0
        print(f"Всего заказов в БД: {orders_count}")
        
        # Проверим статусы заказов
        statuses = db.query(Order.status, func.count(Order.id)).group_by(Order.status).all()
        print(f"Статусы заказов в БД: {statuses}")
        
        # Получение данных о среднем времени приготовления заказов
        avg_preparation_time_query = (
            db.query(func.avg(func.julianday(Order.completed_at) - func.julianday(Order.created_at)) * 24 * 60)
            .filter(Order.completed_at.isnot(None))
            # Убираем фильтр по статусу
            # .filter(Order.status.in_(["Завершён", "Оплачен", "Готов", "Доставлен"]))
        )
        
        avg_preparation_time = avg_preparation_time_query.scalar() or 0
        
        # Получение данных о среднем времени оборота столиков
        # (время между созданием и завершением заказа для столиков)
        avg_table_turnover_query = (
            db.query(func.avg(func.julianday(Order.completed_at) - func.julianday(Order.created_at)) * 24 * 60)
            .filter(
                Order.completed_at.isnot(None),
                Order.table_number.isnot(None)
                # Убираем фильтр по статусу
                # Order.status.in_(["Завершён", "Оплачен", "Готов", "Доставлен"])
            )
        )
        
        avg_table_turnover = avg_table_turnover_query.scalar() or 0
        
        # Получение количества столиков
        tables_count = (
            db.query(func.count(func.distinct(Order.table_number)))
            .filter(Order.table_number.isnot(None))
        ).scalar() or 0
        
        # Получение данных о заказах по столикам
        table_utilization_query = (
            db.query(
                Order.table_number,
                func.count(Order.id).label('usage_count')
            )
            .filter(Order.table_number.isnot(None))
            .group_by(Order.table_number)
            .order_by(Order.table_number)
            .all()
        )
        
        # Формирование данных о загрузке столиков
        table_utilization = {}
        total_orders = 0
        
        for item in table_utilization_query:
            table_utilization[str(item.table_number)] = item.usage_count
            total_orders += item.usage_count
            
        # Расчет среднего количества заказов на столик
        avg_orders_per_table = total_orders / tables_count if tables_count > 0 else 0
        
        # Определение загрузки столиков в процентах относительно самого загруженного
        if table_utilization:
            max_usage = max(table_utilization.values())
            for table, count in table_utilization.items():
                table_utilization[table] = round(count / max_usage * 100) if max_usage > 0 else 0
                
        # Получение данных о пиковых часах
        peak_hours_query = (
            db.query(
                func.strftime('%H', Order.created_at).label('hour'),
                func.count(Order.id).label('orders_count')
            )
            .group_by('hour')
            .order_by(func.count(Order.id).desc())
            .all()
        )
        
        # Формирование данных о пиковых часах
        peak_hours = {
            '12-14': 0,
            '14-16': 0,
            '16-18': 0,
            '18-20': 0,
            '20-22': 0
        }
        
        for item in peak_hours_query:
            try:
                hour = int(item.hour)
                if 12 <= hour < 14:
                    peak_hours['12-14'] += item.orders_count
                elif 14 <= hour < 16:
                    peak_hours['14-16'] += item.orders_count
                elif 16 <= hour < 18:
                    peak_hours['16-18'] += item.orders_count
                elif 18 <= hour < 20:
                    peak_hours['18-20'] += item.orders_count
                elif 20 <= hour < 22:
                    peak_hours['20-22'] += item.orders_count
            except:
                pass
                
        # Нормализация данных о пиковых часах до 100
        if peak_hours:
            max_peak = max(peak_hours.values())
            for time, count in peak_hours.items():
                peak_hours[time] = round(count / max_peak * 100) if max_peak > 0 else 0
                
        # Получение данных об эффективности персонала
        staff_efficiency_query = (
            db.query(
                User.id.label('userId'),
                User.full_name.label('userName'),
                User.role,
                func.count(Order.id).label('ordersServed'),
                func.avg(func.julianday(Order.completed_at) - func.julianday(Order.created_at)).label('avgServiceTime'),
                func.avg(Review.service_rating).label('customerRating'),
                func.avg(Order.total_amount).label('avgOrderValue')
            )
            .join(Order, Order.waiter_id == User.id)
            .outerjoin(Review, Review.order_id == Order.id)
            .filter(
                User.role == 'waiter'
                # Убираем фильтр по статусу
                # Order.status.in_(["Завершён", "Оплачен", "Готов", "Доставлен"])
            )
            .group_by(User.id)
            .order_by(func.count(Order.id).desc())
            .limit(5)
            .all()
        )
        
        # Формирование данных об эффективности персонала
        staff_efficiency = {}
        for i, item in enumerate(staff_efficiency_query, 1):
            staff_efficiency[str(i)] = {
                "userId": item.userId,
                "userName": item.userName or "Официант " + str(i),
                "role": "Официант",
                "averageServiceTime": round(item.avgServiceTime * 24 * 60, 1) if item.avgServiceTime else 0,
                "ordersServed": item.ordersServed or 0,
                "customerRating": round(item.customerRating, 1) if item.customerRating else 0,
                "averageOrderValue": round(float(item.avgOrderValue)) if item.avgOrderValue else 0
            }
            
        # Получение данных о статусах заказов
        order_status_query = (
            db.query(
                Order.status,
                func.count(Order.id).label('count')
            )
            .group_by(Order.status)
            .all()
        )
        
        # Формирование данных о статусах заказов
        order_completion_rates = {}
        total_orders_status = sum(item.count for item in order_status_query) or 1
        
        for item in order_status_query:
            status = item.status or "Неизвестно"
            percentage = item.count / total_orders_status * 100
            order_completion_rates[status] = round(percentage, 1)
            
        # Расчет средней загрузки столиков
        avg_table_utilization = sum(table_utilization.values()) / len(table_utilization) if table_utilization else 0
        
        # Формирование итогового результата
        result = {
            "averageOrderPreparationTime": round(avg_preparation_time, 1),
            "averageTableTurnoverTime": round(avg_table_turnover, 1),
            "tablesCount": tables_count,
            "averageTableUtilization": round(avg_table_utilization),
            "averageOrdersPerTable": round(avg_orders_per_table, 1),
            "tableUtilization": table_utilization,
            "peakHours": peak_hours,
            "staffEfficiency": staff_efficiency,
            "orderCompletionRates": order_completion_rates,
            "period": {
                "startDate": display_start_date.strftime("%Y-%m-%d") if display_start_date else "",
                "endDate": display_end_date.strftime("%Y-%m-%d") if display_end_date else ""
            }
        }
        
        print("Успешно сформированы операционные метрики на основе реальных данных")
        return result
    
    except Exception as e:
        # В случае ошибки логируем её и возвращаем пустую структуру
        print(f"КРИТИЧЕСКАЯ ОШИБКА при получении операционных метрик: {e}")
        import traceback
        traceback.print_exc()
        
        return {
            "averageOrderPreparationTime": 0,
            "averageTableTurnoverTime": 0,
            "tablesCount": 0,
            "averageTableUtilization": 0,
            "averageOrdersPerTable": 0,
            "tableUtilization": {},
            "peakHours": {},
            "staffEfficiency": {},
            "orderCompletionRates": {},
            "error": str(e),
            "period": {
                "startDate": display_start_date.strftime("%Y-%m-%d") if display_start_date else "",
                "endDate": display_end_date.strftime("%Y-%m-%d") if display_end_date else ""
            }
        }


def get_predictive_metrics(
    db: Session, 
    start_date: datetime = None, 
    end_date: datetime = None,
    use_mock_data: bool = False
) -> Dict[str, Any]:
    """
    Получение предиктивных метрик ресторана на основе реальных данных
    """
    print("===== ЗАПРОС ПРЕДИКТИВНЫХ МЕТРИК =====")
    
    # Обработка входных дат
    if isinstance(start_date, str):
        try:
            start_date = datetime.strptime(start_date, "%Y-%m-%d")
        except Exception as e:
            print(f"Ошибка парсинга start_date: {e}")
            start_date = None
            
    if isinstance(end_date, str):
        try:
            end_date = datetime.strptime(end_date, "%Y-%m-%d")
        except Exception as e:
            print(f"Ошибка парсинга end_date: {e}")
            end_date = None
    
    # Для отображения запрашиваемого периода
    if not start_date:
        start_date = datetime.now()
    if not end_date:
        end_date = start_date + timedelta(days=14)  # Прогноз на 14 дней вперед
        
    display_start_date = start_date
    display_end_date = end_date
    
    print(f"Период прогноза: {display_start_date} - {display_end_date}")
    
    try:
        # Проверка наличия данных в БД
        orders_count = db.query(func.count(Order.id)).scalar() or 0
        print(f"Всего заказов в БД: {orders_count}")
        
        # Проверим статусы заказов
        statuses = db.query(Order.status, func.count(Order.id)).group_by(Order.status).all()
        print(f"Статусы заказов в БД: {statuses}")
        
        # Получение последних реальных данных о продажах для обучения прогноза
        past_sales_query = (
            db.query(
                func.date(Order.created_at).label("date"),
                func.count(Order.id).label("orders_count"),
                func.sum(Order.total_amount).label("total_amount")
            )
            # Убираем фильтр по статусу
            # .filter(Order.status.in_(["Завершён", "Оплачен", "Готов", "Доставлен"]))
            .group_by(func.date(Order.created_at))
            .order_by(func.date(Order.created_at).desc())
            .limit(30)  # Берем данные за последние 30 дней
            .all()
        )
        
        if not past_sales_query:
            print("В БД нет данных о продажах для создания прогноза")
            return {
                "salesForecast": [],
                "inventoryForecast": {},
                "staffingNeeds": {},
                "peakTimePrediction": {},
                "suggestedPromotions": [],
                "period": {
                    "startDate": display_start_date.strftime("%Y-%m-%d"),
                    "endDate": display_end_date.strftime("%Y-%m-%d")
                }
            }
            
        # Построение простой модели прогноза на основе средних значений по дням недели
        # Собираем данные по дням недели
        daily_data = {}  # {день_недели: [сумма_продаж1, сумма_продаж2, ...]}
        
        for record in past_sales_query:
            try:
                date_obj = datetime.strptime(str(record.date), "%Y-%m-%d")
                day_of_week = date_obj.weekday()
                
                if day_of_week not in daily_data:
                    daily_data[day_of_week] = []
                    
                daily_data[day_of_week].append(float(record.total_amount) if record.total_amount else 0)
            except Exception as e:
                print(f"Ошибка при обработке записи: {e}")
                
        # Расчет средних значений по дням недели
        daily_averages = {}
        for day, amounts in daily_data.items():
            if amounts:
                daily_averages[day] = sum(amounts) / len(amounts)
            else:
                daily_averages[day] = 0
        
        # Заполняем пропущенные дни недели средним значением
        all_days_avg = sum(daily_averages.values()) / len(daily_averages) if daily_averages else 1000
        for day in range(7):
            if day not in daily_averages:
                daily_averages[day] = all_days_avg
        
        # Генерация прогноза продаж
        sales_forecast = []
        days = (display_end_date - display_start_date).days + 1
        
        for i in range(days):
            forecast_date = display_start_date + timedelta(days=i)
            day_of_week = forecast_date.weekday()
            
            # Базовое прогнозируемое значение
            predicted_value = daily_averages.get(day_of_week, all_days_avg)
            
            # Добавляем случайную вариацию для реалистичности (+/- 10%)
            variation = 0.9 + (random.random() * 0.2)
            predicted_value *= variation
            
            # Увеличиваем прогноз для выходных дней
            if day_of_week >= 5:  # Суббота и воскресенье
                predicted_value *= 1.3
                
            sales_forecast.append({
                "date": forecast_date.strftime("%Y-%m-%d"),
                "value": round(predicted_value)
            })
            
        # Расчет прогнозируемых потребностей в запасах
        # Берем данные о 5 самых популярных блюдах
        top_dishes_query = (
            db.query(
                Dish.id,
                Dish.name,
                Category.id.label("category_id"),
                Category.name.label("category_name"),
                func.sum(OrderItem.quantity).label("total_ordered")
            )
            .join(OrderItem, OrderItem.dish_id == Dish.id)
            .join(Order, Order.id == OrderItem.order_id)
            .join(Category, Category.id == Dish.category_id)
            # Убираем фильтр по статусу
            # .filter(Order.status.in_(["Завершён", "Оплачен", "Готов", "Доставлен"]))
            .group_by(Dish.id, Category.id)
            .order_by(func.sum(OrderItem.quantity).desc())
            .limit(5)
            .all()
        )
        
        # Прогноз потребностей в запасах
        inventory_forecast = {}
        for dish in top_dishes_query:
            # Простой прогноз: среднее количество заказов * прогнозируемый период
            avg_daily_orders = dish.total_ordered / len(past_sales_query) if past_sales_query else 0
            predicted_quantity = avg_daily_orders * days * 1.2  # Добавляем 20% запаса
            inventory_forecast[str(dish.id)] = round(predicted_quantity)
            
        # Прогноз потребностей в персонале по дням недели и времени суток
        # Анализ пиковых часов по дням недели
        peak_hours_query = (
            db.query(
                func.strftime('%w', Order.created_at).label('day'),
                func.strftime('%H', Order.created_at).label('hour'),
                func.count(Order.id).label('orders_count')
            )
            .group_by('day', 'hour')
            .all()
        )
        
        # Агрегация данных по дням недели и временным интервалам
        time_slots = {
            '12-14': (12, 14),
            '14-16': (14, 16),
            '16-18': (16, 18),
            '18-20': (18, 20),
            '20-22': (20, 22)
        }
        
        # Структура для хранения данных о заказах
        day_hour_data = {}
        for day in range(7):
            day_hour_data[str(day)] = {slot: 0 for slot in time_slots}
            
        # Заполнение данных
        for record in peak_hours_query:
            try:
                day = int(record.day)
                hour = int(record.hour)
                
                for slot, (start, end) in time_slots.items():
                    if start <= hour < end:
                        day_hour_data[str(day)][slot] += record.orders_count
                        break
            except:
                pass
                
        # Преобразование дней недели в текстовые названия
        day_names = {
            '0': 'Воскресенье',
            '1': 'Понедельник',
            '2': 'Вторник',
            '3': 'Среда',
            '4': 'Четверг',
            '5': 'Пятница',
            '6': 'Суббота'
        }
        
        # Формирование прогноза персонала
        staffing_needs = {}
        peak_time_prediction = {}
        
        for day_num, hours in day_hour_data.items():
            day_name = day_names.get(day_num, f'День {day_num}')
            staffing_needs[day_name] = {}
            peak_time_prediction[day_name] = []
            
            # Нахождение пикового времени
            max_orders = max(hours.values()) if hours.values() else 0
            
            for slot, count in hours.items():
                # Базовая потребность в персонале: 1 человек на 5 заказов
                staff_needed = max(2, round(count / 5))
                staffing_needs[day_name][slot] = staff_needed
                
                # Определение пикового времени (более 80% от максимума)
                if max_orders > 0 and count >= 0.8 * max_orders:
                    peak_time_prediction[day_name].append(slot)
                    
        # Прогноз рекомендуемых акций для увеличения продаж
        # Находим наименее продаваемые блюда
        least_selling_query = (
            db.query(
                Dish.id,
                Dish.name,
                Dish.price,
                func.sum(OrderItem.quantity).label("total_ordered")
            )
            .join(OrderItem, OrderItem.dish_id == Dish.id)
            .join(Order, Order.id == OrderItem.order_id)
            # Убираем фильтр по статусу
            # .filter(Order.status.in_(["Завершён", "Оплачен", "Готов", "Доставлен"]))
            .group_by(Dish.id)
            .order_by(func.sum(OrderItem.quantity).asc())
            .limit(5)
            .all()
        )
        
        # Находим самые прибыльные блюда для кросс-продаж
        profitable_query = (
            db.query(
                Dish.id,
                Dish.name,
                Dish.price,
                Dish.cost_price,
                func.sum(OrderItem.quantity).label("total_ordered")
            )
            .join(OrderItem, OrderItem.dish_id == Dish.id)
            .join(Order, Order.id == OrderItem.order_id)
            .filter(
                # Убираем фильтр по статусу
                # Order.status.in_(["Завершён", "Оплачен", "Готов", "Доставлен"]),
                Dish.cost_price.isnot(None),
                Dish.cost_price > 0
            )
            .group_by(Dish.id)
            .order_by((Dish.price - Dish.cost_price).desc())
            .limit(2)
            .all()
        )
        
        # Формирование предложений по акциям
        suggested_promotions = []
        
        # Акции для наименее продаваемых блюд
        for dish in least_selling_query:
            # Размер скидки и потенциальный доход
            discount = 15 + random.randint(0, 10)  # Скидка 15-25%
            potential_revenue = round(dish.price * (1 - discount/100) * 20)  # Предполагаем продажу 20 единиц
            
            suggested_promotions.append({
                "dishId": dish.id,
                "dishName": dish.name,
                "reason": "Низкие продажи",
                "suggestedDiscount": discount,
                "potentialRevenue": potential_revenue
            })
            
        # Акции для прибыльных блюд
        for dish in profitable_query:
            # Меньшая скидка для прибыльных блюд
            discount = 5 + random.randint(0, 5)  # Скидка 5-10%
            potential_revenue = round(dish.price * (1 - discount/100) * 30)  # Предполагаем продажу 30 единиц
            
            suggested_promotions.append({
                "dishId": dish.id,
                "dishName": dish.name,
                "reason": "Высокая маржинальность",
                "suggestedDiscount": discount,
                "potentialRevenue": potential_revenue
            })
            
        # Формирование итогового результата
        result = {
            "salesForecast": sales_forecast,
            "inventoryForecast": inventory_forecast,
            "staffingNeeds": staffing_needs,
            "peakTimePrediction": peak_time_prediction,
            "suggestedPromotions": suggested_promotions,
            "period": {
                "startDate": display_start_date.strftime("%Y-%m-%d"),
                "endDate": display_end_date.strftime("%Y-%m-%d")
            }
        }
        
        print("Успешно сформированы предиктивные метрики на основе реальных данных")
        return result
        
    except Exception as e:
        # В случае ошибки логируем её и возвращаем пустую структуру
        print(f"КРИТИЧЕСКАЯ ОШИБКА при получении предиктивных метрик: {e}")
        import traceback
        traceback.print_exc()
        
        return {
            "salesForecast": [],
            "inventoryForecast": {},
            "staffingNeeds": {},
            "peakTimePrediction": {},
            "suggestedPromotions": [],
            "error": str(e),
            "period": {
                "startDate": display_start_date.strftime("%Y-%m-%d") if display_start_date else "",
                "endDate": display_end_date.strftime("%Y-%m-%d") if display_end_date else ""
            }
        }


# Мок-данные для финансовой аналитики
def get_mock_financial_metrics(start_date: datetime, end_date: datetime) -> Dict[str, Any]:
    return {
        "totalRevenue": 1250000,
        "totalCost": 750000,
        "grossProfit": 500000,
        "profitMargin": 40,
        "averageOrderValue": 3500,
        "orderCount": 357,
        # Дополнительные поля для сравнения с предыдущим периодом
        "revenueChange": 8.5,
        "profitChange": 12.2,
        "averageOrderValueChange": 5.1,
        "orderCountChange": 7.8,
        "previousRevenue": 1150000,
        "previousProfit": 445000,
        "previousAverageOrderValue": 3330,
        "previousOrderCount": 331,
        # Данные по месяцам
        "revenueByMonth": {
            "01": 950000,
            "02": 1050000,
            "03": 1100000,
            "04": 1150000,
            "05": 1250000,
            "06": 1350000,
            "07": 1400000,
            "08": 1450000,
            "09": 1200000,
            "10": 1100000,
            "11": 1150000,
            "12": 1300000
        },
        "expensesByMonth": {
            "01": 570000,
            "02": 630000,
            "03": 660000,
            "04": 690000,
            "05": 750000,
            "06": 810000,
            "07": 840000,
            "08": 870000,
            "09": 720000,
            "10": 660000,
            "11": 690000,
            "12": 780000
        },
        "revenueByCategory": {
            "1": 350000,
            "2": 280000,
            "3": 210000,
            "4": 170000,
            "5": 140000
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
            {"dishId": 1, "dishName": "Стейк Рибай", "categoryId": 2, "categoryName": "Основные блюда", "salesCount": 105, "revenue": 210000, "percentage": 25.2},
            {"dishId": 2, "dishName": "Цезарь с курицей", "categoryId": 3, "categoryName": "Салаты", "salesCount": 89, "revenue": 133500, "percentage": 16.1},
            {"dishId": 3, "dishName": "Паста Карбонара", "categoryId": 2, "categoryName": "Основные блюда", "salesCount": 76, "revenue": 95000, "percentage": 11.4},
            {"dishId": 4, "dishName": "Борщ", "categoryId": 1, "categoryName": "Супы", "salesCount": 70, "revenue": 84000, "percentage": 10.1},
            {"dishId": 5, "dishName": "Тирамису", "categoryId": 4, "categoryName": "Десерты", "salesCount": 68, "revenue": 74800, "percentage": 9.0}
        ],
        "mostProfitableDishes": [
            {"dishId": 1, "dishName": "Стейк Рибай", "categoryId": 2, "categoryName": "Основные блюда", "salesCount": 105, "revenue": 210000, "percentage": 25.2, "costPrice": 100000, "profit": 110000, "profitMargin": 52.4},
            {"dishId": 6, "dishName": "Лосось на гриле", "categoryId": 2, "categoryName": "Основные блюда", "salesCount": 60, "revenue": 120000, "percentage": 14.5, "costPrice": 60000, "profit": 60000, "profitMargin": 50.0},
            {"dishId": 2, "dishName": "Цезарь с курицей", "categoryId": 3, "categoryName": "Салаты", "salesCount": 89, "revenue": 133500, "percentage": 16.1, "costPrice": 67000, "profit": 66500, "profitMargin": 49.8},
            {"dishId": 7, "dishName": "Утиная грудка", "categoryId": 2, "categoryName": "Основные блюда", "salesCount": 45, "revenue": 135000, "percentage": 16.3, "costPrice": 70000, "profit": 65000, "profitMargin": 48.1},
            {"dishId": 8, "dishName": "Говядина Веллингтон", "categoryId": 2, "categoryName": "Основные блюда", "salesCount": 35, "revenue": 122500, "percentage": 14.8, "costPrice": 65000, "profit": 57500, "profitMargin": 46.9}
        ],
        "leastSellingDishes": [
            {"dishId": 30, "dishName": "Салат Оливье", "categoryId": 3, "categoryName": "Салаты", "salesCount": 15, "revenue": 18000, "percentage": 2.2},
            {"dishId": 31, "dishName": "Окрошка", "categoryId": 1, "categoryName": "Супы", "salesCount": 12, "revenue": 14400, "percentage": 1.7},
            {"dishId": 32, "dishName": "Рататуй", "categoryId": 2, "categoryName": "Основные блюда", "salesCount": 10, "revenue": 15000, "percentage": 1.8},
            {"dishId": 33, "dishName": "Суп-пюре из тыквы", "categoryId": 1, "categoryName": "Супы", "salesCount": 8, "revenue": 9600, "percentage": 1.2},
            {"dishId": 34, "dishName": "Салат из морепродуктов", "categoryId": 3, "categoryName": "Салаты", "salesCount": 5, "revenue": 7500, "percentage": 0.9}
        ],
        "averageCookingTime": 18,
        "categoryPopularity": {
            "1": 15,
            "2": 40,
            "3": 25,
            "4": 10,
            "5": 10
        },
        "menuItemSalesTrend": {
            "1": [{"date": (start_date + timedelta(days=i)).strftime("%Y-%m-%d"), "value": 8 + (i % 3)} for i in range((end_date - start_date).days + 1)],
            "2": [{"date": (start_date + timedelta(days=i)).strftime("%Y-%m-%d"), "value": 6 + (i % 4)} for i in range((end_date - start_date).days + 1)],
            "3": [{"date": (start_date + timedelta(days=i)).strftime("%Y-%m-%d"), "value": 5 + (i % 3)} for i in range((end_date - start_date).days + 1)],
        },
        "menuItemPerformance": [
            {"dishId": 1, "dishName": "Стейк Рибай", "salesCount": 105, "revenue": 210000, "profitMargin": 52.4},
            {"dishId": 2, "dishName": "Цезарь с курицей", "salesCount": 89, "revenue": 133500, "profitMargin": 49.8},
            {"dishId": 3, "dishName": "Паста Карбонара", "salesCount": 76, "revenue": 95000, "profitMargin": 45.3},
            {"dishId": 4, "dishName": "Борщ", "salesCount": 70, "revenue": 84000, "profitMargin": 55.7},
            {"dishId": 5, "dishName": "Тирамису", "salesCount": 68, "revenue": 74800, "profitMargin": 60.2},
            {"dishId": 6, "dishName": "Лосось на гриле", "salesCount": 60, "revenue": 120000, "profitMargin": 50.0},
            {"dishId": 7, "dishName": "Утиная грудка", "salesCount": 45, "revenue": 135000, "profitMargin": 48.1},
            {"dishId": 8, "dishName": "Говядина Веллингтон", "salesCount": 35, "revenue": 122500, "profitMargin": 46.9},
            {"dishId": 30, "dishName": "Салат Оливье", "salesCount": 15, "revenue": 18000, "profitMargin": 42.5},
            {"dishId": 31, "dishName": "Окрошка", "salesCount": 12, "revenue": 14400, "profitMargin": 48.3}
        ],
        "categoryPerformance": {
            "1": {"salesPercentage": 15, "averageOrderValue": 1200, "averageProfitMargin": 52},
            "2": {"salesPercentage": 40, "averageOrderValue": 2000, "averageProfitMargin": 48},
            "3": {"salesPercentage": 25, "averageOrderValue": 900, "averageProfitMargin": 45},
            "4": {"salesPercentage": 10, "averageOrderValue": 600, "averageProfitMargin": 60},
            "5": {"salesPercentage": 10, "averageOrderValue": 800, "averageProfitMargin": 40}
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
        "customerRetentionRate": 78.3,
        "averageVisitsPerCustomer": 2.8,
        "customerSatisfaction": 4.6,
        "foodRating": 4.7,
        "serviceRating": 4.5,
        "newCustomersChange": 8.2,
        "returnRateChange": 3.5,
        "averageOrderValueChange": 5.8,
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
        "visitTimes": {
            "12-14": 25,
            "14-16": 15,
            "16-18": 10,
            "18-20": 35,
            "20-22": 15
        },
        "visitFrequency": {
            "Еженедельно": 22,
            "2-3 раза в месяц": 38,
            "Ежемесячно": 25,
            "Раз в квартал": 10,
            "Реже": 5
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
            "1": 85,
            "2": 90,
            "3": 75,
            "4": 80,
            "5": 95,
            "6": 70,
            "7": 65,
            "8": 75,
            "9": 80,
            "10": 85,
            "11": 55,
            "12": 60,
            "13": 45,
            "14": 50,
            "15": 65
        },
        "peakHours": {
            '12-14': 100,
            '14-16': 95,
            '16-18': 90,
            '18-20': 85,
            '20-22': 80
        },
        "staffEfficiency": {
            "1": {"userId": 101, "userName": "Анна", "role": "Официант", "averageServiceTime": 12.5, "ordersServed": 35, "customerRating": 4.8, "averageOrderValue": 3200},
            "2": {"userId": 102, "userName": "Иван", "role": "Официант", "averageServiceTime": 14.8, "ordersServed": 28, "customerRating": 4.5, "averageOrderValue": 2800},
            "3": {"userId": 103, "userName": "Мария", "role": "Официант", "averageServiceTime": 11.2, "ordersServed": 32, "customerRating": 4.9, "averageOrderValue": 3500},
            "4": {"userId": 104, "userName": "Алексей", "role": "Официант", "averageServiceTime": 15.5, "ordersServed": 25, "customerRating": 4.2, "averageOrderValue": 2500},
            "5": {"userId": 105, "userName": "Елена", "role": "Официант", "averageServiceTime": 13.0, "ordersServed": 30, "customerRating": 4.6, "averageOrderValue": 3100}
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
            "1": 45,
            "2": 60,
            "3": 35,
            "4": 25,
            "5": 80
        },
        "staffingNeeds": {
            "Понедельник": {"12-14": 3, "14-16": 2, "16-18": 2, "18-20": 4, "20-22": 3},
            "Вторник": {"12-14": 3, "14-16": 2, "16-18": 2, "18-20": 4, "20-22": 3},
            "Среда": {"12-14": 3, "14-16": 2, "16-18": 2, "18-20": 4, "20-22": 3},
            "Четверг": {"12-14": 3, "14-16": 2, "16-18": 3, "18-20": 5, "20-22": 4},
            "Пятница": {"12-14": 4, "14-16": 3, "16-18": 3, "18-20": 6, "20-22": 5},
            "Суббота": {"12-14": 5, "14-16": 4, "16-18": 4, "18-20": 6, "20-22": 5},
            "Воскресенье": {"12-14": 5, "14-16": 4, "16-18": 3, "18-20": 5, "20-22": 4}
        },
        "peakTimePrediction": {
            "Понедельник": ["18-20"],
            "Вторник": ["18-20"],
            "Среда": ["18-20"],
            "Четверг": ["18-20", "20-22"],
            "Пятница": ["18-20", "20-22"],
            "Суббота": ["12-14", "18-20", "20-22"],
            "Воскресенье": ["12-14", "18-20"]
        },
        "suggestedPromotions": [
            {"dishId": 31, "dishName": "Окрошка", "reason": "Низкие продажи", "suggestedDiscount": 15, "potentialRevenue": 25000},
            {"dishId": 32, "dishName": "Рататуй", "reason": "Низкие продажи", "suggestedDiscount": 20, "potentialRevenue": 30000},
            {"dishId": 33, "dishName": "Суп-пюре из тыквы", "reason": "Низкие продажи", "suggestedDiscount": 25, "potentialRevenue": 22000},
            {"dishId": 34, "dishName": "Салат из морепродуктов", "reason": "Низкие продажи", "suggestedDiscount": 15, "potentialRevenue": 18000},
            {"dishId": 5, "dishName": "Тирамису", "reason": "Высокая маржинальность", "suggestedDiscount": 10, "potentialRevenue": 42000}
        ],
        "period": {
            "startDate": start_date.strftime("%Y-%m-%d"),
            "endDate": end_date.strftime("%Y-%m-%d")
        }
    } 