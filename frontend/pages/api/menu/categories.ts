import { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { query, initDB } from '../../../lib/db';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://backend-production-1a78.up.railway.app/api/v1';
const CACHE_FILE_PATH = path.join(process.cwd(), 'data', 'categories_cache.json');
const CACHE_DURATION = 3600000; // 1 час в миллисекундах

// Получение категорий непосредственно из БД
const getCategoriesFromDB = async () => {
  try {
    console.log('Попытка получить категории напрямую из БД...');
    
    // Убедимся, что соединение с БД инициализировано
    await initDB();
    
    // Запрос категорий из БД
    const sql = `
      SELECT 
        id, 
        name, 
        description, 
        created_at, 
        updated_at,
        '' as image_url,
        0 as position
      FROM categories
      ORDER BY id
    `;
    
    const categories = await query(sql);
    
    if (!categories || !Array.isArray(categories)) {
      console.error('Ошибка: результат запроса к БД не является массивом:', categories);
      return [];
    }
    
    console.log(`Получено ${categories.length} категорий из БД`);
    
    // Преобразуем данные в нужный формат
    return categories.map((category, index) => ({
      id: category.id,
      name: category.name,
      description: category.description || '',
      image_url: category.image_url || `/images/categories/default${(index % 5) + 1}.jpg`,
      position: index + 1,
      created_at: category.created_at,
      updated_at: category.updated_at
    }));
  } catch (error) {
    console.error('Ошибка при получении категорий из БД:', error);
    return [];
  }
};

// Убедимся, что директория существует
const ensureDirectoryExists = (filePath: string) => {
  const dirname = path.dirname(filePath);
  if (fs.existsSync(dirname)) {
    return true;
  }
  fs.mkdirSync(dirname, { recursive: true });
  return true;
};

// Чтение кэша из файла
const getCachedData = () => {
  try {
    ensureDirectoryExists(CACHE_FILE_PATH);
    
    if (!fs.existsSync(CACHE_FILE_PATH)) {
      return null;
    }
    
    const fileContent = fs.readFileSync(CACHE_FILE_PATH, 'utf8');
    const data = JSON.parse(fileContent);
    
    // Проверяем, не истек ли срок кэша
    if (Date.now() - data.timestamp > CACHE_DURATION) {
      return null;
    }
    
    return data.categories;
  } catch (error) {
    console.error('Ошибка при чтении кэша категорий:', error);
    return null;
  }
};

// Сохранение данных в кэш
const saveToCache = (categories: any) => {
  try {
    ensureDirectoryExists(CACHE_FILE_PATH);
    
    const cacheData = {
      categories,
      timestamp: Date.now()
    };
    
    fs.writeFileSync(CACHE_FILE_PATH, JSON.stringify(cacheData, null, 2), 'utf8');
  } catch (error) {
    console.error('Ошибка при сохранении кэша категорий:', error);
  }
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Настройка CORS заголовков - разрешаем любому источнику
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST,PUT,DELETE');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  // Обработка предварительных запросов CORS
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  // Сначала пробуем получить данные из локальной БД
  console.log('Пытаемся получить категории из локальной БД');
  const dbCategories = await getCategoriesFromDB();
  
  if (dbCategories && dbCategories.length > 0) {
    console.log(`Получено ${dbCategories.length} категорий из локальной БД, возвращаем их`);
    saveToCache(dbCategories);
    return res.status(200).json(dbCategories);
  }

  // Если в БД нет данных, проверяем наличие данных в кэше
  const cachedCategories = getCachedData();
  if (cachedCategories) {
    console.log('Возвращаем категории из кэша');
    return res.status(200).json(cachedCategories);
  }

  // Как последний вариант, пытаемся получить данные с удаленного API
  try {
    // Получаем токен из заголовков запроса
    const token = req.headers.authorization;

    // Настраиваем заголовки для запроса к бэкенду
    const headers: Record<string, string> = {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'Origin': 'https://frontend-production-8eb6.up.railway.app'
    };

    if (token) {
      headers['Authorization'] = token;
    }

    console.log('Пытаемся получить категории с удаленного API:', API_BASE_URL);
    
    // Делаем запрос к бэкенду с отключенными редиректами
    const response = await axios.get(`${API_BASE_URL}/menu/categories`, { 
      headers,
      maxRedirects: 0,
      validateStatus: function (status) {
        return status < 400; // Принимаем только успешные статусы
      },
      timeout: 10000 // 10 секунд таймаут
    });

    // Сохраняем результат в кэш
    saveToCache(response.data);

    // Возвращаем данные клиенту
    return res.status(200).json(response.data);
  } catch (error: any) {
    console.error('Error fetching categories from remote API:', error.message);
    
    // Если нет данных ни в БД, ни в кэше, ни на удаленном API, возвращаем ошибку
    return res.status(500).json({ 
      error: 'Не удалось получить категории ни из одного источника',
      message: error.message
    });
  }
} 