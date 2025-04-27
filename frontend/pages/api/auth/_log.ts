import { NextApiRequest, NextApiResponse } from 'next';

/**
 * API-эндпоинт для логирования ошибок авторизации
 * Позволяет клиентам отправлять диагностическую информацию
 */
export default async function authLogHandler(req: NextApiRequest, res: NextApiResponse) {
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
    const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const isMobile = /Mobile|Android|iPhone|iPad|iPod|Windows Phone/i.test(userAgent);
    
    // Получаем информацию об ошибке из тела запроса
    const {
      error,
      endpoint,
      timestamp,
      diagnosticInfo,
      networkInfo
    } = req.body || {};

    // Формируем текущую дату, если timestamp не указан
    const logTimestamp = timestamp || new Date().toISOString();
    const logEndpoint = endpoint || 'неизвестный эндпоинт';
    
    // Выводим информацию в консоль сервера для диагностики
    console.log('Auth Log API - Получен отчет об ошибке авторизации:');
    console.log(`Устройство: ${isMobile ? 'Мобильное' : 'Десктоп'}, IP: ${clientIp}`);
    console.log(`User-Agent: ${userAgent}`);
    console.log(`Ошибка: ${error || 'Не указана'}`);
    console.log(`Эндпоинт: ${logEndpoint}`);
    console.log(`Timestamp: ${logTimestamp}`);
    
    if (diagnosticInfo) {
      console.log('Диагностическая информация:', 
        typeof diagnosticInfo === 'object' 
          ? JSON.stringify(diagnosticInfo, null, 2) 
          : diagnosticInfo);
    }
    
    if (networkInfo) {
      console.log('Информация о сети:', 
        typeof networkInfo === 'object' 
          ? JSON.stringify(networkInfo, null, 2) 
          : networkInfo);
    }
    
    // Для дальнейшего анализа можно сохранить логи в файл или базу данных
    
    // Возвращаем успешный ответ
    return res.status(200).json({
      success: true,
      message: 'Информация об ошибке успешно логирована',
      received_at: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('Auth Log API - Ошибка обработки запроса:', error);
    
    return res.status(500).json({
      success: false,
      message: 'Ошибка обработки запроса логирования',
      error: error.message
    });
  }
} 