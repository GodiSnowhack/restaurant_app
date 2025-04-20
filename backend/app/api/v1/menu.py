from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.models.user import User, UserRole
from app.schemas.menu import (
    CategoryResponse, CategoryCreate, CategoryUpdate,
    AllergenResponse, AllergenCreate, AllergenUpdate,
    TagResponse, TagCreate, TagUpdate,
    DishResponse, DishCreate, DishUpdate, DishShortResponse
)
from app.services.auth import get_current_user
from app.services.menu import (
    get_category, get_categories, create_category, update_category, delete_category,
    get_allergen, get_allergens, create_allergen, update_allergen, delete_allergen,
    get_tag, get_tags, create_tag, update_tag, delete_tag,
    get_dish, get_dishes, create_dish, update_dish, delete_dish
)

router = APIRouter()


# Эндпоинты для категорий
@router.get("/categories", response_model=List[CategoryResponse])
def read_categories(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    """Получение списка категорий"""
    return get_categories(db, skip=skip, limit=limit)


@router.post("/categories", response_model=CategoryResponse, status_code=status.HTTP_201_CREATED)
def create_category_endpoint(
    category_in: CategoryCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Создание новой категории"""
    # Проверяем права доступа
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Недостаточно прав для создания категорий",
        )
    
    return create_category(db, category_in)


@router.get("/categories/{category_id}", response_model=CategoryResponse)
def read_category_by_id(
    category_id: int,
    db: Session = Depends(get_db)
):
    """Получение категории по ID"""
    category = get_category(db, category_id)
    
    if not category:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Категория не найдена",
        )
    
    return category


@router.put("/categories/{category_id}", response_model=CategoryResponse)
def update_category_endpoint(
    category_id: int,
    category_in: CategoryUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Обновление категории"""
    # Проверяем права доступа
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Недостаточно прав для обновления категорий",
        )
    
    category = update_category(db, category_id, category_in)
    
    if not category:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Категория не найдена",
        )
    
    return category


@router.delete("/categories/{category_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_category_endpoint(
    category_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Удаление категории"""
    # Проверяем права доступа
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Недостаточно прав для удаления категорий",
        )
    
    result = delete_category(db, category_id)
    
    if not result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Категория не найдена",
        )


# Эндпоинты для аллергенов
@router.get("/allergens", response_model=List[AllergenResponse])
def read_allergens(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    """Получение списка аллергенов"""
    return get_allergens(db, skip=skip, limit=limit)


@router.post("/allergens", response_model=AllergenResponse, status_code=status.HTTP_201_CREATED)
def create_allergen_endpoint(
    allergen_in: AllergenCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Создание нового аллергена"""
    # Проверяем права доступа
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Недостаточно прав для создания аллергенов",
        )
    
    return create_allergen(db, allergen_in)


@router.get("/allergens/{allergen_id}", response_model=AllergenResponse)
def read_allergen_by_id(
    allergen_id: int,
    db: Session = Depends(get_db)
):
    """Получение аллергена по ID"""
    allergen = get_allergen(db, allergen_id)
    
    if not allergen:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Аллерген не найден",
        )
    
    return allergen


@router.put("/allergens/{allergen_id}", response_model=AllergenResponse)
def update_allergen_endpoint(
    allergen_id: int,
    allergen_in: AllergenUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Обновление аллергена"""
    # Проверяем права доступа
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Недостаточно прав для обновления аллергенов",
        )
    
    allergen = update_allergen(db, allergen_id, allergen_in)
    
    if not allergen:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Аллерген не найден",
        )
    
    return allergen


@router.delete("/allergens/{allergen_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_allergen_endpoint(
    allergen_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Удаление аллергена"""
    # Проверяем права доступа
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Недостаточно прав для удаления аллергенов",
        )
    
    result = delete_allergen(db, allergen_id)
    
    if not result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Аллерген не найден",
        )


# Эндпоинты для тегов
@router.get("/tags", response_model=List[TagResponse])
def read_tags(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    """Получение списка тегов"""
    return get_tags(db, skip=skip, limit=limit)


@router.post("/tags", response_model=TagResponse, status_code=status.HTTP_201_CREATED)
def create_tag_endpoint(
    tag_in: TagCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Создание нового тега"""
    # Проверяем права доступа
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Недостаточно прав для создания тегов",
        )
    
    return create_tag(db, tag_in)


@router.get("/tags/{tag_id}", response_model=TagResponse)
def read_tag_by_id(
    tag_id: int,
    db: Session = Depends(get_db)
):
    """Получение тега по ID"""
    tag = get_tag(db, tag_id)
    
    if not tag:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Тег не найден",
        )
    
    return tag


@router.put("/tags/{tag_id}", response_model=TagResponse)
def update_tag_endpoint(
    tag_id: int,
    tag_in: TagUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Обновление тега"""
    # Проверяем права доступа
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Недостаточно прав для обновления тегов",
        )
    
    tag = update_tag(db, tag_id, tag_in)
    
    if not tag:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Тег не найден",
        )
    
    return tag


@router.delete("/tags/{tag_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_tag_endpoint(
    tag_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Удаление тега"""
    # Проверяем права доступа
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Недостаточно прав для удаления тегов",
        )
    
    result = delete_tag(db, tag_id)
    
    if not result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Тег не найден",
        )


# Эндпоинты для блюд
@router.get("/dishes", response_model=List[DishShortResponse])
def read_dishes(
    skip: int = 0,
    limit: int = 100,
    category_id: Optional[int] = None,
    is_vegetarian: Optional[bool] = None,
    is_vegan: Optional[bool] = None,
    available_only: bool = False,
    db: Session = Depends(get_db)
):
    """Получение списка блюд с фильтрацией"""
    return get_dishes(
        db,
        skip=skip,
        limit=limit,
        category_id=category_id,
        is_vegetarian=is_vegetarian,
        is_vegan=is_vegan,
        available_only=available_only
    )


@router.post("/dishes", response_model=DishResponse, status_code=status.HTTP_201_CREATED)
def create_dish_endpoint(
    dish_in: DishCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Создание нового блюда"""
    # Проверяем права доступа
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Недостаточно прав для создания блюд",
        )
    
    return create_dish(db, dish_in)


@router.get("/dishes/{dish_id}", response_model=DishResponse)
def read_dish_by_id(
    dish_id: int,
    db: Session = Depends(get_db)
):
    """Получение блюда по ID"""
    dish = get_dish(db, dish_id)
    
    if not dish:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Блюдо не найдено",
        )
    
    return dish


@router.put("/dishes/{dish_id}", response_model=DishResponse)
def update_dish_endpoint(
    dish_id: int,
    dish_in: DishUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Обновление блюда"""
    # Проверяем права доступа
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Недостаточно прав для обновления блюд",
        )
    
    dish = update_dish(db, dish_id, dish_in)
    
    if not dish:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Блюдо не найдено",
        )
    
    return dish


@router.delete("/dishes/{dish_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_dish_endpoint(
    dish_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Удаление блюда"""
    # Проверяем права доступа
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Недостаточно прав для удаления блюд",
        )
    
    result = delete_dish(db, dish_id)
    
    if not result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Блюдо не найдено",
        ) 