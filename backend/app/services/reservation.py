from typing import List, Optional
from datetime import datetime
import random
import string

from sqlalchemy.orm import Session

from app.models.reservation import Reservation, ReservationStatus
from app.schemas.reservation import ReservationCreate, ReservationUpdate


def get_reservation(db: Session, reservation_id: int) -> Optional[Reservation]:
    """Получение брони по ID"""
    return db.query(Reservation).filter(Reservation.id == reservation_id).first()


def get_reservation_by_code(db: Session, code: str) -> Optional[Reservation]:
    """Получение брони по коду бронирования"""
    return db.query(Reservation).filter(Reservation.reservation_code == code).first()


def get_reservations_by_user(
    db: Session, user_id: int, skip: int = 0, limit: int = 100
) -> List[Reservation]:
    """Получение списка бронирований пользователя"""
    return db.query(Reservation).filter(Reservation.user_id == user_id).offset(skip).limit(limit).all()


def get_reservations_by_date(
    db: Session, date: datetime, skip: int = 0, limit: int = 100
) -> List[Reservation]:
    """Получение списка бронирований на определенную дату"""
    # Извлекаем только дату (без времени)
    start_of_day = date.replace(hour=0, minute=0, second=0, microsecond=0)
    end_of_day = date.replace(hour=23, minute=59, second=59, microsecond=999999)
    
    return db.query(Reservation).filter(
        Reservation.reservation_time >= start_of_day,
        Reservation.reservation_time <= end_of_day
    ).offset(skip).limit(limit).all()


def get_reservations_by_status(
    db: Session, status: ReservationStatus, skip: int = 0, limit: int = 100
) -> List[Reservation]:
    """Получение списка бронирований по статусу"""
    return db.query(Reservation).filter(Reservation.status == status).offset(skip).limit(limit).all()


def create_reservation(
    db: Session, user_id: int, reservation_in: ReservationCreate
) -> Reservation:
    """Создание новой брони"""
    # Сохраняем исходный код бронирования для логирования
    original_code = reservation_in.reservation_code
    
    # Если код бронирования не указан, генерируем его
    if not original_code:
        # Генерируем уникальный код бронирования
        chars = string.ascii_uppercase + string.digits
        original_code = 'RES-' + ''.join(random.choice(chars) for _ in range(6))
        print(f"[DEBUG] Сгенерирован код бронирования: {original_code}")
    
    print(f"[DEBUG] Создаем бронирование с кодом: {original_code}")
    
    # Создаем объект без commit для проверки
    db_reservation = Reservation(
        user_id=user_id,
        table_number=reservation_in.table_number,
        guests_count=reservation_in.guests_count,
        reservation_time=reservation_in.reservation_time,
        guest_name=reservation_in.guest_name,
        guest_phone=reservation_in.guest_phone,
        comment=reservation_in.comment,
        status=ReservationStatus.PENDING,
        reservation_code=original_code  # Явно указываем, что используем оригинальный код
    )
    
    # КРИТИЧЕСКИ ВАЖНО: двойная проверка кода до сохранения
    if db_reservation.reservation_code != original_code:
        print(f"[ERROR] Код изменился до сохранения: Оригинал: {original_code}, В объекте: {db_reservation.reservation_code}")
        # Принудительно устанавливаем правильный код
        db_reservation.reservation_code = original_code
    
    db.add(db_reservation)
    
    try:
        db.flush()  # Проверяем без полного коммита
        print(f"[DEBUG] После flush, код бронирования: {db_reservation.reservation_code}")
        
        # Еще раз проверяем код перед коммитом
        if db_reservation.reservation_code != original_code:
            print(f"[ERROR] Код изменился после flush: Оригинал: {original_code}, Сейчас: {db_reservation.reservation_code}")
            db_reservation.reservation_code = original_code  # Восстанавливаем оригинальный код
        
        db.commit()
        print(f"[DEBUG] После commit, код бронирования: {db_reservation.reservation_code}")
    except Exception as e:
        db.rollback()
        print(f"[ERROR] Ошибка при сохранении бронирования: {str(e)}")
        raise
    
    # Обновляем объект из базы
    db.refresh(db_reservation)
    print(f"[DEBUG] После refresh, код бронирования: {db_reservation.reservation_code}")
    
    # Финальная проверка, если код изменился - исправляем принудительно и сохраняем снова
    if original_code and original_code != db_reservation.reservation_code:
        print(f"[ERROR] КОД ИЗМЕНИЛСЯ ПОСЛЕ ВСЕХ ОПЕРАЦИЙ! Оригинал: {original_code}, Сейчас: {db_reservation.reservation_code}")
        print(f"[DEBUG] Принудительно устанавливаем оригинальный код и сохраняем заново")
        
        db_reservation.reservation_code = original_code
        db.add(db_reservation)
        db.commit()
        db.refresh(db_reservation)
        print(f"[DEBUG] После принудительного исправления: {db_reservation.reservation_code}")
    
    return db_reservation


def update_reservation(
    db: Session, reservation_id: int, reservation_in: ReservationUpdate
) -> Optional[Reservation]:
    """Обновление брони"""
    db_reservation = get_reservation(db, reservation_id)
    
    if not db_reservation:
        return None
    
    # Сохраняем текущий код бронирования
    original_code = db_reservation.reservation_code
    print(f"[DEBUG] Обновление бронирования {reservation_id}, текущий код: {original_code}")
    
    # Обновляем поля брони
    update_data = reservation_in.dict(exclude_unset=True)
    
    # Если пытаются обновить код - логируем, но не даем это сделать
    if 'reservation_code' in update_data:
        new_code = update_data['reservation_code']
        print(f"[WARN] Попытка изменить код бронирования с {original_code} на {new_code}")
        if original_code and new_code != original_code:
            print(f"[ERROR] Блокируем изменение кода бронирования")
            # Удаляем поле из обновляемых данных
            del update_data['reservation_code']
    
    for field, value in update_data.items():
        setattr(db_reservation, field, value)
    
    # Еще раз проверяем код перед сохранением
    if db_reservation.reservation_code != original_code and original_code:
        print(f"[ERROR] Код бронирования изменился перед сохранением. Восстанавливаем.")
        db_reservation.reservation_code = original_code
    
    db.add(db_reservation)
    db.commit()
    db.refresh(db_reservation)
    
    # Финальная проверка
    if original_code and db_reservation.reservation_code != original_code:
        print(f"[FATAL] Код бронирования изменился после всех операций! Было: {original_code}, Стало: {db_reservation.reservation_code}")
        # Принудительно восстанавливаем
        db_reservation.reservation_code = original_code
        db.add(db_reservation)
        db.commit()
        db.refresh(db_reservation)
    
    return db_reservation


def delete_reservation(db: Session, reservation_id: int) -> bool:
    """Удаление брони"""
    db_reservation = get_reservation(db, reservation_id)
    
    if not db_reservation:
        return False
    
    db.delete(db_reservation)
    db.commit()
    
    return True 