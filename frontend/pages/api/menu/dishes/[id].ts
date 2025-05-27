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

// Данные-заглушки для блюд
const FALLBACK_DISHES = [
  { 
    id: 1, 
    name: "Бургер Классический", 
    description: "Сочная говяжья котлета, свежие овощи, фирменный соус", 
    price: 2500, 
    category_id: 1,
    image_url: "/images/dishes/burger.jpg",
    is_available: true,
    is_vegetarian: false,
    ingredients: "Булочка, говядина, салат, помидор, соус",
    calories: 850,
    weight: 350,
    cooking_time: 15,
    allergens: ["Глютен", "Молоко"]
  },
  { 
    id: 2, 
    name: "Цезарь с курицей", 
    description: "Классический салат с куриным филе, сыром пармезан и гренками", 
    price: 2200, 
    category_id: 3,
    image_url: "/images/dishes/caesar.jpg",
    is_available: true,
    is_vegetarian: false,
    ingredients: "Салат романо, куриное филе, гренки, пармезан, соус цезарь",
    calories: 550,
    weight: 250,
    cooking_time: 10,
    allergens: ["Глютен", "Молоко", "Яйца"]
  },
  { 
    id: 3, 
    name: "Борщ", 
    description: "Традиционный борщ со сметаной и зеленью", 
    price: 1800, 
    category_id: 2,
    image_url: "/images/dishes/borsch.jpg",
    is_available: true,
    is_vegetarian: false,
    ingredients: "Свекла, капуста, морковь, картофель, говядина, зелень",
    calories: 450,
    weight: 400,
    cooking_time: 20,
    allergens: ["Молоко"]
  },
  { 
    id: 4, 
    name: "Тирамису", 
    description: "Классический итальянский десерт с кофейным вкусом", 
    price: 2000, 
    category_id: 4,
    image_url: "/images/dishes/tiramisu.jpg",
    is_available: true,
    is_vegetarian: true,
    ingredients: "Маскарпоне, савоярди, кофе, какао",
    calories: 420,
    weight: 150,
    cooking_time: 5,
    allergens: ["Глютен", "Молоко", "Яйца"]
  },
  { 
    id: 5, 
    name: "Латте", 
    description: "Кофейный напиток с молоком", 
    price: 1200, 
    category_id: 5,
    image_url: "/images/dishes/latte.jpg",
    is_available: true,
    is_vegetarian: true,
    ingredients: "Эспрессо, молоко",
    calories: 180,
    weight: 350,
    cooking_time: 5,
    allergens: ["Молоко"]
  }
];

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Настройка CORS заголовков
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  // Обработка предварительных запросов CORS
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
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

  // Сначала пробуем получить блюдо из кэша
  const cachedDishes = getCachedDishes();
  
  if (cachedDishes) {
    const cachedDish = cachedDishes.find((dish: any) => dish.id === dishId);
    if (cachedDish) {
      console.log(`Возвращаем блюдо с ID ${dishId} из кэша`);
      return res.status(200).json(cachedDish);
    }
  }

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

    return res.status(200).json(response.data);
  } catch (error: any) {
    console.error(`Ошибка при получении блюда с ID ${dishId}:`, error.message);
    
    // Ищем блюдо в данных-заглушках
    const fallbackDish = FALLBACK_DISHES.find(dish => dish.id === dishId);
    
    if (fallbackDish) {
      console.log(`Возвращаем заглушку для блюда с ID ${dishId}`);
      return res.status(200).json(fallbackDish);
    }
    
    // Если блюда нет даже в заглушках, возвращаем 404
    return res.status(404).json({ message: 'Блюдо не найдено' });
  }
} 