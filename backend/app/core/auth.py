from typing import Optional
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from sqlalchemy.orm import Session

from app.core.config import settings
from app.database.session import get_db
from app.models.user import User

oauth2_scheme = OAuth2PasswordBearer(tokenUrl=f"{settings.API_V1_STR}/auth/login")

def get_current_user(
    db: Session = Depends(get_db),
    token: str = Depends(oauth2_scheme)
) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise credentials_exception
        
        user = db.query(User).filter(User.id == int(user_id)).first()
        if user is None:
            raise credentials_exception
            
        # Проверяем соответствие роли в токене и в базе данных
        token_role = payload.get("role")
        if token_role and token_role != user.role:
            print(f"Несоответствие ролей: токен={token_role}, база={user.role}")
            user.needs_token_refresh = True
            
        return user
    except JWTError:
        raise credentials_exception 