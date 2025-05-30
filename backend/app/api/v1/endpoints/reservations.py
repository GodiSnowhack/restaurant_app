from typing import List, Dict, Any
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query, status, Request
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.models.user import User, UserRole
from app.models.reservation import ReservationStatus, Reservation
from app.schemas.reservation import ReservationResponse, ReservationCreate, ReservationUpdate, ReservationRawResponse
from app.services.auth import get_current_user, get_optional_current_user
from app.services.reservation import (
    get_reservation, get_reservations_by_user, get_reservations_by_date,
    get_reservations_by_status, create_reservation, update_reservation, delete_reservation,
    get_reservation_by_code
)

router = APIRouter()


@router.get("/", response_model=List[ReservationResponse])
async def read_reservations(
    request: Request,
    skip: int = 0,
    limit: int = 100,
    status: ReservationStatus = None,
    date: datetime = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_optional_current_user)
):
    """Получение списка бронирований"""
    try:
        print(f"[RESERVATIONS DEBUG] Запрос списка бронирований. Пользователь: {current_user.id if current_user else 'не аутентифицирован'}")
        print(f"[RESERVATIONS DEBUG] Параметры запроса: skip={skip}, limit={limit}, status={status}, date={date}")
        
        # Проверяем, есть ли пользователь (аутентифицирован ли)
        if not current_user:
            # Проверяем наличие X-User-ID в заголовке
            user_id = request.headers.get("X-User-ID")
            print(f"[RESERVATIONS DEBUG] X-User-ID из заголовка: {user_id}")
            
            if not user_id:
                # Если нет ни токена, ни X-User-ID, требуем авторизацию
                # Не возвращаем все бронирования для безопасности
                print("[RESERVATIONS DEBUG] Отсутствует токен и X-User-ID. Требуется авторизация.")
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Необходима авторизация для просмотра бронирований",
                    headers={"WWW-Authenticate": "Bearer"},
                )
            
            # Пытаемся получить пользователя по ID из заголовка
            try:
                user_id_int = int(user_id)
                user = db.query(User).filter(User.id == user_id_int).first()
                if not user:
                    user = User(
                        id=user_id_int,
                        email=f"temp_{user_id_int}@example.com",
                        full_name="Временный пользователь",
                        role=UserRole.CLIENT,
                        is_active=True
                    )
                print(f"[RESERVATIONS DEBUG] Получен пользователь из заголовка: ID={user_id_int}, роль={user.role}")
                # Не сохраняем в базу, просто используем для проверки
                # Обычный пользователь видит только свои бронирования
                reservations = get_reservations_by_user(db, user_id_int, skip, limit)
                print(f"[RESERVATIONS DEBUG] Возвращаем {len(reservations)} бронирований для пользователя {user_id_int}")
                return reservations
            except (ValueError, TypeError):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Неверный формат ID пользователя",
                )
        
        # Если пользователь аутентифицирован, используем обычную логику
        if current_user.role == UserRole.ADMIN:
            # Администратор может видеть все бронирования
            print(f"[RESERVATIONS DEBUG] Пользователь {current_user.id} с ролью ADMIN запрашивает все бронирования")
            if date:
                reservations = get_reservations_by_date(db, date, skip, limit)
            elif status:
                reservations = get_reservations_by_status(db, status, skip, limit)
            else:
                # Возвращаем все бронирования
                reservations = db.query(Reservation).offset(skip).limit(limit).all()
            print(f"[RESERVATIONS DEBUG] Возвращаем {len(reservations)} бронирований для администратора")
            return reservations
        elif current_user.role == UserRole.WAITER:
            # Официант видит все бронирования
            print(f"[RESERVATIONS DEBUG] Пользователь {current_user.id} с ролью WAITER запрашивает все бронирования")
            if date:
                reservations = get_reservations_by_date(db, date, skip, limit)
            elif status:
                reservations = get_reservations_by_status(db, status, skip, limit)
            else:
                reservations = db.query(Reservation).offset(skip).limit(limit).all()
            print(f"[RESERVATIONS DEBUG] Возвращаем {len(reservations)} бронирований для официанта")
            return reservations
        else:
            # Обычный пользователь видит только свои бронирования
            print(f"[RESERVATIONS DEBUG] Пользователь {current_user.id} с ролью {current_user.role} запрашивает свои бронирования")
            reservations = get_reservations_by_user(db, current_user.id, skip, limit)
            print(f"[RESERVATIONS DEBUG] Возвращаем {len(reservations)} бронирований для пользователя {current_user.id}")
            return reservations
    except Exception as e:
        print(f"Ошибка при получении бронирований: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Ошибка при получении бронирований: {str(e)}"
        )


@router.post("/", response_model=ReservationResponse, status_code=status.HTTP_201_CREATED)
async def create_reservation_endpoint(
    request: Request,
    reservation_in: ReservationCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_optional_current_user)
):
    """Создание нового бронирования"""
    # Отладочный вывод входящих данных
    print(f"[DEBUG API] Входящие данные бронирования: {reservation_in.dict()}")
    
    # Если пользователь не аутентифицирован через JWT, пробуем использовать ID из заголовка
    if not current_user:
        user_id = request.headers.get("X-User-ID")
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Не удалось подтвердить учетные данные",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        try:
            user_id_int = int(user_id)
            current_user = db.query(User).filter(User.id == user_id_int).first()
            
            if not current_user:
                current_user = User(
                    id=user_id_int,
                    email=f"temp_{user_id_int}@example.com",
                    full_name="Временный пользователь",
                    role=UserRole.CLIENT,
                    is_active=True
                )
        except (ValueError, TypeError):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Неверный формат ID пользователя",
            )
    
    # Проверяем, что выбранная дата в будущем
    if not reservation_in.reservation_time:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Не указано время бронирования",
        )
    
    if reservation_in.reservation_time <= datetime.now():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Дата бронирования должна быть в будущем",
        )
    
    # Проверяем, что код бронирования уникален
    if reservation_in.reservation_code:
        existing = get_reservation_by_code(db, reservation_in.reservation_code)
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Бронирование с кодом {reservation_in.reservation_code} уже существует",
            )
    
    # Создаем бронирование
    db_reservation = create_reservation(db, current_user.id, reservation_in)
    
    # Проверяем, что код бронирования установлен правильно
    print(f"[DEBUG API] После создания бронирования: ID={db_reservation.id}, код={db_reservation.reservation_code}, исходный код={reservation_in.reservation_code}")
    
    if db_reservation.reservation_code != reservation_in.reservation_code:
        print(f"[CRITICAL] НЕСООТВЕТСТВИЕ КОДОВ БРОНИРОВАНИЯ: отправлено={reservation_in.reservation_code}, сохранено={db_reservation.reservation_code}")
    
    return db_reservation


@router.get("/{reservation_id}", response_model=ReservationResponse)
async def read_reservation_by_id(
    request: Request,
    reservation_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_optional_current_user)
):
    """Получение бронирования по ID"""
    # Проверяем авторизацию через X-User-ID если нет JWT
    if not current_user:
        user_id = request.headers.get("X-User-ID")
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Не удалось подтвердить учетные данные",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        try:
            user_id_int = int(user_id)
            current_user = db.query(User).filter(User.id == user_id_int).first()
            
            if not current_user:
                current_user = User(
                    id=user_id_int,
                    email=f"temp_{user_id_int}@example.com",
                    full_name="Временный пользователь",
                    role=UserRole.CLIENT,
                    is_active=True
                )
        except (ValueError, TypeError):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Неверный формат ID пользователя",
            )
    
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
async def update_reservation_endpoint(
    request: Request,
    reservation_id: int,
    reservation_in: ReservationUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_optional_current_user)
):
    """Обновление бронирования"""
    # Проверяем авторизацию через X-User-ID если нет JWT
    if not current_user:
        user_id = request.headers.get("X-User-ID")
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Не удалось подтвердить учетные данные",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        try:
            user_id_int = int(user_id)
            current_user = db.query(User).filter(User.id == user_id_int).first()
            
            if not current_user:
                current_user = User(
                    id=user_id_int,
                    email=f"temp_{user_id_int}@example.com",
                    full_name="Временный пользователь",
                    role=UserRole.CLIENT,
                    is_active=True
                )
        except (ValueError, TypeError):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Неверный формат ID пользователя",
            )
    
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
async def delete_reservation_endpoint(
    request: Request,
    reservation_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_optional_current_user)
):
    """Удаление бронирования"""
    # Проверяем авторизацию через X-User-ID если нет JWT
    if not current_user:
        user_id = request.headers.get("X-User-ID")
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Не удалось подтвердить учетные данные",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        try:
            user_id_int = int(user_id)
            current_user = db.query(User).filter(User.id == user_id_int).first()
            
            if not current_user:
                current_user = User(
                    id=user_id_int,
                    email=f"temp_{user_id_int}@example.com",
                    full_name="Временный пользователь",
                    role=UserRole.CLIENT,
                    is_active=True
                )
        except (ValueError, TypeError):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Неверный формат ID пользователя",
            )
    
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


@router.post("/verify-code", response_model=Dict[str, Any])
def verify_reservation_code(
    request: dict,
    db: Session = Depends(get_db)
):
    """Проверка кода бронирования"""
    code = request.get("code", "")
    if not code:
        return {"valid": False, "message": "Код бронирования не предоставлен"}
    
    reservation = get_reservation_by_code(db, code)
    
    if not reservation:
        return {"valid": False, "message": "Код бронирования не найден"}
    
    # Проверяем, что бронирование не отменено и не завершено
    if reservation.status == "cancelled":
        return {"valid": False, "message": "Бронирование отменено"}
    
    if reservation.status == "completed":
        return {"valid": False, "message": "Бронирование уже завершено"}
    
    # Возвращаем данные о бронировании
    return {
        "valid": True,
        "reservation_id": reservation.id,
        "table_number": reservation.table_number,
        "guest_name": reservation.guest_name,
        "guest_phone": reservation.guest_phone,
        "guests_count": reservation.guests_count,
        "reservation_time": reservation.reservation_time.isoformat()
    }


@router.get("/raw", response_model=List[ReservationRawResponse])
async def read_raw_reservations(
    request: Request,
    skip: int = 0,
    limit: int = 100,
    status: str = None,
    date: datetime = None,
    db: Session = Depends(get_db)
):
    """Получение списка бронирований без строгой валидации схемы"""
    print(f"[RAW API] Получение бронирований с параметрами: skip={skip}, limit={limit}, status={status}, date={date}")
    
    # Базовый запрос
    query = db.query(Reservation)
    
    # Применяем фильтры
    if status:
        query = query.filter(Reservation.status == status)
    
    if date:
        # Извлекаем только дату (без времени)
        start_of_day = date.replace(hour=0, minute=0, second=0, microsecond=0)
        end_of_day = date.replace(hour=23, minute=59, second=59, microsecond=999999)
        
        query = query.filter(
            Reservation.reservation_time >= start_of_day,
            Reservation.reservation_time <= end_of_day
        )
    
    # Получаем результаты с пагинацией
    reservations = query.offset(skip).limit(limit).all()
    
    print(f"[RAW API] Получено {len(reservations)} бронирований")
    
    return reservations


@router.patch("/{reservation_id}/status", response_model=ReservationResponse)
async def update_reservation_status(
    request: Request,
    reservation_id: int,
    status_data: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_optional_current_user)
):
    """Обновление статуса бронирования"""
    # Проверяем авторизацию через X-User-ID если нет JWT
    if not current_user:
        user_id = request.headers.get("X-User-ID")
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Не удалось подтвердить учетные данные",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        try:
            user_id_int = int(user_id)
            current_user = db.query(User).filter(User.id == user_id_int).first()
            
            if not current_user:
                current_user = User(
                    id=user_id_int,
                    email=f"temp_{user_id_int}@example.com",
                    full_name="Временный пользователь",
                    role=UserRole.CLIENT,
                    is_active=True
                )
        except (ValueError, TypeError):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Неверный формат ID пользователя",
            )
    
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
            detail="Недостаточно прав для изменения статуса этого бронирования",
        )
    
    # Получаем новый статус
    try:
        new_status = status_data.get("status")
        if not new_status:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Не указан новый статус бронирования",
            )
        
        # Проверяем существование указанного статуса
        if new_status not in [s.value for s in ReservationStatus]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Недопустимый статус: {new_status}",
            )
        
        # Проверяем текущий статус бронирования
        if reservation.status in [ReservationStatus.CANCELLED, ReservationStatus.COMPLETED]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Нельзя изменить статус отмененного или завершенного бронирования",
            )
        
        # Создаем объект для обновления только статуса
        update_data = ReservationUpdate(status=new_status)
        
        # Обновляем бронирование
        updated_reservation = update_reservation(db, reservation_id, update_data)
        print(f"[DEBUG] Статус бронирования #{reservation_id} обновлен на {new_status}")
        
        return updated_reservation
    except Exception as e:
        print(f"[ERROR] Ошибка при обновлении статуса бронирования: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Ошибка при обновлении статуса бронирования: {str(e)}",
        ) 