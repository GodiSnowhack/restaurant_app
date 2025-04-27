import { NextApiRequest, NextApiResponse } from 'next';

// Функция для генерации случайного кода
function generateRandomCode(length: number = 6): string {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
}

// Временное хранилище кодов (в реальной системе использовать базу данных)
// Формат: { waiterId: { code: string, createdAt: Date, expiresAt: Date } }
const waiterCodes: Record<string, { code: string, createdAt: Date, expiresAt: Date }> = {};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  console.log('API generate-code вызван, метод:', req.method);
  
  // Настройка CORS заголовков для обработки запроса
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );
  
  // Обработка предварительных запросов OPTIONS
  if (req.method === 'OPTIONS') {
    console.log('Обрабатываем OPTIONS запрос');
    return res.status(200).end();
  }
  
  // Проверяем метод запроса
  if (req.method !== 'POST') {
    console.log('Метод не поддерживается:', req.method);
    return res.status(405).json({ success: false, message: 'Метод не поддерживается' });
  }

  try {
    // Получаем текущее время, чтобы очистить просроченные коды
    const now = new Date();
    
    // Очистка устаревших кодов (не обязательно, но полезно)
    Object.keys(waiterCodes).forEach(waiterId => {
      if (waiterCodes[waiterId].expiresAt < now) {
        delete waiterCodes[waiterId];
      }
    });
    
    // Временное решение: генерируем уникальный ID для официанта
    // В реальном приложении этот ID должен быть извлечен из токена авторизации
    const waiterId = Date.now().toString();
    console.log('Используем временный ID официанта:', waiterId);
    
    // Генерируем новый код
    const code = generateRandomCode();
    const expiresAt = new Date(now.getTime() + 12 * 60 * 60 * 1000); // 12 часов
    
    // Сохраняем код в хранилище
    waiterCodes[waiterId] = {
      code,
      createdAt: now,
      expiresAt
    };

    // Логируем сгенерированный код
    console.log(`Сгенерирован новый код для официанта ${waiterId}: ${code}, действителен до ${expiresAt}`);
    
    // Добавляем задержку для имитации обработки (можно убрать в производственной версии)
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Возвращаем успешный ответ с кодом
    return res.status(200).json({
      success: true,
      code,
      expiresAt
    });
  } catch (error: any) {
    console.error('Ошибка при генерации кода официанта:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Произошла ошибка при генерации кода: ' + (error.message || 'неизвестная ошибка')
    });
  }
} 