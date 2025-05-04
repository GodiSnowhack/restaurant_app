from fastapi import APIRouter, Depends, HTTPException, status, Form
from sqlalchemy.orm import Session
from typing import Any
from jose import JWTError, jwt
from datetime import timedelta

from app.database.session import get_db
from app.models.user import User
from app.schemas.token import Token
from app.core.security import (
    SECRET_KEY, 
    ALGORITHM, 
    ACCESS_TOKEN_EXPIRE_MINUTES,
    create_access_token
)

router = APIRouter()

@router.post("", response_model=Token)
async def refresh_token(
    db: Session = Depends(get_db),
    grant_type: str = Form(...),
    refresh_token: str = Form(...)
) -> Any:
    """
    Обновление токена доступа при помощи refresh_token.
    Поддерживает только формат данных form-data.
    """
    # Проверяем тип запроса
    if grant_type != "refresh_token":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Неверный тип запроса. Допустимый тип: refresh_token"
        )
    
    # Проверяем наличие refresh_token
    if not refresh_token:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Отсутствует refresh_token"
        )
    
    try:
        # Проверяем валидность refresh_token и извлекаем из него данные пользователя
        # В реальной реализации здесь должна быть проверка refresh_token в БД
        try:
            payload = jwt.decode(refresh_token, SECRET_KEY, algorithms=[ALGORITHM])
            user_id: str = payload.get("sub")
            if user_id is None:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Недействительный refresh_token",
                    headers={"WWW-Authenticate": "Bearer"}
                )
        except JWTError:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Недействительный refresh_token",
                headers={"WWW-Authenticate": "Bearer"}
            )
        
        # Получаем пользователя из БД
        user = db.query(User).filter(User.id == int(user_id)).first()
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Пользователь не найден",
                headers={"WWW-Authenticate": "Bearer"}
            )
        
        if not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Неактивный пользователь"
            )
        
        # Создаем новый access_token
        access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
        access_token = create_access_token(
            data={"sub": str(user.id), "role": user.role},
            expires_delta=access_token_expires
        )
        
        # Создаем новый refresh_token (в реальной реализации сохраняем в БД)
        new_refresh_token = create_access_token(
            data={"sub": str(user.id)},
            expires_delta=timedelta(days=30)  # Refresh token действует 30 дней
        )
        
        return {
            "access_token": access_token,
            "refresh_token": new_refresh_token,
            "token_type": "bearer",
            "user": {
                "id": user.id,
                "email": user.email,
                "role": user.role
            }
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Ошибка при обновлении токена: {str(e)}"
        ) 