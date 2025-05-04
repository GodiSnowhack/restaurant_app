import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Метод не поддерживается' });
  }

  try {
    // Проверяем наличие токена авторизации
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ 
        error: 'Требуется авторизация', 
        message: 'Пожалуйста, авторизуйтесь для доступа к этому ресурсу' 
      });
    }

    // В реальном API здесь был бы запрос к бэкенду
    // Сейчас мы вернем демо-данные для отладки
    
    // Создаем объект статистики
    const stats = {
      // Данные для обновленного формата DashboardStats
      ordersToday: 15,
      ordersTotal: 1432,
      revenue: 542500,
      reservationsToday: 8,
      users: 124,
      dishes: 45,
      
      // Дополнительные данные для совместимости
      totalRevenue: 542500,
      totalOrders: 1432,
      averageCheck: 379,
      totalCustomers: 203,
      pendingOrders: 3,
      popularItems: [
        { name: 'Стейк рибай', count: 87, revenue: 98100 },
        { name: 'Паста карбонара', count: 64, revenue: 44800 },
        { name: 'Тирамису', count: 52, revenue: 26000 },
      ],
      recentOrders: [
        { id: 1024, customer: 'Иванов И.', status: 'completed', total: 2450, date: new Date().toISOString() },
        { id: 1023, customer: 'Петров П.', status: 'in-progress', total: 1680, date: new Date(Date.now() - 30*60*1000).toISOString() },
        { id: 1022, customer: 'Сидоров С.', status: 'pending', total: 3200, date: new Date(Date.now() - 60*60*1000).toISOString() },
      ],
      
      // Добавляем данные о демографии клиентов
      customerDemographics: {
        age: {
          'Дети (0-12)': 3,
          'Подростки (13-17)': 5,
          'Молодёжь (18-25)': 28,
          'Взрослые (26-45)': 42,
          'Средний возраст (46-65)': 17,
          'Пожилые (66+)': 5
        },
        gender: {
          'Мужчины': 52,
          'Женщины': 47,
          'Другое': 1
        }
      },
      // Данные о частоте посещений 
      visitFrequency: {
        'Один раз': 35,
        '2-3 раза': 28,
        '4-5 раз': 18,
        '6-10 раз': 12,
        'Более 10 раз': 7
      }
    };

    // Возвращаем статистику
    res.status(200).json(stats);
  } catch (error) {
    console.error('Ошибка при получении статистики:', error);
    res.status(500).json({ 
      error: 'Внутренняя ошибка сервера',
      message: error instanceof Error ? error.message : 'Неизвестная ошибка' 
    });
  }
} 