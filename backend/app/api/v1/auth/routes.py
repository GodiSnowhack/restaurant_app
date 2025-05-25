from datetime import datetime, timedelta
from typing import Any, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from jose import JWTError, jwt

from app.core.config import settings
from app.database.session import get_db
from app.models.user import User
from app.schemas.token import Token
from app.core.security import create_access_token, verify_password

router = APIRouter()

def authenticate_user(db: Session, email: str, password: str) -> Optional[User]:
    """Аутентификация пользователя"""
    try:
        user = db.query(User).filter(User.email == email).first()
        if not user:
            return None
        if not verify_password(password, user.hashed_password):
            return None
        return user
    except Exception as e:
        print(f"Ошибка при аутентификации: {str(e)}")
        return None

@router.post("/login")
async def login(
    request: Request,
    db: Session = Depends(get_db),
    form_data: OAuth2PasswordRequestForm = Depends(),
) -> Any:
    """
    Аутентификация пользователя и выдача токена.
    """
    try:
        # Получаем данные пользователя
        user = authenticate_user(db, form_data.username, form_data.password)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Неверный email или пароль",
                headers={"WWW-Authenticate": "Bearer"},
            )

        if not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Пользователь неактивен"
            )

        # Создаем токен доступа
        access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
        access_token = create_access_token(
            data={
                "sub": str(user.id),
                "email": user.email,
                "role": user.role,
                "iat": datetime.utcnow().timestamp(),
            },
            expires_delta=access_token_expires
        )

        # Формируем ответ
        response_data = {
            "access_token": access_token,
            "token_type": "bearer",
            "user": {
                "id": user.id,
                "email": user.email,
                "full_name": user.full_name,
                "role": user.role,
                "is_active": user.is_active
            }
        }

        print("Auth API - Успешная авторизация:", {
            "user_id": user.id,
            "email": user.email,
            "role": user.role,
            "token_length": len(access_token) if access_token else 0
        })

        return response_data

    except Exception as e:
        print(f"Auth API - Ошибка при авторизации: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Ошибка сервера: {str(e)}"
        )

@router.get("/verify")
async def verify_token(
    request: Request,
    db: Session = Depends(get_db)
) -> Any:
    """
    Проверка валидности токена
    """
    try:
        auth_header = request.headers.get("Authorization")
        if not auth_header or not auth_header.startswith("Bearer "):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Отсутствует токен авторизации",
                headers={"WWW-Authenticate": "Bearer"},
            )

        token = auth_header.split(" ")[1]
        try:
            payload = jwt.decode(
                token, 
                settings.JWT_SECRET, 
                algorithms=[settings.JWT_ALGORITHM]
            )
            user_id = payload.get("sub")
            if not user_id:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Недействительный токен",
                    headers={"WWW-Authenticate": "Bearer"},
                )

            user = db.query(User).filter(User.id == int(user_id)).first()
            if not user:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Пользователь не найден",
                    headers={"WWW-Authenticate": "Bearer"},
                )

            if not user.is_active:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Пользователь неактивен",
                    headers={"WWW-Authenticate": "Bearer"},
                )

            return {
                "valid": True,
                "user": {
                    "id": user.id,
                    "email": user.email,
                    "role": user.role
                }
            }

        except JWTError:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Недействительный токен",
                headers={"WWW-Authenticate": "Bearer"},
            )

    except Exception as e:
        print(f"Auth API - Ошибка при проверке токена: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Ошибка сервера: {str(e)}"
        ) 