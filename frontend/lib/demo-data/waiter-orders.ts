/**
 * Демо-данные для заказов официанта
 */

import { Order } from '../api/types';

/**
 * Демо-заказы для отображения в интерфейсе официанта
 */
export const demoWaiterOrders: Order[] = [
  {
    id: 101,
    status: 'new',
    payment_status: 'not_paid',
    payment_method: 'cash',
    total_amount: 1250.00,
    table_number: 5,
    customer_name: 'Александр Иванов',
    created_at: new Date(Date.now() - 20 * 60000).toISOString(), // 20 минут назад
    order_type: 'dine_in',
    items: [
      {
        dish_id: 12,
        quantity: 2,
        price: 450.00,
        name: 'Цезарь с курицей'
      },
      {
        dish_id: 24,
        quantity: 1,
        price: 350.00,
        name: 'Борщ'
      }
    ],
    waiter_id: 1
  },
  {
    id: 102,
    status: 'preparing',
    payment_status: 'not_paid',
    payment_method: 'card',
    total_amount: 2300.00,
    table_number: 8,
    customer_name: 'Елена Смирнова',
    created_at: new Date(Date.now() - 35 * 60000).toISOString(), // 35 минут назад
    order_type: 'dine_in',
    items: [
      {
        dish_id: 15,
        quantity: 1,
        price: 850.00,
        name: 'Стейк Рибай'
      },
      {
        dish_id: 31,
        quantity: 2,
        price: 320.00,
        name: 'Картофель фри'
      },
      {
        dish_id: 44,
        quantity: 1,
        price: 290.00,
        name: 'Тирамису'
      },
      {
        dish_id: 55,
        quantity: 2,
        price: 260.00,
        name: 'Кола'
      }
    ],
    waiter_id: 1
  },
  {
    id: 103,
    status: 'ready',
    payment_status: 'not_paid',
    payment_method: 'cash',
    total_amount: 1890.00,
    table_number: 3,
    customer_name: 'Михаил Петров',
    created_at: new Date(Date.now() - 50 * 60000).toISOString(), // 50 минут назад
    order_type: 'dine_in',
    items: [
      {
        dish_id: 17,
        quantity: 1,
        price: 750.00,
        name: 'Лосось на гриле'
      },
      {
        dish_id: 20,
        quantity: 1,
        price: 620.00,
        name: 'Ризотто с грибами'
      },
      {
        dish_id: 43,
        quantity: 1,
        price: 250.00,
        name: 'Чизкейк'
      },
      {
        dish_id: 51,
        quantity: 1,
        price: 270.00,
        name: 'Сок'
      }
    ],
    waiter_id: 1
  },
  {
    id: 104,
    status: 'delivered',
    payment_status: 'not_paid',
    payment_method: 'card',
    total_amount: 1680.00,
    table_number: 12,
    customer_name: 'Татьяна Сидорова',
    created_at: new Date(Date.now() - 65 * 60000).toISOString(), // 65 минут назад
    order_type: 'dine_in',
    items: [
      {
        dish_id: 14,
        quantity: 2,
        price: 550.00,
        name: 'Пицца Маргарита'
      },
      {
        dish_id: 33,
        quantity: 1,
        price: 280.00,
        name: 'Салат "Весенний"'
      },
      {
        dish_id: 42,
        quantity: 1,
        price: 300.00,
        name: 'Мороженое'
      }
    ],
    waiter_id: 1
  },
  {
    id: 105,
    status: 'completed',
    payment_status: 'paid',
    payment_method: 'card',
    total_amount: 3450.00,
    table_number: 7,
    customer_name: 'Дмитрий Николаев',
    created_at: new Date(Date.now() - 3 * 3600000).toISOString(), // 3 часа назад
    order_type: 'dine_in',
    items: [
      {
        dish_id: 18,
        quantity: 2,
        price: 1100.00,
        name: 'Стейк Нью-Йорк'
      },
      {
        dish_id: 22,
        quantity: 1,
        price: 520.00,
        name: 'Паста Карбонара'
      },
      {
        dish_id: 41,
        quantity: 2,
        price: 270.00,
        name: 'Панна-котта'
      },
      {
        dish_id: 57,
        quantity: 1,
        price: 190.00,
        name: 'Эспрессо'
      }
    ],
    waiter_id: 1
  }
]; 