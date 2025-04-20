from pydantic import BaseModel

class DashboardStats(BaseModel):
    ordersToday: int
    ordersTotal: int
    revenue: float
    reservationsToday: int
    users: int
    dishes: int 