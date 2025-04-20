from typing import List, Optional, Dict, Any

from sqlalchemy.orm import Session

from app.models.menu import Category, Dish, Allergen, Tag
from app.schemas.menu import (
    CategoryCreate, CategoryUpdate,
    DishCreate, DishUpdate,
    AllergenCreate, AllergenUpdate,
    TagCreate, TagUpdate
)


# Функции для категорий
def get_category(db: Session, category_id: int) -> Optional[Category]:
    """Получение категории по ID"""
    return db.query(Category).filter(Category.id == category_id).first()


def get_categories(db: Session, skip: int = 0, limit: int = 100) -> List[Category]:
    """Получение списка категорий"""
    return db.query(Category).offset(skip).limit(limit).all()


def create_category(db: Session, category_in: CategoryCreate) -> Category:
    """Создание новой категории"""
    db_category = Category(**category_in.dict())
    db.add(db_category)
    db.commit()
    db.refresh(db_category)
    return db_category


def update_category(
    db: Session, category_id: int, category_in: CategoryUpdate
) -> Optional[Category]:
    """Обновление категории"""
    db_category = get_category(db, category_id)
    
    if not db_category:
        return None
    
    update_data = category_in.dict(exclude_unset=True)
    
    for field, value in update_data.items():
        setattr(db_category, field, value)
    
    db.add(db_category)
    db.commit()
    db.refresh(db_category)
    
    return db_category


def delete_category(db: Session, category_id: int) -> bool:
    """Удаление категории"""
    db_category = get_category(db, category_id)
    
    if not db_category:
        return False
    
    db.delete(db_category)
    db.commit()
    
    return True


# Функции для аллергенов
def get_allergen(db: Session, allergen_id: int) -> Optional[Allergen]:
    """Получение аллергена по ID"""
    return db.query(Allergen).filter(Allergen.id == allergen_id).first()


def get_allergens(db: Session, skip: int = 0, limit: int = 100) -> List[Allergen]:
    """Получение списка аллергенов"""
    return db.query(Allergen).offset(skip).limit(limit).all()


def create_allergen(db: Session, allergen_in: AllergenCreate) -> Allergen:
    """Создание нового аллергена"""
    db_allergen = Allergen(**allergen_in.dict())
    db.add(db_allergen)
    db.commit()
    db.refresh(db_allergen)
    return db_allergen


def update_allergen(
    db: Session, allergen_id: int, allergen_in: AllergenUpdate
) -> Optional[Allergen]:
    """Обновление аллергена"""
    db_allergen = get_allergen(db, allergen_id)
    
    if not db_allergen:
        return None
    
    update_data = allergen_in.dict(exclude_unset=True)
    
    for field, value in update_data.items():
        setattr(db_allergen, field, value)
    
    db.add(db_allergen)
    db.commit()
    db.refresh(db_allergen)
    
    return db_allergen


def delete_allergen(db: Session, allergen_id: int) -> bool:
    """Удаление аллергена"""
    db_allergen = get_allergen(db, allergen_id)
    
    if not db_allergen:
        return False
    
    db.delete(db_allergen)
    db.commit()
    
    return True


# Функции для тегов
def get_tag(db: Session, tag_id: int) -> Optional[Tag]:
    """Получение тега по ID"""
    return db.query(Tag).filter(Tag.id == tag_id).first()


def get_tags(db: Session, skip: int = 0, limit: int = 100) -> List[Tag]:
    """Получение списка тегов"""
    return db.query(Tag).offset(skip).limit(limit).all()


def create_tag(db: Session, tag_in: TagCreate) -> Tag:
    """Создание нового тега"""
    db_tag = Tag(**tag_in.dict())
    db.add(db_tag)
    db.commit()
    db.refresh(db_tag)
    return db_tag


def update_tag(
    db: Session, tag_id: int, tag_in: TagUpdate
) -> Optional[Tag]:
    """Обновление тега"""
    db_tag = get_tag(db, tag_id)
    
    if not db_tag:
        return None
    
    update_data = tag_in.dict(exclude_unset=True)
    
    for field, value in update_data.items():
        setattr(db_tag, field, value)
    
    db.add(db_tag)
    db.commit()
    db.refresh(db_tag)
    
    return db_tag


def delete_tag(db: Session, tag_id: int) -> bool:
    """Удаление тега"""
    db_tag = get_tag(db, tag_id)
    
    if not db_tag:
        return False
    
    db.delete(db_tag)
    db.commit()
    
    return True


# Функции для блюд
def get_dish(db: Session, dish_id: int) -> Optional[Dish]:
    """Получение блюда по ID"""
    return db.query(Dish).filter(Dish.id == dish_id).first()


def get_dishes(
    db: Session, 
    skip: int = 0, 
    limit: int = 100,
    category_id: Optional[int] = None,
    is_vegetarian: Optional[bool] = None,
    is_vegan: Optional[bool] = None,
    available_only: bool = False
) -> List[Dish]:
    """Получение списка блюд с фильтрацией"""
    query = db.query(Dish)
    
    if category_id:
        query = query.filter(Dish.category_id == category_id)
    
    if is_vegetarian is not None:
        query = query.filter(Dish.is_vegetarian == is_vegetarian)
    
    if is_vegan is not None:
        query = query.filter(Dish.is_vegan == is_vegan)
    
    if available_only:
        query = query.filter(Dish.is_available == True)
    
    return query.offset(skip).limit(limit).all()


def create_dish(db: Session, dish_in: DishCreate) -> Dish:
    """Создание нового блюда"""
    # Создаем блюдо без связанных сущностей
    dish_data = dish_in.dict(exclude={"allergen_ids", "tag_ids"})
    db_dish = Dish(**dish_data)
    
    # Добавляем аллергены
    if dish_in.allergen_ids:
        allergens = db.query(Allergen).filter(Allergen.id.in_(dish_in.allergen_ids)).all()
        db_dish.allergens = allergens
    
    # Добавляем теги
    if dish_in.tag_ids:
        tags = db.query(Tag).filter(Tag.id.in_(dish_in.tag_ids)).all()
        db_dish.tags = tags
    
    db.add(db_dish)
    db.commit()
    db.refresh(db_dish)
    
    return db_dish


def update_dish(
    db: Session, dish_id: int, dish_in: DishUpdate
) -> Optional[Dish]:
    """Обновление блюда"""
    db_dish = get_dish(db, dish_id)
    
    if not db_dish:
        return None
    
    # Обновляем основные поля
    update_data = dish_in.dict(exclude={"allergen_ids", "tag_ids"}, exclude_unset=True)
    
    for field, value in update_data.items():
        setattr(db_dish, field, value)
    
    # Обновляем аллергены при необходимости
    if dish_in.allergen_ids is not None:
        allergens = db.query(Allergen).filter(Allergen.id.in_(dish_in.allergen_ids)).all()
        db_dish.allergens = allergens
    
    # Обновляем теги при необходимости
    if dish_in.tag_ids is not None:
        tags = db.query(Tag).filter(Tag.id.in_(dish_in.tag_ids)).all()
        db_dish.tags = tags
    
    db.add(db_dish)
    db.commit()
    db.refresh(db_dish)
    
    return db_dish


def delete_dish(db: Session, dish_id: int) -> bool:
    """Удаление блюда"""
    db_dish = get_dish(db, dish_id)
    
    if not db_dish:
        return False
    
    db.delete(db_dish)
    db.commit()
    
    return True 