import { NextApiRequest, NextApiResponse } from 'next';

/**
 * Тестовый API-эндпоинт для прямой проверки соединения с бэкендом через fetch
 */
export default async function directApiTest(req: NextApiRequest, res: NextApiResponse) {
  try {
    const { endpoint = '' } = req.query;
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';
    
    // Определяем url для запроса
    const url = endpoint ? `${apiUrl}/${endpoint}` : apiUrl.replace('/api/v1', '');
    
    console.log('Прямое тестовое соединение с API. URL:', url);
    
    // Выполняем запрос через fetch вместо axios
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      }
    });
    
    // Проверяем успешность запроса
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Ошибка HTTP ${response.status}: ${errorText}`);
    }
    
    // Пытаемся получить JSON-ответ
    let responseData;
    try {
      responseData = await response.json();
    } catch (e) {
      // Если невозможно распарсить JSON, возвращаем текст
      responseData = await response.text();
    }
    
    // Собираем заголовки в объект
    const headersObj: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      headersObj[key] = value;
    });
    
    return res.status(200).json({
      success: true,
      status: response.status,
      statusText: response.statusText,
      headers: headersObj,
      apiUrl: url,
      data: responseData,
      message: 'Соединение с бэкендом установлено успешно через fetch'
    });
  } catch (error: any) {
    console.error('Ошибка при прямой проверке соединения с API:', error);
    
    return res.status(500).json({
      success: false,
      message: 'Ошибка при подключении к бэкенду через fetch',
      error: error.message,
    });
  }
} 