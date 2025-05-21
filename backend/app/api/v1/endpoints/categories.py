from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database.session import get_db

router = APIRouter()

@router.get("/")
def get_categories(db: Session = Depends(get_db)):
    return {"message": "Categories endpoint"} 