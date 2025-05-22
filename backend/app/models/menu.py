from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, ForeignKey, Table, Text
from sqlalchemy.orm import relationship

from app.database.session import Base


# Таблица для связи многие-ко-многим между блюдами и аллергенами
dish_allergen = Table(
    "dish_allergen",
    Base.metadata,
    Column("dish_id", Integer, ForeignKey("dishes.id", ondelete="CASCADE")),
    Column("allergen_id", Integer, ForeignKey("allergens.id", ondelete="CASCADE"))
)

# Таблица для связи многие-ко-многим между блюдами и тегами
dish_tag = Table(
    "dish_tag",
    Base.metadata,
    Column("dish_id", Integer, ForeignKey("dishes.id", ondelete="CASCADE")),
    Column("tag_id", Integer, ForeignKey("tags.id", ondelete="CASCADE"))
)


class Category(Base):
    __tablename__ = "categories"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True, nullable=False)
    description = Column(String, nullable=True)
    
    # Время создания и обновления
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Связи с другими таблицами
    dishes = relationship("Dish", back_populates="category", cascade="all, delete-orphan")


class Allergen(Base):
    __tablename__ = "allergens"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True, nullable=False)
    description = Column(String, nullable=True)
    
    # Связь многие-ко-многим с блюдами
    dishes = relationship("Dish", secondary=dish_allergen, back_populates="allergens")


class Tag(Base):
    __tablename__ = "tags"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True, nullable=False)
    
    # Связь многие-ко-многим с блюдами
    dishes = relationship("Dish", secondary=dish_tag, back_populates="tags")


class Dish(Base):
    __tablename__ = "dishes"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True, nullable=False)
    description = Column(Text, nullable=True)
    price = Column(Float, nullable=False)
    cost_price = Column(Float, nullable=True)
    image_url = Column(String, nullable=True)
    calories = Column(Integer, nullable=True)
    cooking_time = Column(Integer, default=15)  # время приготовления в минутах
    is_vegetarian = Column(Boolean, default=False)
    is_vegan = Column(Boolean, default=False)
    is_available = Column(Boolean, default=True)
    category_id = Column(Integer, ForeignKey("categories.id", ondelete="SET NULL"))
    
    # Время создания и обновления
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Связи с другими таблицами
    category = relationship("Category", back_populates="dishes")
    allergens = relationship("Allergen", secondary=dish_allergen, back_populates="dishes")
    tags = relationship("Tag", secondary=dish_tag, back_populates="dishes")
    feedbacks = relationship("Feedback", back_populates="dish", cascade="all, delete-orphan")
    order_dishes = relationship("OrderDish", back_populates="dish")
    
    @property
    def orders(self):
        return [od.order for od in self.order_dishes]