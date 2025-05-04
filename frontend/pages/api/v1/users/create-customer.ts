import type { NextApiRequest, NextApiResponse } from 'next';
import { getClientWithAuth } from '../../../../lib/api-client';

// Функция для преобразования возрастной группы из формата фронтенда в формат бэкенда
const mapAgeGroupToEnum = (ageGroup: string): string => {
  console.log(`Маппинг возрастной группы из '${ageGroup}' в enum AgeGroup`);
  
  switch (ageGroup) {
    case '18-24':
      return 'young';
    case '25-34':
    case '35-44':
      return 'adult';
    case '45-54':
    case '55-64':
      return 'middle';
    case '65+':
      return 'senior';
    default:
      // Проверяем, если значение уже соответствует одному из значений enum
      if (['child', 'teenager', 'young', 'adult', 'middle', 'senior'].includes(ageGroup)) {
        console.log(`Возрастная группа '${ageGroup}' уже в правильном формате`);
        return ageGroup;
      }
      console.log(`Неизвестная возрастная группа '${ageGroup}', используем adult по умолчанию`);
      return 'adult'; // Значение по умолчанию
  }
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Метод не разрешен' });
  }

  try {
    const { name, email, password, phone, age_group } = req.body;

    // Базовая валидация
    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Отсутствуют обязательные поля' });
    }

    // Получение авторизованного клиента из токена в заголовке
    const client = getClientWithAuth(req);

    // Преобразуем возрастную группу в нужный формат
    const mappedAgeGroup = mapAgeGroupToEnum(age_group);

    // Отправка запроса на бэкенд для создания пользователя
    const response = await client.post('/users/customer', {
      full_name: name, // Используем name как full_name
      email,
      password,
      phone: phone || null,
      age_group: mappedAgeGroup, // Используем преобразованную возрастную группу
      role: 'client' // Используем client вместо customer
    });

    if (response.status === 201 || response.status === 200) {
      return res.status(201).json(response.data);
    } else {
      return res.status(response.status).json(response.data);
    }
  } catch (error: any) {
    console.error('Ошибка при создании пользователя:', error);
    
    // Обработка ошибок
    if (error.response) {
      // Клиент получил ответ от сервера, но с ошибкой
      return res.status(error.response.status).json({
        message: error.response.data.message || 'Ошибка при создании пользователя',
        error: error.response.data
      });
    } else if (error.request) {
      // Запрос был сделан, но ответ не получен
      return res.status(503).json({
        message: 'Сервер недоступен',
        error: 'Нет ответа от сервера'
      });
    } else {
      // Произошла ошибка при подготовке запроса
      return res.status(500).json({
        message: 'Ошибка при создании запроса',
        error: error.message
      });
    }
  }
} 