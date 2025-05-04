import { NextApiRequest, NextApiResponse } from 'next';

/**
 * API-эндпоинт для проверки доступности сервера
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Устанавливаем CORS заголовки
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  // Обрабатываем предварительные запросы CORS
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    // Отправляем ответ с информацией о статусе сервера
    res.status(200).json({
      success: true,
      message: 'Сервер доступен',
      timestamp: new Date().toISOString(),
      server: 'NextJS API'
    });
  } catch (error) {
    console.error('Ошибка при проверке сервера:', error);
    res.status(500).json({
      success: false,
      message: 'Внутренняя ошибка сервера',
      error: error instanceof Error ? error.message : String(error)
    });
  }
} 