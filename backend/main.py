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

# Получаем список разрешенных источников для CORS
# Когда используется withCredentials, нельзя использовать звездочку "*"
# Нужно явно перечислить все разрешенные источники
origins = [
    "http://localhost:3000", 
    "http://127.0.0.1:3000", 
    "http://localhost", 
    "http://127.0.0.1", 
    "http://0.0.0.0:3000", 
    "http://192.168.0.10:3000",
    "http://192.168.0.11:3000",
    "http://192.168.0.12:3000",
    "http://192.168.0.13:3000",
    "http://192.168.0.14:3000",
    "http://192.168.0.15:3000",
    "http://192.168.0.16:3000",
    "http://192.168.1.1:3000",
    "http://192.168.1.2:3000",
    "http://192.168.1.3:3000",
    "http://192.168.1.4:3000",
    "http://192.168.1.5:3000",
    "http://10.0.0.1:3000",
    "http://10.0.0.2:3000",
    "http://10.0.0.3:3000",
    "http://10.0.0.4:3000",
    "http://10.0.0.5:3000",
    # Добавляем и HTTPS варианты для корректной работы в безопасной среде
    "https://localhost:3000", 
    "https://127.0.0.1:3000",
    "https://192.168.0.10:3000",
    "https://192.168.0.11:3000",
    "https://192.168.0.12:3000",
    "https://192.168.0.13:3000",
    "https://192.168.0.14:3000",
    "https://192.168.0.15:3000",
    "https://192.168.0.16:3000",
]

# Настройки CORS
app.add_middleware(
    CORSMiddleware,
    # Расширенный список origins для поддержки мобильных устройств
    allow_origins=origins,
    allow_credentials=True,  # Включаем credentials для поддержки куки авторизации
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH", "HEAD"],
    allow_headers=[
        "Content-Type", 
        "Authorization", 
        "X-Requested-With", 
        "Accept", 
        "Origin", 
        "Access-Control-Request-Method", 
        "Access-Control-Request-Headers",
        "X-CSRF-Token",
        "X-Client-Type",
        "X-Mobile-Auth",
        "X-Low-Quality",
        "X-Save-Data",
        "X-Fallback",
        "X-Attempt"
    ],
    expose_headers=["Content-Disposition", "Location"],
    max_age=1800  # Кешировать предполетные запросы на 30 минут
)

# Middleware для логирования запросов, особенно важно для отладки мобильных клиентов
@app.middleware("http")
async def log_requests(request: Request, call_next):
    # Получаем информацию о запросе
    client_host = request.client.host if request.client else "unknown"
    user_agent = request.headers.get("user-agent", "unknown")
    is_mobile = "mobile" in user_agent.lower() or "android" in user_agent.lower() or "iphone" in user_agent.lower()
    
    # Логируем только запросы от мобильных устройств или содержащие определенные пути
    if is_mobile or "/auth/" in request.url.path or "/users/" in request.url.path:
        logger.info(f"Request: {request.method} {request.url.path} - Client: {client_host} - Mobile: {is_mobile}")
    
    # Продолжаем обработку запроса
    response = await call_next(request)
    
    # Для ошибок логируем статус ответа
    if response.status_code >= 400 and (is_mobile or "/auth/" in request.url.path or "/users/" in request.url.path):
        logger.warning(f"Response: {response.status_code} - {request.method} {request.url.path} - Client: {client_host}")
    
    return response

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