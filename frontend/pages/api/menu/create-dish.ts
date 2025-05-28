import { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';
import { getSecureApiUrl } from '../../../lib/utils/api';
import fs from 'fs';
import path from 'path';

const CACHE_FILE_PATH = path.join(process.cwd(), 'data', 'dishes_cache.json');

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
const getCachedDishes = () => {
  try {
    ensureDirectoryExists(CACHE_FILE_PATH);
    
    if (!fs.existsSync(CACHE_FILE_PATH)) {
      return null;
    }
    
    const fileContent = fs.readFileSync(CACHE_FILE_PATH, 'utf8');
    const data = JSON.parse(fileContent);
    
    return data.dishes;
  } catch (error) {
    console.error('Ошибка при чтении кэша блюд:', error);
    return null;
  }
};

// Сохранение блюд в кэш
const saveDishesToCache = (dishes: any[]) => {
  try {
    ensureDirectoryExists(CACHE_FILE_PATH);
    
    const cacheData = {
      dishes,
      timestamp: Date.now()
    };
    
    fs.writeFileSync(CACHE_FILE_PATH, JSON.stringify(cacheData, null, 2), 'utf8');
    console.log('Блюда успешно сохранены в кэш');
  } catch (error) {
    console.error('Ошибка при сохранении кэша блюд:', error);
  }
};

// Добавление блюда в кэш
const addDishToCache = (newDish: any) => {
  try {
    const dishes = getCachedDishes() || [];
    dishes.push(newDish);
    saveDishesToCache(dishes);
    console.log(`Блюдо с ID ${newDish.id} добавлено в кэш`);
  } catch (error) {
    console.error('Ошибка при добавлении блюда в кэш:', error);
  }
};

// Функция для генерации уникального ID для нового блюда
const generateUniqueId = (existingDishes: any[] = []): number => {
  if (!existingDishes.length) return 1;
  const maxId = Math.max(...existingDishes.map(dish => dish.id));
  return maxId + 1;
};

// Список разрешенных полей для создания блюда
const allowedDishFields = [
  'name', 'description', 'price', 'category_id', 'image_url', 
  'is_available', 'calories', 'weight', 'position', 'is_vegetarian', 
  'is_vegan', 'is_spicy', 'cooking_time', 'cost_price', 'ingredients',
  'allergens', 'tags'
];

// Функция для фильтрации полей объекта
const filterObject = (obj: any, allowedFields: string[]) => {
  const filteredObj: any = {};
  
  for (const field of allowedFields) {
    if (field in obj) {
      filteredObj[field] = obj[field];
    }
  }
  
  return filteredObj;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Настройка CORS заголовков
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  // Обработка предварительных запросов CORS
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Принимаем только POST запросы
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  // Проверка тела запроса
  if (!req.body) {
    return res.status(400).json({ message: 'Missing request body' });
  }

  // Фильтруем данные для безопасности
  const dishData = filterObject(req.body, allowedDishFields);

  console.log(`[API] Создание нового блюда:`, dishData);

  try {
    // Отправляем запрос на бэкенд
    const url = `${getSecureApiUrl()}/menu/dishes`;
    console.log(`Отправка запроса на создание блюда в API: ${url}`);
    
    const response = await axios.post(url, dishData, {
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...(req.headers.authorization ? { 'Authorization': req.headers.authorization } : {})
      },
      maxRedirects: 5,
      validateStatus: function (status) {
        return status < 400;
      },
      timeout: 10000
    });

    // Получили ответ от бэкенда с созданным блюдом
    const newDish = response.data;

    // Добавляем блюдо в кэш
    addDishToCache(newDish);
    
    return res.status(201).json(newDish);
  } catch (error: any) {
    console.error('Ошибка при создании блюда:', error.message);
    
    // Детали ошибки для диагностики
    if (error.response) {
      console.error('Детали ошибки API:');
      console.error('Статус:', error.response.status);
      console.error('Данные:', error.response.data);
      console.error('Заголовки:', error.response.headers);
    } else if (error.request) {
      console.error('Запрос был отправлен, но ответ не получен:');
      console.error(error.request);
    } else {
      console.error('Ошибка настройки запроса:', error.message);
    }
    
    // Вместо создания локального блюда, возвращаем ошибку для диагностики
    return res.status(error.response?.status || 500).json({ 
      message: 'Не удалось создать блюдо',
      error: error.message,
      details: error.response?.data || 'Нет деталей ошибки'
    });
  }
} 