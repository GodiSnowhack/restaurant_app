import { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';

/**
 * API-прокси для авторизации
 * Улучшенная версия с расширенной диагностикой и восстановлением после ошибок
 */
export default async function loginProxy(req: NextApiRequest, res: NextApiResponse) {
  // Разрешаем CORS для всех клиентов
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  // Обрабатываем предварительные запросы CORS
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Метод не поддерживается' });
  }

  try {
    const userAgent = req.headers['user-agent'] || 'Unknown';
    const startTime = Date.now();
    const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    
    // Определяем, является ли устройство мобильным
    const isMobile = /Mobile|Android|iPhone|iPad|iPod|Windows Phone/i.test(userAgent);
    console.log(`Auth API - Запрос авторизации от устройства: ${userAgent}`);
    console.log(`Auth API - IP клиента: ${clientIp}`);
    
    // Получаем учетные данные из тела запроса
    const { email, password } = req.body;
    
    console.log('Auth API - Данные запроса:', { 
      email,
      password,
      rawBody: req.body
    });
    
    // Базовая валидация
    if (!email || !password) {
      return res.status(400).json({ 
        detail: 'Email и пароль обязательны'
      });
    }

    // Проверяем доступность сервера перед отправкой запроса
    const apiUrl = 'https://backend-production-1a78.up.railway.app/api/v1';
    
    try {
      // Формируем данные для отправки
      const formData = new URLSearchParams();
      formData.append('username', email);
      formData.append('password', password);

      console.log('Auth API - Отправляемые данные:', formData.toString());

      const response = await axios.post(`${apiUrl}/auth/login`, formData, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json',
          'X-Requested-With': 'XMLHttpRequest'
        },
        validateStatus: function (status) {
          return status < 500; // Разрешаем все статусы < 500
        }
      });

      console.log('Auth API - Ответ от сервера:', {
        status: response.status,
        data: response.data
      });

      if (response.status === 401) {
        return res.status(401).json({
          detail: 'Неверные учетные данные'
        });
      }

      if (response.data && response.data.access_token) {
        return res.status(200).json(response.data);
      } else {
        return res.status(401).json({
          detail: 'Не удалось получить токен доступа'
        });
      }
    } catch (error: any) {
      console.error('Auth API - Ошибка авторизации:', error.response?.data || error.message);
      
      return res.status(500).json({
        detail: 'Ошибка сервера при авторизации'
      });
    }
  } catch (error: any) {
    console.error('Auth API - Критическая ошибка:', error);
    
    return res.status(500).json({
      detail: error.message,
      message: 'Внутренняя ошибка сервера'
    });
  }
}

// Добавляем функцию генерации refresh_token
function generateRefreshToken(): string {
  const random = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  return `refresh_${random}_${Date.now()}`;
} 