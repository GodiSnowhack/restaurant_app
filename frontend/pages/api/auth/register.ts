import type { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';

// Обработчик API запроса для регистрации пользователя
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
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
    return res.status(200).end();
  }

  // Проверяем, что метод запроса - POST
  if (req.method !== 'POST') {
    return res.status(405).json({ detail: 'Метод не разрешен' });
  }

  try {
    // Получаем данные из запроса
    const { email, password, full_name, phone, role } = req.body;

    // Проверяем наличие всех необходимых полей
    if (!email || !password || !full_name) {
      return res.status(400).json({ 
        detail: 'Отсутствуют обязательные поля',
        errors: [
          { loc: ['body', 'email'], msg: 'Это поле обязательно', type: 'value_error.missing' },
          { loc: ['body', 'password'], msg: 'Это поле обязательно', type: 'value_error.missing' },
          { loc: ['body', 'full_name'], msg: 'Это поле обязательно', type: 'value_error.missing' }
        ].filter(err => !req.body[err.loc[1]])
      });
    }

    // Получаем URL бэкенда для отправки запроса
    const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';
    
    // Формируем данные для отправки на бэкенд
    const userData = {
      email,
      password,
      full_name,
      phone,
      role: role || 'client'
    };

    console.log('Отправка данных для регистрации:', { 
      ...userData, 
      password: '********' // Маскируем пароль в логах
    });
    
    try {
      // Отправляем POST запрос на бэкенд для создания пользователя
      const response = await axios.post(`${backendUrl}/auth/register`, userData, {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json' 
        },
        timeout: 10000, // Таймаут 10 секунд
      });

      // Успешный ответ с данными пользователя
      return res.status(201).json({
        id: response.data.id,
        email: response.data.email,
        full_name: response.data.full_name,
        role: response.data.role,
        message: 'Пользователь успешно зарегистрирован'
      });
    } catch (axiosError: any) {
      // Расширенное логирование ошибки для отладки
      console.error('Ошибка регистрации пользователя:', {
        status: axiosError.response?.status,
        statusText: axiosError.response?.statusText,
        data: axiosError.response?.data,
        error: axiosError.message,
        stack: axiosError.stack?.split('\n').slice(0, 3).join('\n'),
        config: {
          url: axiosError.config?.url,
          method: axiosError.config?.method,
          headers: axiosError.config?.headers
        }
      });

      // Если есть ответ от сервера
      if (axiosError.response) {
        // Обрабатываем различные статусы ошибок
        if (axiosError.response.status === 422) {
          // Ошибка валидации данных - возвращаем детали ошибки
          return res.status(422).json({
            detail: 'Ошибка валидации данных',
            errors: Array.isArray(axiosError.response.data.detail) 
              ? axiosError.response.data.detail 
              : [axiosError.response.data.detail],
            original: axiosError.response.data
          });
        } else if (axiosError.response.status === 400 && axiosError.response.data.detail?.includes('уже существует')) {
          // Пользователь с таким email уже существует
          return res.status(409).json({
            detail: 'Пользователь с таким email уже существует',
            original: axiosError.response.data
          });
        } else if (axiosError.response.status === 503) {
          // Сервер недоступен
          return res.status(503).json({
            detail: 'Сервер временно недоступен. Пожалуйста, попробуйте позже.',
            original: axiosError.response.data
          });
        }

        // Общая ошибка с сервера - возвращаем оригинальные данные и статус
        return res.status(axiosError.response.status || 500).json({
          detail: axiosError.response.data?.detail || 'Произошла ошибка при регистрации',
          message: axiosError.message,
          original: axiosError.response.data
        });
      } else if (axiosError.request) {
        // Запрос был сделан, но не получен ответ
        console.error('Нет ответа от сервера:', axiosError.request);
        return res.status(503).json({
          detail: 'Нет ответа от сервера. Пожалуйста, проверьте подключение или повторите позже.',
          message: axiosError.message
        });
      } else {
        // Ошибка при настройке запроса
        console.error('Ошибка при настройке запроса:', axiosError.message);
        return res.status(500).json({
          detail: 'Ошибка при отправке запроса: ' + axiosError.message,
          message: axiosError.message,
          stack: axiosError.stack?.split('\n').slice(0, 3).join('\n')
        });
      }
    }
  } catch (error: any) {
    // Обработка непредвиденных ошибок
    console.error('Непредвиденная ошибка при регистрации:', error);
    return res.status(500).json({
      detail: 'Внутренняя ошибка сервера: ' + (error.message || 'Неизвестная ошибка')
    });
  }
} 