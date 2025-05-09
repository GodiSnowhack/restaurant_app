from typing import List, Dict, Any
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, desc, extract, cast, Date, distinct

from app.models.order import Order, OrderStatus, OrderDish
from app.models.menu import Dish, Category
from app.models.reservation import Reservation
from app.models.user import User
from app.models.review import Review


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
    end_date: datetime = None
) -> Dict[str, Any]:
    """
    Получение комплексных финансовых метрик для аналитики
    """
    # Проверка и установка дат по умолчанию
    try:
        # Если даты не указаны, используем последний месяц
        if not start_date:
            start_date = datetime.now() - timedelta(days=30)
        if not end_date:
            end_date = datetime.now()
        
        # Безопасная проверка типов
        if not isinstance(start_date, datetime) or not isinstance(end_date, datetime):
            print(f"Ошибка типов в аргументах: start_date={type(start_date)}, end_date={type(end_date)}")
            # Используем значения по умолчанию
            start_date = datetime.now() - timedelta(days=30)
            end_date = datetime.now()
        
        print(f"Расчет финансовых метрик для периода: {start_date} - {end_date}")
        
        # Прямой запрос общей выручки и количества заказов без промежуточной обработки
        direct_query_result = db.query(
            func.sum(Order.total_amount).label('total_revenue'),
            func.count(Order.id).label('order_count')
        ).filter(
            Order.created_at >= start_date,
            Order.created_at <= end_date
        ).first()
        
        total_revenue = float(direct_query_result.total_revenue) if direct_query_result.total_revenue else 0
        order_count = direct_query_result.order_count or 0
        
        print(f"Прямой SQL запрос: выручка={total_revenue}, количество заказов={order_count}")
        
        # Начало предыдущего периода для сравнения (такой же длительности)
        period_length = end_date - start_date
        prev_start_date = start_date - period_length
        prev_end_date = start_date

        # Данные текущего периода с использованием промежуточной функции
        try:
            current_sales = get_sales_by_period(db, start_date, end_date)
            sales_total_revenue = sum(item["total_revenue"] for item in current_sales) if current_sales else 0
            sales_order_count = sum(item["orders_count"] for item in current_sales) if current_sales else 0
            
            print(f"Через get_sales_by_period: выручка={sales_total_revenue}, количество заказов={sales_order_count}")
            
            # В случае расхождения между данными используем максимальное значение
            total_revenue = max(total_revenue, sales_total_revenue)
            order_count = max(order_count, sales_order_count)
            
            # Рассчитываем средний чек
            avg_order_value = total_revenue / order_count if order_count else 0
            
            print(f"Итоговые значения: выручка={total_revenue}, количество заказов={order_count}, средний чек={avg_order_value}")
        except Exception as e:
            print(f"Ошибка при получении текущих продаж: {e}")
            # Используем данные из прямого запроса
            avg_order_value = total_revenue / order_count if order_count else 0
        
        # Данные предыдущего периода для сравнения
        try:
            prev_direct_query = db.query(
                func.sum(Order.total_amount).label('total_revenue'),
                func.count(Order.id).label('order_count')
            ).filter(
                Order.created_at >= prev_start_date,
                Order.created_at <= prev_end_date
            ).first()
            
            prev_revenue = float(prev_direct_query.total_revenue) if prev_direct_query.total_revenue else 0
            prev_order_count = prev_direct_query.order_count or 0
            prev_avg_order_value = prev_revenue / prev_order_count if prev_order_count else 0
        except Exception as e:
            print(f"Ошибка при получении предыдущих продаж: {e}")
            prev_sales = []
            prev_revenue = 0
            prev_order_count = 0
            prev_avg_order_value = 0
        
        # Безопасный расчет изменений в процентах
        try:
            revenue_change = ((total_revenue - prev_revenue) / prev_revenue * 100) if prev_revenue > 0 else 0
            order_count_change = ((order_count - prev_order_count) / prev_order_count * 100) if prev_order_count > 0 else 0
            avg_order_value_change = ((avg_order_value - prev_avg_order_value) / prev_avg_order_value * 100) if prev_avg_order_value > 0 else 0
        except Exception as e:
            print(f"Ошибка при расчете изменений: {e}")
            revenue_change = 0
            order_count_change = 0
            avg_order_value_change = 0
        
        # Получаем данные по заказам с их стоимостью с обработкой ошибок
        total_cost = 0
        try:
            # Получаем все заказы за период (без фильтрации по статусу)
            order_query = db.query(Order).filter(
                Order.created_at >= start_date,
                Order.created_at <= end_date
            )
            
            # Рассчитываем общие затраты (себестоимость блюд)
            for order in order_query:
                try:
                    for order_dish in order.order_dishes:
                        dish = db.query(Dish).get(order_dish.dish_id)
                        if dish and dish.cost_price:
                            total_cost += dish.cost_price * order_dish.quantity
                        elif dish:
                            # Если себестоимость не указана, используем 60% от цены
                            total_cost += dish.price * 0.6 * order_dish.quantity
                except Exception as dish_e:
                    print(f"Ошибка при обработке блюд заказа {order.id}: {dish_e}")
        except Exception as e:
            print(f"Ошибка при расчете общих затрат: {e}")
            # Используем примерное значение в случае ошибки
            total_cost = total_revenue * 0.6  # Примерно 60% от выручки
        
        # Безопасный расчет прибыли и маржи
        try:
            gross_profit = total_revenue - total_cost
            profit_margin = (gross_profit / total_revenue * 100) if total_revenue > 0 else 0
            
            print(f"Прибыль: {gross_profit}, маржа: {profit_margin}%")
        except Exception as e:
            print(f"Ошибка при расчете прибыли: {e}")
            gross_profit = 0
            profit_margin = 0
        
        # Для сравнения с предыдущим периодом с обработкой ошибок
        prev_total_cost = 0
        try:
            prev_order_query = db.query(Order).filter(
                Order.created_at >= prev_start_date,
                Order.created_at <= prev_end_date
            )
            
            for order in prev_order_query:
                try:
                    for order_dish in order.order_dishes:
                        dish = db.query(Dish).get(order_dish.dish_id)
                        if dish and dish.cost_price:
                            prev_total_cost += dish.cost_price * order_dish.quantity
                        elif dish:
                            # Если себестоимость не указана, используем 60% от цены
                            prev_total_cost += dish.price * 0.6 * order_dish.quantity
                except Exception as dish_e:
                    print(f"Ошибка при обработке блюд предыдущего заказа: {dish_e}")
                        
            prev_gross_profit = prev_revenue - prev_total_cost
            profit_change = ((gross_profit - prev_gross_profit) / prev_gross_profit * 100) if prev_gross_profit > 0 else 0
        except Exception as e:
            print(f"Ошибка при расчете предыдущей прибыли: {e}")
            prev_total_cost = prev_revenue * 0.6  # Примерно 60% от выручки
            prev_gross_profit = prev_revenue - prev_total_cost
            profit_change = 0
        
        # Получаем выручку по категориям с обработкой ошибок
        revenue_by_category = {}
        try:
            category_data = get_revenue_by_category(db, start_date, end_date)
            for item in category_data:
                revenue_by_category[item["id"]] = item["total_revenue"]
        except Exception as e:
            print(f"Ошибка при получении выручки по категориям: {e}")
        
        # Получаем выручку по времени суток (часам) с обработкой ошибок
        revenue_by_hour = {}
        try:
            revenue_by_time = db.query(
                extract('hour', Order.created_at).label('hour'),
                func.sum(Order.total_amount).label('revenue')
            ).filter(
                Order.created_at >= start_date,
                Order.created_at <= end_date
            ).group_by(
                extract('hour', Order.created_at)
            ).all()
            
            revenue_by_hour = {str(item.hour): float(item.revenue) for item in revenue_by_time}
        except Exception as e:
            print(f"Ошибка при получении выручки по времени суток: {e}")
        
        # Получаем выручку по дням недели с обработкой ошибок
        revenue_by_day_of_week = {}
        try:
            revenue_by_weekday = db.query(
                extract('dow', Order.created_at).label('day_of_week'),
                func.sum(Order.total_amount).label('revenue')
            ).filter(
                Order.created_at >= start_date,
                Order.created_at <= end_date
            ).group_by(
                extract('dow', Order.created_at)
            ).all()
            
            weekdays = {
                0: 'Понедельник', 1: 'Вторник', 2: 'Среда', 
                3: 'Четверг', 4: 'Пятница', 5: 'Суббота', 6: 'Воскресенье'
            }
            
            revenue_by_day_of_week = {
                weekdays[item.day_of_week]: float(item.revenue) 
                for item in revenue_by_weekday
            }
        except Exception as e:
            print(f"Ошибка при получении выручки по дням недели: {e}")
        
        # Получаем тренд выручки по дням с обработкой ошибок
        revenue_trend = []
        try:
            for item in current_sales:
                # Безопасное преобразование даты
                date_value = item["date"]
                date_str = ""
                
                if hasattr(date_value, 'isoformat'):
                    date_str = date_value.isoformat()
                elif isinstance(date_value, str):
                    date_str = date_value
                else:
                    date_str = str(date_value)
                    
                revenue_trend.append({
                    "date": date_str,
                    "value": item["total_revenue"]
                })
        except Exception as e:
            print(f"Ошибка при формировании тренда выручки: {e}")
        
        # Формируем итоговые финансовые метрики с безопасным округлением
        final_result = {
            "totalRevenue": round(total_revenue, 2),
            "totalCost": round(total_cost, 2),
            "grossProfit": round(gross_profit, 2),
            "profitMargin": round(profit_margin, 2),
            "averageOrderValue": round(avg_order_value, 2),
            "orderCount": order_count,
            
            "revenueByCategory": revenue_by_category,
            "revenueByTimeOfDay": revenue_by_hour,
            "revenueByDayOfWeek": revenue_by_day_of_week,
            "revenueTrend": revenue_trend,
            
            "revenueChange": round(revenue_change, 2),
            "profitChange": round(profit_change, 2),
            "averageOrderValueChange": round(avg_order_value_change, 2),
            "orderCountChange": round(order_count_change, 2),
            
            "previousRevenue": round(prev_revenue, 2),
            "previousProfit": round(prev_gross_profit, 2),
            "previousAverageOrderValue": round(prev_avg_order_value, 2),
            "previousOrderCount": prev_order_count,
            
            # Добавляем информацию о периоде для отчетов
            "period": {
                "startDate": start_date.isoformat() if hasattr(start_date, 'isoformat') else str(start_date),
                "endDate": end_date.isoformat() if hasattr(end_date, 'isoformat') else str(end_date)
            }
        }
        
        print(f"Финальные метрики: выручка={final_result['totalRevenue']}, прибыль={final_result['grossProfit']}, средний чек={final_result['averageOrderValue']}")
        
        return final_result
    except Exception as e:
        print(f"Критическая ошибка в get_financial_metrics: {e}")
        # Возвращаем минимальную структуру в случае критической ошибки
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
            "period": {
                "startDate": start_date.isoformat() if hasattr(start_date, 'isoformat') else str(start_date),
                "endDate": end_date.isoformat() if hasattr(end_date, 'isoformat') else str(end_date)
            },
            "error": str(e)
        }


def get_menu_metrics(
    db: Session, 
    start_date: datetime = None, 
    end_date: datetime = None
) -> Dict[str, Any]:
    """
    Получение комплексных метрик по меню для аналитики
    """
    # Если даты не указаны, используем последний месяц
    if not start_date:
        start_date = datetime.now() - timedelta(days=30)
    if not end_date:
        end_date = datetime.now()
    
    # Получаем данные о продажах блюд
    dish_sales_query = db.query(
        Dish.id,
        Dish.name,
        Dish.price,
        Dish.cost_price,
        Dish.cooking_time,
        func.sum(OrderDish.quantity).label("sales_count"),
        func.sum(OrderDish.quantity * OrderDish.price).label("revenue")
    ).join(
        OrderDish, OrderDish.dish_id == Dish.id
    ).join(
        Order, Order.id == OrderDish.order_id
    ).filter(
        Order.status.in_([OrderStatus.COMPLETED, OrderStatus.DELIVERED]),
        Order.created_at >= start_date,
        Order.created_at <= end_date
    ).group_by(
        Dish.id
    )
    
    dish_sales = dish_sales_query.all()
    
    # Общее количество проданных блюд за период
    total_dishes_sold = sum(item.sales_count for item in dish_sales) if dish_sales else 0
    
    # Формируем топы блюд
    top_selling_dishes = []
    most_profitable_dishes = []
    least_selling_dishes = []
    
    # Перебираем все блюда и формируем выборки
    for dish in dish_sales:
        sales_percentage = (dish.sales_count / total_dishes_sold * 100) if total_dishes_sold else 0
        
        # Расчет прибыли
        if dish.cost_price:
            cost = dish.cost_price
            profit = (dish.price - cost) * dish.sales_count
            profit_margin = ((dish.price - cost) / dish.price * 100) if dish.price else 0
        else:
            # Если себестоимость не указана, используем примерную (30% от цены)
            cost = dish.price * 0.3
            profit = (dish.price - cost) * dish.sales_count
            profit_margin = 70  # Примерная маржа
        
        dish_data = {
            "dishId": dish.id,
            "dishName": dish.name,
            "salesCount": dish.sales_count,
            "revenue": float(dish.revenue) if dish.revenue else 0,
            "percentage": round(sales_percentage, 2),
            "costPrice": float(cost),
            "profit": float(profit),
            "profitMargin": round(profit_margin, 2)
        }
        
        top_selling_dishes.append(dish_data)
        most_profitable_dishes.append(dish_data)
    
    # Сортируем топы
    top_selling_dishes = sorted(top_selling_dishes, key=lambda x: x["salesCount"], reverse=True)[:10]
    most_profitable_dishes = sorted(most_profitable_dishes, key=lambda x: x["profitMargin"], reverse=True)[:10]
    
    # Наименее продаваемые блюда (из тех, что продавались)
    least_selling_dishes = sorted(top_selling_dishes, key=lambda x: x["salesCount"])[:5]
    
    # Среднее время приготовления
    avg_cooking_time = db.query(func.avg(Dish.cooking_time)).scalar() or 0
    
    # Анализ популярности категорий
    category_data = db.query(
        Category.id,
        Category.name,
        func.sum(OrderDish.quantity).label("sales_count")
    ).join(
        Dish, Dish.category_id == Category.id
    ).join(
        OrderDish, OrderDish.dish_id == Dish.id
    ).join(
        Order, Order.id == OrderDish.order_id
    ).filter(
        Order.status.in_([OrderStatus.COMPLETED, OrderStatus.DELIVERED]),
        Order.created_at >= start_date,
        Order.created_at <= end_date
    ).group_by(
        Category.id
    ).all()
    
    category_popularity = {}
    for cat in category_data:
        category_popularity[cat.id] = (cat.sales_count / total_dishes_sold * 100) if total_dishes_sold else 0
    
    # Тренд продаж блюд по дням
    top_dish_ids = [dish["dishId"] for dish in top_selling_dishes[:3]]
    
    menu_item_sales_trend = {}
    for dish_id in top_dish_ids:
        daily_sales = db.query(
            func.date(Order.created_at).label("date"),
            func.sum(OrderDish.quantity).label("count")
        ).join(
            OrderDish, Order.id == OrderDish.order_id
        ).filter(
            OrderDish.dish_id == dish_id,
            Order.status.in_([OrderStatus.COMPLETED, OrderStatus.DELIVERED]),
            Order.created_at >= start_date,
            Order.created_at <= end_date
        ).group_by(
            func.date(Order.created_at)
        ).all()
        
        dish_trend = []
        for day in daily_sales:
            try:
                # Безопасное преобразование даты
                date_value = day.date
                if hasattr(date_value, 'isoformat'):
                    date_str = date_value.isoformat()
                else:
                    date_str = str(date_value)
                    
                dish_trend.append({
                    "date": date_str,
                    "value": day.count
                })
            except Exception as e:
                print(f"Ошибка при обработке даты в тренде продаж блюд: {e}")
                continue
        
        menu_item_sales_trend[dish_id] = dish_trend
    
    # Формируем итоговые метрики по меню
    return {
        "topSellingDishes": top_selling_dishes,
        "mostProfitableDishes": most_profitable_dishes,
        "leastSellingDishes": least_selling_dishes,
        "averageCookingTime": float(avg_cooking_time),
        "categoryPopularity": category_popularity,
        "menuItemSalesTrend": menu_item_sales_trend
    }


def get_customer_metrics(
    db: Session, 
    start_date: datetime = None, 
    end_date: datetime = None
) -> Dict[str, Any]:
    """
    Получение основных метрик по клиентам
    """
    # Если даты не указаны, используем последний месяц
    if not start_date or not end_date:
        end_date = datetime.now()
        start_date = end_date - timedelta(days=30)
    
    # Общее количество пользователей (клиентов)
    total_customers = db.query(
        func.count(User.id)
    ).filter(
        User.role == 'client'
    ).scalar() or 0
    
    # Новые клиенты за указанный период
    new_customers = db.query(
        func.count(User.id)
    ).filter(
        User.role == 'client',
        User.created_at >= start_date,
        User.created_at <= end_date
    ).scalar() or 0
    
    # Предыдущий период для сравнения
    period_duration = (end_date - start_date).days
    prev_end_date = start_date
    prev_start_date = prev_end_date - timedelta(days=period_duration)
    
    # Новые клиенты за предыдущий период
    prev_new_customers = db.query(
        func.count(User.id)
    ).filter(
        User.role == 'client',
        User.created_at >= prev_start_date,
        User.created_at <= prev_end_date
    ).scalar() or 0
    
    # Изменение количества новых клиентов (в процентах)
    new_customers_change = ((new_customers - prev_new_customers) / prev_new_customers * 100) if prev_new_customers else 0
    
    # Возвращающиеся клиенты: пользователи с более чем одним заказом в указанный период
    returning_customers = db.query(
        func.count(distinct(Order.user_id))
    ).filter(
        Order.user_id.isnot(None),
        Order.created_at >= start_date,
        Order.created_at <= end_date,
        Order.user_id.in_(
            db.query(Order.user_id).filter(
                Order.created_at < start_date
            )
        )
    ).scalar() or 0
    
    # Процент возврата клиентов
    return_rate = (returning_customers / total_customers * 100) if total_customers else 0
    
    # Получаем среднее количество посещений на клиента
    visit_counts = db.query(
        Order.user_id,
        func.count(Order.id).label('visit_count')
    ).filter(
        Order.user_id.isnot(None),
        Order.created_at >= start_date,
        Order.created_at <= end_date
    ).group_by(
        Order.user_id
    ).all()
    
    total_visits = sum(vc.visit_count for vc in visit_counts)
    average_visits = (total_visits / len(visit_counts)) if visit_counts else 0
    
    # Получаем данные о удовлетворенности клиентов (средний рейтинг)
    # Проверяем, есть ли атрибут rating в модели Order
    has_rating_attr = False
    try:
        Order.rating
        has_rating_attr = True
    except AttributeError:
        has_rating_attr = False
    
    avg_satisfaction = 0
    avg_food_rating = 0
    avg_service_rating = 0
    
    if has_rating_attr:
        avg_satisfaction = db.query(
            func.avg(Order.rating)
        ).filter(
            Order.rating.isnot(None),
            Order.created_at >= start_date,
            Order.created_at <= end_date
        ).scalar() or 0
    else:
        # Если атрибута rating нет, используем данные из модели Review
        avg_satisfaction = db.query(
            func.avg(Review.service_rating)
        ).filter(
            Review.created_at >= start_date,
            Review.created_at <= end_date
        ).scalar() or 4.0  # Значение по умолчанию, если данных нет
        
        # Средний рейтинг еды
        avg_food_rating = db.query(
            func.avg(Review.food_rating)
        ).filter(
            Review.created_at >= start_date,
            Review.created_at <= end_date,
            Review.food_rating.isnot(None)
        ).scalar() or 0
        
        # Средний рейтинг обслуживания
        avg_service_rating = db.query(
            func.avg(Review.service_rating)
        ).filter(
            Review.created_at >= start_date,
            Review.created_at <= end_date,
            Review.service_rating.isnot(None)
        ).scalar() or 0
    
    # Сегментация клиентов на основе количества заказов
    customer_segmentation = {
        'Новые': 0,      # 1 заказ
        'Случайные': 0,  # 2-3 заказа
        'Регулярные': 0, # 4-8 заказов
        'Лояльные': 0    # 9+ заказов
    }
    
    # Получаем сегментацию клиентов
    customer_segments = db.query(
        Order.user_id,
        func.count(Order.id).label('orders_count')
    ).filter(
        Order.user_id.isnot(None),
        Order.created_at <= end_date
    ).group_by(
        Order.user_id
    ).all()
    
    for segment in customer_segments:
        if segment.orders_count == 1:
            customer_segmentation['Новые'] += 1
        elif segment.orders_count > 1 and segment.orders_count <= 3:
            customer_segmentation['Случайные'] += 1
        elif segment.orders_count > 3 and segment.orders_count <= 8:
            customer_segmentation['Регулярные'] += 1
        else:
            customer_segmentation['Лояльные'] += 1
    
    # Преобразуем абсолютные значения в проценты
    total_segmented = sum(customer_segmentation.values())
    if total_segmented > 0:
        for key in customer_segmentation:
            customer_segmentation[key] = round(customer_segmentation[key] / total_segmented * 100, 1)
    
    # Топ клиентов по сумме заказов
    try:
        # Пытаемся объединить имя и фамилию
        top_customers_query = db.query(
            User.id.label('user_id'),
            (User.first_name + ' ' + User.last_name).label('full_name'),
            User.email,
            func.sum(Order.total_amount).label('total_spent'),
            func.count(Order.id).label('orders_count'),
            func.max(Order.created_at).label('last_visit')
        )
    except Exception:
        # Если не получилось, используем имя из модели User
        try:
            top_customers_query = db.query(
                User.id.label('user_id'),
                User.name.label('full_name'),
                User.email,
                func.sum(Order.total_amount).label('total_spent'),
                func.count(Order.id).label('orders_count'),
                func.max(Order.created_at).label('last_visit')
            )
        except Exception:
            # Если и это не получилось, используем атрибут username или full_name
            try:
                top_customers_query = db.query(
                    User.id.label('user_id'),
                    User.full_name.label('full_name'),
                    User.email,
                    func.sum(Order.total_amount).label('total_spent'),
                    func.count(Order.id).label('orders_count'),
                    func.max(Order.created_at).label('last_visit')
                )
            except Exception:
                top_customers_query = db.query(
                    User.id.label('user_id'),
                    User.id.label('full_name'),  # Если имя не найдено, используем ID
                    User.email,
                    func.sum(Order.total_amount).label('total_spent'),
                    func.count(Order.id).label('orders_count'),
                    func.max(Order.created_at).label('last_visit')
                )
    
    top_customers = top_customers_query.join(
        Order, Order.user_id == User.id
    ).filter(
        User.role == 'client',
        Order.created_at >= start_date,
        Order.created_at <= end_date
    ).group_by(
        User.id, User.email
    ).order_by(
        desc('total_spent')
    ).limit(10).all()
    
    # Форматируем результат
    return {
        "totalCustomers": total_customers,
        "newCustomers": new_customers,
        "newCustomersChange": round(new_customers_change, 1),
        "returningCustomers": returning_customers,
        "returnRate": round(return_rate, 1),
        "averageVisitsPerCustomer": round(average_visits, 1),
        "customerSatisfaction": round(avg_satisfaction, 1), # Рейтинг в 5-бальной шкале
        "foodRating": round(avg_food_rating, 1), # Средний рейтинг еды в 5-бальной шкале
        "serviceRating": round(avg_service_rating, 1), # Средний рейтинг обслуживания в 5-бальной шкале
        "customerSegmentation": customer_segmentation,
        "topCustomers": [
            {
                "userId": customer.user_id,
                "fullName": getattr(customer, 'full_name', f"Клиент {customer.user_id}"),
                "email": getattr(customer, 'email', ''),
                "totalSpent": round(float(customer.total_spent), 2) if customer.total_spent else 0,
                "ordersCount": customer.orders_count,
                "lastVisit": str(customer.last_visit) if customer.last_visit else ""
            }
            for customer in top_customers
        ]
    }


def get_operational_metrics(
    db: Session, 
    start_date: datetime = None, 
    end_date: datetime = None
) -> Dict[str, Any]:
    """
    Получение операционных метрик ресторана
    """
    # Если даты не указаны, используем последний месяц
    if not start_date:
        start_date = datetime.now() - timedelta(days=30)
    if not end_date:
        end_date = datetime.now()
    
    # Среднее время приготовления заказа (в минутах)
    avg_preparation_time_query = db.query(
        func.avg(
            func.extract('epoch', Order.updated_at - Order.created_at) / 60
        )
    ).filter(
        Order.status.in_([OrderStatus.COMPLETED, OrderStatus.DELIVERED]),
        Order.created_at >= start_date,
        Order.created_at <= end_date,
        Order.updated_at.isnot(None)
    )
    
    avg_order_preparation_time = avg_preparation_time_query.scalar() or 0
    
    # Среднее время оборота стола (в минутах)
    # Предполагаем, что время оборота - это разница между временем завершения заказа и временем его создания
    avg_table_turnover_query = db.query(
        func.avg(
            func.extract('epoch', Order.updated_at - Order.created_at) / 60
        )
    ).filter(
        Order.status == OrderStatus.COMPLETED,
        Order.created_at >= start_date,
        Order.created_at <= end_date,
        Order.updated_at.isnot(None),
        Order.table_number.isnot(None)
    )
    
    avg_table_turnover_time = avg_table_turnover_query.scalar() or 0
    
    # Получаем количество столиков, которые использовались
    tables_count = db.query(
        func.count(distinct(Order.table_number))
    ).filter(
        Order.table_number.isnot(None),
        Order.created_at >= start_date,
        Order.created_at <= end_date
    ).scalar() or 0
    
    # Получаем использование столиков (количество заказов на столик)
    table_usage = db.query(
        Order.table_number,
        func.count(Order.id).label('orders_count')
    ).filter(
        Order.table_number.isnot(None),
        Order.created_at >= start_date,
        Order.created_at <= end_date
    ).group_by(
        Order.table_number
    ).all()
    
    # Формируем данные по загрузке столиков
    table_utilization = {}
    
    if table_usage:
        max_orders = max(t.orders_count for t in table_usage)
        for table in table_usage:
            # Рассчитываем использование в процентах от максимума
            utilization_percentage = (table.orders_count / max_orders * 100) if max_orders else 0
            table_utilization[str(table.table_number)] = round(utilization_percentage)
    
    # Получаем пиковые часы по количеству заказов
    hourly_data = db.query(
        extract('hour', Order.created_at).label('hour'),
        func.count(Order.id).label('orders_count')
    ).filter(
        Order.created_at >= start_date,
        Order.created_at <= end_date
    ).group_by(
        extract('hour', Order.created_at)
    ).order_by(
        desc('orders_count')
    ).all()
    
    peak_hours = {}
    
    if hourly_data:
        max_hourly_orders = max(h.orders_count for h in hourly_data)
        for hour_data in hourly_data:
            # Рассчитываем загруженность часа в процентах от максимума
            hour_percentage = (hour_data.orders_count / max_hourly_orders * 100) if max_hourly_orders else 0
            peak_hours[f"{int(hour_data.hour)}:00"] = round(hour_percentage)
    
    # Получаем статусы заказов за период
    order_statuses = db.query(
        Order.status,
        func.count(Order.id).label('count')
    ).filter(
        Order.created_at >= start_date,
        Order.created_at <= end_date
    ).group_by(
        Order.status
    ).all()
    
    # Преобразуем статусы заказов в проценты
    total_orders = sum(status.count for status in order_statuses)
    order_completion_rates = {}
    
    if total_orders > 0:
        for status in order_statuses:
            status_percentage = (status.count / total_orders * 100)
            order_completion_rates[str(status.status)] = round(status_percentage, 1)
    
    # Проверяем, есть ли атрибут rating в модели Order для расчета эффективности персонала
    has_rating_attr = False
    try:
        Order.rating
        has_rating_attr = True
    except AttributeError:
        has_rating_attr = False
    
    # Заготовка для эффективности персонала
    staff_efficiency = {}
    
    # В данном примере предполагаем, что у нас есть информация об эффективности работников
    # На практике здесь могла бы быть сложная логика для анализа работы персонала
    
    # Форматируем итоговый результат
    return {
        "averageOrderPreparationTime": round(avg_order_preparation_time, 1),
        "averageTableTurnoverTime": round(avg_table_turnover_time, 1),
        "tablesCount": tables_count,
        "averageTableUtilization": round(sum(table_utilization.values()) / len(table_utilization)) if table_utilization else 0,
        "averageOrdersPerTable": round(total_orders / tables_count, 1) if tables_count else 0,
        "tableUtilization": table_utilization,
        "peakHours": peak_hours,
        "staffEfficiency": staff_efficiency,
        "orderCompletionRates": order_completion_rates
    }


def get_predictive_metrics(
    db: Session, 
    start_date: datetime = None, 
    end_date: datetime = None
) -> Dict[str, Any]:
    """
    Получение предиктивных метрик ресторана на основе анализа данных
    """
    # Если даты не указаны, используем последний месяц
    if not start_date:
        start_date = datetime.now() - timedelta(days=30)
    if not end_date:
        end_date = datetime.now()
    
    # Получаем данные о продажах за последние 30 дней
    sales_data = get_daily_orders(db, days=30)
    
    # Прогноз продаж на следующие 14 дней
    # В простом примере используем среднее значение за последние 7 дней
    last_7_days_data = sales_data[-7:] if len(sales_data) >= 7 else sales_data
    
    # Рассчитываем средние значения
    avg_daily_orders = sum(day["orders_count"] for day in last_7_days_data) / len(last_7_days_data) if last_7_days_data else 0
    avg_daily_revenue = sum(day["total_revenue"] for day in last_7_days_data) / len(last_7_days_data) if last_7_days_data else 0
    
    # Анализируем тренд (линейная регрессия)
    if len(last_7_days_data) >= 3:
        x = list(range(len(last_7_days_data)))
        y_orders = [day["orders_count"] for day in last_7_days_data]
        y_revenue = [day["total_revenue"] for day in last_7_days_data]
        
        # Простая линейная регрессия
        order_slope = (len(x) * sum(x_i * y_i for x_i, y_i in zip(x, y_orders)) - sum(x) * sum(y_orders)) / \
                      (len(x) * sum(x_i ** 2 for x_i in x) - sum(x) ** 2) if len(x) > 1 else 0
        revenue_slope = (len(x) * sum(x_i * y_i for x_i, y_i in zip(x, y_revenue)) - sum(x) * sum(y_revenue)) / \
                        (len(x) * sum(x_i ** 2 for x_i in x) - sum(x) ** 2) if len(x) > 1 else 0
    else:
        order_slope = 0
        revenue_slope = 0
    
    # Формируем прогноз на следующие 14 дней
    forecast = []
    for day in range(1, 15):
        # Учитываем тренд в прогнозе
        forecasted_orders = max(0, avg_daily_orders + order_slope * day)
        forecasted_revenue = max(0, avg_daily_revenue + revenue_slope * day)
        
        # Учитываем сезонность по дням недели
        today = datetime.now().date()
        forecast_date = today + timedelta(days=day)
        day_of_week = forecast_date.weekday()
        
        # Коэффициенты для разных дней недели (примерные значения)
        dow_coefficients = {
            0: 0.9,  # Понедельник
            1: 0.95, # Вторник
            2: 1.0,  # Среда
            3: 1.05, # Четверг
            4: 1.2,  # Пятница
            5: 1.3,  # Суббота
            6: 1.1   # Воскресенье
        }
        
        daily_coefficient = dow_coefficients.get(day_of_week, 1.0)
        
        # Применяем коэффициент к прогнозу
        adjusted_orders = round(forecasted_orders * daily_coefficient)
        adjusted_revenue = round(forecasted_revenue * daily_coefficient, 2)
        
        forecast.append({
            "date": forecast_date.isoformat(),
            "value": adjusted_revenue
        })
    
    # Прогноз необходимых запасов на основе популярности блюд
    # Получаем топ-10 популярных блюд
    top_dishes = get_top_dishes(db, limit=10, start_date=start_date, end_date=end_date)
    
    inventory_forecast = {}
    for dish in top_dishes:
        # Предполагаем, что для каждого топ-блюда нужно иметь запас на неделю
        dish_id = dish["id"]
        weekly_demand = dish["total_ordered"] / 4  # примерно четверть месячного объема
        inventory_forecast[dish_id] = round(weekly_demand)
    
    # Прогноз потребности в персонале по дням недели и часам
    # Анализируем распределение заказов по дням недели и часам
    staff_needs_query = db.query(
        extract('dow', Order.created_at).label('day_of_week'),
        extract('hour', Order.created_at).label('hour'),
        func.count(Order.id).label('orders_count')
    ).filter(
        Order.created_at >= start_date,
        Order.created_at <= end_date
    ).group_by(
        extract('dow', Order.created_at),
        extract('hour', Order.created_at)
    )
    
    staffing_data = staff_needs_query.all()
    
    # Формируем прогноз потребности в персонале
    weekdays = {
        0: 'Понедельник', 1: 'Вторник', 2: 'Среда', 
        3: 'Четверг', 4: 'Пятница', 5: 'Суббота', 6: 'Воскресенье'
    }
    
    staffing_needs = {}
    for day in range(7):
        day_name = weekdays[day]
        staffing_needs[day_name] = {}
        
        for hour in range(9, 23):  # Рабочие часы с 9 до 22
            hour_str = f"{hour:02d}-{hour+1:02d}"
            
            # Находим данные для этого дня недели и часа
            day_hour_data = next((
                item for item in staffing_data 
                if item.day_of_week == day and item.hour == hour
            ), None)
            
            # Рассчитываем количество необходимого персонала
            # Предполагаем, что один сотрудник может обслужить до 5 заказов в час
            orders_in_hour = day_hour_data.orders_count if day_hour_data else 0
            staff_needed = max(1, round(orders_in_hour / 5))
            
            staffing_needs[day_name][hour_str] = staff_needed
    
    # Определяем пиковые часы по дням недели
    peak_time_prediction = {}
    for day_name, hours in staffing_needs.items():
        # Сортируем часы по количеству персонала (от большего к меньшему)
        sorted_hours = sorted(hours.items(), key=lambda x: x[1], reverse=True)
        
        # Берем топ-3 часа
        peak_hours = [hour for hour, _ in sorted_hours[:3]]
        peak_time_prediction[day_name] = peak_hours
    
    # Рекомендации по акциям на основе анализа продаж
    # Ищем блюда с хорошим потенциалом для акций
    promotion_candidates_query = db.query(
        Dish.id,
        Dish.name,
        Dish.price,
        func.count(OrderDish.id).label('orders_count')
    ).join(
        OrderDish, OrderDish.dish_id == Dish.id
    ).join(
        Order, Order.id == OrderDish.order_id
    ).filter(
        Order.created_at >= start_date,
        Order.created_at <= end_date
    ).group_by(
        Dish.id
    ).order_by(
        func.count(OrderDish.id)
    ).limit(5)
    
    promotion_candidates = promotion_candidates_query.all()
    
    suggested_promotions = []
    for dish in promotion_candidates:
        # Рассчитываем рекомендуемую скидку и потенциальную выручку
        suggested_discount = min(30, max(10, 30 - (dish.orders_count / 10)))  # От 10% до 30%
        potential_revenue = dish.price * dish.orders_count * 1.5 * (1 - suggested_discount / 100)
        
        suggested_promotions.append({
            "dishId": dish.id,
            "dishName": dish.name,
            "reason": "Повышение продаж",
            "suggestedDiscount": round(suggested_discount, 2),
            "potentialRevenue": round(potential_revenue, 2)
        })
    
    # Формируем итоговые предиктивные метрики
    return {
        "salesForecast": forecast,
        "inventoryForecast": inventory_forecast,
        "staffingNeeds": staffing_needs,
        "peakTimePrediction": peak_time_prediction,
        "suggestedPromotions": suggested_promotions
    } 