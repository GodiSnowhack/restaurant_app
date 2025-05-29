from datetime import datetime, timedelta
from typing import Optional

from fastapi import Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from fastapi.security.utils import get_authorization_scheme_param
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy.orm import Session

from app.core.config import settings
from app.database.session import get_db, SessionLocal
from app.models.user import User
from app.schemas.user import TokenPayload

# Опциональная схема OAuth2, которая не выбрасывает исключение если токен отсутствует
class OptionalOAuth2PasswordBearer(OAuth2PasswordBearer):
    async def __call__(self, request: Request) -> Optional[str]:
        authorization = request.headers.get("Authorization")
        scheme, param = get_authorization_scheme_param(authorization)
        if not authorization or scheme.lower() != "bearer":
            return None  # Вместо исключения возвращаем None
        return param

# Стандартная схема OAuth2 для обязательной авторизации
oauth2_scheme = OAuth2PasswordBearer(tokenUrl=f"{settings.API_V1_STR}/auth/login")

# Используем обычную схему для обязательной авторизации и опциональную для случаев,
# когда можно использовать ID из заголовка
optional_oauth2_scheme = OptionalOAuth2PasswordBearer(tokenUrl=f"{settings.API_V1_STR}/auth/login")

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Проверяет соответствие пароля его хешу"""
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    """Создает хеш пароля"""
    return pwd_context.hash(password)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Создает JWT токен"""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(
        to_encode, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM
    )
    return encoded_jwt


def get_current_user(
    token: str = Depends(oauth2_scheme), 
    db: Session = Depends(get_db)
) -> User:
    """Получение текущего пользователя из JWT токена"""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Не удалось подтвердить учетные данные",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    try:
        # Добавляем логирование для отладки
        print(f"AUTH DEBUG: Получен токен: {token[:10]}...")
        
        payload = jwt.decode(
            token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM]
        )
        user_id: str = payload.get("sub")
        role: str = payload.get("role")
        
        print(f"AUTH DEBUG: Декодирован payload: {payload}")
        
        if user_id is None:
            print("AUTH DEBUG: ID пользователя отсутствует в токене")
            raise credentials_exception
        
        token_data = TokenPayload(sub=int(user_id), exp=payload.get("exp"), role=role)
        
        if datetime.fromtimestamp(token_data.exp) < datetime.now():
            print(f"AUTH DEBUG: Токен истек: {datetime.fromtimestamp(token_data.exp)} < {datetime.now()}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Токен истек",
                headers={"WWW-Authenticate": "Bearer"},
            )
            
        print(f"AUTH DEBUG: Ищем пользователя с ID: {token_data.sub}")
        user = db.query(User).filter(User.id == token_data.sub).first()
        
        if user is None:
            print(f"AUTH DEBUG: Пользователь с ID {token_data.sub} не найден в базе данных")
            raise credentials_exception
        
        if not user.is_active:
            print(f"AUTH DEBUG: Пользователь {user.id} неактивен")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Неактивный пользователь",
            )
        
        # Проверяем соответствие роли в токене и в базе данных
        if role and role != user.role:
            print(f"AUTH DEBUG: Несоответствие ролей: токен={role}, база={user.role}")
            raise credentials_exception
        
        print(f"AUTH DEBUG: Успешно получен пользователь: ID={user.id}, email={user.email}, роль={user.role}")
        return user
        
    except JWTError as e:
        print(f"AUTH DEBUG: Ошибка при декодировании JWT: {str(e)}")
        raise credentials_exception


def get_current_active_user(
    current_user: User = Depends(get_current_user),
) -> User:
    """Получение текущего активного пользователя"""
    if not current_user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Неактивный пользователь",
        )
    return current_user


def authenticate_user(db: Session, email: str, password: str) -> Optional[User]:
    """Аутентификация пользователя по email и паролю"""
    user = db.query(User).filter(User.email == email).first()
    
    if not user:
        return None
    
    if not verify_password(password, user.hashed_password):
        return None
    
    return user


# Новая функция для получения пользователя по ID из заголовка
async def get_user_by_header(
    request: Request,
    db: Session = Depends(get_db)
) -> Optional[User]:
    """Получение пользователя из заголовка X-User-ID (для API без JWT)"""
    # Получаем ID пользователя из заголовка
    user_id = request.headers.get("X-User-ID")
    
    if not user_id:
        return None
    
    try:
        # Пытаемся преобразовать ID в число
        user_id_int = int(user_id)
        # Ищем пользователя в базе
        user = db.query(User).filter(User.id == user_id_int).first()
        return user
    except (ValueError, TypeError):
        return None


# Функция для получения пользователя с опциональной проверкой (не выбрасывает исключения)
async def get_optional_current_user(
    request: Request,
    db: Session = Depends(get_db),
    token: Optional[str] = Depends(optional_oauth2_scheme),
) -> Optional[User]:
    """
    Пытается получить пользователя через JWT токен, 
    если не получается, пытается через X-User-ID заголовок.
    В случае неудачи возвращает None, а не выбрасывает исключение.
    """
    # Пытаемся получить пользователя по токену
    if token:
        try:
            payload = jwt.decode(
                token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM]
            )
            user_id = payload.get("sub")
            
            if user_id:
                # Проверяем срок действия токена
                token_data = TokenPayload(sub=int(user_id), exp=payload.get("exp"))
                if datetime.fromtimestamp(token_data.exp) >= datetime.now():
                    # Токен действителен, ищем пользователя
                    user = db.query(User).filter(User.id == token_data.sub).first()
                    if user and user.is_active:
                        return user
        except (JWTError, ValueError, TypeError):
            # Любая ошибка при работе с токеном - переходим к проверке заголовка
            pass
    
    # Если токен не сработал, пробуем через заголовок
    header_user = await get_user_by_header(request, db)
    return header_user 