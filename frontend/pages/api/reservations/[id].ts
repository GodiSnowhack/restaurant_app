import { NextApiRequest, NextApiResponse } from 'next';
import { getDefaultApiUrl } from '../../../src/config/defaults';
import https from 'https';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const { method, query, body } = req;
    const token = req.headers.authorization;
    const userId = req.headers['x-user-id'];
    const id = query.id as string;

    if (!id) {
      return res.status(400).json({ message: 'ID бронирования не указан' });
    }

    // Получаем базовый URL API
    const baseApiUrl = getDefaultApiUrl();
    
    // Формируем корректный URL для запроса к бэкенду
    const url = `${baseApiUrl.replace(/\/+$/, '')}/reservations/${id}`;

    console.log('API Proxy: Отправка запроса на', url);

    // Формируем заголовки запроса
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };

    // Добавляем заголовки авторизации
    if (token) {
      headers['Authorization'] = token;
    }
    if (userId) {
      headers['X-User-ID'] = userId.toString();
    }

    // Настройка HTTPS агента с отключенной проверкой сертификата
    const httpsAgent = new https.Agent({
      rejectUnauthorized: false
    });

    // Отправляем запрос к бэкенду с таймаутом
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    try {
      const response = await fetch(url, {
        method,
        headers,
        body: method !== 'GET' && body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
        // @ts-ignore - добавляем агент напрямую
        agent: url.startsWith('https') ? httpsAgent : undefined
      });

      clearTimeout(timeoutId);

      // Получаем данные ответа
      const data = await response.json();

      // Отправляем ответ клиенту
      res.status(response.status).json(data);
    } catch (fetchError: any) {
      clearTimeout(timeoutId);
      console.error('[API Proxy] Ошибка при отправке запроса к бронированию:', fetchError.message);
      
      // В случае ошибки сети возвращаем демо-данные
      const demoReservation = generateDemoReservation(parseInt(id));
      
      // Отправляем демо-данные клиенту
      res.status(200).json(demoReservation);
    }
  } catch (error: any) {
    console.error('[API Proxy] Ошибка при обработке запроса бронирования:', error);
    
    // В случае любой ошибки возвращаем демо-данные
    const id = parseInt(req?.query?.id as string) || 1001;
    const demoReservation = generateDemoReservation(id);
    
    res.status(200).json(demoReservation);
  }
}

// Функция для генерации демо-данных одного бронирования
function generateDemoReservation(id: number) {
  const now = new Date();
  
  // Генерируем дату в прошлом со случайным смещением (до 10 дней назад)
  const getRandomPastDate = () => {
    const date = new Date(now);
    const randomDaysBack = Math.floor(Math.random() * 10) + 1;
    date.setDate(date.getDate() - randomDaysBack);
    return date.toISOString();
  };
  
  // Генерируем дату в будущем со случайным смещением (до 10 дней вперед)
  const getRandomFutureDate = () => {
    const date = new Date(now);
    const randomDaysForward = Math.floor(Math.random() * 10) + 1;
    date.setDate(date.getDate() + randomDaysForward);
    return date.toISOString();
  };
  
  // Генерируем случайное число в заданном диапазоне
  const getRandomInt = (min: number, max: number) => {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  };
  
  // Список статусов бронирования
  const statuses = ['pending', 'confirmed', 'completed', 'cancelled'];
  const status = statuses[getRandomInt(0, statuses.length - 1)];
  
  const created_at = getRandomPastDate();
  const reservation_time = getRandomFutureDate();
  
  return {
    id,
    user_id: getRandomInt(1, 5),
    table_id: getRandomInt(1, 10),
    table_number: getRandomInt(1, 10),
    guests_count: getRandomInt(1, 6),
    reservation_time,
    created_at,
    updated_at: created_at,
    status,
    guest_name: ['Александр Иванов', 'Елена Петрова', 'Дмитрий Сидоров', 'Андрей Кузнецов', 'Наталья Смирнова'][getRandomInt(0, 4)],
    guest_phone: `+7 (${getRandomInt(900, 999)}) ${getRandomInt(100, 999)}-${getRandomInt(10, 99)}-${getRandomInt(10, 99)}`,
    guest_email: `user${getRandomInt(1, 999)}@example.com`,
    comment: Math.random() < 0.3 ? 'Комментарий к бронированию' : null,
    reservation_code: `RES-${getRandomInt(1000, 9999)}`
  };
} 