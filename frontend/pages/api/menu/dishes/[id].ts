import { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';
import { getSecureApiUrl } from '../../../../lib/utils/api';
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
  res.setHeader('Access-Control-Allow-Methods', 'GET,PUT,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  // Обработка предварительных запросов CORS
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET' && req.method !== 'PUT') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { id } = req.query;
  
  if (!id || Array.isArray(id)) {
    return res.status(400).json({ message: 'Invalid dish ID' });
  }

  const dishId = parseInt(id, 10);
  
  if (isNaN(dishId)) {
    return res.status(400).json({ message: 'Invalid dish ID format' });
  }

  // Обработка GET запроса
  if (req.method === 'GET') {
    try {
      // Пробуем получить блюдо с бэкенда
      const url = `${getSecureApiUrl()}/menu/dishes/${dishId}`;
      console.log(`Запрос блюда с ID ${dishId} из API: ${url}`);
      
      const response = await axios.get(url, {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        maxRedirects: 0,
        validateStatus: function (status) {
          return status < 400;
        },
        timeout: 5000
      });

      if (response.data) {
        // Если успешно получили данные, обновляем кэш
        updateDishInCache(dishId, response.data);
        return res.status(200).json(response.data);
      } else {
        throw new Error('Получены некорректные данные от API');
      }
    } catch (error: any) {
      console.error(`Ошибка при получении блюда с ID ${dishId} из API:`, error.message);
      
      // В случае ошибки пробуем получить блюдо из кэша
      const cachedDishes = getCachedDishes();
      
      if (cachedDishes) {
        const cachedDish = cachedDishes.find((dish: any) => dish.id === dishId);
        if (cachedDish) {
          console.log(`Возвращаем блюдо с ID ${dishId} из кэша`);
          return res.status(200).json(cachedDish);
        }
      }
      
      // Если блюда нет в кэше, возвращаем 404
      return res.status(404).json({ message: 'Блюдо не найдено' });
    }
  }

  // Обработка PUT запроса (обновление блюда)
  if (req.method === 'PUT') {
    console.log(`[API] Получен запрос на обновление блюда ID ${dishId}`);
    
    // Проверяем тело запроса
    if (!req.body) {
      return res.status(400).json({ message: 'Missing request body' });
    }

    // Фильтруем данные для безопасности
    const dishData = filterObject(req.body, allowedDishFields);

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
          maxRedirects: 0,
          validateStatus: function (status) {
            return status < 400;
          },
          timeout: 5000
        });

        // Обновляем кэш
        updateDishInCache(dishId, response.data);
        
        return res.status(200).json(response.data);
      } catch (error) {
        console.error(`Ошибка при обновлении блюда в API:`, error);
        
        // Если не удалось обновить на бэкенде, обновляем только локальный кэш
        // Сначала проверяем, есть ли блюдо в кэше или заглушках
        let existingDish = null;
        const cachedDishes = getCachedDishes();
        
        if (cachedDishes) {
          existingDish = cachedDishes.find((dish: any) => dish.id === dishId);
        }
        
        if (!existingDish) {
          return res.status(404).json({ message: 'Блюдо не найдено' });
        }
        
        // Обновляем данные блюда
        const updatedDish = { ...existingDish, ...dishData, id: dishId };
        
        // Обновляем кэш
        updateDishInCache(dishId, updatedDish);
        
        console.log(`Блюдо с ID ${dishId} обновлено локально`);
        return res.status(200).json(updatedDish);
      }
    } catch (error: any) {
      console.error(`Серверная ошибка при обновлении блюда с ID ${dishId}:`, error.message);
      return res.status(500).json({ message: 'Internal server error' });
    }
  }
} 