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
from sqlalchemy.sql import text

from app.api.v1 import api_router
from app.core.config import settings
from app.database.session import SessionLocal, create_tables, get_db
from app.core.init_db import init_db
from app.api.v1.endpoints import orders
from app.models.order import Order
from app.models.user import User
from app.services.auth import get_current_user

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
    
    # Исправляем значения payment_method
    try:
        from app.services.order import fix_payment_method_case
        updated_count = fix_payment_method_case(db)
        logger.info(f"Исправлено {updated_count} записей payment_method в базе данных")
    except Exception as e:
        logger.error(f"Ошибка при исправлении payment_method: {e}")
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

# Добавляем новый простой эндпоинт для обновления статуса заказа
@app.post("/api/direct/order-status/{order_id}", include_in_schema=True)
async def simple_order_status_update(
    order_id: int,
    status_data: dict,
    db: Session = Depends(get_db)
):
    """
    Максимально простой эндпоинт для обновления статуса заказа без сложной валидации.
    
    - **order_id**: ID заказа
    - **status_data**: Словарь с ключом 'status' или 'payment_status'
    """
    try:
        logger.info(f"Запрос на прямое обновление заказа {order_id}: {status_data}")
        
        # Простой SQL-запрос для обновления заказа
        sql_query = "UPDATE orders SET "
        params = {"order_id": order_id}
        update_parts = []
        
        # Обновляем статус заказа
        if "status" in status_data and status_data["status"]:
            new_status = status_data["status"].upper()
            update_parts.append("status = :status")
            params["status"] = new_status
            logger.info(f"Обновление status на {new_status}")
            
            # Если статус COMPLETED, устанавливаем время завершения
            if new_status == "COMPLETED":
                update_parts.append("completed_at = CURRENT_TIMESTAMP")
                
        # Обновляем статус оплаты
        if "payment_status" in status_data and status_data["payment_status"]:
            new_payment_status = status_data["payment_status"].upper()
            update_parts.append("payment_status = :payment_status")
            params["payment_status"] = new_payment_status
            logger.info(f"Обновление payment_status на {new_payment_status}")
        
        # Обновляем время изменения
        update_parts.append("updated_at = CURRENT_TIMESTAMP")
        
        # Собираем и выполняем запрос
        if not update_parts:
            return JSONResponse(
                status_code=400,
                content={"success": False, "message": "Не указаны данные для обновления"}
            )
            
        sql_query += ", ".join(update_parts) + " WHERE id = :order_id"
        logger.info(f"SQL запрос: {sql_query} с параметрами {params}")
        
        try:
            result = db.execute(text(sql_query), params)
            db.commit()
            
            if result.rowcount == 0:
                return JSONResponse(
                    status_code=404,
                    content={"success": False, "message": f"Заказ с ID {order_id} не найден"}
                )
                
            # Получаем обновленные данные заказа
            updated_order = db.query(Order).filter(Order.id == order_id).first()
            
            return JSONResponse(
                status_code=200,
                content={
                    "success": True,
                    "message": "Статус заказа успешно обновлен",
                    "order": {
                        "id": updated_order.id,
                        "status": updated_order.status,
                        "payment_status": updated_order.payment_status,
                        "updated_at": updated_order.updated_at.isoformat() if updated_order.updated_at else None
                    }
                }
            )
        except Exception as e:
            logger.error(f"Ошибка SQL: {str(e)}")
            db.rollback()
            
            # Аварийная попытка с простым запросом
            try:
                emergency_update = "UPDATE orders SET updated_at = CURRENT_TIMESTAMP"
                if "status" in params:
                    emergency_update += ", status = :status"
                if "payment_status" in params:
                    emergency_update += ", payment_status = :payment_status"
                emergency_update += " WHERE id = :order_id"
                
                db.execute(text(emergency_update), params)
                db.commit()
                return JSONResponse(
                    status_code=200,
                    content={"success": True, "message": "Статус обновлен (аварийный режим)"}
                )
            except Exception as e2:
                logger.error(f"Критическая ошибка: {str(e2)}")
                return JSONResponse(
                    status_code=500,
                    content={"success": False, "message": f"Ошибка при обновлении: {str(e)}"}
                )
            
    except Exception as e:
        logger.exception(f"Необработанная ошибка: {str(e)}")
        return JSONResponse(
            status_code=500,
            content={"success": False, "message": f"Внутренняя ошибка сервера: {str(e)}"}
        )

# Также регистрируем PUT метод для этого же пути
@app.put("/api/direct/order-status/{order_id}", include_in_schema=True)
async def simple_order_status_update_put(order_id: int, status_data: dict, db: Session = Depends(get_db)):
    """PUT версия прямого обновления статуса заказа"""
    return await simple_order_status_update(order_id, status_data, db)

# Альтернативный путь для совместимости
@app.post("/api/v1/direct/order-status/{order_id}", include_in_schema=True)
async def simple_order_status_update_v1(order_id: int, status_data: dict, db: Session = Depends(get_db)):
    """API v1 версия прямого обновления статуса заказа"""
    return await simple_order_status_update(order_id, status_data, db)

@app.put("/api/v1/direct/order-status/{order_id}", include_in_schema=True)
async def simple_order_status_update_v1_put(order_id: int, status_data: dict, db: Session = Depends(get_db)):
    """API v1 PUT версия прямого обновления статуса заказа"""
    return await simple_order_status_update(order_id, status_data, db)

# Сверхпростой эндпоинт для обновления статуса
@app.post("/api/simple-update/{order_id}", include_in_schema=True)
async def ultra_simple_update(
    order_id: int,
    request: Request,
    db: Session = Depends(get_db)
):
    """
    Ультра-простой эндпоинт для обновления статуса заказа без валидации.
    Принимает только id заказа и JSON со статусом:
    
    {"status": "COMPLETED"} или {"payment_status": "PAID"}
    """
    try:
        # Получаем данные запроса
        try:
            data = await request.json()
            logger.info(f"Простое обновление заказа {order_id}: {data}")
        except Exception as e:
            return JSONResponse(
                status_code=400,
                content={"success": False, "message": "Некорректный JSON"}
            )
        
        # Прямой SQL-запрос для максимальной надежности
        sql_parts = []
        params = {"order_id": order_id}
        
        # Обрабатываем статус заказа
        if "status" in data and data["status"]:
            status = data["status"].upper()
            sql_parts.append("status = :status")
            params["status"] = status
            
            # Обновляем время завершения для COMPLETED
            if status == "COMPLETED":
                sql_parts.append("completed_at = CURRENT_TIMESTAMP")
        
        # Обрабатываем статус оплаты
        if "payment_status" in data and data["payment_status"]:
            payment_status = data["payment_status"].upper()
            sql_parts.append("payment_status = :payment_status")
            params["payment_status"] = payment_status
        
        # Всегда обновляем updated_at
        sql_parts.append("updated_at = CURRENT_TIMESTAMP")
        
        # Если нет данных для обновления
        if len(sql_parts) < 2:  # только updated_at
            return JSONResponse(
                status_code=400,
                content={"success": False, "message": "Не указаны данные для обновления"}
            )
        
        # Строим и выполняем запрос
        sql = f"UPDATE orders SET {', '.join(sql_parts)} WHERE id = :order_id"
        logger.info(f"SQL запрос: {sql}, параметры: {params}")
        
        try:
            result = db.execute(text(sql), params)
            db.commit()
            
            if result.rowcount == 0:
                return JSONResponse(
                    status_code=404,
                    content={"success": False, "message": f"Заказ с ID {order_id} не найден"}
                )
            
            # Получаем обновленные данные заказа
            updated_order = db.query(Order).filter(Order.id == order_id).first()
            
            return JSONResponse(
                status_code=200,
                content={
                    "success": True,
                    "message": "Статус заказа успешно обновлен",
                    "order": {
                        "id": updated_order.id,
                        "status": updated_order.status,
                        "payment_status": updated_order.payment_status,
                        "updated_at": updated_order.updated_at.isoformat() if updated_order.updated_at else None
                    }
                }
            )
        except Exception as e:
            logger.error(f"Ошибка SQL: {str(e)}")
            db.rollback()
            
            # Аварийная попытка с простым запросом
            try:
                emergency_update = "UPDATE orders SET updated_at = CURRENT_TIMESTAMP"
                if "status" in params:
                    emergency_update += ", status = :status"
                if "payment_status" in params:
                    emergency_update += ", payment_status = :payment_status"
                emergency_update += " WHERE id = :order_id"
                
                db.execute(text(emergency_update), params)
                db.commit()
                return JSONResponse(
                    status_code=200,
                    content={"success": True, "message": "Статус обновлен (аварийный режим)"}
                )
            except Exception as e2:
                logger.error(f"Критическая ошибка: {str(e2)}")
                return JSONResponse(
                    status_code=500,
                    content={"success": False, "message": f"Ошибка при обновлении: {str(e)}"}
                )
    
    except Exception as e:
        logger.exception(f"Необработанная ошибка: {str(e)}")
        return JSONResponse(
            status_code=500,
            content={"success": False, "message": f"Внутренняя ошибка сервера: {str(e)}"}
        )

# Сверхнадежные пути для обновления статуса оплаты (которые пытается использовать фронтенд)
@app.put("/api/v1/orders/{order_id}/payment", include_in_schema=True)
@app.patch("/api/v1/orders/{order_id}/payment", include_in_schema=True)
@app.post("/api/v1/orders/{order_id}/payment", include_in_schema=True)
@app.put("/api/v1/orders/{order_id}/payment-status", include_in_schema=True)
@app.patch("/api/v1/orders/{order_id}/payment-status", include_in_schema=True)
@app.post("/api/v1/orders/{order_id}/payment-status", include_in_schema=True)
@app.put("/api/v1/orders/update-payment/{order_id}", include_in_schema=True)
@app.patch("/api/v1/orders/update-payment/{order_id}", include_in_schema=True)
@app.post("/api/v1/orders/update-payment/{order_id}", include_in_schema=True)
async def update_payment_status(
    order_id: int,
    request: Request,
    db: Session = Depends(get_db)
):
    """
    Универсальный эндпоинт для обновления статуса оплаты заказа.
    Принимает любой JSON с payment_status или status для совместимости со всеми форматами запросов.
    """
    try:
        # Получаем данные запроса
        try:
            data = await request.json()
            logger.info(f"Обновление статуса оплаты заказа {order_id}: {data}")
        except Exception as e:
            return JSONResponse(
                status_code=400,
                content={"success": False, "message": "Некорректный JSON"}
            )
        
        # Извлекаем статус оплаты из разных возможных форматов данных
        payment_status = None
        
        # Проверяем все возможные варианты расположения статуса оплаты в JSON
        if "payment_status" in data:
            payment_status = data["payment_status"]
        elif "status" in data and data.get("type") == "payment":
            payment_status = data["status"]
        elif "new_payment_status" in data:
            payment_status = data["new_payment_status"]
        elif "status" in data and isinstance(data["status"], dict) and "payment_status" in data["status"]:
            payment_status = data["status"]["payment_status"]
        
        # Если статус не найден, пробуем использовать весь объект как статус
        if not payment_status and len(data) == 1 and isinstance(list(data.values())[0], str):
            payment_status = list(data.values())[0]
        
        # Если статус всё ещё не найден
        if not payment_status:
            return JSONResponse(
                status_code=400,
                content={"success": False, "message": "Не указан статус оплаты в запросе"}
            )
        
        # Приводим к верхнему регистру
        payment_status = payment_status.upper()
        
        # Прямой SQL-запрос для обновления
        sql = "UPDATE orders SET payment_status = :payment_status, updated_at = CURRENT_TIMESTAMP WHERE id = :order_id"
        params = {"order_id": order_id, "payment_status": payment_status}
        
        logger.info(f"SQL запрос: {sql}, параметры: {params}")
        
        try:
            result = db.execute(text(sql), params)
            db.commit()
            
            if result.rowcount == 0:
                return JSONResponse(
                    status_code=404,
                    content={"success": False, "message": f"Заказ с ID {order_id} не найден"}
                )
                
            # Получаем обновленные данные заказа
            updated_order = db.query(Order).filter(Order.id == order_id).first()
            
            return JSONResponse(
                status_code=200,
                content={
                    "success": True,
                    "message": "Статус оплаты заказа успешно обновлен",
                    "order": {
                        "id": updated_order.id,
                        "status": updated_order.status,
                        "payment_status": updated_order.payment_status,
                        "updated_at": updated_order.updated_at.isoformat() if updated_order.updated_at else None
                    }
                }
            )
        except Exception as e:
            logger.error(f"Ошибка SQL при обновлении статуса оплаты: {str(e)}")
            db.rollback()
            
            # Аварийная попытка с максимально простым запросом
            try:
                emergency_sql = f"UPDATE orders SET payment_status = '{payment_status}' WHERE id = {order_id}"
                db.execute(emergency_sql)
                db.commit()
                return JSONResponse(
                    status_code=200,
                    content={"success": True, "message": "Статус оплаты обновлен (аварийный режим)"}
                )
            except Exception as e2:
                logger.error(f"Критическая ошибка при обновлении статуса оплаты: {str(e2)}")
                return JSONResponse(
                    status_code=500,
                    content={"success": False, "message": f"Ошибка при обновлении статуса оплаты: {str(e)}"}
                )
            
    except Exception as e:
        logger.exception(f"Необработанная ошибка при обновлении статуса оплаты: {str(e)}")
        return JSONResponse(
            status_code=500,
            content={"success": False, "message": f"Внутренняя ошибка сервера: {str(e)}"}
        )

# Также добавляем пути для обновления через /waiter/ префикс
@app.put("/api/v1/waiter/orders/{order_id}/payment", include_in_schema=True)
@app.patch("/api/v1/waiter/orders/{order_id}/payment", include_in_schema=True)
@app.post("/api/v1/waiter/orders/{order_id}/payment", include_in_schema=True)
async def waiter_update_payment_status(
    order_id: int,
    request: Request,
    db: Session = Depends(get_db)
):
    """Версия для официантов"""
    return await update_payment_status(order_id, request, db)

# Сверхнадежные пути для обновления статуса заказа (которые пытается использовать фронтенд)
@app.put("/api/v1/orders/{order_id}/status", include_in_schema=True)
@app.patch("/api/v1/orders/{order_id}/status", include_in_schema=True)
@app.post("/api/v1/orders/{order_id}/status", include_in_schema=True)
@app.put("/api/v1/orders/status/{order_id}", include_in_schema=True)
@app.patch("/api/v1/orders/status/{order_id}", include_in_schema=True)
@app.post("/api/v1/orders/status/{order_id}", include_in_schema=True)
@app.put("/api/v1/orders/update/{order_id}", include_in_schema=True)
@app.patch("/api/v1/orders/update/{order_id}", include_in_schema=True)
@app.post("/api/v1/orders/update/{order_id}", include_in_schema=True)
@app.put("/api/v1/waiter/orders/{order_id}/status", include_in_schema=True)
@app.patch("/api/v1/waiter/orders/{order_id}/status", include_in_schema=True)
@app.post("/api/v1/waiter/orders/{order_id}/status", include_in_schema=True)
async def update_order_status(
    order_id: int,
    request: Request,
    db: Session = Depends(get_db)
):
    """
    Универсальный эндпоинт для обновления статуса заказа.
    Принимает любой JSON со status для совместимости со всеми форматами запросов.
    """
    try:
        # Получаем данные запроса
        try:
            data = await request.json()
            logger.info(f"Обновление статуса заказа {order_id}: {data}")
        except Exception as e:
            return JSONResponse(
                status_code=400,
                content={"success": False, "message": "Некорректный JSON"}
            )
        
        # Извлекаем статус заказа из разных возможных форматов данных
        status = None
        
        # Проверяем все возможные варианты расположения статуса в JSON
        if "status" in data and data.get("type") != "payment":
            status = data["status"]
        elif "new_status" in data:
            status = data["new_status"]
        elif "action" in data and data.get("action") == "update_status" and "new_status" in data:
            status = data["new_status"]
        elif "status" in data and isinstance(data["status"], dict) and "status" in data["status"]:
            status = data["status"]["status"]
        
        # Если статус не найден, пробуем использовать весь объект как статус
        if not status and len(data) == 1 and isinstance(list(data.values())[0], str):
            status = list(data.values())[0]
        
        # Если статус всё ещё не найден
        if not status:
            return JSONResponse(
                status_code=400,
                content={"success": False, "message": "Не указан статус заказа в запросе"}
            )
        
        # Приводим к верхнему регистру
        status = status.upper()
        
        # Прямой SQL-запрос для обновления
        sql_parts = ["status = :status", "updated_at = CURRENT_TIMESTAMP"]
        params = {"order_id": order_id, "status": status}
        
        # Для завершенных заказов обновляем время завершения
        if status == "COMPLETED":
            sql_parts.append("completed_at = CURRENT_TIMESTAMP")
        
        sql = f"UPDATE orders SET {', '.join(sql_parts)} WHERE id = :order_id"
        logger.info(f"SQL запрос: {sql}, параметры: {params}")
        
        try:
            result = db.execute(text(sql), params)
            db.commit()
            
            if result.rowcount == 0:
                return JSONResponse(
                    status_code=404,
                    content={"success": False, "message": f"Заказ с ID {order_id} не найден"}
                )
                
            # Получаем обновленные данные заказа
            updated_order = db.query(Order).filter(Order.id == order_id).first()
            
            return JSONResponse(
                status_code=200,
                content={
                    "success": True,
                    "message": "Статус заказа успешно обновлен",
                    "order": {
                        "id": updated_order.id,
                        "status": updated_order.status,
                        "payment_status": updated_order.payment_status,
                        "updated_at": updated_order.updated_at.isoformat() if updated_order.updated_at else None
                    }
                }
            )
        except Exception as e:
            logger.error(f"Ошибка SQL при обновлении статуса заказа: {str(e)}")
            db.rollback()
            
            # Аварийная попытка с максимально простым запросом
            try:
                emergency_sql = f"UPDATE orders SET status = '{status}' WHERE id = {order_id}"
                db.execute(emergency_sql)
                db.commit()
                return JSONResponse(
                    status_code=200,
                    content={"success": True, "message": "Статус заказа обновлен (аварийный режим)"}
                )
            except Exception as e2:
                logger.error(f"Критическая ошибка при обновлении статуса заказа: {str(e2)}")
                return JSONResponse(
                    status_code=500,
                    content={"success": False, "message": f"Ошибка при обновлении статуса заказа: {str(e)}"}
                )
            
    except Exception as e:
        logger.exception(f"Необработанная ошибка при обновлении статуса заказа: {str(e)}")
        return JSONResponse(
            status_code=500,
            content={"success": False, "message": f"Внутренняя ошибка сервера: {str(e)}"}
        )

# Особые обработчики для стандартных методов обновления заказа
@app.put("/api/v1/orders/{order_id}", include_in_schema=True)
@app.patch("/api/v1/orders/{order_id}", include_in_schema=True)
@app.post("/api/v1/orders/{order_id}", include_in_schema=True)
async def update_order_universal(
    order_id: int,
    request: Request,
    db: Session = Depends(get_db)
):
    """
    Универсальный эндпоинт для обновления всех данных заказа.
    Анализирует запрос и определяет, что именно нужно обновить.
    """
    try:
        # Получаем данные запроса
        try:
            data = await request.json()
            logger.info(f"Универсальное обновление заказа {order_id}: {data}")
        except Exception as e:
            return JSONResponse(
                status_code=400,
                content={"success": False, "message": "Некорректный JSON"}
            )
        
        # Определяем тип обновления
        status = None
        payment_status = None
        
        # Проверяем, содержит ли запрос данные о статусе
        if "status" in data and data.get("type") != "payment":
            status = data["status"]
        elif "new_status" in data:
            status = data["new_status"]
            
        # Проверяем, содержит ли запрос данные о статусе оплаты
        if "payment_status" in data:
            payment_status = data["payment_status"]
        elif "status" in data and data.get("type") == "payment":
            payment_status = data["status"]
        elif "new_payment_status" in data:
            payment_status = data["new_payment_status"]
            
        # Собираем SQL-запрос для обновления
        sql_parts = []
        params = {"order_id": order_id}
        
        if status:
            status = status.upper()
            sql_parts.append("status = :status")
            params["status"] = status
            
            # Для завершенных заказов обновляем время завершения
            if status == "COMPLETED":
                sql_parts.append("completed_at = CURRENT_TIMESTAMP")
                
        if payment_status:
            payment_status = payment_status.upper()
            sql_parts.append("payment_status = :payment_status")
            params["payment_status"] = payment_status
            
        # Если нет данных для обновления
        if not sql_parts:
            return JSONResponse(
                status_code=400,
                content={"success": False, "message": "Не указаны данные для обновления"}
            )
            
        # Всегда обновляем время изменения
        sql_parts.append("updated_at = CURRENT_TIMESTAMP")
        
        # Строим и выполняем запрос
        sql = f"UPDATE orders SET {', '.join(sql_parts)} WHERE id = :order_id"
        logger.info(f"SQL запрос: {sql}, параметры: {params}")
        
        try:
            result = db.execute(text(sql), params)
            db.commit()
            
            if result.rowcount == 0:
                return JSONResponse(
                    status_code=404,
                    content={"success": False, "message": f"Заказ с ID {order_id} не найден"}
                )
                
            # Получаем обновленные данные заказа
            updated_order = db.query(Order).filter(Order.id == order_id).first()
            
            return JSONResponse(
                status_code=200,
                content={
                    "success": True,
                    "message": "Заказ успешно обновлен",
                    "order": {
                        "id": updated_order.id,
                        "status": updated_order.status,
                        "payment_status": updated_order.payment_status,
                        "updated_at": updated_order.updated_at.isoformat() if updated_order.updated_at else None
                    }
                }
            )
        except Exception as e:
            logger.error(f"Ошибка SQL при универсальном обновлении: {str(e)}")
            db.rollback()
            
            # Аварийная попытка с максимально простым запросом
            try:
                emergency_parts = []
                if "status" in params:
                    emergency_parts.append(f"status = '{params['status']}'")
                if "payment_status" in params:
                    emergency_parts.append(f"payment_status = '{params['payment_status']}'")
                
                if emergency_parts:
                    emergency_sql = f"UPDATE orders SET {', '.join(emergency_parts)} WHERE id = {order_id}"
                    db.execute(emergency_sql)
                    db.commit()
                    return JSONResponse(
                        status_code=200,
                        content={"success": True, "message": "Заказ обновлен (аварийный режим)"}
                    )
                else:
                    raise ValueError("Нет данных для аварийного обновления")
            except Exception as e2:
                logger.error(f"Критическая ошибка при универсальном обновлении: {str(e2)}")
                return JSONResponse(
                    status_code=500,
                    content={"success": False, "message": f"Ошибка при обновлении заказа: {str(e)}"}
                )
    except Exception as e:
        logger.exception(f"Необработанная ошибка при универсальном обновлении: {str(e)}")
        return JSONResponse(
            status_code=500,
            content={"success": False, "message": f"Внутренняя ошибка сервера: {str(e)}"}
        )

# Максимально простой эндпоинт для обновления любого заказа
@app.put("/api/simple/orders/{order_id}", include_in_schema=True)
@app.post("/api/simple/orders/{order_id}", include_in_schema=True)
@app.patch("/api/simple/orders/{order_id}", include_in_schema=True)
async def simplest_order_update(
    order_id: int,
    request: Request,
    db: Session = Depends(get_db)
):
    """
    Максимально простой эндпоинт для обновления заказа без проверок аутентификации.
    Используется только в экстренных случаях.
    
    Принимает JSON в любом формате:
    - {"status": "COMPLETED"}
    - {"payment_status": "PAID"}
    - {"status": "COMPLETED", "payment_status": "PAID"}
    """
    try:
        # Получаем данные из запроса
        try:
            data = await request.json()
            logger.info(f"ПРЯМОЕ обновление заказа {order_id}: {data}")
        except Exception as e:
            return JSONResponse(
                status_code=400,
                content={"success": False, "message": f"Ошибка в формате JSON: {str(e)}"}
            )
        
        # Получаем заказ из базы данных
        order_query = "SELECT id FROM orders WHERE id = :order_id"
        order_result = db.execute(text(order_query), {"order_id": order_id})
        order_exists = order_result.fetchone()
        
        if not order_exists:
            return JSONResponse(
                status_code=404,
                content={"success": False, "message": f"Заказ с ID {order_id} не найден"}
            )
        
        # Подготовка SQL запроса для обновления
        update_parts = []
        params = {"order_id": order_id}
        
        # Обрабатываем все возможные поля
        if "status" in data and data["status"]:
            status = data["status"].upper() if isinstance(data["status"], str) else data["status"]
            update_parts.append("status = :status")
            params["status"] = status
            
            # Для завершенных заказов обновляем время завершения
            if status in ["COMPLETED", "completed"]:
                update_parts.append("completed_at = datetime('now')")
        
        if "payment_status" in data and data["payment_status"]:
            payment = data["payment_status"].upper() if isinstance(data["payment_status"], str) else data["payment_status"]
            update_parts.append("payment_status = :payment_status")
            params["payment_status"] = payment
        
        # Всегда обновляем время изменения
        update_parts.append("updated_at = datetime('now')")
        
        if not update_parts:
            return JSONResponse(
                status_code=400,
                content={"success": False, "message": "Не указаны поля для обновления"}
            )
        
        # Формируем SQL запрос
        sql = f"UPDATE orders SET {', '.join(update_parts)} WHERE id = :order_id"
        logger.info(f"Выполняем SQL запрос для прямого обновления: {sql}")
        logger.info(f"Параметры: {params}")
        
        # Выполняем запрос
        try:
            result = db.execute(text(sql), params)
            db.commit()
            logger.info(f"SQL запрос выполнен успешно, обновлено строк: {result.rowcount}")
            
            # Получаем обновленные данные заказа
            order_data_query = "SELECT id, status, payment_status, updated_at FROM orders WHERE id = :order_id"
            order_data = db.execute(text(order_data_query), {"order_id": order_id}).fetchone()
            
            return JSONResponse(
                status_code=200,
                content={
                    "success": True,
                    "message": "Заказ успешно обновлен через прямой метод",
                    "order": {
                        "id": order_data[0] if order_data else order_id,
                        "status": order_data[1] if order_data else None,
                        "payment_status": order_data[2] if order_data else None,
                        "updated_at": order_data[3] if order_data else None
                    }
                }
            )
        except Exception as sql_error:
            db.rollback()
            logger.error(f"Ошибка при выполнении SQL запроса: {str(sql_error)}")
            
            # Экстренное обновление через максимально простой запрос
            try:
                simple_sql = "UPDATE orders SET updated_at = datetime('now')"
                if "status" in params:
                    simple_sql = "UPDATE orders SET status = :status, updated_at = datetime('now') WHERE id = :order_id"
                elif "payment_status" in params:
                    simple_sql = "UPDATE orders SET payment_status = :payment_status, updated_at = datetime('now') WHERE id = :order_id"
                
                db.execute(text(simple_sql), params)
                db.commit()
                logger.info("Выполнено экстренное обновление через простой SQL")
                
                return JSONResponse(
                    status_code=200,
                    content={
                        "success": True,
                        "message": "Заказ обновлен через экстренный метод",
                        "order_id": order_id
                    }
                )
            except Exception as emergency_error:
                db.rollback()
                logger.error(f"Критическая ошибка при обновлении: {str(emergency_error)}")
                return JSONResponse(
                    status_code=500,
                    content={
                        "success": False,
                        "message": f"Все попытки обновления не удались: {str(emergency_error)}"
                    }
                )
    except Exception as e:
        logger.exception(f"Необработанная ошибка в простом методе обновления: {str(e)}")
        return JSONResponse(
            status_code=500,
            content={"success": False, "message": f"Внутренняя ошибка сервера: {str(e)}"}
        )

# Эндпоинт для привязки заказа к официанту по коду заказа - API v1 путь
@app.post("/api/v1/waiter/assign-order-by-code", include_in_schema=True)
@app.post("/api/v1/orders/by-code/assign", include_in_schema=True)
async def assign_order_by_code_api_v1(
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Привязка заказа к официанту по коду заказа (API v1 путь).
    
    Принимает JSON: {"code": "ORDER_CODE"}
    """
    return await assign_order_by_code_handler(request, db, current_user)

# Эндпоинт для привязки заказа к официанту по коду заказа - прямой путь для фронтенда
@app.post("/waiter/assign-order-by-code", include_in_schema=True)
async def assign_order_by_code_direct(
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Привязка заказа к официанту по коду заказа (прямой путь).
    
    Принимает JSON: {"code": "ORDER_CODE"}
    """
    return await assign_order_by_code_handler(request, db, current_user)

# Обработчик для привязки заказа к официанту по коду
async def assign_order_by_code_handler(
    request: Request,
    db: Session,
    current_user: User
):
    """
    Обработчик привязки заказа к официанту по коду заказа.
    
    Принимает JSON: {"code": "ORDER_CODE"}
    """
    try:
        logger.info(f"Запрос на привязку заказа к официанту по коду. User: {current_user.id}, role: {current_user.role}")
        
        # Проверка прав доступа
        if current_user.role not in ["waiter", "admin"]:
            logger.warning(f"Попытка привязать заказ пользователем с недостаточными правами: {current_user.role}")
            return JSONResponse(
                status_code=403,
                content={"success": False, "message": "Недостаточно прав для привязки заказа"}
            )
        
        # Получаем данные из запроса
        try:
            data = await request.json()
            logger.info(f"Получены данные для привязки заказа: {data}")
        except Exception as e:
            logger.error(f"Ошибка при разборе JSON: {str(e)}")
            return JSONResponse(
                status_code=400,
                content={"success": False, "message": "Некорректный JSON"}
            )
        
        # Получаем код заказа (поддерживаем оба варианта: code и order_code)
        order_code = data.get("code") or data.get("order_code")
        if not order_code:
            logger.warning("Код заказа не указан в запросе")
            return JSONResponse(
                status_code=400,
                content={"success": False, "message": "Код заказа не указан"}
            )
        
        logger.info(f"Привязка заказа с кодом {order_code} к официанту {current_user.id}")
        
        # Ищем заказ по коду
        order_query = text("""
            SELECT id, status, waiter_id 
            FROM orders 
            WHERE order_code = :code
        """)
        
        result = db.execute(order_query, {"code": order_code})
        order_data = result.fetchone()
        
        if not order_data:
            logger.warning(f"Заказ с кодом {order_code} не найден")
            return JSONResponse(
                status_code=404,
                content={"success": False, "message": f"Заказ с кодом {order_code} не найден"}
            )
        
        order_id = order_data[0]
        order_status = order_data[1]
        previous_waiter_id = order_data[2]
        
        logger.info(f"Найден заказ: ID={order_id}, статус={order_status}, текущий waiter_id={previous_waiter_id}")
        
        # Проверяем, завершен ли заказ
        if order_status in ["COMPLETED", "CANCELLED"]:
            logger.warning(f"Невозможно привязать заказ #{order_id} со статусом {order_status}")
            return JSONResponse(
                status_code=400,
                content={"success": False, "message": f"Невозможно привязать завершенный заказ"}
            )
        
        # Проверяем, привязан ли заказ к другому официанту
        if previous_waiter_id and previous_waiter_id != current_user.id:
            # Получаем имя официанта
            waiter_query = text("SELECT full_name FROM users WHERE id = :waiter_id")
            waiter_result = db.execute(waiter_query, {"waiter_id": previous_waiter_id})
            waiter_data = waiter_result.fetchone()
            waiter_name = waiter_data[0] if waiter_data else "Другой официант"
            
            logger.warning(f"Заказ #{order_id} уже привязан к официанту {waiter_name} (ID: {previous_waiter_id})")
            
            if current_user.role == "admin":
                logger.info(f"Администратор {current_user.id} переназначает заказ с другого официанта")
            else:
                return JSONResponse(
                    status_code=400,
                    content={"success": False, "message": f"Заказ уже привязан к другому официанту"}
                )
        
        # Определяем новый статус
        new_status = "CONFIRMED" if order_status.upper() == "PENDING" else order_status
        
        # Обновляем заказ через прямой SQL запрос
        update_query = text("""
            UPDATE orders 
            SET waiter_id = :waiter_id, 
                status = :status, 
                updated_at = datetime('now')
            WHERE id = :order_id
        """)
        
        update_params = {
            "waiter_id": current_user.id,
            "status": new_status,
            "order_id": order_id
        }
        
        try:
            logger.info(f"Выполнение SQL запроса для привязки заказа: {update_params}")
            result = db.execute(update_query, update_params)
            db.commit()
            
            # Проверяем успешность обновления
            verify_query = text("SELECT waiter_id FROM orders WHERE id = :order_id")
            verify_result = db.execute(verify_query, {"order_id": order_id})
            verify_data = verify_result.fetchone()
            
            if verify_data and verify_data[0] == current_user.id:
                logger.info(f"Заказ {order_id} успешно привязан к официанту {current_user.id}")
                
                # Получаем детали заказа
                order_details_query = text("""
                    SELECT id, status, waiter_id, payment_status, updated_at
                    FROM orders
                    WHERE id = :order_id
                """)
                order_details = db.execute(order_details_query, {"order_id": order_id}).fetchone()
                
                return JSONResponse(
                    status_code=200,
                    content={
                        "success": True,
                        "message": "Заказ успешно привязан к официанту",
                        "order": {
                            "id": order_details[0],
                            "status": order_details[1],
                            "waiter_id": order_details[2],
                            "payment_status": order_details[3],
                            "updated_at": order_details[4]
                        }
                    }
                )
            else:
                current_value = verify_data[0] if verify_data else None
                logger.error(f"Ошибка привязки заказа! Текущее значение waiter_id = {current_value}")
                
                # Экстренная привязка
                emergency_query = f"""
                    UPDATE orders
                    SET waiter_id = {current_user.id}
                    WHERE id = {order_id}
                """
                db.execute(emergency_query)
                db.commit()
                
                return JSONResponse(
                    status_code=200,
                    content={
                        "success": True,
                        "message": "Заказ привязан (аварийный режим)",
                        "order_id": order_id
                    }
                )
        except Exception as e:
            db.rollback()
            logger.error(f"Ошибка при обновлении заказа: {str(e)}")
            
            # Последняя попытка привязки
            try:
                super_emergency_query = f"UPDATE orders SET waiter_id = {current_user.id} WHERE id = {order_id}"
                db.execute(super_emergency_query)
                db.commit()
                
                return JSONResponse(
                    status_code=200,
                    content={
                        "success": True,
                        "message": "Заказ привязан (экстренный режим)",
                        "order_id": order_id
                    }
                )
            except Exception as final_error:
                logger.critical(f"Критическая ошибка при привязке заказа: {str(final_error)}")
                return JSONResponse(
                    status_code=500,
                    content={"success": False, "message": f"Не удалось привязать заказ: {str(e)}"}
                )
    except Exception as e:
        logger.exception(f"Необработанная ошибка при привязке заказа: {str(e)}")
        return JSONResponse(
            status_code=500,
            content={"success": False, "message": f"Внутренняя ошибка сервера: {str(e)}"}
        )

# Добавляем прямой эндпоинт для привязки заказа по коду без префикса API
@app.post("/waiter/assign-order", include_in_schema=True)
async def assign_order_direct(
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Прямой эндпоинт для привязки заказа к официанту по коду.
    
    Принимает JSON: {"code": "ORDER_CODE"} или {"order_code": "ORDER_CODE"}
    """
    return await assign_order_by_code_handler(request, db, current_user)

# Добавляем прямой эндпоинт для совместимости с фронтендом
@app.post("/api/waiter/assign-order", include_in_schema=True)
async def api_assign_order_direct(
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Прямой эндпоинт для привязки заказа к официанту по коду через /api/.
    
    Принимает JSON: {"code": "ORDER_CODE"} или {"order_code": "ORDER_CODE"}
    """
    return await assign_order_by_code_handler(request, db, current_user)

# Добавляем путь для прямой привязки по коду в URL
@app.post("/api/v1/orders/by-code/{code}/assign", include_in_schema=True)
async def assign_order_by_code_in_url(
    code: str,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Привязка заказа к официанту по коду заказа, указанному в URL.
    
    Код заказа передается в URL.
    """
    # Создаем модифицированный запрос с кодом заказа в теле
    class ModifiedRequest:
        async def json(self):
            return {"code": code}
    
    # Создаем объект с методом json, который вернет нужные данные
    modified_request = ModifiedRequest()
    
    # Копируем остальные атрибуты из оригинального запроса
    for attr in dir(request):
        if not attr.startswith('_') and attr != 'json':
            setattr(modified_request, attr, getattr(request, attr))
    
    return await assign_order_by_code_handler(modified_request, db, current_user)

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