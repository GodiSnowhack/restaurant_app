// Типы для статусов заказа
export type OrderStatus = 'pending' | 'confirmed' | 'preparing' | 'ready' | 'completed' | 'cancelled';
export type PaymentStatus = 'pending' | 'paid' | 'refunded' | 'failed';
export type PaymentMethod = 'card' | 'cash' | 'online';
export type OrderType = 'dine-in' | 'delivery' | 'pickup';

// Интерфейс для элемента заказа
export interface IOrderItem {
  dish_id: number;
  quantity: number;
  price: number;
  name: string;
  total_price: number;
  special_instructions?: string;
}

// Интерфейс для создания элемента заказа
export interface IOrderItemCreate {
  dish_id: number;
  quantity: number;
  price: number;
  special_instructions?: string;
}

// Интерфейс для заказа
export interface IOrder {
  id: number;
  user_id?: number;
  waiter_id?: number;
  status: OrderStatus;
  payment_status: PaymentStatus;
  payment_method?: PaymentMethod;
  order_type?: OrderType;
  total_amount: number;
  total_price: number;
  created_at?: string;
  updated_at?: string;
  completed_at?: string;
  items: IOrderItem[];
  table_number?: number;
  customer_name?: string;
  customer_phone?: string;
  reservation_code?: string;
  order_code?: string;
  comment?: string;
  is_urgent?: boolean;
  is_group_order?: boolean;
  delivery_address?: string;
}

// Интерфейс для создания заказа
export interface IOrderCreate {
  user_id?: number;
  waiter_id?: number;
  table_number?: number;
  payment_method?: PaymentMethod;
  customer_name?: string;
  customer_phone?: string;
  reservation_code?: string;
  order_code?: string;
  status?: OrderStatus;
  payment_status?: PaymentStatus;
  comment?: string;
  is_urgent?: boolean;
  is_group_order?: boolean;
  items: IOrderItemCreate[];
}

// Интерфейс для обновления заказа
export interface IOrderUpdate {
  user_id?: number;
  waiter_id?: number;
  table_number?: number;
  payment_method?: PaymentMethod;
  customer_name?: string;
  customer_phone?: string;
  reservation_code?: string;
  order_code?: string;
  status?: OrderStatus;
  payment_status?: PaymentStatus;
  comment?: string;
  is_urgent?: boolean;
  is_group_order?: boolean;
} 