from datetime import timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.models.user import User
from app.schemas.user import Token, UserCreate, UserResponse
from app.services.auth import authenticate_user, create_access_token
from app.services.user import get_user_by_email, create_user
from app.core.config import settings

router = APIRouter()


@router.get("/")
async def auth_info():
    """Информация об API авторизации"""
    return {
        "message": "API авторизации работает",
        "endpoints": [
            {"path": "/login", "method": "POST", "description": "Авторизация пользователя"},
            {"path": "/register", "method": "POST", "description": "Регистрация пользователя"},
            {"path": "/_log", "method": "POST", "description": "Логирование ошибок авторизации"}
        ],
        "status": "ok"
    }


@router.post("/login", response_model=Token)
def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db)
):
    """Аутентификация пользователя и получение токена"""
    user = authenticate_user(db, form_data.username, form_data.password)
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Неверный email или пароль",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Создаем токен доступа
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        subject=user.id, expires_delta=access_token_expires
    )
    
    return {"access_token": access_token, "token_type": "bearer"}


@router.post("/register", response_model=UserResponse)
def register(
    user_in: UserCreate,
    db: Session = Depends(get_db)
):
    """Регистрация нового пользователя"""
    # Проверяем, что пользователь с таким email не существует
    existing_user = get_user_by_email(db, user_in.email)
    
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Пользователь с таким email уже существует",
        )
    
    # Создаем нового пользователя
    user = create_user(db, user_in)
    
    return user 