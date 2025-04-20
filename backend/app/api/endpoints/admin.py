from fastapi import APIRouter, Depends, HTTPException
from app.services.dashboard import get_dashboard_stats
from app.schemas.dashboard import DashboardStats
from app.core.auth import get_current_user
from app.models.user import User

router = APIRouter()

@router.get("/dashboard/stats", response_model=DashboardStats)
async def get_stats(current_user: User = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Not enough permissions")
    return get_dashboard_stats() 