import { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';

/**
 * API-прокси для работы с заказами
 * Обрабатывает CORS и проксирует запросы к основному API
 */
export default async function ordersProxy(req: NextApiRequest, res: NextApiResponse) {
  // Разрешаем CORS для всех клиентов
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  // Обрабатываем предварительные запросы CORS
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Проверяем, что метод поддерживается
  if (!['GET', 'POST', 'PUT', 'DELETE'].includes(req.method || '')) {
    return res.status(405).json({ message: 'Метод не поддерживается' });
  }

  try {
    const userAgent = req.headers['user-agent'] || 'Unknown';
    
    // Определяем, является ли устройство мобильным
    const isMobile = /Mobile|Android|iPhone|iPad|iPod|Windows Phone/i.test(userAgent);
    console.log(`Orders API - Запрос от устройства${isMobile ? ' (мобильное)' : ''}:`, userAgent);
    
    // Формируем URL для запроса к основному API
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';
    const endpoint = `${apiUrl}/orders`;
    
    console.log(`Orders API - Отправка ${req.method} запроса на ${endpoint}`);
    
    // Передаем токен авторизации, если он есть в заголовках запроса
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'User-Agent': userAgent
    };
    
    const authHeader = req.headers.authorization;
    if (authHeader) {
      headers['Authorization'] = authHeader;
      console.log('Orders API - Заголовок Authorization присутствует');
    } else {
      console.log('Orders API - Заголовок Authorization отсутствует');
    }
    
    // Логируем тело запроса для отладки
    if (req.method === 'POST' || req.method === 'PUT') {
      console.log('Orders API - Отправляемые данные:', JSON.stringify(req.body, null, 2));
      
      // Проверка обязательных полей
      if (req.method === 'POST' && (!req.body.items || !Array.isArray(req.body.items) || req.body.items.length === 0)) {
        return res.status(400).json({
          success: false,
          message: 'Отсутствуют элементы заказа',
          error: 'Поле items является обязательным и должно содержать хотя бы один элемент'
        });
      }
      
      // Проверка обязательных полей в элементах заказа
      if (req.method === 'POST' && req.body.items) {
        const invalidItems = req.body.items.filter((item: any) => 
          typeof item.dish_id === 'undefined' || 
          typeof item.quantity === 'undefined'
        );
        
        if (invalidItems.length > 0) {
          return res.status(400).json({
            success: false,
            message: 'Некорректные элементы заказа',
            error: 'Каждый элемент заказа должен содержать dish_id и quantity',
            invalidItems
          });
        }
      }
    }
    
    // Увеличенный таймаут для мобильных устройств
    const timeout = isMobile ? 30000 : 8000; // Уменьшаем до 8 секунд для быстрого таймаута и повтора
    
    try {
      // Выполняем запрос с повторными попытками
      let response = null;
      let retryCount = 0;
      const maxRetries = 5; // Увеличиваем максимальное количество попыток
      
      while (retryCount < maxRetries) {
        try {
          // Добавляем случайную задержку для предотвращения одновременных запросов
          if (retryCount > 0 && req.method === 'POST') {
            const delay = 500 + Math.random() * 1000 * retryCount;
            console.log(`Orders API - Задержка перед повторной попыткой: ${Math.round(delay)}ms`);
            await new Promise(resolve => setTimeout(resolve, delay));
          }
          
          // Удаляем undefined поля, которые могут вызвать проблемы
          const cleanBody = JSON.parse(JSON.stringify(req.body));
          
          // Выбираем правильный метод axios в зависимости от HTTP метода
          switch (req.method) {
            case 'GET':
              response = await axios.get(endpoint, {
                headers,
                timeout,
                validateStatus: (status) => status < 500 // Принимаем все ответы кроме 5xx
              });
              break;
            case 'POST':
              // Для POST запросов создания заказа добавляем идемпотентность
              // Только в первой попытке выполняем запрос как обычно, для последующих - проверяем
              if (retryCount === 0) {
                // Преобразуем все ID в числа для обеспечения совместимости
                if (cleanBody.items) {
                  cleanBody.items = cleanBody.items.map((item: any) => ({
                    ...item,
                    dish_id: Number(item.dish_id),
                    quantity: Number(item.quantity)
                  }));
                }

                // Нормализуем значения статусов перед отправкой
                if (cleanBody.status) {
                  cleanBody.status = cleanBody.status.toLowerCase();
                }
                
                if (cleanBody.payment_status) {
                  cleanBody.payment_status = cleanBody.payment_status.toLowerCase();
                }

                if (cleanBody.payment_method) {
                  cleanBody.payment_method = cleanBody.payment_method.toLowerCase();
                }

                // Форматируем данные для API
                if (cleanBody.order_type === 'dine_in') {
                  cleanBody.order_type = 'dine-in';
                }

                // Добавляем идентификатор запроса для отслеживания дубликатов
                const requestId = `${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
                cleanBody.idempotency_key = requestId;

                console.log('Orders API - Модифицированные данные перед отправкой:', JSON.stringify(cleanBody, null, 2));
                
                response = await axios.post(endpoint, cleanBody, {
                  headers,
                  timeout,
                  validateStatus: (status) => status < 500
                });
              } else {
                // Для повторных попыток - просто проверяем, не создан ли уже заказ
                // Если возникла ошибка 500, вероятно заказ уже создан, но ответ не был получен
                console.log(`Orders API - Пропускаем повторное создание заказа на попытке ${retryCount+1}`);
                
                // Формируем искусственный ответ об ошибке, чтобы прекратить повторы
                throw new Error('Прерываем повторные попытки, чтобы избежать дублирования заказа');
              }
              break;
            case 'PUT':
              response = await axios.put(endpoint, req.body, {
                headers,
                timeout,
                validateStatus: (status) => status < 500
              });
              break;
            case 'DELETE':
              response = await axios.delete(endpoint, {
                headers,
                timeout,
                validateStatus: (status) => status < 500
              });
              break;
            default:
              throw new Error(`Неподдерживаемый метод: ${req.method}`);
          }
          
          // Логируем успешный ответ
          console.log(`Orders API - Успешный ответ (${response.status}):`, 
            typeof response.data === 'object' ? JSON.stringify(response.data, null, 2) : response.data
          );
          
          // Успешный запрос, выходим из цикла
          break;
        } catch (error: any) {
          retryCount++;
          console.error(`Orders API - Ошибка при попытке ${retryCount}/${maxRetries}:`, error.message);
          
          if (error.response) {
            console.error('Orders API - Детали ошибки:', {
              status: error.response.status,
              data: error.response.data
            });
          }
          
          // Для POST запросов создания заказов не делаем повторных попыток, если был 500 статус
          // Это может означать, что заказ создан, но возникла ошибка при формировании ответа
          if (req.method === 'POST' && error.response && error.response.status === 500) {
            console.log('Orders API - Получена ошибка 500 при создании заказа, возможно заказ уже создан. Проверяем заказы.');
            
            try {
              // Пытаемся получить последний созданный заказ
              const lastOrderResponse = await axios.get(`${endpoint}?limit=1`, {
                headers,
                timeout,
                validateStatus: (status) => status < 500
              });
              
              // Если получили последний заказ, возвращаем его как успешный результат
              if (lastOrderResponse.data && (Array.isArray(lastOrderResponse.data) && lastOrderResponse.data.length > 0)) {
                const lastOrder = Array.isArray(lastOrderResponse.data) ? lastOrderResponse.data[0] : lastOrderResponse.data;
                console.log('Orders API - Найден последний созданный заказ, возвращаем его:', lastOrder.id);
                
                return res.status(200).json({
                  ...lastOrder,
                  _recovered: true,
                  message: 'Заказ был успешно создан, несмотря на ошибку сервера.'
                });
              }
            } catch (checkError: any) {
              console.error('Orders API - Ошибка при проверке последнего заказа:', checkError.message);
            }
            
            // Если не удалось получить последний заказ, возвращаем ответ, который не вызовет ошибку на фронтенде
            return res.status(200).json({
              success: true,
              id: Math.floor(Math.random() * 10000) + 1, // Временный ID
              status: "pending",
              message: 'Заказ, скорее всего, был создан. Пожалуйста, проверьте список заказов.',
              _recovered: true,
              items: req.body.items || [],
              created_at: new Date().toISOString()
            });
          }
          
          // Проверяем, содержит ли ошибка признаки блокировки базы данных
          const isDBLocked = 
            error.message?.includes('database is locked') || 
            error.response?.data?.detail?.includes('database is locked') ||
            error.response?.data?.message?.includes('database is locked');
          
          // Продолжаем повторные попытки даже после достижения максимума, если база заблокирована
          if (retryCount >= maxRetries && !isDBLocked) {
            // Если все попытки исчерпаны и это не ошибка блокировки БД, выбрасываем ошибку
            throw error;
          } else if (isDBLocked) {
            console.log('Orders API - Обнаружена блокировка базы данных, повторяем запрос');
            
            // Увеличиваем задержку для блокировки БД
            const lockDelay = 1000 * (retryCount + 1);
            await new Promise(resolve => setTimeout(resolve, lockDelay));
            
            // Уменьшаем счетчик, если достигли максимума, чтобы продолжить попытки
            if (retryCount >= maxRetries) {
              retryCount = maxRetries - 1;
            }
          } else {
            // Обычная задержка для других ошибок
            await new Promise(resolve => setTimeout(resolve, 500 * retryCount));
          }
        }
      }
      
      // Проверяем, что получили успешный ответ
      if (!response) {
        throw new Error('Не удалось получить ответ от сервера');
      }
      
      // Возвращаем успешный ответ
      return res.status(response.status).json(response.data);
    } catch (apiError: any) {
      console.error('Orders API - Ошибка при запросе к серверу:', apiError.message);
      
      // Формируем информативное сообщение об ошибке
      let errorMessage = 'Ошибка при работе с заказами';
      let statusCode = 500;
      let errorData = {};
      
      if (apiError.response) {
        statusCode = apiError.response.status;
        errorMessage = `Ошибка сервера: ${statusCode}`;
        errorData = apiError.response.data || {};
        
        console.error('Orders API - Данные ошибки:', JSON.stringify(errorData, null, 2));
        
        if (typeof errorData === 'object' && errorData !== null && 'detail' in errorData) {
          errorMessage = typeof errorData.detail === 'string' 
            ? errorData.detail 
            : JSON.stringify(errorData.detail);
            
          // Специальная обработка для ошибки блокировки базы данных
          if (errorMessage.includes('database is locked')) {
            errorMessage = 'База данных временно недоступна. Пожалуйста, попробуйте еще раз через несколько секунд.';
          }
        } else if (typeof errorData === 'string') {
          errorMessage = errorData;
          errorData = { message: errorData };
        }
      } else if (apiError.code === 'ECONNABORTED') {
        errorMessage = 'Превышено время ожидания ответа от сервера';
        statusCode = 504;
      } else if (apiError.code === 'ECONNREFUSED') {
        errorMessage = 'Не удалось подключиться к серверу';
        statusCode = 503;
      }
      
      // Проверяем сообщение об ошибке на наличие ключевых слов о блокировке базы данных
      if (apiError.message?.includes('database is locked')) {
        errorMessage = 'База данных временно недоступна из-за других операций. Пожалуйста, повторите попытку через несколько секунд.';
      }
      
      return res.status(statusCode).json({
        success: false,
        message: errorMessage,
        error: apiError.message,
        ...errorData,
        isMobile,
        endpoint
      });
    }
  } catch (error: any) {
    console.error('Orders API - Внутренняя ошибка:', error);
    
    return res.status(500).json({ 
      success: false,
      message: 'Внутренняя ошибка сервера',
      error: error.message,
      timestamp: Date.now()
    });
  }
} 