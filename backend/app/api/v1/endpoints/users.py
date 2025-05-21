from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database.session import get_db

router = APIRouter()

@router.get("/me")
def get_current_user(db: Session = Depends(get_db)):
    return {"message": "Users endpoint"} 