-- Добавляем поле created_at в таблицу order_dish
ALTER TABLE order_dish ADD COLUMN created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP; 