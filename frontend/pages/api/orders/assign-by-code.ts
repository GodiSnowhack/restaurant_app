import { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  console.log('API: assign-by-code вызван, метод:', req.method);
  console.log('API: Заголовки запроса:', JSON.stringify(req.headers, null, 2));
  
  // Настройка CORS заголовков
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );
  
  // Обработка предварительных запросов OPTIONS
  if (req.method === 'OPTIONS') {
    console.log('API: Обработка OPTIONS запроса');
    return res.status(200).end();
  }
  
  // Проверяем метод запроса
  if (req.method !== 'POST') {
    console.error(`API: Неподдерживаемый метод ${req.method}`);
    return res.status(405).json({ message: 'Метод не поддерживается' });
  }
  
  // Получаем токен из заголовка Authorization
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    console.error('API: Отсутствует токен авторизации');
    return res.status(401).json({ message: 'Требуется авторизация' });
  }
  
  // Получаем код заказа из тела запроса
  const { order_code } = req.body;
  if (!order_code) {
    console.error('API: Отсутствует код заказа в теле запроса');
    return res.status(400).json({ message: 'Требуется код заказа' });
  }
  
  try {
    // Определяем URL для API бэкенда
    const apiUrl = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1'}/orders/assign-by-code`;
    console.log(`API: Отправка запроса на бэкенд: ${apiUrl}`);
    console.log(`API: Код заказа: ${order_code}`);
    
    // Отправляем запрос на бэкенд
    const response = await axios.post(
      apiUrl,
      { order_code },
      {
        headers: {
          Authorization: authHeader,
          'Content-Type': 'application/json',
        },
      }
    );
    
    console.log(`API: Получен ответ от бэкенда, статус: ${response.status}`);
    console.log('API: Данные ответа:', JSON.stringify(response.data, null, 2));
    
    // Возвращаем ответ от бэкенда
    return res.status(response.status).json(response.data);
  } catch (error: any) {
    console.error('API: Ошибка при обработке запроса:', error);
    
    if (error.response) {
      console.error(`API: Ошибка бэкенда, статус: ${error.response.status}`);
      console.error('API: Данные ошибки:', JSON.stringify(error.response.data, null, 2));
      return res.status(error.response.status).json(error.response.data);
    }
    
    return res.status(500).json({ 
      message: 'Произошла ошибка при привязке заказа', 
      error: error.message 
    });
  }
} 