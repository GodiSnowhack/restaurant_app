import uvicorn
from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pathlib import Path
import logging
import os
from fastapi import Depends
from fastapi.responses import JSONResponse
from datetime import datetime
from sqlalchemy.orm import Session

from app.api.v1 import api_router
from app.core.config import settings
from app.database.session import SessionLocal, create_tables, get_db
from app.core.init_db import init_db
from app.api.v1.endpoints import orders
from app.models.order import Order

# Настройка логгера
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Создаем все таблицы в базе данных
try:
    logger.info("Создание таблиц базы данных...")
    create_tables()
    logger.info("Таблицы успешно созданы")
except Exception as e:
    logger.error(f"Ошибка при создании таблиц: {e}")

# Инициализируем базу данных при запуске
db = SessionLocal()
try:
    logger.info("Инициализация базы данных...")
    init_db(db)
except Exception as e:
    logger.error(f"Ошибка при инициализации базы данных: {e}")
finally:
    db.close()

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="СППР для управления рестораном",
    version="0.1.0",
    openapi_url=f"{settings.API_V1_STR}/openapi.json"
)

# Настройки CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[str(origin) for origin in settings.BACKEND_CORS_ORIGINS if origin != "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=[
        "Content-Type",
        "Authorization",
        "Accept",
        "Origin",
        "X-User-ID",
        "X-User-Role",
        "Access-Control-Allow-Origin",
        "Access-Control-Allow-Credentials"
    ],
    expose_headers=["*"],
    max_age=3600,
)

# Middleware для логирования запросов
@app.middleware("http")
async def log_requests(request: Request, call_next):
    logger.info(f"Request: {request.method} {request.url}")
    logger.info(f"Client host: {request.client.host}")
    logger.info(f"Headers: {request.headers}")
    response = await call_next(request)
    logger.info(f"Response status: {response.status_code}")
    return response

# Монтируем статические файлы
static_path = Path(__file__).parent.parent / "static"
static_path.mkdir(exist_ok=True)
app.mount("/static", StaticFiles(directory=str(static_path)), name="static")

# Регистрируем маршруты API
app.include_router(api_router, prefix=settings.API_V1_STR)

# Добавляем альтернативный маршрут для запросов без /v1/
app.include_router(orders.router, prefix="/api/orders", tags=["orders"])

# Корневой маршрут для проверки работоспособности API
@app.get("/")
def read_root():
    return {
        "message": "Добро пожаловать в API ресторана!",
        "docs_url": "/docs",
        "version": "1.0.0"
    }

# Добавляем прямой эндпоинт для обновления статуса заказа
@app.put("/api/v1/orders/{order_id}/direct-status-update", include_in_schema=True)
async def direct_status_update(
    order_id: int,
    status_data: dict,
    db: Session = Depends(get_db)
):
    """
    Простой эндпоинт для прямого обновления статуса заказа без сложной валидации.
    
    - **order_id**: ID заказа
    - **status_data**: Словарь с ключом 'status' для обновления статуса заказа
      или 'payment_status' для обновления статуса оплаты
    """
    try:
        # Ищем заказ в БД
        order = db.query(Order).filter(Order.id == order_id).first()
        if not order:
            return JSONResponse(
                status_code=404,
                content={"success": False, "message": f"Заказ с ID {order_id} не найден"}
            )
        
        is_modified = False
        
        # Обновляем статус заказа
        if "status" in status_data:
            new_status = status_data["status"].upper()
            order.status = new_status
            is_modified = True
            
            # Если статус COMPLETED, устанавливаем время завершения
            if new_status == "COMPLETED" and not order.completed_at:
                order.completed_at = datetime.utcnow()
                
            logger.info(f"Прямое обновление статуса заказа {order_id} на {new_status}")
        
        # Обновляем статус оплаты
        if "payment_status" in status_data:
            new_payment_status = status_data["payment_status"].upper()
            order.payment_status = new_payment_status
            is_modified = True
            logger.info(f"Прямое обновление статуса оплаты заказа {order_id} на {new_payment_status}")
        
        # Если что-то изменилось, сохраняем
        if is_modified:
            order.updated_at = datetime.utcnow()
            db.commit()
            db.refresh(order)
            
            return JSONResponse(
                status_code=200,
                content={
                    "success": True,
                    "message": "Статус заказа успешно обновлен",
                    "order": {
                        "id": order.id,
                        "status": order.status,
                        "payment_status": order.payment_status,
                        "updated_at": order.updated_at.isoformat() if order.updated_at else None
                    }
                }
            )
        else:
            return JSONResponse(
                status_code=400,
                content={"success": False, "message": "Не указаны поля 'status' или 'payment_status'"}
            )
    except Exception as e:
        logger.exception(f"Ошибка при прямом обновлении статуса заказа {order_id}: {str(e)}")
        db.rollback()
        return JSONResponse(
            status_code=500,
            content={"success": False, "message": f"Ошибка при обновлении: {str(e)}"}
        )

# Добавляем прямой эндпоинт для обновления статуса заказа методом POST
@app.post("/api/v1/orders/{order_id}/direct-status-update", include_in_schema=True)
async def direct_status_update_post(order_id: int, status_data: dict, db: Session = Depends(get_db)):
    """POST версия прямого обновления статуса заказа"""
    return await direct_status_update(order_id, status_data, db)

# Добавляем прямой эндпоинт для обновления статуса заказа (альтернативный путь)
@app.put("/api/v1/direct/orders/{order_id}/status", include_in_schema=True)
async def direct_status_update_alt(order_id: int, status_data: dict, db: Session = Depends(get_db)):
    """Альтернативный путь для прямого обновления статуса заказа"""
    return await direct_status_update(order_id, status_data, db)

# Добавляем прямой эндпоинт для обновления статуса заказа методом POST (альтернативный путь)
@app.post("/api/v1/direct/orders/{order_id}/status", include_in_schema=True)
async def direct_status_update_alt_post(order_id: int, status_data: dict, db: Session = Depends(get_db)):
    """POST версия альтернативного пути для прямого обновления статуса заказа"""
    return await direct_status_update(order_id, status_data, db)

if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host=settings.SERVER_HOST,
        port=settings.SERVER_PORT,
        reload=settings.DEBUG,
        workers=settings.WORKERS_COUNT,
        proxy_headers=True,
        forwarded_allow_ips='*'
    ) 