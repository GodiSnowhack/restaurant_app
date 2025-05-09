from sqlalchemy import Column, String
from alembic import op
import sqlalchemy as sa

def upgrade():
    # Добавляем новые колонки в таблицу orders
    op.add_column('orders', Column('customer_gender', String, nullable=True))
    op.add_column('orders', Column('customer_age_group', String, nullable=True))

def downgrade():
    # Удаляем колонки при откате миграции
    op.drop_column('orders', 'customer_gender')
    op.drop_column('orders', 'customer_age_group') 