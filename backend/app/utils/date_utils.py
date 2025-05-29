from datetime import datetime

def is_weekend(date: datetime) -> bool:
    """Проверяет, является ли дата выходным днем (суббота или воскресенье)"""
    return date.weekday() >= 5  # 5 - суббота, 6 - воскресенье

def get_day_name(weekday: int) -> str:
    """Возвращает название дня недели на русском языке по номеру (0-6)"""
    days = {
        0: 'Понедельник',
        1: 'Вторник',
        2: 'Среда',
        3: 'Четверг',
        4: 'Пятница',
        5: 'Суббота',
        6: 'Воскресенье'
    }
    return days.get(weekday, 'Неизвестно') 