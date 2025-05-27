import { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';
// import { getSecureApiUrl } from '../../lib/utils/api'; // Удалено
import { getDefaultApiUrl } from '../../src/config/defaults'; // Добавлено

// Список разрешенных полей для блюда
const allowedDishFields = [
  'name', 'description', 'price', 'category_id', 'image_url', 
  'is_available', 'calories', 'weight', 'position', 'is_vegetarian', 
  'is_vegan', 'is_spicy', 'cooking_time', 'cost_price'
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

const API_BASE_URL = getDefaultApiUrl(); // Изменено

/**
 * API-прокси для получения меню и категорий
 * Используется как для десктопных, так и для мобильных устройств
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { method, query, body, headers } = req;

  // Проверяем и получаем authorization header
  const authHeader = headers.authorization;

  // Определяем конечную точку запроса на основе метода, указанного в query
  const { method: apiMethod } = query;
  let endpoint = 'dishes';  // По умолчанию - dishes

  if (apiMethod === 'categories') {
    endpoint = 'categories';
  } else if (apiMethod === 'dish' && query.id) {
    endpoint = `dishes/${query.id}`;
  }

  // Строим URL для запроса к бэкенду
  let url = `${API_BASE_URL}/menu/${endpoint}`; // API_BASE_URL уже содержит /api/v1

  // Копируем query параметры, исключая внутренние параметры
  const queryParams = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (!['method', 'id', '_'].includes(key) && value !== undefined) {
      queryParams.append(key, value as string);
    }
  });

  // Добавляем query параметры к URL
  const queryString = queryParams.toString();
  if (queryString) {
    url += `?${queryString}`;
  }

  console.log(`[Menu API Proxy] Перенаправление запроса на: ${url}`);

  try {
    // Настройка заголовков для запроса к бэкенду
    const requestHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    // Добавляем заголовок авторизации, если он есть
    if (authHeader) {
      requestHeaders['Authorization'] = authHeader;
    }

    // Выполняем запрос к бэкенду с соответствующим методом
    const response = await axios({
      method: method as string,
      url,
      headers: requestHeaders,
      data: method !== 'GET' ? body : undefined,
      validateStatus: () => true, // Возвращает все статусы ответов
    });

    // Устанавливаем заголовки ответа
    Object.entries(response.headers).forEach(([key, value]) => {
      if (value !== undefined && !['transfer-encoding', 'connection'].includes(key.toLowerCase())) {
        res.setHeader(key, value as string);
      }
    });

    // Логируем ответ
    console.log(`[Menu API Proxy] Получен ответ со статусом: ${response.status}`);

    // Отправляем ответ с тем же статусом и данными
    res.status(response.status).json(response.data);
  } catch (error) {
    console.error('[Menu API Proxy] Ошибка при выполнении запроса:', error);
    
    // Обработка ошибок
    if (axios.isAxiosError(error)) {
      const statusCode = error.response?.status || 500;
      const errorData = error.response?.data || { message: 'Ошибка при выполнении запроса к API меню' };
      
      // Для случая, когда сервер недоступен, возвращаем пустой массив для dishes
      if (statusCode === 404 && endpoint === 'dishes') {
        // Возвращаем mock данные в крайнем случае
        console.log('[Menu API Proxy] Сервер недоступен, возвращаем пустой массив для dishes');
        return res.status(200).json([]);
      }
      
      res.status(statusCode).json(errorData);
    } else {
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Произошла непредвиденная ошибка при обработке запроса',
        path: url
      });
    }
  }
} 