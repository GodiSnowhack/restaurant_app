from typing import List, Optional, Dict, Any, Union
from datetime import datetime
from fastapi.encoders import jsonable_encoder
from sqlalchemy.orm import Session

from app.crud.base import CRUDBase
from app.models.order import Order
from app.schemas.order import OrderCreate, OrderUpdate

class CRUDOrder(CRUDBase[Order, OrderCreate, OrderUpdate]):
    def get_multi_filtered(
        self,
        db: Session,
        *,
        status: Optional[str] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        user_id: Optional[int] = None,
        table_number: Optional[int] = None,
        skip: int = 0,
        limit: int = 100
    ) -> List[Order]:
        """
        Получить список заказов с фильтрацией по статусу, дате, пользователю и номеру стола
        """
        query = db.query(self.model)
        
        # Подробное логирование для отладки
        print(f"Фильтрация заказов: status={status}, date_range={start_date} - {end_date}, user_id={user_id}, table={table_number}")
        
        # Применяем фильтры, если они указаны
        if status:
            query = query.filter(self.model.status == status)
        
        if start_date:
            query = query.filter(self.model.created_at >= start_date)
        
        if end_date:
            query = query.filter(self.model.created_at <= end_date)
        
        if user_id:
            query = query.filter(self.model.user_id == user_id)
        
        if table_number:
            query = query.filter(self.model.table_number == table_number)
        
        # Сортировка по дате создания (новые сверху)
        query = query.order_by(self.model.created_at.desc())
        
        # Применяем пагинацию
        orders = query.offset(skip).limit(limit).all()
        
        # Логирование результатов
        print(f"SQL запрос: {query}")
        print(f"Найдено {len(orders)} заказов")
        
        return orders
    
    def create_with_items(
        self,
        db: Session,
        *,
        obj_in: OrderCreate,
    ) -> Order:
        """
        Создать заказ с элементами заказа
        """
        obj_in_data = jsonable_encoder(obj_in, exclude_unset=True)
        items_data = obj_in_data.pop("items", [])
        
        # Создаем заказ
        db_obj = self.model(**obj_in_data)
        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)
        
        # Добавляем элементы заказа
        if items_data:
            from app.models.menu import Dish
            for item_data in items_data:
                dish_id = item_data.get("dish_id")
                if dish_id:
                    dish = db.query(Dish).filter(Dish.id == dish_id).first()
                    if dish:
                        # Тут добавляем связь многие-ко-многим через order_dish
                        db_obj.items.append(dish)
                        
                        # Дополнительные данные для заказа (количество, особые инструкции)
                        # можно добавить через отдельное связующее отношение
                        
        db.commit()
        db.refresh(db_obj)
        return db_obj


order = CRUDOrder(Order) 