from typing import Any, List
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session

from app.schemas.orders import OrderCreate, OrderOut
from app.services.orders import create_order, get_orders as get_orders_service
from app.models.user import User
from app.database.session import get_db
from app.core.auth import get_current_user

router = APIRouter()

@router.get("/", response_model=List[OrderOut])
def get_orders(
    db: Session = Depends(get_db),
    skip: int = 0,
    limit: int = 100,
    status: str = None,
    user_id: int = None,
    start_date: str = None,
    end_date: str = None,
    current_user: User = Depends(get_current_user)
):
    """
    Получение списка заказов с возможностью фильтрации
    
    Параметры:
    - status: фильтр по статусу заказа
    - user_id: фильтр по ID пользователя
    - start_date: начальная дата для выборки
    - end_date: конечная дата для выборки
    """
    try:
        # Проверка прав доступа: обычный пользователь видит только свои заказы
        if current_user.role not in ["admin", "waiter"]:
            user_id = current_user.id

        # Получаем заказы через сервисный слой
        orders = get_orders_service(
            db=db,
            skip=skip,
            limit=limit,
            status=status,
            user_id=user_id
        )
        
        return orders
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Ошибка при получении заказов: {str(e)}"
        )

@router.post("/", response_model=OrderOut)
async def create_order(
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    """
    Создание нового заказа с обработкой различных форматов данных.
    Номер стола получается автоматически из кода бронирования.
    """
    try:
        # Получаем данные из запроса
        try:
            request_data = await request.json()
            print(f"Получены данные заказа: {request_data}")
        except Exception as e:
            print(f"Ошибка при чтении JSON: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Некорректный формат данных в запросе"
            )
        
        # Базовые данные заказа
        order_data = {
            "status": "pending"
        }
        
        # Код бронирования (если есть)
        if request_data.get("reservation_code"):
            order_data["reservation_code"] = request_data["reservation_code"]
        
        # Обработка блюд
        dishes = request_data.get("dishes", [])
        items = []
        
        if dishes:
            # Проверяем формат dishes
            if dishes and isinstance(dishes[0], dict):
                # Формат объектов с dish_id и quantity
                for dish in dishes:
                    items.append({
                        "dish_id": dish["dish_id"],
                        "quantity": dish.get("quantity", 1),
                        "special_instructions": dish.get("special_instructions", "")
                    })
            else:
                # Простой массив ID блюд
                order_data["dishes"] = dishes
                
        # Если определены items напрямую, используем их
        if request_data.get("items"):
            for item in request_data["items"]:
                items.append({
                    "dish_id": item["dish_id"],
                    "quantity": item.get("quantity", 1),
                    "special_instructions": item.get("special_instructions", "")
                })
        
        # Если есть обработанные items, добавляем их к данным заказа
        if items:
            order_data["items"] = items
            
        # Проверяем, что есть хотя бы один источник блюд
        if not order_data.get("dishes") and not order_data.get("items"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="В заказе должны быть указаны блюда (dishes или items)"
            )
        
        # Создаем заказ через сервисный слой
        try:
            order = create_order(db, current_user.id, OrderCreate(**order_data))
            return order
        except Exception as e:
            print(f"Ошибка при создании заказа: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Ошибка при создании заказа: {str(e)}"
            )
    except HTTPException:
        raise
    except Exception as e:
        # Логгируем ошибку и возвращаем описательный ответ
        print(f"Общая ошибка при создании заказа: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Непредвиденная ошибка при создании заказа: {str(e)}"
        ) 