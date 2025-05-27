import { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';
import { getSecureApiUrl } from '../../../lib/utils/api';
import fs from 'fs';
import path from 'path';

const CACHE_FILE_PATH = path.join(process.cwd(), 'data', 'dishes_cache.json');
const CACHE_DURATION = 3600000; // 1 час в миллисекундах

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
    
    return data.dishes;
  } catch (error) {
    console.error('Ошибка при чтении кэша блюд:', error);
    return null;
  }
};

// Сохранение данных в кэш
const saveToCache = (dishes: any) => {
  try {
    ensureDirectoryExists(CACHE_FILE_PATH);
    
    const cacheData = {
      dishes,
      timestamp: Date.now()
    };
    
    fs.writeFileSync(CACHE_FILE_PATH, JSON.stringify(cacheData, null, 2), 'utf8');
  } catch (error) {
    console.error('Ошибка при сохранении кэша блюд:', error);
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
    ingredients: "Булочка, говядина, салат, помидор, соус" 
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
    ingredients: "Салат романо, куриное филе, гренки, пармезан, соус цезарь" 
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
    ingredients: "Свекла, капуста, морковь, картофель, говядина, зелень" 
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
    ingredients: "Маскарпоне, савоярди, кофе, какао" 
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
    ingredients: "Эспрессо, молоко" 
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

  // Проверяем наличие данных в кэше
  const cachedDishes = getCachedData();
  if (cachedDishes) {
    console.log('Возвращаем блюда из кэша');
    return res.status(200).json(cachedDishes);
  }

  try {
    const url = `${getSecureApiUrl()}/menu/dishes`;
    const response = await axios.get(url, {
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      maxRedirects: 0,
      validateStatus: function (status) {
        return status < 400; // Принимаем только успешные статусы
      }
    });

    // Сохраняем результат в кэш
    saveToCache(response.data);

    return res.status(200).json(response.data);
  } catch (error: any) {
    console.error('Ошибка при получении блюд:', error);
    
    // В случае ошибки возвращаем данные-заглушки
    console.log('Возвращаем заглушки блюд из-за ошибки API');
    
    // Сохраняем заглушки в кэш
    saveToCache(FALLBACK_DISHES);
    
    // Возвращаем заглушки клиенту
    return res.status(200).json(FALLBACK_DISHES);
  }
} 