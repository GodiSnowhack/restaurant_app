from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database.session import get_db

router = APIRouter()

@router.get("/")
def get_dishes(db: Session = Depends(get_db)):
    return {"message": "Dishes endpoint"} 