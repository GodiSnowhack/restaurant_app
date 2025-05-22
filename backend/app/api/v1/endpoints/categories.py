from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from app.database.session import get_db
from app.models.menu import Category
from app.schemas.menu import CategoryResponse

router = APIRouter()

@router.get("/", response_model=List[CategoryResponse])
def get_categories(db: Session = Depends(get_db)):
    """Получение списка всех категорий меню"""
    try:
        categories = db.query(Category).all()
        return categories
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Ошибка при получении категорий: {str(e)}"
        ) 