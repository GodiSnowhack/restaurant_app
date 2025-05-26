from pydantic import BaseModel, EmailStr, ConfigDict
from typing import Optional

class UserBase(BaseModel):
    email: str
    full_name: str
    role: str = "user"

    model_config = ConfigDict(from_attributes=True)

class UserCreate(UserBase):
    password: str

class UserOut(UserBase):
    id: int

    model_config = ConfigDict(from_attributes=True) 