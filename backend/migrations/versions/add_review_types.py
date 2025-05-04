"""add_review_types

Revision ID: add_review_types
Revises: 
Create Date: 2025-05-03 10:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'add_review_types'
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    # Добавление новых колонок в таблицу reviews
    op.add_column('reviews', sa.Column('review_type', sa.String(length=20), nullable=True))
    op.add_column('reviews', sa.Column('order_rating', sa.Float(), nullable=True))
    op.add_column('reviews', sa.Column('service_rating', sa.Float(), nullable=True))
    op.add_column('reviews', sa.Column('dish_rating', sa.Float(), nullable=True))
    op.add_column('reviews', sa.Column('waiter_id', sa.Integer(), nullable=True))
    
    # Обновление существующих отзывов, устанавливая тип DISH
    op.execute("UPDATE reviews SET review_type = 'dish', dish_rating = rating WHERE review_type IS NULL")
    
    # Добавление внешнего ключа для waiter_id
    op.create_foreign_key(
        'fk_reviews_waiter_id', 
        'reviews', 
        'users', 
        ['waiter_id'], 
        ['id'],
        ondelete='SET NULL'
    )
    
    # Создание индекса для быстрого поиска отзывов по типу
    op.create_index(op.f('ix_reviews_review_type'), 'reviews', ['review_type'], unique=False)
    op.create_index(op.f('ix_reviews_waiter_id'), 'reviews', ['waiter_id'], unique=False)


def downgrade():
    # Удаление индексов
    op.drop_index(op.f('ix_reviews_review_type'), table_name='reviews')
    op.drop_index(op.f('ix_reviews_waiter_id'), table_name='reviews')
    
    # Удаление внешнего ключа
    op.drop_constraint('fk_reviews_waiter_id', 'reviews', type_='foreignkey')
    
    # Удаление колонок
    op.drop_column('reviews', 'waiter_id')
    op.drop_column('reviews', 'dish_rating')
    op.drop_column('reviews', 'service_rating')
    op.drop_column('reviews', 'order_rating')
    op.drop_column('reviews', 'review_type') 