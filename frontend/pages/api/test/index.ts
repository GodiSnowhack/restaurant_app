import { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';

/**
 * Тестовый API-эндпоинт для проверки соединения с бэкендом
 */
export default async function testApiConnection(req: NextApiRequest, res: NextApiResponse) {
  try {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';
    
    console.log('Тестовое соединение с API. URL:', apiUrl);
    
    // Пробуем получить корневой маршрут API
    const response = await axios.get(apiUrl.replace('/api/v1', ''));
    
    return res.status(200).json({
      success: true,
      apiUrl: apiUrl,
      serverResponse: response.data,
      message: 'Соединение с бэкендом установлено успешно'
    });
  } catch (error: any) {
    console.error('Ошибка при проверке соединения с API:', error);
    
    return res.status(500).json({
      success: false,
      message: 'Ошибка при подключении к бэкенду',
      error: error.message,
      errorDetails: error.response?.data || 'Нет дополнительных данных'
    });
  }
} 