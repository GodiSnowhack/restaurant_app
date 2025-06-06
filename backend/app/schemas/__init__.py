"""
Pydantic schemas for the application
"""

from app.schemas.orders import OrderCreate, OrderOut
from app.schemas.dishes import DishCreate, DishOut
from app.schemas.users import UserCreate, UserOut
from app.schemas.categories import CategoryCreate, CategoryOut

__all__ = [
    "OrderCreate", "OrderOut",
    "DishCreate", "DishOut",
    "UserCreate", "UserOut",
    "CategoryCreate", "CategoryOut"
]

"""
Пакет схем для pydantic-моделей API
"""
from app.schemas.user import (
    UserBase, UserCreate, UserUpdate, UserResponse,
    UserLogin, UserResponseWithToken, 
    UserRoleUpdate, UserPasswordUpdate
)
from app.schemas.menu import (
    CategoryBase, CategoryCreate, CategoryUpdate, CategoryResponse,
    AllergenBase, AllergenCreate, AllergenUpdate, AllergenResponse,
    TagBase, TagCreate, TagUpdate, TagResponse,
    DishBase, DishCreate, DishUpdate, DishResponse, DishResponseWithCategory
)
from app.schemas.order import (
    OrderBase, OrderCreate, OrderUpdate, Order,
    FeedbackBase, FeedbackCreate, Feedback
)
from app.schemas.reservation import (
    ReservationBase, ReservationCreate, ReservationUpdate, ReservationResponse
)
from app.schemas.settings import (
    SettingsBase, SettingsCreate, SettingsUpdate, SettingsResponse
)
from app.schemas.order_code import OrderCodeResponse as OrderCode, OrderCodeCreate 