from typing import List
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.models.user import User, UserRole
from app.models.reservation import ReservationStatus, Reservation
from app.schemas.reservation import ReservationResponse, ReservationCreate, ReservationUpdate
from app.services.auth import get_current_user
from app.services.reservation import (
    get_reservation, get_reservations_by_user, get_reservations_by_date,
    get_reservations_by_status, create_reservation, update_reservation, delete_reservation
)

router = APIRouter()


@router.get("/", response_model=List[ReservationResponse])
def read_reservations(
    skip: int = 0,
    limit: int = 100,
    status: ReservationStatus = None,
    date: datetime = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Получение списка бронирований"""
    # Проверяем права доступа
    if current_user.role == UserRole.ADMIN or current_user.role == UserRole.WAITER:
        # Администратор и официант могут видеть все бронирования
        if date:
            return get_reservations_by_date(db, date, skip, limit)
        elif status:
            return get_reservations_by_status(db, status, skip, limit)
        else:
            # Возвращаем все бронирования
            return db.query(Reservation).offset(skip).limit(limit).all()
    else:
        # Обычный пользователь видит только свои бронирования
        return get_reservations_by_user(db, current_user.id, skip, limit)


@router.post("/", response_model=ReservationResponse, status_code=status.HTTP_201_CREATED)
def create_reservation_endpoint(
    reservation_in: ReservationCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Создание нового бронирования"""
    # Проверяем, что выбранная дата в будущем
    if reservation_in.reservation_time <= datetime.now():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Дата бронирования должна быть в будущем",
        )
    
    return create_reservation(db, current_user.id, reservation_in)


@router.get("/{reservation_id}", response_model=ReservationResponse)
def read_reservation_by_id(
    reservation_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Получение бронирования по ID"""
    reservation = get_reservation(db, reservation_id)
    
    if not reservation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Бронирование не найдено",
        )
    
    # Проверяем права доступа
    if current_user.id != reservation.user_id and current_user.role not in [UserRole.ADMIN, UserRole.WAITER]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Недостаточно прав для просмотра этого бронирования",
        )
    
    return reservation


@router.put("/{reservation_id}", response_model=ReservationResponse)
def update_reservation_endpoint(
    reservation_id: int,
    reservation_in: ReservationUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Обновление бронирования"""
    # Получаем бронирование
    reservation = get_reservation(db, reservation_id)
    
    if not reservation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Бронирование не найдено",
        )
    
    # Проверяем права доступа
    if current_user.id != reservation.user_id and current_user.role not in [UserRole.ADMIN, UserRole.WAITER]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Недостаточно прав для изменения этого бронирования",
        )
    
    # Если изменяется дата, проверяем, что она в будущем
    if reservation_in.reservation_time and reservation_in.reservation_time <= datetime.now():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Дата бронирования должна быть в будущем",
        )
    
    # Проверяем статус бронирования
    if reservation.status in [ReservationStatus.CANCELLED, ReservationStatus.COMPLETED]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Нельзя изменить отмененное или завершенное бронирование",
        )
    
    return update_reservation(db, reservation_id, reservation_in)


@router.delete("/{reservation_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_reservation_endpoint(
    reservation_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Удаление бронирования"""
    # Получаем бронирование
    reservation = get_reservation(db, reservation_id)
    
    if not reservation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Бронирование не найдено",
        )
    
    # Проверяем права доступа
    if current_user.id != reservation.user_id and current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Недостаточно прав для удаления этого бронирования",
        )
    
    # Проверяем статус бронирования
    if reservation.status == ReservationStatus.COMPLETED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Нельзя удалить завершенное бронирование",
        )
    
    delete_reservation(db, reservation_id) 