from fastapi import APIRouter

from app.api.v1 import auth, users, menu, orders, reservations, order_codes, settings, analytics, admin, waiter

api_router = APIRouter()

api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(users.router, prefix="/users", tags=["users"])
api_router.include_router(menu.router, prefix="/menu", tags=["menu"])
api_router.include_router(orders.router, prefix="/orders", tags=["orders"])
api_router.include_router(reservations.router, prefix="/reservations", tags=["reservations"])
api_router.include_router(order_codes.router, prefix="/order-codes", tags=["order_codes"])
api_router.include_router(settings.router, prefix="/settings", tags=["settings"])
api_router.include_router(analytics.router, prefix="/analytics", tags=["analytics"])
api_router.include_router(admin.router, prefix="/admin", tags=["admin"])
api_router.include_router(waiter.router, prefix="/waiter", tags=["waiter"]) 

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