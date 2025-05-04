from typing import List, Optional
from datetime import date, datetime
from sqlalchemy.orm import Session

from app.models.user import User, UserRole, AgeGroup
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


def calculate_age_group(birthday: Optional[date]) -> Optional[AgeGroup]:
    """Рассчитывает возрастную группу на основе даты рождения"""
    if not birthday:
        return None
    
    today = date.today()
    age = today.year - birthday.year - ((today.month, today.day) < (birthday.month, birthday.day))
    
    if age <= 12:
        return AgeGroup.CHILD
    elif age <= 17:
        return AgeGroup.TEENAGER
    elif age <= 25:
        return AgeGroup.YOUNG
    elif age <= 45:
        return AgeGroup.ADULT
    elif age <= 65:
        return AgeGroup.MIDDLE
    else:
        return AgeGroup.SENIOR


def create_user(db: Session, user_in: UserCreate) -> User:
    """Создание нового пользователя"""
    hashed_password = get_password_hash(user_in.password)
    
    # Рассчитываем возрастную группу, если указана дата рождения
    age_group = user_in.age_group
    print(f"Создание пользователя с возрастной группой: {age_group}")
    
    # Если возрастная группа не указана, но есть дата рождения, вычисляем
    if not age_group and user_in.birthday:
        age_group = calculate_age_group(user_in.birthday)
    
    db_user = User(
        email=user_in.email,
        phone=user_in.phone,
        hashed_password=hashed_password,
        full_name=user_in.full_name,
        role=user_in.role or UserRole.CLIENT,
        birthday=user_in.birthday,
        age_group=age_group,
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
    
    # Создаем словарь с обновляемыми данными
    update_data = user_in.model_dump(exclude_unset=True)
    
    # Если изменена дата рождения, пересчитываем возрастную группу
    if "birthday" in update_data:
        update_data["age_group"] = calculate_age_group(update_data["birthday"])
    
    # Если передан пароль, хэшируем его
    if "password" in update_data:
        update_data["hashed_password"] = get_password_hash(update_data.pop("password"))
    
    # Обновляем атрибуты объекта
    for key, value in update_data.items():
        setattr(db_user, key, value)
    
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