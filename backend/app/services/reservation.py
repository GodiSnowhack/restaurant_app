from typing import List, Optional
from datetime import datetime

from sqlalchemy.orm import Session

from app.models.reservation import Reservation, ReservationStatus
from app.schemas.reservation import ReservationCreate, ReservationUpdate


def get_reservation(db: Session, reservation_id: int) -> Optional[Reservation]:
    """Получение брони по ID"""
    return db.query(Reservation).filter(Reservation.id == reservation_id).first()


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
    db_reservation = Reservation(
        user_id=user_id,
        table_number=reservation_in.table_number,
        guests_count=reservation_in.guests_count,
        reservation_time=reservation_in.reservation_time,
        guest_name=reservation_in.guest_name,
        guest_phone=reservation_in.guest_phone,
        comment=reservation_in.comment,
        status=ReservationStatus.PENDING,
    )
    
    db.add(db_reservation)
    db.commit()
    db.refresh(db_reservation)
    
    return db_reservation


def update_reservation(
    db: Session, reservation_id: int, reservation_in: ReservationUpdate
) -> Optional[Reservation]:
    """Обновление брони"""
    db_reservation = get_reservation(db, reservation_id)
    
    if not db_reservation:
        return None
    
    # Обновляем поля брони
    update_data = reservation_in.dict(exclude_unset=True)
    
    for field, value in update_data.items():
        setattr(db_reservation, field, value)
    
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