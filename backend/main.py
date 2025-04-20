import uvicorn
from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pathlib import Path
import logging

from app.api.v1 import api_router
from app.core.config import settings
from app.database.session import SessionLocal
from app.core.init_db import init_db

# Настройка логгера
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

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
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],  # Указываем конкретные origins
    allow_credentials=True,  # Включаем credentials для поддержки куки авторизации
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allow_headers=["Content-Type", "Authorization", "X-Requested-With"],
    expose_headers=["*"],
    max_age=600  # Кешировать предполетные запросы на 10 минут
)

# Монтируем статические файлы
static_path = Path(__file__).parent / "static"
static_path.mkdir(exist_ok=True)
app.mount("/static", StaticFiles(directory=str(static_path)), name="static")

# Регистрируем маршруты API
app.include_router(api_router, prefix=settings.API_V1_STR)

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
        workers=settings.WORKERS_COUNT
    ) 