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

  try {
    console.log('Получаем блюда из бэкенда...');
    const url = `${getSecureApiUrl()}/menu/dishes`;
    console.log('URL запроса:', url);
    
    // Более детальная диагностика запроса
    const response = await axios.get(url, {
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      maxRedirects: 5, // Увеличиваем количество редиректов
      validateStatus: function (status) {
        // Принимаем все статусы для диагностики
        return true;
      }
    });

    console.log('Статус ответа API:', response.status);
    console.log('Заголовки ответа:', JSON.stringify(response.headers));

    if (response.status >= 400) {
      throw new Error(`API вернул ошибку: ${response.status} ${response.statusText}`);
    }

    if (response.data && Array.isArray(response.data)) {
      console.log(`Получено ${response.data.length} блюд из бэкенда`);
      // Сохраняем результат в кэш
      saveToCache(response.data);
      return res.status(200).json(response.data);
    } else {
      console.error('Некорректные данные от API:', response.data);
      throw new Error('Получены некорректные данные от API');
    }
  } catch (error: any) {
    console.error('Ошибка при получении блюд из бэкенда:', error);
    
    // Детали ошибки для диагностики
    if (error.response) {
      // Ответ от сервера получен, но с ошибкой
      console.error('Детали ошибки API:');
      console.error('Статус:', error.response.status);
      console.error('Данные:', error.response.data);
      console.error('Заголовки:', error.response.headers);
    } else if (error.request) {
      // Запрос был сделан, но ответ не получен
      console.error('Запрос был отправлен, но ответ не получен:');
      console.error(error.request);
    } else {
      // Что-то пошло не так при настройке запроса
      console.error('Ошибка настройки запроса:', error.message);
    }
    
    // Проверяем наличие данных в кэше
    console.log('Проверяем кэш...');
    const cachedDishes = getCachedData();
    if (cachedDishes) {
      console.log('Возвращаем блюда из кэша');
      return res.status(200).json(cachedDishes);
    }
    
    // Если и кэш недоступен, возвращаем ошибку с деталями
    console.error('Не удалось получить блюда ни из API, ни из кэша');
    return res.status(500).json({ 
      message: 'Не удалось получить данные о блюдах',
      error: error.message,
      details: error.response ? {
        status: error.response.status,
        data: error.response.data
      } : 'Нет данных о деталях ошибки'
    });
  }
} 