from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database.session import get_db

router = APIRouter()

@router.post("/login")
def login(db: Session = Depends(get_db)):
    return {"message": "Auth endpoint"} 