import uvicorn
from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pathlib import Path
import logging
import os

from app.api.v1 import api_router
from app.core.config import settings
from app.database.session import SessionLocal, create_tables
from app.core.init_db import init_db
from app.api.v1.endpoints import orders

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
async def root():
    return {"message": "Сервер API работает", "status": "OK"}

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