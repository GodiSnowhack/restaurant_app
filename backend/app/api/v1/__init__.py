"""
API v1 router and endpoints
"""

from fastapi import APIRouter
from app.api.v1.endpoints import orders, categories, auth, users
from app.api.v1 import menu

api_router = APIRouter()

api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(users.router, prefix="/users", tags=["users"])
api_router.include_router(menu.router, prefix="/menu", tags=["menu"])
api_router.include_router(orders.router, prefix="/orders", tags=["orders"])
api_router.include_router(categories.router, prefix="/categories", tags=["categories"])

@api_router.get("/health", tags=["system"])
async def health_check():
    """
    Проверка работоспособности сервера.
    Используется клиентскими приложениями для проверки доступности API.
    """
    return {
        "status": "ok",
        "version": "1.0",
        "message": "API сервер работает нормально"
    }

@api_router.get("/ping", tags=["system"])
async def ping():
    """
    Простая проверка доступности API для клиентских приложений.
    """
    return {"status": "ok", "message": "pong"}

@api_router.post("/auth/_log", tags=["system"])
async def auth_log(data: dict):
    """
    Эндпоинт для логирования ошибок авторизации.
    Используется мобильными клиентами для отправки диагностической информации.
    """
    # Логируем полученные данные
    print(f"[AUTH LOG] Получены данные об ошибке авторизации:")
    print(f"  Ошибка: {data.get('error')}")
    print(f"  Эндпоинт: {data.get('endpoint')}")
    print(f"  Время: {data.get('timestamp')}")
    
    # Дополнительная диагностическая информация
    if "diagnosticInfo" in data:
        print(f"  Диагностика: {data['diagnosticInfo']}")
    
    if "networkInfo" in data:
        print(f"  Информация о сети: {data['networkInfo']}")
    
    # Возвращаем подтверждение
    return {"status": "logged", "received": True} 