from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.models.user import User, UserRole
from app.services.auth import get_current_user
from app.schemas.order_code import OrderCodeCreate, OrderCodeResponse, OrderCodeUpdate, OrderCodeVerify
from app.services.order_code import (
    create_order_code,
    get_order_code,
    get_order_codes,
    get_order_code_by_code,
    update_order_code,
    delete_order_code
)

router = APIRouter()


@router.post("/", response_model=OrderCodeResponse)
def create_new_order_code(
    table_number: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Создание нового кода заказа"""
    # Проверка прав доступа (только официант и администратор)
    if current_user.role not in [UserRole.WAITER, UserRole.ADMIN]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Недостаточно прав для создания кода заказа"
        )
    
    # Создаем новый код
    order_code_data = OrderCodeCreate(
        code="",  # Код будет сгенерирован автоматически
        table_number=table_number,
        waiter_id=current_user.id
    )
    
    new_code = create_order_code(db, order_code_data)
    return new_code


@router.get("/", response_model=List[OrderCodeResponse])
def read_order_codes(
    skip: int = 0,
    limit: int = 100,
    is_used: Optional[bool] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Получение списка кодов заказов"""
    # Проверка прав доступа (только официант и администратор)
    if current_user.role not in [UserRole.WAITER, UserRole.ADMIN]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Недостаточно прав для просмотра кодов заказа"
        )
    
    # Администратор видит все коды, официант - только свои
    waiter_id = None if current_user.role == UserRole.ADMIN else current_user.id
    
    codes = get_order_codes(db, skip=skip, limit=limit, waiter_id=waiter_id, is_used=is_used)
    return codes


@router.get("/{code_id}", response_model=OrderCodeResponse)
def read_order_code(
    code_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Получение информации о коде заказа по ID"""
    # Проверка прав доступа (только официант и администратор)
    if current_user.role not in [UserRole.WAITER, UserRole.ADMIN]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Недостаточно прав для просмотра кода заказа"
        )
    
    code = get_order_code(db, code_id)
    
    if not code:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Код заказа не найден"
        )
    
    # Официант может видеть только свои коды
    if current_user.role == UserRole.WAITER and code.waiter_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Недостаточно прав для просмотра этого кода заказа"
        )
    
    return code


@router.post("/verify", response_model=OrderCodeResponse)
def verify_order_code(
    code_data: OrderCodeVerify,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Проверка валидности кода заказа"""
    # Любой авторизованный пользователь может проверить код
    
    code = get_order_code_by_code(db, code_data.code)
    
    if not code:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Код заказа не найден"
        )
    
    if code.is_used:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Код заказа уже использован"
        )
    
    return code


@router.delete("/{code_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_code(
    code_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Удаление кода заказа"""
    # Проверка прав доступа (только официант и администратор)
    if current_user.role not in [UserRole.WAITER, UserRole.ADMIN]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Недостаточно прав для удаления кода заказа"
        )
    
    code = get_order_code(db, code_id)
    
    if not code:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Код заказа не найден"
        )
    
    # Официант может удалять только свои коды
    if current_user.role == UserRole.WAITER and code.waiter_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Недостаточно прав для удаления этого кода заказа"
        )
    
    # Нельзя удалить уже использованный код
    if code.is_used:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Нельзя удалить использованный код заказа"
        )
    
    result = delete_order_code(db, code_id)
    
    if not result:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Ошибка при удалении кода заказа"
        ) 