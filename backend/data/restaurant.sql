BEGIN TRANSACTION;
CREATE TABLE IF NOT EXISTS "users" (
	"id"	INTEGER NOT NULL,
	"email"	VARCHAR NOT NULL,
	"phone"	VARCHAR,
	"hashed_password"	VARCHAR NOT NULL,
	"full_name"	VARCHAR,
	"is_active"	BOOLEAN,
	"role"	VARCHAR,
	"birthday"	DATE,
	"age_group"	VARCHAR(8),
	"created_at"	DATETIME,
	"updated_at"	DATETIME,
	PRIMARY KEY("id")
);
CREATE TABLE IF NOT EXISTS "categories" (
	"id"	INTEGER NOT NULL,
	"name"	VARCHAR NOT NULL,
	"description"	VARCHAR,
	"created_at"	DATETIME,
	"updated_at"	DATETIME,
	PRIMARY KEY("id")
);
CREATE TABLE IF NOT EXISTS "allergens" (
	"id"	INTEGER NOT NULL,
	"name"	VARCHAR NOT NULL,
	"description"	VARCHAR,
	PRIMARY KEY("id")
);
CREATE TABLE IF NOT EXISTS "tags" (
	"id"	INTEGER NOT NULL,
	"name"	VARCHAR NOT NULL,
	PRIMARY KEY("id")
);
CREATE TABLE IF NOT EXISTS "settings" (
	"id"	INTEGER NOT NULL,
	"restaurant_name"	VARCHAR(255) NOT NULL,
	"email"	VARCHAR(255) NOT NULL,
	"phone"	VARCHAR(50) NOT NULL,
	"address"	VARCHAR(255) NOT NULL,
	"website"	VARCHAR(255),
	"working_hours"	JSON,
	"tables"	JSON,
	"currency"	VARCHAR(10) NOT NULL,
	"currency_symbol"	VARCHAR(10) NOT NULL,
	"tax_percentage"	INTEGER NOT NULL,
	"min_order_amount"	INTEGER NOT NULL,
	"delivery_fee"	INTEGER NOT NULL,
	"free_delivery_threshold"	INTEGER NOT NULL,
	"table_reservation_enabled"	BOOLEAN NOT NULL,
	"delivery_enabled"	BOOLEAN NOT NULL,
	"pickup_enabled"	BOOLEAN NOT NULL,
	"smtp_host"	VARCHAR(255),
	"smtp_port"	INTEGER,
	"smtp_user"	VARCHAR(255),
	"smtp_password"	VARCHAR(255),
	"smtp_from_email"	VARCHAR(255),
	"smtp_from_name"	VARCHAR(255),
	"sms_api_key"	VARCHAR(255),
	"sms_sender"	VARCHAR(255),
	"privacy_policy"	TEXT,
	"terms_of_service"	TEXT,
	PRIMARY KEY("id")
);
CREATE TABLE IF NOT EXISTS "dishes" (
	"id"	INTEGER NOT NULL,
	"name"	VARCHAR NOT NULL,
	"description"	VARCHAR,
	"price"	FLOAT NOT NULL,
	"cost_price"	FLOAT,
	"image_url"	VARCHAR,
	"calories"	INTEGER,
	"cooking_time"	INTEGER,
	"is_vegetarian"	BOOLEAN,
	"is_vegan"	BOOLEAN,
	"is_available"	BOOLEAN,
	"category_id"	INTEGER,
	"created_at"	DATETIME,
	"updated_at"	DATETIME,
	FOREIGN KEY("category_id") REFERENCES "categories"("id") ON DELETE SET NULL,
	PRIMARY KEY("id")
);
CREATE TABLE IF NOT EXISTS "reservations" (
	"id"	INTEGER NOT NULL,
	"user_id"	INTEGER,
	"table_number"	INTEGER,
	"guests_count"	INTEGER NOT NULL,
	"reservation_time"	DATETIME NOT NULL,
	"status"	VARCHAR,
	"guest_name"	VARCHAR,
	"guest_phone"	VARCHAR,
	"comment"	VARCHAR,
	"reservation_code"	VARCHAR,
	"created_at"	DATETIME,
	"updated_at"	DATETIME,
	FOREIGN KEY("user_id") REFERENCES "users"("id"),
	PRIMARY KEY("id"),
	UNIQUE("reservation_code")
);
CREATE TABLE IF NOT EXISTS "dish_allergen" (
	"dish_id"	INTEGER,
	"allergen_id"	INTEGER,
	FOREIGN KEY("dish_id") REFERENCES "dishes"("id") ON DELETE CASCADE,
	FOREIGN KEY("allergen_id") REFERENCES "allergens"("id") ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS "dish_tag" (
	"dish_id"	INTEGER,
	"tag_id"	INTEGER,
	FOREIGN KEY("dish_id") REFERENCES "dishes"("id") ON DELETE CASCADE,
	FOREIGN KEY("tag_id") REFERENCES "tags"("id") ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS "order_dish" (
	"id"	INTEGER NOT NULL,
	"order_id"	INTEGER NOT NULL,
	"dish_id"	INTEGER NOT NULL,
	"quantity"	INTEGER,
	"special_instructions"	TEXT,
	"price"	FLOAT NOT NULL,
	PRIMARY KEY("id"),
	FOREIGN KEY("dish_id") REFERENCES "dishes"("id") ON DELETE CASCADE,
	FOREIGN KEY("order_id") REFERENCES "orders"("id") ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS "reviews" (
	"id"	INTEGER,
	"user_id"	INTEGER NOT NULL,
	"order_id"	INTEGER NOT NULL,
	"service_rating"	INTEGER NOT NULL,
	"food_rating"	INTEGER,
	"comment"	TEXT,
	"created_at"	TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
	PRIMARY KEY("id"),
	FOREIGN KEY("user_id") REFERENCES "users"("id"),
	FOREIGN KEY("order_id") REFERENCES "orders"("id")
);
CREATE TABLE IF NOT EXISTS "orders" (
	"id"	INTEGER NOT NULL,
	"user_id"	INTEGER,
	"waiter_id"	INTEGER,
	"table_number"	INTEGER,
	"payment_method"	VARCHAR(6),
	"customer_name"	VARCHAR,
	"customer_phone"	VARCHAR,
	"reservation_code"	VARCHAR,
	"order_code"	VARCHAR,
	"status"	VARCHAR(9),
	"payment_status"	VARCHAR(8),
	"total_amount"	FLOAT,
	"comment"	TEXT,
	"is_urgent"	BOOLEAN,
	"is_group_order"	BOOLEAN,
	"customer_age_group"	VARCHAR,
	"created_at"	DATETIME NOT NULL DEFAULT (CURRENT_TIMESTAMP),
	"updated_at"	DATETIME,
	"completed_at"	DATETIME,
	PRIMARY KEY("id"),
	FOREIGN KEY("waiter_id") REFERENCES "users"("id"),
	FOREIGN KEY("user_id") REFERENCES "users"("id")
);
CREATE INDEX IF NOT EXISTS "ix_users_id" ON "users" (
	"id"
);
CREATE INDEX IF NOT EXISTS "ix_users_full_name" ON "users" (
	"full_name"
);
CREATE UNIQUE INDEX IF NOT EXISTS "ix_users_email" ON "users" (
	"email"
);
CREATE UNIQUE INDEX IF NOT EXISTS "ix_users_phone" ON "users" (
	"phone"
);
CREATE INDEX IF NOT EXISTS "ix_categories_name" ON "categories" (
	"name"
);
CREATE INDEX IF NOT EXISTS "ix_categories_id" ON "categories" (
	"id"
);
CREATE UNIQUE INDEX IF NOT EXISTS "ix_allergens_name" ON "allergens" (
	"name"
);
CREATE INDEX IF NOT EXISTS "ix_allergens_id" ON "allergens" (
	"id"
);
CREATE UNIQUE INDEX IF NOT EXISTS "ix_tags_name" ON "tags" (
	"name"
);
CREATE INDEX IF NOT EXISTS "ix_tags_id" ON "tags" (
	"id"
);
CREATE INDEX IF NOT EXISTS "ix_settings_id" ON "settings" (
	"id"
);
CREATE INDEX IF NOT EXISTS "ix_dishes_id" ON "dishes" (
	"id"
);
CREATE INDEX IF NOT EXISTS "ix_dishes_name" ON "dishes" (
	"name"
);
CREATE INDEX IF NOT EXISTS "ix_reservations_id" ON "reservations" (
	"id"
);
CREATE INDEX IF NOT EXISTS "ix_order_dish_id" ON "order_dish" (
	"id"
);
CREATE INDEX IF NOT EXISTS "ix_orders_id" ON "orders" (
	"id"
);
COMMIT;
