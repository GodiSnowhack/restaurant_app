from typing import List, Optional

from sqlalchemy.orm import Session

from app.models.user import User, UserRole
from app.schemas.user import UserCreate, UserUpdate
from app.services.auth import get_password_hash


def get_user(db: Session, user_id: int) -> Optional[User]:
    """Получение пользователя по ID"""
    return db.query(User).filter(User.id == user_id).first()


def get_user_by_email(db: Session, email: str) -> Optional[User]:
    """Получение пользователя по email"""
    return db.query(User).filter(User.email == email).first()


def get_users(
    db: Session, 
    skip: int = 0, 
    limit: int = 100,
    role: Optional[UserRole] = None
) -> List[User]:
    """Получение списка пользователей с фильтрацией по роли"""
    query = db.query(User)
    
    if role:
        query = query.filter(User.role == role)
    
    return query.offset(skip).limit(limit).all()


def create_user(db: Session, user_in: UserCreate) -> User:
    """Создание нового пользователя"""
    hashed_password = get_password_hash(user_in.password)
    
    db_user = User(
        email=user_in.email,
        phone=user_in.phone,
        hashed_password=hashed_password,
        full_name=user_in.full_name,
        role=user_in.role or UserRole.GUEST,
    )
    
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    
    return db_user


def update_user(db: Session, user_id: int, user_in: UserUpdate) -> Optional[User]:
    """Обновление данных пользователя"""
    db_user = get_user(db, user_id)
    
    if not db_user:
        return None
    
    update_data = user_in.dict(exclude_unset=True)
    
    if "password" in update_data and update_data["password"]:
        update_data["hashed_password"] = get_password_hash(update_data.pop("password"))
    
    for field, value in update_data.items():
        setattr(db_user, field, value)
    
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    
    return db_user


def delete_user(db: Session, user_id: int) -> bool:
    """Удаление пользователя"""
    db_user = get_user(db, user_id)
    
    if not db_user:
        return False
    
    db.delete(db_user)
    db.commit()
    
    return True 