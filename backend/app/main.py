import uvicorn
from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pathlib import Path
import logging
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import RedirectResponse

from app.api.v1 import api_router
from app.core.config import settings
from app.database.session import SessionLocal
from app.core.init_db import init_db

# Настройка логгера
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Middleware для принудительного HTTPS
class HTTPSRedirectMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        if settings.FORCE_HTTPS and request.url.scheme == "http":
            https_url = str(request.url).replace("http://", "https://", 1)
            return RedirectResponse(https_url, status_code=301)
        return await call_next(request)

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
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    root_path=settings.ROOT_PATH if settings.ENVIRONMENT == "production" else ""
)

# Закомментируем middleware для HTTPS
# app.add_middleware(HTTPSRedirectMiddleware)

# Настройки CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://frontend-production-8eb6.up.railway.app",
        "https://backend-production-1a78.up.railway.app",
        "http://localhost:3000",
        "http://localhost:8000"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=[
        "Content-Type",
        "Authorization",
        "Accept",
        "Origin",
        "X-User-ID",
        "X-User-Role"
    ],
    expose_headers=["*"],
    max_age=3600,
)

# Монтируем статические файлы
static_path = Path(__file__).parent.parent / "static"
static_path.mkdir(exist_ok=True)
app.mount("/static", StaticFiles(directory=str(static_path)), name="static")

# Регистрируем маршруты API
app.include_router(api_router, prefix=settings.API_V1_STR)

# Middleware для логирования запросов
@app.middleware("http")
async def log_requests(request: Request, call_next):
    logger.info(f"Request: {request.method} {request.url}")
    logger.info(f"Client host: {request.client.host}")
    logger.info(f"Headers: {request.headers}")
    response = await call_next(request)
    logger.info(f"Response status: {response.status_code}")
    return response

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
        ssl_keyfile="key.pem",  # Добавляем SSL
        ssl_certfile="cert.pem"  # Добавляем SSL
    ) 