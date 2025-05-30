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
        # Проверяем, есть ли пользователь (аутентифицирован ли)
        if not current_user:
            # Проверяем наличие X-User-ID в заголовке
            user_id = request.headers.get("X-User-ID")
            if not user_id:
                # Для неаутентифицированных запросов без ID в заголовке 
                # возвращаем ошибку авторизации
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Необходима авторизация для просмотра бронирований",
                    headers={"WWW-Authenticate": "Bearer"},
                )
            
            # Пытаемся получить пользователя по ID из заголовка
            try:
                user_id_int = int(user_id)
                print(f"[RESERVATIONS DEBUG] Запрос списка бронирований. Пользователь: {user_id_int}")
                print(f"[RESERVATIONS DEBUG] Параметры запроса: skip={skip}, limit={limit}, status={status}, date={date}")
                
                user = db.query(User).filter(User.id == user_id_int).first()
                if not user:
                    # Для неизвестного пользователя из заголовка создаем временного
                    # с ролью клиента для ограничения доступа
                    print(f"[RESERVATIONS DEBUG] Пользователь {user_id_int} не найден, создаем временного")
                    user = User(
                        id=user_id_int,
                        email=f"temp_{user_id_int}@example.com",
                        full_name="Временный пользователь",
                        role=UserRole.CLIENT,
                        is_active=True
                    )
                    # Сохраняем пользователя
                    db.add(user)
                    db.commit()
                    print(f"[RESERVATIONS DEBUG] Временный пользователь {user_id_int} создан")
                
                # Получаем список бронирований пользователя
                print(f"[RESERVATIONS DEBUG] Пользователь {user_id_int} с ролью {user.role} запрашивает свои бронирования")
                reservations = get_reservations_by_user(db, user_id_int, skip, limit)
                print(f"[RESERVATIONS DEBUG] Возвращаем {len(reservations)} бронирований для пользователя {user_id_int}")
                
                # Выводим список ID всех найденных бронирований
                if reservations:
                    ids = [r.id for r in reservations]
                    print(f"[RESERVATIONS DEBUG] Список ID бронирований: {ids}")
                
                return reservations
            except (ValueError, TypeError):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Неверный формат ID пользователя",
                )
        
        # Если пользователь аутентифицирован, используем обычную логику
        if current_user.role == UserRole.ADMIN:
            # Администратор может видеть все бронирования
            if date:
                return get_reservations_by_date(db, date, skip, limit)
            elif status:
                return get_reservations_by_status(db, status, skip, limit)
            else:
                # Возвращаем все бронирования
                return db.query(Reservation).offset(skip).limit(limit).all()
        elif current_user.role == UserRole.WAITER:
            # Официант видит все бронирования
            if date:
                return get_reservations_by_date(db, date, skip, limit)
            elif status:
                return get_reservations_by_status(db, status, skip, limit)
            else:
                return db.query(Reservation).offset(skip).limit(limit).all()
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
            print(f"[RESERVATIONS DEBUG] Поиск пользователя по ID {user_id_int}")
            current_user = db.query(User).filter(User.id == user_id_int).first()
            
            # Если пользователя с таким ID нет, создаем временного
            if not current_user:
                print(f"[RESERVATIONS DEBUG] Пользователь {user_id_int} не найден, создаем временного")
                current_user = User(
                    id=user_id_int,
                    email=f"temp_{user_id_int}@example.com",
                    full_name="Временный пользователь",
                    role=UserRole.CLIENT,
                    is_active=True
                )
                # Сохраняем временного пользователя в базу для обеспечения связей
                db.add(current_user)
                db.commit()
                print(f"[RESERVATIONS DEBUG] Временный пользователь {user_id_int} создан и сохранен")
        except (ValueError, TypeError):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Неверный формат ID пользователя",
            )
    
    # Проверяем, что выбранная дата в будущем
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
    
    # Явно устанавливаем user_id в данных бронирования
    user_id = current_user.id
    print(f"[RESERVATIONS DEBUG] Создание бронирования для пользователя {user_id}")
    
    # Создаем бронирование
    db_reservation = create_reservation(db, user_id, reservation_in)
    
    # Проверяем, что бронирование создано и имеет правильный user_id
    if db_reservation.user_id != user_id:
        print(f"[CRITICAL] Несоответствие ID пользователя: ожидаемый={user_id}, фактический={db_reservation.user_id}")
        # Исправляем
        db_reservation.user_id = user_id
        db.add(db_reservation)
        db.commit()
        db.refresh(db_reservation)
    
    # Еще раз проверяем данные
    print(f"[RESERVATIONS DEBUG] Бронирование создано: ID={db_reservation.id}, Пользователь={db_reservation.user_id}, Код={db_reservation.reservation_code}")
    
    # Проверим, что бронирование есть в списке пользователя
    user_reservations = get_reservations_by_user(db, user_id, 0, 100)
    found = False
    for r in user_reservations:
        if r.id == db_reservation.id:
            found = True
            print(f"[RESERVATIONS DEBUG] Бронирование найдено в списке пользователя")
            break
    
    if not found:
        print(f"[CRITICAL] Бронирование НЕ НАЙДЕНО в списке пользователя после создания!")
    
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
    current_user: User = Depends(get_current_user)
):
    """Удаление бронирования"""
    reservation = get_reservation(db, reservation_id)
    
    if not reservation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Бронирование не найдено"
        )
    
    # Проверяем права доступа
    if current_user.id != reservation.user_id and current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Недостаточно прав для удаления этого бронирования"
        )
    
    # Проверяем статус бронирования
    if reservation.status == ReservationStatus.COMPLETED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Нельзя удалить завершенное бронирование"
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