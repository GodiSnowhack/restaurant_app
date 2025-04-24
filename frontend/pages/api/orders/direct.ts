import { NextApiRequest, NextApiResponse } from 'next';

/**
 * Прямой API-прокси для заказов с использованием fetch, обходящий проблемы с CORS
 */
export default async function directOrdersProxy(req: NextApiRequest, res: NextApiResponse) {
  try {
    const { method, query, headers, body } = req;
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';
    
    // Устанавливаем CORS-заголовки для ответа
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader('Access-Control-Allow-Headers', 
      'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');
      
    // Обработка предварительных запросов OPTIONS
    if (method === 'OPTIONS') {
      return res.status(200).end();
    }
    
    // Извлекаем токен из заголовка авторизации
    let token = headers.authorization;
    
    // Собираем URL с параметрами запроса
    let url = `${apiUrl}/orders`;
    const queryString = new URLSearchParams();
    
    // Добавляем параметры запроса, если они есть
    Object.entries(query).forEach(([key, value]) => {
      if (key !== 'id' && value !== undefined) {
        if (key === 'status' && typeof value === 'string') {
          // Преобразуем статус в верхний регистр
          queryString.append(key, value.toUpperCase());
          console.log(`Преобразовали статус запроса "${value}" в верхний регистр: "${value.toUpperCase()}"`);
        } else if (Array.isArray(value)) {
          value.forEach(v => queryString.append(key, v));
        } else {
          queryString.append(key, value as string);
        }
      }
    });
    
    // Добавляем параметры в URL, если они есть
    const qs = queryString.toString();
    if (qs) {
      url += `?${qs}`;
    }
    
    console.log(`Direct API Proxy (fetch) - ${method} запрос на URL: ${url}`);
    console.log('Токен авторизации присутствует:', !!token);
    
    // Настраиваем заголовки для запроса
    const requestHeaders: Record<string, string> = {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    };
    
    // Добавляем токен авторизации, если он есть
    if (token) {
      requestHeaders['Authorization'] = token;
    }
    
    try {
      let retryCount = 0;
      const maxRetries = 3;
      let response = null;
      
      while (retryCount < maxRetries) {
        try {
          // Делаем прямой fetch запрос
          console.log(`Попытка ${retryCount + 1}/${maxRetries} - Отправка запроса с заголовками:`, JSON.stringify(requestHeaders));
          
          // Настраиваем опции запроса в зависимости от метода
          const fetchOptions: RequestInit = {
            method: method || 'GET',
            headers: requestHeaders,
            credentials: 'include'
          };
          
          // Добавляем тело запроса для методов, которые его поддерживают
          if (method && ['POST', 'PUT', 'PATCH'].includes(method)) {
            let processedBody = body;
            // Проверяем, есть ли статус в теле запроса, и преобразуем его в верхний регистр
            if (typeof body === 'object' && body !== null && (body as any).status) {
              processedBody = { ...body as Record<string, any> };
              if (typeof (processedBody as any).status === 'string') {
                (processedBody as any).status = (processedBody as any).status.toUpperCase();
                console.log(`Преобразовали статус в теле запроса в верхний регистр: ${(processedBody as any).status}`);
              }
            }
            fetchOptions.body = typeof processedBody === 'string' ? processedBody : JSON.stringify(processedBody);
          }
          
          response = await fetch(url, fetchOptions);
          
          // Если дошли до этой точки, значит запрос успешен - выходим из цикла
          break;
        } catch (err) {
          retryCount++;
          if (retryCount >= maxRetries) throw err; // Выбрасываем ошибку если все попытки исчерпаны
          
          // Экспоненциальная задержка
          const delay = Math.pow(2, retryCount) * 1000;
          console.log(`Ошибка запроса, попытка ${retryCount}/${maxRetries}. Повтор через ${delay}мс...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
      
      if (!response) {
        throw new Error('Не удалось получить ответ после всех попыток');
      }
      
      console.log('Получен статус ответа:', response.status);
      
      // Получаем данные ответа
      let data;
      const contentType = response.headers.get('content-type');
      
      try {
        if (contentType && contentType.includes('application/json')) {
          data = await response.json();
          
          // Преобразуем статусы заказов в нижний регистр
          if (data) {
            if (Array.isArray(data)) {
              // Если это массив заказов
              data = data.map(order => {
                if (order && typeof order === 'object' && order.status) {
                  return { 
                    ...order, 
                    status: order.status.toLowerCase() 
                  };
                }
                return order;
              });
            } else if (typeof data === 'object' && data.status) {
              // Если это один заказ
              data = { 
                ...data, 
                status: data.status.toLowerCase() 
              };
            }
          }
        } else {
          data = await response.text();
        }
        
        console.log('Данные ответа:', typeof data, Array.isArray(data) ? `(массив из ${data.length} элементов)` : '');
      } catch (readError) {
        console.error('Ошибка при чтении тела ответа:', readError);
        data = 'Ошибка при чтении тела ответа';
      }
      
      // Если ответ не успешный, возвращаем ошибку
      if (!response.ok) {
        return res.status(response.status).json({
          error: true,
          status: response.status,
          statusText: response.statusText,
          data
        });
      }
      
      // Возвращаем успешный ответ
      return res.status(200).json(data);
    } catch (fetchError: any) {
      console.error('Ошибка при выполнении fetch-запроса:', fetchError);
      
      return res.status(500).json({
        error: true,
        message: 'Ошибка при выполнении запроса к API бэкенда',
        errorDetails: fetchError.message
      });
    }
  } catch (error: any) {
    console.error('Direct API Proxy - Неожиданная ошибка:', error);
    
    return res.status(500).json({
      error: true,
      message: 'Внутренняя ошибка сервера в прокси',
      errorDetails: error.message
    });
  }
} 