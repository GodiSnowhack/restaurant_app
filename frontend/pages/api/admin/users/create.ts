import type { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';

/**
 * API прокси для создания пользователя администратором
 */
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

  // Получаем токен авторизации из заголовка или cookie
  const authToken = req.headers.authorization?.replace('Bearer ', '') || 
                   req.cookies.token || 
                   '';
                   
  // Логируем информацию о запросе (без пароля)
  console.log('[ADMIN-CREATE-USER] Получен запрос на создание пользователя:', {
    email: req.body.email,
    full_name: req.body.full_name,
    role: req.body.role,
    has_password: !!req.body.password,
    client_ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress
  });
  
  try {
    // Проверяем наличие всех необходимых полей
    if (!req.body.email || !req.body.password || !req.body.full_name) {
      return res.status(400).json({ 
        detail: 'Отсутствуют обязательные поля',
        fields_missing: !req.body.email ? 'email' : !req.body.password ? 'password' : 'full_name'
      });
    }

    // Базовый URL API
    const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';
    
    // Формируем данные для регистрации
    const userData = {
      email: req.body.email,
      password: req.body.password, // Важно: не маскируем пароль!
      full_name: req.body.full_name,
      phone: req.body.phone,
      role: req.body.role || 'client'
    };

    console.log('[ADMIN-CREATE-USER] Отправка запроса на бэкенд:', {
      url: `${backendUrl}/auth/register`,
      email: userData.email,
      role: userData.role
    });
    
    try {
      // Отправляем запрос напрямую через axios
      const headers: any = {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      };
      
      // Если есть токен авторизации, добавляем его
      if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
      }
      
      const response = await axios.post(`${backendUrl}/auth/register`, userData, {
        headers,
        timeout: 10000, // 10 секунд таймаут
      });
      
      // Успешный ответ
      console.log('[ADMIN-CREATE-USER] Пользователь успешно создан:', {
        id: response.data.id,
        email: response.data.email,
        role: response.data.role
      });
      
      return res.status(201).json({
        success: true,
        user: response.data,
        message: 'Пользователь успешно создан'
      });
    } catch (error: any) {
      // Детальное логирование ошибки
      console.error('[ADMIN-CREATE-USER] Ошибка при создании пользователя:', {
        status: error.response?.status,
        data: error.response?.data || error.message,
        code: error.code
      });
      
      // Проверяем тип ошибки
      if (error.response) {
        // Проверяем специфичные ошибки
        if (error.response.status === 409 || 
            (error.response.data?.detail && 
             error.response.data.detail.includes('уже существует'))) {
          // Пользователь с таким email уже существует
          return res.status(409).json({
            detail: `Пользователь с email ${userData.email} уже существует`,
            original: error.response.data
          });
        }
        
        // Возвращаем ошибку с сервера
        return res.status(error.response.status).json({
          detail: error.response.data?.detail || 'Ошибка при создании пользователя',
          original: error.response.data
        });
      } else if (error.request) {
        // Запрос был отправлен, но нет ответа
        console.error('[ADMIN-CREATE-USER] Нет ответа от сервера:', error.request);
        return res.status(504).json({
          detail: 'Сервер не отвечает. Пожалуйста, попробуйте позже.'
        });
      } else {
        // Что-то пошло не так при настройке запроса
        console.error('[ADMIN-CREATE-USER] Ошибка при настройке запроса:', error.message);
        return res.status(500).json({
          detail: 'Произошла ошибка при отправке запроса: ' + error.message
        });
      }
    }
  } catch (error: any) {
    console.error('[ADMIN-CREATE-USER] Непредвиденная ошибка:', error);
    return res.status(500).json({
      detail: 'Внутренняя ошибка сервера: ' + (error.message || 'Неизвестная ошибка')
    });
  }
} 