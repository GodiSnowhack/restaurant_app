import { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';
import { jwtDecode } from 'jwt-decode';

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
    console.log('Profile API - Декодирование токена');
    
    const decoded = jwtDecode<JWTPayload>(tokenValue);
    console.log('Profile API - Декодирован токен:', {
      id: decoded.sub,
      role: decoded.role,
      exp: new Date(decoded.exp * 1000).toISOString()
    });
    
    return {
      id: decoded.sub,
      role: decoded.role
    };
  } catch (error) {
    console.error('Profile API - Ошибка декодирования токена:', error);
    return null;
  }
};

// Создание заглушки профиля на основе токена
const createProfileFromToken = (token: string) => {
  const userData = getUserFromToken(token);
  if (!userData) {
    return null;
  }
  
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
};

/**
 * API-прокси для получения профиля пользователя
 * Усовершенствованная версия с расширенной диагностикой и восстановлением после ошибок
 */
export default async function profileProxy(req: NextApiRequest, res: NextApiResponse) {
  // Разрешаем CORS для всех клиентов
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  // Обрабатываем предварительные запросы CORS
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Метод не поддерживается' });
  }

  try {
    const userAgent = req.headers['user-agent'] || 'Unknown';
    const startTime = Date.now();
    const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    
    // Определяем, является ли устройство мобильным
    const isMobile = /Mobile|Android|iPhone|iPad|iPod|Windows Phone/i.test(userAgent);
    console.log(`Profile API - Запрос профиля от устройства${isMobile ? ' (мобильное)' : ''}: ${userAgent}`);
    console.log(`Profile API - IP клиента: ${clientIp}`);
    
    // Получаем токен авторизации из заголовков
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ 
        detail: 'Отсутствует токен авторизации',
        message: 'Необходимо авторизоваться'
      });
    }
    
    const token = authHeader.substring(7); // Убираем 'Bearer ' из начала строки
    
    // Логируем токен для отладки
    console.log(`Profile API DEBUG: Получен токен длиной ${token.length}, первые 10 символов: ${token.substring(0, 10)}...`);
    
    // Декодируем токен для получения ID пользователя
    const userData = getUserFromToken(authHeader);
    if (userData) {
      console.log(`Profile API - Данные из токена: ID=${userData.id}, роль=${userData.role}`);
    }
    
    // Формируем URL для запроса к основному API
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';
    
    // Сначала проверяем доступность сервера перед запросом профиля
    let isServerAvailable = true;
    try {
      console.log('Profile API - Проверка доступности сервера перед запросом профиля');
      const healthCheck = await axios.get(`${apiUrl}/health`, { 
        timeout: 5000,
        validateStatus: () => true // Принимаем любой код ответа
      });
      
      if (healthCheck.status >= 500) {
        console.warn(`Profile API - Сервер недоступен, код ответа: ${healthCheck.status}`);
        isServerAvailable = false;
      } else {
        console.log(`Profile API - Сервер доступен, код ответа: ${healthCheck.status}`);
      }
    } catch (healthError: any) {
      console.warn('Profile API - Ошибка при проверке доступности сервера:', healthError.message);
      isServerAvailable = false;
    }
    
    // Если сервер недоступен и у нас есть данные из токена, используем их
    if (!isServerAvailable && userData) {
      console.log('Profile API - Использование данных из токена из-за недоступности сервера');
      
      // Создаем профиль на основе данных из токена
      const tokenProfile = createProfileFromToken(authHeader);
      if (tokenProfile) {
        return res.status(200).json({
          ...tokenProfile,
          is_offline_mode: true,
          cached: true,
          timestamp: new Date().toISOString()
        });
      }
    }
    
    // Если сервер недоступен и передан флаг кэширования, но нет данных из токена
    if (!isServerAvailable && req.query.fallback === 'true' && !userData) {
      console.log('Profile API - Использование резервного профиля из-за недоступности сервера');
      
      // Базовый профиль со статусом "офлайн"
      return res.status(200).json({
        id: -1,
        email: 'offline@user.local',
        full_name: 'Офлайн пользователь',
        is_active: true,
        role: 'client',
        is_offline_mode: true,
        cached: true,
        timestamp: new Date().toISOString()
      });
    }
    
    // Формируем различные URL для получения профиля
    let endpoints = [
      { name: 'users/me', url: `${apiUrl}/users/me` }
    ];
    
    // Для мобильных устройств изменяем порядок, чтобы сначала пробовать работающий эндпоинт
    // На основе логов видно, что users/me работает успешно
    if (isMobile) {
      console.log('Profile API - Оптимизирован порядок запросов для мобильного устройства');
    }
    
    // Увеличенный таймаут для мобильных устройств
    const timeout = isMobile ? 30000 : 10000;
    
    // Пробуем получить профиль с повторными попытками
    let profileData = null;
    let attempts = 0;
    const maxAttempts = isMobile ? 5 : 3;
    let lastError = null;
    
    // Пробуем все доступные эндпоинты
    endpointLoop: for (const endpoint of endpoints) {
      if (attempts >= maxAttempts) break;
      
      for (let i = 0; i < 2; i++) { // До 2 попыток на каждый эндпоинт
        attempts++;
        if (attempts > maxAttempts) break;
        
        try {
          console.log(`Profile API - Попытка #${attempts}: запрос к ${endpoint.name}`);
          
          // Подробно логируем заголовки запроса для отладки
          console.log(`Profile API DEBUG: Отправка запроса на ${endpoint.url} с заголовками:`, {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Authorization': `Bearer ${token.substring(0, 10)}...`,
            'User-Agent': userAgent.substring(0, 30) + '...',
            'X-Client-Type': isMobile ? 'mobile' : 'desktop',
            'X-Attempt': String(attempts)
          });
          
          const response = await axios({
            method: 'GET',
            url: endpoint.url,
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json',
              'Authorization': `Bearer ${token}`,
              'User-Agent': userAgent,
              'X-Client-Type': isMobile ? 'mobile' : 'desktop',
              'X-Forwarded-For': String(clientIp),
              'X-Attempt': String(attempts)
            },
            timeout,
            validateStatus: (status) => status < 500 // Отклоняем только серверные ошибки 5xx
          });
          
          console.log(`Profile API - Ответ от ${endpoint.name} (попытка #${attempts}): ${response.status}`);
          
          // Если запрос успешен и содержит нужные данные
          if (response.status === 200 && response.data && response.data.email) {
            profileData = response.data;
            console.log(`Profile API - Успешно получен профиль через ${endpoint.name}`);
            console.log(`Profile API DEBUG: Данные пользователя: ID=${response.data.id}, email=${response.data.email}, роль=${response.data.role}`);
            break endpointLoop;
          }
          
          // Если получили 401 - недействительный токен, прекращаем попытки
          if (response.status === 401) {
            console.log('Profile API - Получен 401, токен недействителен');
            lastError = {
              status: response.status, 
              data: response.data,
              message: 'Недействительный токен авторизации'
            };
            break endpointLoop;
          }
          
          lastError = {
            status: response.status,
            data: response.data,
            endpoint: endpoint.name
          };
        } catch (error: any) {
          console.error(`Profile API - Ошибка при попытке ${attempts} (${endpoint.name}):`, error.message);
          
          lastError = {
            message: error.message,
            code: error.code,
            endpoint: endpoint.name
          };
          
          // Ждем перед следующей попыткой
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    }
    
    if (profileData) {
      // Добавляем информацию о времени выполнения запроса
      const duration = Date.now() - startTime;
      
      // Добавляем информацию о клиенте и запросе
      const enrichedProfile = {
        ...profileData,
        _meta: {
          retrieved_at: new Date().toISOString(),
          duration,
          attempts,
          is_mobile: isMobile
        }
      };
      
      console.log(`Profile API - Успешно возвращаем профиль после ${attempts} попыток за ${duration}ms`);
      return res.status(200).json(enrichedProfile);
    } else if (userData) {
      // Если API запрос не удался, но у нас есть данные из токена - используем их
      console.log('Profile API - Используем данные из токена, так как API запрос не удался');
      const tokenProfile = createProfileFromToken(authHeader);
      
      if (tokenProfile) {
        return res.status(200).json({
          ...tokenProfile,
          _meta: {
            source: 'token',
            timestamp: new Date().toISOString(),
            attempts
          }
        });
      }
    }
    
    // Если ни API запрос, ни данные из токена не сработали
    // Определяем код ошибки на основе последней ошибки
    let statusCode = 404;
    let errorMessage = 'Не удалось получить профиль пользователя';
    
    if (lastError) {
      if (lastError.status === 401) {
        statusCode = 401;
        errorMessage = 'Недействительный токен авторизации';
      } else if (lastError.code === 'ECONNABORTED') {
        statusCode = 504;
        errorMessage = 'Превышено время ожидания ответа от сервера';
      } else if (lastError.code === 'ECONNREFUSED') {
        statusCode = 503;
        errorMessage = 'Не удалось подключиться к серверу';
      }
    }
    
    console.error(`Profile API - Не удалось получить профиль после ${attempts} попыток`);
    
    return res.status(statusCode).json({
      detail: errorMessage,
      message: 'Не удалось получить данные профиля',
      status: statusCode,
      isMobile,
      attempts,
      last_error: process.env.NODE_ENV === 'development' ? lastError : undefined,
      server_checked: isServerAvailable,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('Profile API - Критическая ошибка:', error);
    
    return res.status(500).json({
      detail: error.message,
      message: 'Внутренняя ошибка сервера при получении профиля',
      timestamp: new Date().toISOString()
    });
  }
} 