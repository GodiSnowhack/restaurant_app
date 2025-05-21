import { Database } from 'sqlite3';
import { open, Database as SQLiteDatabase } from 'sqlite';
import path from 'path';
import fs from 'fs';

// Путь к файлу базы данных SQLite
const dbPath = process.env.DB_PATH || path.resolve(process.cwd(), '../data/restaurant_db.sqlite');

console.log('SQLite DB Path:', dbPath);

// Подключение к базе данных
let db: SQLiteDatabase | null = null;

/**
 * Создает основные таблицы в базе данных, если они отсутствуют
 * @param db Экземпляр соединения с БД
 */
async function createSchema(db: SQLiteDatabase) {
  console.log('Проверка и создание схемы базы данных...');
  
  // Проверяем наличие таблиц в базе
  const tablesExist = await db.get(`
    SELECT name FROM sqlite_master 
    WHERE type='table' AND name='menu_items'
  `);
  
  if (tablesExist) {
    console.log('Схема базы данных уже существует');
    return;
  }
  
  console.log('Создание таблиц...');
  
  try {
    // Выполняем все запросы на создание таблиц в рамках транзакции
    await db.exec('BEGIN TRANSACTION');
    
    // Таблица категорий меню
    await db.exec(`
      CREATE TABLE IF NOT EXISTS menu_categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Таблица позиций меню
    await db.exec(`
      CREATE TABLE IF NOT EXISTS menu_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        description TEXT,
        price REAL NOT NULL,
        cost_price REAL NOT NULL,
        category_id INTEGER NOT NULL,
        image_url TEXT,
        available BOOLEAN DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (category_id) REFERENCES menu_categories(id)
      )
    `);
    
    // Таблица пользователей
    await db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        full_name TEXT NOT NULL,
        role TEXT NOT NULL CHECK(role IN ('admin', 'waiter', 'client')),
        phone TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Таблица столиков
    await db.exec(`
      CREATE TABLE IF NOT EXISTS tables (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        number INTEGER NOT NULL UNIQUE,
        capacity INTEGER NOT NULL,
        status TEXT NOT NULL DEFAULT 'free' CHECK(status IN ('free', 'occupied', 'reserved')),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Таблица заказов
    await db.exec(`
      CREATE TABLE IF NOT EXISTS orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        customer_id INTEGER,
        waiter_id INTEGER,
        table_id INTEGER,
        status TEXT NOT NULL CHECK(status IN ('pending', 'in_progress', 'completed', 'cancelled', 'rejected')),
        total_price REAL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        completed_at TIMESTAMP,
        FOREIGN KEY (customer_id) REFERENCES users(id),
        FOREIGN KEY (waiter_id) REFERENCES users(id),
        FOREIGN KEY (table_id) REFERENCES tables(id)
      )
    `);
    
    // Таблица позиций заказа
    await db.exec(`
      CREATE TABLE IF NOT EXISTS order_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER NOT NULL,
        menu_item_id INTEGER NOT NULL,
        quantity INTEGER NOT NULL DEFAULT 1,
        price REAL NOT NULL,
        cost_price REAL NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'cooking', 'ready', 'served', 'cancelled')),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (order_id) REFERENCES orders(id),
        FOREIGN KEY (menu_item_id) REFERENCES menu_items(id)
      )
    `);
    
    // Таблица отзывов
    await db.exec(`
      CREATE TABLE IF NOT EXISTS reviews (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        order_id INTEGER NOT NULL,
        rating INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5),
        comment TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (order_id) REFERENCES orders(id)
      )
    `);
    
    // Заполняем минимальными демо-данными
    // Категории меню
    await db.exec(`
      INSERT INTO menu_categories (name, description) VALUES
      ('Закуски', 'Легкие закуски перед основным блюдом'),
      ('Супы', 'Разнообразные супы'),
      ('Салаты', 'Свежие и здоровые салаты'),
      ('Основные блюда', 'Мясные и рыбные блюда'),
      ('Десерты', 'Сладкие десерты и выпечка'),
      ('Напитки', 'Безалкогольные напитки');
    `);
    
    // Позиции меню
    await db.exec(`
      INSERT INTO menu_items (name, description, price, cost_price, category_id, available) VALUES
      ('Цезарь с курицей', 'Классический салат Цезарь с куриным филе', 450, 180, 3, 1),
      ('Борщ', 'Традиционный борщ со сметаной', 350, 120, 2, 1),
      ('Стейк Рибай', 'Сочный стейк из мраморной говядины', 1200, 600, 4, 1),
      ('Картофель фри', 'Хрустящий картофель с соусом', 220, 80, 1, 1),
      ('Тирамису', 'Итальянский десерт с маскарпоне', 380, 150, 5, 1),
      ('Латте', 'Кофейный напиток с молоком', 200, 70, 6, 1),
      ('Греческий салат', 'Салат с сыром фета и оливками', 420, 160, 3, 1),
      ('Суп-пюре грибной', 'Нежный крем-суп из шампиньонов', 380, 130, 2, 1),
      ('Паста Карбонара', 'Итальянская паста с беконом', 520, 200, 4, 1),
      ('Чизкейк', 'Нью-Йоркский чизкейк с ягодным соусом', 350, 140, 5, 1);
    `);
    
    // Пользователи с разными ролями
    await db.exec(`
      INSERT INTO users (email, password, full_name, role, phone) VALUES
      ('admin@example.com', 'password123', 'Администратор', 'admin', '+7 (901) 123-45-67'),
      ('waiter1@example.com', 'password123', 'Официант Петров', 'waiter', '+7 (903) 123-45-67'),
      ('waiter2@example.com', 'password123', 'Официант Сидоров', 'waiter', '+7 (904) 123-45-67'),
      ('customer1@example.com', 'password123', 'Клиент Алексеев', 'client', '+7 (905) 123-45-67'),
      ('customer2@example.com', 'password123', 'Клиент Сергеев', 'client', '+7 (906) 123-45-67');
    `);
    
    // Добавляем столики
    await db.exec(`
      INSERT INTO tables (number, capacity, status) VALUES
      (1, 2, 'free'),
      (2, 4, 'free'),
      (3, 6, 'free'),
      (4, 2, 'free'),
      (5, 4, 'free');
    `);
    
    // Создаем несколько заказов с разным статусом
    await db.exec(`
      INSERT INTO orders (customer_id, waiter_id, table_id, status, created_at, updated_at, completed_at) VALUES
      (5, 3, 1, 'completed', datetime('now', '-10 day'), datetime('now', '-10 day'), datetime('now', '-10 day')),
      (6, 4, 2, 'completed', datetime('now', '-8 day'), datetime('now', '-8 day'), datetime('now', '-8 day')),
      (5, 3, 3, 'completed', datetime('now', '-5 day'), datetime('now', '-5 day'), datetime('now', '-5 day')),
      (6, 4, 4, 'completed', datetime('now', '-3 day'), datetime('now', '-3 day'), datetime('now', '-3 day')),
      (5, 3, 5, 'completed', datetime('now', '-1 day'), datetime('now', '-1 day'), datetime('now', '-1 day')),
      (6, 4, 1, 'in_progress', datetime('now'), datetime('now'), NULL);
    `);
    
    // Добавляем позиции в заказы
    await db.exec(`
      INSERT INTO order_items (order_id, menu_item_id, quantity, price, cost_price, status) VALUES
      (1, 1, 1, 450, 180, 'served'),
      (1, 2, 1, 350, 120, 'served'),
      (1, 6, 2, 200, 70, 'served'),
      (2, 3, 1, 1200, 600, 'served'),
      (2, 4, 1, 220, 80, 'served'),
      (2, 5, 1, 380, 150, 'served'),
      (3, 7, 1, 420, 160, 'served'),
      (3, 8, 1, 380, 130, 'served'),
      (4, 9, 1, 520, 200, 'served'),
      (4, 10, 1, 350, 140, 'served'),
      (5, 1, 1, 450, 180, 'served'),
      (5, 3, 1, 1200, 600, 'served'),
      (6, 7, 1, 420, 160, 'cooking'),
      (6, 6, 2, 200, 70, 'pending');
    `);
    
    // Добавляем отзывы
    await db.exec(`
      INSERT INTO reviews (user_id, order_id, rating, comment) VALUES
      (5, 1, 5, 'Отличное обслуживание и вкусная еда!'),
      (6, 2, 4, 'Хорошее место, но долго ждали заказ'),
      (5, 3, 5, 'Все было превосходно'),
      (6, 4, 3, 'Неплохо, но есть куда расти');
    `);
    
    // Завершаем транзакцию
    await db.exec('COMMIT');
    console.log('Схема базы данных успешно создана и заполнена демо-данными');
  } catch (error) {
    console.error('Ошибка при создании схемы базы данных:', error);
    await db.exec('ROLLBACK');
    throw error;
  }
}

/**
 * Инициализирует соединение с базой данных SQLite
 */
export async function initDB() {
  try {
    if (db) {
      console.log('Соединение с базой данных уже инициализировано');
      return db;
    }
    
    console.log('Создание соединения с SQLite БД...');
    // Проверяем, существует ли файл базы данных
    const dbExists = fs.existsSync(dbPath);
    
    db = await open({
      filename: dbPath,
      driver: Database
    });
    
    // Проверяем соединение
    try {
      console.log('Проверка соединения с БД...');
      await db.get('SELECT 1');
      console.log('Соединение с базой данных успешно установлено');
      
      // Если файл БД новый, создаем схему
      if (!dbExists) {
        console.log('Файл базы данных не существовал, создаем схему...');
        await createSchema(db);
      } else {
        // Проверяем наличие основных таблиц
        try {
          const tablesExist = await db.get(`
            SELECT name FROM sqlite_master 
            WHERE type='table' AND name='menu_items'
          `);
          
          if (!tablesExist) {
            console.log('База данных существует, но не содержит необходимых таблиц. Создаем схему...');
            await createSchema(db);
          }
        } catch (error) {
          console.error('Ошибка при проверке схемы базы данных:', error);
          await createSchema(db);
        }
      }
      
      return db;
    } catch (error) {
      console.error('Ошибка при проверке соединения с БД:', error);
      db = null;
      throw error;
    }
  } catch (error) {
    console.error('Ошибка создания соединения с БД:', error);
    db = null;
    throw error;
  }
}

// Инициализируем соединение при импорте модуля
try {
  initDB().catch(error => {
    console.error('Не удалось инициализировать соединение с БД при запуске:', error);
  });
} catch (error) {
  console.error('Исключение при инициализации соединения с БД:', error);
}

/**
 * Выполняет SQL запрос к базе данных
 * @param sql SQL запрос
 * @param params Параметры запроса
 * @returns Результат запроса
 */
export async function query<T = any>(sql: string, params: any[] = []): Promise<T> {
  try {
    // Проверяем соединение с базой данных
    if (!db) {
      await initDB();
    }
    
    if (!db) {
      throw new Error('Не удалось установить соединение с базой данных');
    }
    
    // Выполняем запрос
    const result = await db.all(sql, params);
    return result as T;
  } catch (error) {
    console.error('Ошибка при выполнении запроса:', error);
    throw error;
  }
}

/**
 * Выполняет транзакцию из нескольких SQL запросов
 * @param callback Функция, содержащая набор запросов для выполнения в транзакции
 * @returns Promise с результатом транзакции
 */
export async function transaction(callback: (connection: SQLiteDatabase) => Promise<any>) {
  try {
    // Инициализация соединения, если оно еще не создано
    if (!db) {
      try {
        await initDB();
      } catch (error) {
        console.error('Не удалось инициализировать соединение с БД для транзакции:', error);
        throw error;
      }
    }
    
    if (!db) {
      console.error('Соединение с базой данных не инициализировано');
      throw new Error('Соединение с базой данных не установлено');
    }

    try {
      await db.exec('BEGIN TRANSACTION');
      const result = await callback(db);
      await db.exec('COMMIT');
      return result;
    } catch (error) {
      try {
        await db.exec('ROLLBACK');
      } catch (rollbackError) {
        console.error('Ошибка при откате транзакции:', rollbackError);
      }
      console.error('Ошибка транзакции:', error);
      throw error;
    }
  } catch (error) {
    console.error('Ошибка в транзакции:', error);
    throw error;
  }
}

/**
 * Проверяет соединение с базой данных
 * @returns Promise<boolean> - true если соединение активно
 */
export async function checkConnection(): Promise<boolean> {
  try {
    // Если соединения нет, пытаемся создать
    if (!db) {
      try {
        await initDB();
      } catch (error) {
        console.error('Не удалось инициализировать соединение с БД при проверке:', error);
        return false;
      }
    }
    
    if (!db) return false;
    
    // Выполняем простой запрос с таймаутом
    await Promise.race([
      db.get('SELECT 1'),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Таймаут проверки соединения с БД')), 5000)
      )
    ]);
    
    console.log('Проверка соединения с БД успешна');
    return true;
  } catch (error) {
    console.error('Ошибка проверки соединения с БД:', error);
    // Для некоторых типов ошибок можно попробовать переинициализировать соединение
    if (error instanceof Error && 
        (error.message.includes('database is locked') || 
         error.message.includes('no such table'))) {
      console.log('Попытка переинициализации соединения с БД...');
      db = null;
      // Не пытаемся здесь переинициализировать, просто возвращаем false
    }
    return false;
  }
}

/**
 * Закрывает соединение с базой данных
 */
export async function closeDB() {
  if (db) {
    try {
      await db.close();
      db = null;
      console.log('Соединение с базой данных закрыто');
    } catch (error) {
      console.error('Ошибка при закрытии соединения с базой данных:', error);
    }
  }
} 