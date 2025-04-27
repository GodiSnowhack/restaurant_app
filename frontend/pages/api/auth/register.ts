import type { NextApiRequest, NextApiResponse } from 'next';

// Обработчик API запроса для регистрации пользователя
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Проверяем, что метод запроса - POST
  if (req.method !== 'POST') {
    return res.status(405).json({ detail: 'Метод не разрешен' });
  }

  try {
    // Получаем данные из запроса
    const { email, password, name } = req.body;

    // Проверяем наличие всех необходимых полей
    if (!email || !password || !name) {
      return res.status(400).json({ 
        detail: 'Отсутствуют обязательные поля',
        errors: [
          { loc: ['body', 'email'], msg: 'Это поле обязательно', type: 'value_error.missing' },
          { loc: ['body', 'password'], msg: 'Это поле обязательно', type: 'value_error.missing' },
          { loc: ['body', 'name'], msg: 'Это поле обязательно', type: 'value_error.missing' }
        ].filter(err => !req.body[err.loc[1]])
      });
    }

    // Получаем URL бэкенда для отправки запроса
    const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';
    
    // Формируем данные для отправки на бэкенд
    const userData = {
      email,
      password,
      full_name: name,
      role: 'client'
    };

    console.log('Отправка данных для регистрации:', { 
      ...userData, 
      password: '********' // Маскируем пароль в логах
    });
    
    // Отправляем POST запрос на бэкенд для создания пользователя
    const response = await fetch(`${backendUrl}/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(userData),
    });

    // Получаем результат в формате JSON
    const data = await response.json();

    // Проверяем статус ответа
    if (!response.ok) {
      // Логируем ошибку для отладки
      console.error('Ошибка регистрации пользователя:', {
        status: response.status,
        statusText: response.statusText,
        data
      });

      // Обрабатываем различные статусы ошибок
      if (response.status === 422) {
        // Ошибка валидации данных - возвращаем детали ошибки
        return res.status(422).json({
          detail: 'Ошибка валидации данных',
          errors: Array.isArray(data.detail) ? data.detail : [data.detail]
        });
      } else if (response.status === 400 && data.detail?.includes('уже существует')) {
        // Пользователь с таким email уже существует
        return res.status(409).json({
          detail: 'Пользователь с таким email уже существует'
        });
      } else if (response.status === 503) {
        // Сервер недоступен
        return res.status(503).json({
          detail: 'Сервер временно недоступен. Пожалуйста, попробуйте позже.'
        });
      }

      // Общая ошибка
      return res.status(500).json({
        detail: data.detail || 'Произошла ошибка при регистрации'
      });
    }

    // Успешный ответ с данными пользователя
    return res.status(201).json({
      id: data.id,
      email: data.email,
      full_name: data.full_name,
      role: data.role,
      message: 'Пользователь успешно зарегистрирован'
    });
  } catch (error) {
    // Обработка непредвиденных ошибок
    console.error('Непредвиденная ошибка при регистрации:', error);
    return res.status(500).json({
      detail: 'Внутренняя ошибка сервера'
    });
  }
} 