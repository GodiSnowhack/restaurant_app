from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.models.user import User, UserRole
from app.schemas.user import UserResponse, UserUpdate
from app.services.auth import get_current_user
from app.services.user import get_user, get_users, update_user, delete_user

router = APIRouter()


@router.get("/me", response_model=UserResponse)
def read_user_me(
    current_user: User = Depends(get_current_user)
):
    """Получение информации о текущем пользователе"""
    return current_user


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