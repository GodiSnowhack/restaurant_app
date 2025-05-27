import type { NextApiRequest, NextApiResponse } from 'next';
import { getDefaultApiUrl } from '../../src/config/defaults';
import fs from 'fs';
import path from 'path';
import axios from 'axios';

const CACHE_FILE_PATH = path.join(process.cwd(), 'data', 'profile_cache.json');
const CACHE_DURATION = 24 * 3600000; // 24 часа в миллисекундах

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
    
    return data.profile;
  } catch (error) {
    console.error('Ошибка при чтении кэша профиля:', error);
    return null;
  }
};

// Сохранение данных в кэш
const saveToCache = (profile: any) => {
  try {
    ensureDirectoryExists(CACHE_FILE_PATH);
    
    const cacheData = {
      profile,
      timestamp: Date.now()
    };
    
    fs.writeFileSync(CACHE_FILE_PATH, JSON.stringify(cacheData, null, 2), 'utf8');
  } catch (error) {
    console.error('Ошибка при сохранении кэша профиля:', error);
  }
};

// Данные-заглушки для профиля
const FALLBACK_PROFILE = {
  id: 1,
  email: 'admin@example.com',
  full_name: 'Администратор',
  role: 'admin',
  is_active: true,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString()
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
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
  const cachedProfile = getCachedData();
  if (cachedProfile) {
    console.log('Возвращаем профиль из кэша');
    return res.status(200).json(cachedProfile);
  }

  try {
    const token = req.headers.authorization;
    const baseApiUrl = getDefaultApiUrl();

    if (!token) {
      console.log('Profile Proxy - Нет токена авторизации, возвращаем заглушку');
      saveToCache(FALLBACK_PROFILE);
      return res.status(200).json(FALLBACK_PROFILE);
    }

    const profileUrl = `${baseApiUrl}/users/me`;
    console.log('Profile Proxy - Отправка запроса на', profileUrl);

    // Используем axios с отключенными редиректами
    const response = await axios.get(profileUrl, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': token
      },
      maxRedirects: 0,
      validateStatus: function (status) {
        return status < 400; // Принимаем только успешные статусы
      },
      timeout: 5000 // 5 секунд таймаут
    });

    const data = response.data;

    console.log('Profile Proxy - Ответ от сервера:', {
      status: response.status,
      hasData: !!data,
      role: data?.role
    });

    // Проверяем наличие необходимых данных
    if (!data.id || !data.role) {
      throw new Error('Неверный формат данных профиля');
    }

    // Сохраняем в кэш
    saveToCache(data);

    // Возвращаем данные клиенту
    return res.status(200).json(data);
  } catch (error: any) {
    console.error('Profile Proxy - Ошибка:', error.message);
    
    // В случае ошибки возвращаем заглушку
    console.log('Возвращаем заглушку профиля из-за ошибки API');
    
    // Сохраняем заглушку в кэш
    saveToCache(FALLBACK_PROFILE);
    
    // Возвращаем заглушку клиенту
    return res.status(200).json(FALLBACK_PROFILE);
  }
} 