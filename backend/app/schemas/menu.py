from typing import Optional, List
from datetime import datetime
from pydantic import BaseModel, Field, ConfigDict


# Схемы для категорий
class CategoryBase(BaseModel):
    name: str
    description: Optional[str] = None
    image_url: Optional[str] = None


class CategoryCreate(CategoryBase):
    pass


class CategoryUpdate(CategoryBase):
    name: Optional[str] = None


class CategoryResponse(CategoryBase):
    id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


# Схемы для аллергенов
class AllergenBase(BaseModel):
    name: str
    description: Optional[str] = None


class AllergenCreate(AllergenBase):
    pass


class AllergenUpdate(AllergenBase):
    name: Optional[str] = None


class AllergenResponse(AllergenBase):
    id: int

    model_config = ConfigDict(from_attributes=True)


# Схемы для тегов
class TagBase(BaseModel):
    name: str


class TagCreate(TagBase):
    pass


class TagUpdate(TagBase):
    name: Optional[str] = None


class TagResponse(TagBase):
    id: int

    model_config = ConfigDict(from_attributes=True)


# Схемы для блюд
class DishBase(BaseModel):
    name: str
    description: Optional[str] = None
    price: float
    cost_price: Optional[float] = None
    image_url: Optional[str] = None
    calories: Optional[int] = None
    cooking_time: Optional[int] = None
    is_vegetarian: Optional[bool] = False
    is_vegan: Optional[bool] = False
    is_available: Optional[bool] = True
    category_id: int


class DishCreate(DishBase):
    allergen_ids: Optional[List[int]] = []
    tag_ids: Optional[List[int]] = []


class DishUpdate(DishBase):
    name: Optional[str] = None
    price: Optional[float] = None
    cost_price: Optional[float] = None
    category_id: Optional[int] = None
    allergen_ids: Optional[List[int]] = None
    tag_ids: Optional[List[int]] = None


class DishResponse(DishBase):
    id: int
    created_at: datetime
    updated_at: datetime
    category: CategoryResponse
    allergens: List[AllergenResponse] = []
    tags: List[TagResponse] = []

    model_config = ConfigDict(from_attributes=True)


# Схема для списка блюд с минимальной информацией
class DishShortResponse(BaseModel):
    id: int
    name: str
    price: float
    image_url: Optional[str] = None
    is_available: bool
    category_id: int

    model_config = ConfigDict(from_attributes=True)


# Схема для блюда с категорией (поддерживает обратную совместимость)
class DishResponseWithCategory(DishResponse):
    """Схема для представления блюда с полной информацией о категории"""
    pass 