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
        # Проверяем заголовок X-Forwarded-Proto
        forwarded_proto = request.headers.get('X-Forwarded-Proto')
        
        # Если запрос уже идет через HTTPS или мы на Railway (они автоматически обрабатывают HTTPS)
        if (forwarded_proto == 'https' or 
            'railway.app' in request.headers.get('host', '') or
            not settings.FORCE_HTTPS):
            return await call_next(request)
            
        # Для локальной разработки
        if request.url.hostname in ['localhost', '127.0.0.1']:
            return await call_next(request)
            
        # Для всех остальных случаев делаем редирект на HTTPS
        if request.url.scheme == "http":
            return RedirectResponse(
                request.url.replace(scheme="https"),
                status_code=301
            )
            
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
    openapi_url=f"{settings.API_V1_STR}/openapi.json"
)

# Добавляем middleware для HTTPS
app.add_middleware(HTTPSRedirectMiddleware)

# Настройки CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://frontend-production-8eb6.up.railway.app",
        "https://backend-production-1a78.up.railway.app",
        "https://localhost:3000",
        "https://localhost:8000"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=[
        "Content-Type",
        "Authorization",
        "Accept",
        "Origin",
        "X-User-ID",
        "X-User-Role",
        "X-Forwarded-Proto",
        "X-Forwarded-For"
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
    logger.info(f"Forwarded Proto: {request.headers.get('X-Forwarded-Proto')}")
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
        workers=settings.WORKERS_COUNT
    ) 