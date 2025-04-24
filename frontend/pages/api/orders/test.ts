import { NextApiRequest, NextApiResponse } from 'next';
import { Order } from '../../../types';

// Создаем упрощенный тип для тестовых блюд
type SimpleDish = {
  id: number;
  name: string;
  price: number;
  description?: string;
  category_id?: number;
  is_vegetarian?: boolean;
  is_vegan?: boolean;
  is_spicy?: boolean;
  has_allergens?: boolean;
  image_url?: string;
  calories?: number;
  available?: boolean;
};

/**
 * Тестовый API-эндпоинт, который всегда возвращает тестовые данные заказов
 */
export default function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Только GET запросы
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Метод не разрешен' });
  }

  // Генерируем тестовые данные
  const testOrders: Order[] = [
    {
      id: 1001,
      created_at: new Date().toISOString(),
      status: 'pending',
      customer_name: 'Иван Петров',
      customer_phone: '+7 (777) 123-4567',
      total_amount: 4500,
      payment_method: 'card',
      payment_status: 'paid',
      items: [
        {
          id: 1,
          dish_id: 101,
          quantity: 2,
          price: 1500,
          dish: {
            id: 101,
            name: 'Пицца Маргарита',
            price: 1500,
            description: 'Классическая итальянская пицца с томатами и моцареллой',
            category_id: 1,
            is_vegetarian: true,
            is_vegan: false,
            is_spicy: false,
            has_allergens: true,
            image_url: '/images/dishes/pizza-margarita.jpg',
            calories: 850,
            available: true
          }
        },
        {
          id: 2,
          dish_id: 102,
          quantity: 1,
          price: 1500,
          dish: {
            id: 102,
            name: 'Карбонара',
            price: 1500,
            description: 'Паста с беконом и сливочным соусом',
            category_id: 2,
            is_vegetarian: false,
            is_vegan: false,
            is_spicy: false,
            has_allergens: true,
            image_url: '/images/dishes/carbonara.jpg',
            calories: 950,
            available: true
          }
        }
      ]
    },
    {
      id: 1002,
      created_at: new Date(Date.now() - 3600000).toISOString(), // 1 час назад
      status: 'confirmed',
      customer_name: 'Александра Смирнова',
      customer_phone: '+7 (707) 765-4321',
      total_amount: 6200,
      payment_method: 'cash',
      items: [
        {
          id: 3,
          dish_id: 103,
          quantity: 2,
          price: 2200,
          dish: {
            id: 103,
            name: 'Стейк средней прожарки',
            price: 2200,
            description: 'Сочный стейк из говядины, приготовленный на гриле',
            category_id: 3,
            is_vegetarian: false,
            is_vegan: false,
            is_spicy: false,
            has_allergens: false,
            image_url: '/images/dishes/steak.jpg',
            calories: 1200,
            available: true
          }
        },
        {
          id: 4,
          dish_id: 104,
          quantity: 1,
          price: 1800,
          dish: {
            id: 104,
            name: 'Салат Цезарь',
            price: 1800,
            description: 'Классический салат с курицей, сыром пармезан и соусом',
            category_id: 4,
            is_vegetarian: false,
            is_vegan: false,
            is_spicy: false,
            has_allergens: true,
            image_url: '/images/dishes/caesar.jpg',
            calories: 450,
            available: true
          }
        }
      ]
    },
    {
      id: 1003,
      created_at: new Date(Date.now() - 7200000).toISOString(), // 2 часа назад
      status: 'preparing',
      customer_name: 'Нурлан Ахметов',
      customer_phone: '+7 (747) 987-6543',
      total_amount: 3500,
      payment_method: 'online',
      payment_status: 'paid',
      items: [
        {
          id: 5,
          dish_id: 105,
          quantity: 1,
          price: 2500,
          dish: {
            id: 105,
            name: 'Суши-сет "Токио"',
            price: 2500,
          }
        },
        {
          id: 6,
          dish_id: 106,
          quantity: 1,
          price: 1000,
          dish: {
            id: 106,
            name: 'Мисо-суп',
            price: 1000,
          }
        }
      ]
    },
    {
      id: 1004,
      created_at: new Date(Date.now() - 10800000).toISOString(), // 3 часа назад
      status: 'ready',
      customer_name: 'Мария Козлова',
      customer_phone: '+7 (701) 234-5678',
      total_amount: 5200,
      payment_method: 'card',
      payment_status: 'paid',
      items: [
        {
          id: 7,
          dish_id: 107,
          quantity: 2,
          price: 1800,
          dish: {
            id: 107,
            name: 'Бургер "Классический"',
            price: 1800,
          }
        },
        {
          id: 8,
          dish_id: 108,
          quantity: 1,
          price: 600,
          dish: {
            id: 108,
            name: 'Картофель фри',
            price: 600,
          }
        },
        {
          id: 9,
          dish_id: 109,
          quantity: 1,
          price: 1000,
          dish: {
            id: 109,
            name: 'Молочный коктейль',
            price: 1000,
          }
        }
      ]
    },
    {
      id: 1005,
      created_at: new Date(Date.now() - 86400000).toISOString(), // 1 день назад
      status: 'completed',
      customer_name: 'Дмитрий Иванов',
      customer_phone: '+7 (777) 555-4433',
      total_amount: 7800,
      payment_method: 'card',
      payment_status: 'paid',
      items: [
        {
          id: 10,
          dish_id: 110,
          quantity: 1,
          price: 4500,
          dish: {
            id: 110,
            name: 'Семейный набор',
            price: 4500,
          }
        },
        {
          id: 11,
          dish_id: 111,
          quantity: 2,
          price: 1650,
          dish: {
            id: 111,
            name: 'Пирожное "Тирамису"',
            price: 1650,
          }
        }
      ]
    },
    {
      id: 1006,
      created_at: new Date(Date.now() - 172800000).toISOString(), // 2 дня назад
      status: 'cancelled',
      customer_name: 'Анна Сидорова',
      customer_phone: '+7 (708) 111-2233',
      total_amount: 3200,
      payment_method: 'card',
      payment_status: 'failed',
      items: [
        {
          id: 12,
          dish_id: 112,
          quantity: 2,
          price: 1600,
          dish: {
            id: 112,
            name: 'Паста "Болоньезе"',
            price: 1600,
          }
        }
      ]
    }
  ];

  res.status(200).json(testOrders);
} 