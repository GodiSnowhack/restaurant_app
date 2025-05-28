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

// Обновление блюда в кэше
const updateDishInCache = (id: number, updatedDish: any) => {
  try {
    const dishes = getCachedDishes();
    if (!dishes) return;
    
    const index = dishes.findIndex((dish: any) => dish.id === id);
    if (index >= 0) {
      dishes[index] = { ...dishes[index], ...updatedDish, id };
      saveDishesToCache(dishes);
      console.log(`Блюдо с ID ${id} обновлено в кэше`);
    }
  } catch (error) {
    console.error('Ошибка при обновлении блюда в кэше:', error);
  }
};

// Список разрешенных полей для редактирования блюда
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
  res.setHeader('Access-Control-Allow-Methods', 'POST,PUT,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  // Обработка предварительных запросов CORS
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Принимаем только POST и PUT запросы
  if (req.method !== 'POST' && req.method !== 'PUT') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  // Проверка тела запроса
  if (!req.body) {
    return res.status(400).json({ message: 'Missing request body' });
  }

  const { id } = req.body;
  
  if (!id || isNaN(Number(id))) {
    return res.status(400).json({ message: 'Invalid dish ID' });
  }

  const dishId = Number(id);
  
  // Фильтруем данные для безопасности
  const dishData = filterObject(req.body, allowedDishFields);

  console.log(`[API] Обновление блюда ID ${dishId}:`, dishData);

  try {
    // Пытаемся отправить запрос на бэкенд
    const url = `${getSecureApiUrl()}/menu/dishes/${dishId}`;
    console.log(`Отправка запроса на обновление блюда в API: ${url}`);
    
    try {
      const response = await axios.put(url, dishData, {
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

      // Обновляем кэш
      updateDishInCache(dishId, response.data);
      
      return res.status(200).json(response.data);
    } catch (error: any) {
      console.error(`Ошибка при обновлении блюда в API:`, error);
      
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
      
      // Если не удалось обновить на бэкенде, пробуем обновить только локальный кэш
      // Сначала проверяем, есть ли блюдо в кэше
      let existingDish = null;
      const cachedDishes = getCachedDishes();
      
      if (cachedDishes) {
        existingDish = cachedDishes.find((dish: any) => dish.id === dishId);
      }
      
      if (!existingDish) {
        return res.status(404).json({ 
          message: 'Блюдо не найдено',
          error: error.message,
          details: error.response?.data || 'Нет данных о деталях ошибки'
        });
      }
      
      // Обновляем блюдо в кэше
      const updatedDish = { ...existingDish, ...dishData, id: dishId };
      updateDishInCache(dishId, updatedDish);
      
      return res.status(200).json(updatedDish);
    }
  } catch (error: any) {
    console.error('Ошибка при обработке запроса на обновление блюда:', error);
    return res.status(500).json({ 
      message: 'Внутренняя ошибка сервера',
      error: error.message
    });
  }
} 