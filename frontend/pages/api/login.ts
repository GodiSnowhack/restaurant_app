import { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';
import cookie from 'cookie';

/**
 * API-прокси для авторизации пользователей
 * Обрабатывает авторизацию для всех типов клиентов, включая мобильные устройства
 */
export default async function loginProxy(req: NextApiRequest, res: NextApiResponse) {
  // Разрешаем CORS для всех клиентов
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, X-User-Agent'
  );

  // Обрабатываем предварительные запросы CORS
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ detail: 'Метод не поддерживается' });
  }

  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ detail: 'Email и пароль обязательны' });
  }

  try {
    const userAgent = req.headers['user-agent'] ||
      (req.headers['x-user-agent'] ?
        (Array.isArray(req.headers['x-user-agent']) ?
          req.headers['x-user-agent'][0] :
          req.headers['x-user-agent']) :
        'unknown');

    console.log(`Login Proxy - Запрос от устройства: ${userAgent}`);
    
    // Определяем, является ли устройство мобильным
    const isMobile = /Mobile|Android|iPhone|iPad|iPod|Windows Phone/i.test(typeof userAgent === 'string' ? userAgent : '');
    if (isMobile) {
      console.log('Login Proxy - Клиент определен как мобильное устройство');
    }

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';
    const loginUrl = `${apiUrl}/auth/login`;

    console.log(`Login Proxy - Отправка запроса на ${loginUrl}`);

    try {
      // Для формы авторизации используем form-data формат
      const formData = new URLSearchParams();
      formData.append('username', email);
      formData.append('password', password);

      const response = await axios.post(loginUrl, formData.toString(), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': typeof userAgent === 'string' ? userAgent : 'unknown',
          'X-User-Agent': typeof userAgent === 'string' ? userAgent : 'unknown',
          'Accept': 'application/json'
        },
        timeout: 30000,
        validateStatus: (status) => status < 500
      });

      // Если авторизация не удалась
      if (response.status === 401) {
        return res.status(401).json({ detail: 'Неверные учетные данные' });
      }

      // Если получили успешный ответ
      if (response.data && response.data.access_token) {
        console.log('Login Proxy - Успешная авторизация, установлен cookie');

        // Устанавливаем cookie с токеном и возвращаем только сам токен для frontend
        const token = response.data.access_token;
        
        // Устанавливаем все необходимые cookie для надежной авторизации
        // HttpOnly cookie для безопасности
        res.setHeader('Set-Cookie', [
          cookie.serialize('auth_token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 60 * 60 * 24 * 7, // 7 дней
            path: '/'
          }),
          // Второй cookie без HttpOnly для доступа на клиенте
          cookie.serialize('auth_status', 'authenticated', {
            httpOnly: false,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 60 * 60 * 24 * 7, // 7 дней
            path: '/'
          })
        ]);
        
        // Для мобильных устройств добавляем дополнительную информацию
        let responseData: any = { token, success: true };
        
        if (isMobile) {
          // Добавляем информацию для отладки
          responseData.isMobile = true;
          responseData.tokenLength = token.length;
          responseData.apiUrl = loginUrl;
          responseData.timestamp = Date.now();
        }

        return res.status(200).json(responseData);
      } else {
        console.error('Login Proxy - Ответ сервера не содержит токен');
        
        return res.status(400).json({ detail: 'Не удалось получить токен доступа' });
      }
    } catch (error: any) {
      // Обработка ошибок от сервера авторизации
      console.error('Login Proxy - Ошибка авторизации:', error);
      
      // Расширенное логирование для ошибок
      let status = 500;
      let errorMessage = 'Ошибка авторизации';
      let errorDetails: any = { message: 'Неизвестная ошибка' };
      
      if (error.response) {
        // Сервер вернул ошибку
        status = error.response.status;
        
        // Получаем детали ошибки
        if (error.response.data) {
          if (typeof error.response.data === 'object') {
            errorDetails = error.response.data;
            errorMessage = error.response.data.detail || 'Ошибка авторизации';
          } else {
            errorMessage = error.response.data || 'Ошибка авторизации';
          }
        }
      } else if (error.request) {
        // Запрос был отправлен, но ответ не получен
        errorMessage = 'Сервер авторизации не отвечает';
        errorDetails = { error: 'no_response', message: error.message };
      } else {
        // Другие ошибки
        errorMessage = error.message || 'Внутренняя ошибка авторизации';
        errorDetails = { error: 'internal', message: error.message };
      }

      // Подготовка альтернативного метода авторизации для мобильных устройств
      if (isMobile) {
        try {
          console.log('Login Proxy - Попытка прямой авторизации для мобильного устройства');
          
          // Пробуем отправить запрос напрямую с fetch
          const formData = new URLSearchParams();
          formData.append('username', email);
          formData.append('password', password);
          
          const directResponse = await fetch(loginUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
              'User-Agent': typeof userAgent === 'string' ? userAgent : 'unknown',
              'Accept': 'application/json'
            },
            body: formData.toString()
          });
          
          if (directResponse.ok) {
            const data = await directResponse.json();
            
            if (data.access_token) {
              console.log('Login Proxy - Успешная прямая авторизация для мобильного устройства');
              
              // Добавляем токен в ответ
              return res.status(200).json({ 
                token: data.access_token, 
                success: true,
                method: 'direct',
                isMobile: true
              });
            }
          } else {
            console.error('Login Proxy - Прямая авторизация не удалась:', directResponse.status);
          }
        } catch (directError) {
          console.error('Login Proxy - Ошибка прямой авторизации:', directError);
        }
      }
      
      // Возвращаем информативную ошибку
      return res.status(status).json({
        message: errorMessage,
        serverError: errorDetails,
        apiUrl: loginUrl,
        timestamp: Date.now(),
        isMobile: isMobile
      });
    }
  } catch (error: any) {
    console.error('Login Proxy - Внутренняя ошибка:', error);
    
    // Общая ошибка обработки запроса
    return res.status(500).json({
      message: 'Внутренняя ошибка сервера',
      error: error.message,
      timestamp: Date.now()
    });
  }
} 