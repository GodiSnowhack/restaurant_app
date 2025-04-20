from app.services.auth import get_current_active_user
from fastapi import Depends, HTTPException, status
from app.models.user import User, UserRole

# Реэкспорт функции для обеспечения обратной совместимости
# при импорте из app.core.security 

def check_admin_permission(current_user: User = Depends(get_current_active_user)):
    """Проверка прав администратора"""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Недостаточно прав. Требуются права администратора."
        )
    return current_user

def check_waiter_permission(current_user: User = Depends(get_current_active_user)):
    """Проверка прав официанта"""
    if current_user.role != UserRole.WAITER and current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Недостаточно прав. Требуются права официанта или администратора."
        )
    return current_user 