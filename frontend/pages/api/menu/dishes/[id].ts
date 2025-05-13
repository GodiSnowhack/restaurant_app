import { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';

// Базовый URL бэкенда
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

// Список разрешенных полей для блюда (для безопасной фильтрации данных)
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

/**
 * API-прокси для операций с блюдами по ID
 * Поддерживает операции GET, PUT (обновление) и DELETE
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Настройка CORS заголовков
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PUT,DELETE');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  // Обработка предварительных запросов CORS
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { method, query, body, headers } = req;
  const { id } = query;

  if (!id || Array.isArray(id)) {
    return res.status(400).json({ message: 'Invalid dish ID' });
  }

  try {
    switch (method) {
      case 'GET':
        const getResponse = await axios.get(`${API_BASE_URL}/menu/dishes/${id}`, {
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            ...(headers.authorization ? { 'Authorization': headers.authorization } : {})
          },
        });

        return res.status(200).json(getResponse.data);

      case 'PUT':
        // Проверяем данные блюда
        if (!body) {
          return res.status(400).json({ 
            success: false,
            message: 'Данные блюда обязательны' 
          });
        }

        // Фильтруем данные для безопасности
        const dishData = filterObject(body, allowedDishFields);

        // Проверяем обязательные поля
        if (!dishData.name || !dishData.price || !dishData.category_id) {
          return res.status(400).json({ 
            success: false,
            message: 'Отсутствуют обязательные поля: название, цена или категория'
          });
        }

        try {
          // Отправляем запрос на обновление
          console.log('[API Proxy] Отправка запроса на обновление блюда:', {
            url: `${API_BASE_URL}/menu/dishes/${id}`,
            data: dishData
          });

          const putResponse = await axios.put(
            `${API_BASE_URL}/menu/dishes/${id}`,
            dishData,
            {
              headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                ...(headers.authorization ? { 'Authorization': headers.authorization } : {})
              },
            }
          );

          console.log('[API Proxy] Детальный лог ответа:', {
            status: putResponse.status,
            statusText: putResponse.statusText,
            data: putResponse.data
          });

          // Если получили ответ от бэкенда, просто передаем его клиенту
          return res.status(putResponse.status).json(putResponse.data);

        } catch (error: any) {
          console.error('[API Proxy] Ошибка при обновлении блюда:', {
            response: error.response?.data,
            status: error.response?.status,
            message: error.message
          });

          // Если есть ответ от сервера, передаем его
          if (error.response) {
            return res.status(error.response.status).json(error.response.data);
          }

          // Если нет ответа, возвращаем общую ошибку
          return res.status(500).json({
            message: error.message || 'Внутренняя ошибка сервера'
          });
        }

      default:
        res.setHeader('Allow', ['GET', 'PUT']);
        return res.status(405).json({ 
          success: false,
          message: `Method ${method} Not Allowed` 
        });
    }
  } catch (error: any) {
    console.error(`Error handling ${method} request for dish ${id}:`, error);
    
    return res.status(error.response?.status || 500).json({ 
      success: false,
      message: error.response?.data?.detail || error.message || `Error ${method} dish ${id}`,
      error: error.response?.data || error.message
    });
  }
} 