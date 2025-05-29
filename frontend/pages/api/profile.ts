import type { NextApiRequest, NextApiResponse } from 'next';
import { getDefaultApiUrl } from '../../src/config/defaults';
import fs from 'fs';
import path from 'path';
import axios from 'axios';
import { jwtDecode } from 'jwt-decode';

const CACHE_FILE_PATH = path.join(process.cwd(), 'data', 'profile_cache.json');
const CACHE_DURATION = 24 * 3600000; // 24 часа в миллисекундах

// Структура JWT payload
interface JWTPayload {
  sub: string;  // ID пользователя
  role: string; // Роль пользователя
  exp: number;  // Время истечения
}

// Функция для декодирования токена и получения данных пользователя
const getUserFromToken = (token: string): { id: string; role: string } | null => {
  try {
    if (!token || !token.startsWith('Bearer ')) {
      return null;
    }
    
    const tokenValue = token.substring(7); // Убираем 'Bearer '
    console.log('Profile Proxy - Декодирование токена');
    
    const decoded = jwtDecode<JWTPayload>(tokenValue);
    console.log('Profile Proxy - Декодирован токен:', {
      id: decoded.sub,
      role: decoded.role,
      exp: new Date(decoded.exp * 1000).toISOString()
    });
    
    return {
      id: decoded.sub,
      role: decoded.role
    };
  } catch (error) {
    console.error('Profile Proxy - Ошибка декодирования токена:', error);
    return null;
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

// Создание заглушки профиля на основе токена
const getFallbackProfile = (token: string | undefined) => {
  // Если есть токен, пытаемся извлечь из него данные
  if (token) {
    const userData = getUserFromToken(token);
    if (userData) {
      console.log('Profile Proxy - Создание заглушки из токена:', userData);
      return {
        id: parseInt(userData.id),
        email: `user${userData.id}@example.com`, // Примерный email
        full_name: `Пользователь ${userData.id}`,
        role: userData.role,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        from_token: true
      };
    }
  }
  
  // Если нет токена или не удалось декодировать, используем стандартную заглушку
  console.log('Profile Proxy - Использование стандартной заглушки профиля');
  return {
    id: -1, // Отрицательный ID, чтобы было понятно, что это заглушка
    email: 'offline@example.com',
    full_name: 'Офлайн пользователь',
    role: 'client',
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    from_token: false
  };
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
      const fallbackProfile = getFallbackProfile(undefined);
      saveToCache(fallbackProfile);
      return res.status(200).json(fallbackProfile);
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
    
    // В случае ошибки используем данные из токена для заглушки
    console.log('Возвращаем заглушку профиля из-за ошибки API');
    const fallbackProfile = getFallbackProfile(req.headers.authorization);
    
    // Сохраняем заглушку в кэш
    saveToCache(fallbackProfile);
    
    // Возвращаем заглушку клиенту
    return res.status(200).json(fallbackProfile);
  }
} 