from typing import List
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.models.user import User, UserRole
from app.schemas.user import UserResponse, UserUpdate, UserCreate
from app.services.auth import get_current_user
from app.services.user import get_user, get_users, update_user, delete_user, create_user, get_user_by_email

router = APIRouter()


@router.get("/me", response_model=UserResponse)
def read_user_me(
    current_user: User = Depends(get_current_user)
):
    """Получение информации о текущем пользователе"""
    # Проверяем, нужно ли обновить токен
    if hasattr(current_user, 'needs_token_refresh') and current_user.needs_token_refresh:
        return {
            **current_user.__dict__,
            "needs_token_refresh": True
        }
    
    # Возвращаем полные данные пользователя
    return {
        "id": current_user.id,
        "email": current_user.email,
        "role": current_user.role,
        "is_active": current_user.is_active,
        "full_name": current_user.full_name,
        "phone": current_user.phone,
        "created_at": current_user.created_at,
        "updated_at": current_user.updated_at,
        "needs_token_refresh": False
    }


@router.put("/me", response_model=UserResponse)
def update_user_me(
    user_in: UserUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Обновление данных текущего пользователя"""
    # Запрещаем обычным пользователям менять свою роль
    if user_in.role and user_in.role != current_user.role and current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Недостаточно прав для изменения роли",
        )
    
    return update_user(db, current_user.id, user_in)


@router.get("/{user_id}", response_model=UserResponse)
def read_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Получение информации о пользователе по ID"""
    # Проверяем права доступа
    if current_user.id != user_id and current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Недостаточно прав для просмотра информации о других пользователях",
        )
    
    user = get_user(db, user_id)
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Пользователь не найден",
        )
    
    return user


@router.get("/", response_model=List[UserResponse])
def read_users(
    skip: int = 0,
    limit: int = 100,
    role: UserRole = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Получение списка пользователей"""
    # Проверяем права доступа
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Недостаточно прав для просмотра списка пользователей",
        )
    
    users = get_users(db, skip=skip, limit=limit, role=role)
    return users


@router.put("/{user_id}", response_model=UserResponse)
def update_user_by_id(
    user_id: int,
    user_in: UserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Обновление данных пользователя по ID"""
    # Проверяем права доступа
    if current_user.id != user_id and current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Недостаточно прав для изменения данных других пользователей",
        )
    
    user = get_user(db, user_id)
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Пользователь не найден",
        )
    
    return update_user(db, user_id, user_in)


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user_by_id(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Удаление пользователя по ID"""
    # Проверяем права доступа
    if current_user.id != user_id and current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Недостаточно прав для удаления других пользователей",
        )
    
    # Запрещаем удаление админа
    if user_id == 1:  # Предполагаем, что первый пользователь - админ
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Невозможно удалить основного администратора",
        )
    
    result = delete_user(db, user_id)
    
    if not result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Пользователь не найден",
        )


@router.post("/customer", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def create_customer(
    user_in: UserCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Создание нового пользователя с ролью клиента"""
    # Проверяем права доступа
    if current_user.role not in [UserRole.ADMIN, UserRole.WAITER]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Недостаточно прав для создания клиентов",
        )
    
    # Проверяем, нет ли уже пользователя с таким email
    existing_user = get_user_by_email(db, user_in.email)
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Пользователь с email {user_in.email} уже существует",
        )
    
    # Устанавливаем роль клиента
    user_data = user_in.model_dump()
    user_data["role"] = UserRole.CLIENT
    
    # Проверяем наличие возрастной группы
    print(f"Полученная возрастная группа: {user_in.age_group}")
    
    user_create = UserCreate(**user_data)
    
    # Создаем пользователя
    new_user = create_user(db, user_create)
    return new_user 