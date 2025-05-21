// Типы для пользователей
export interface UserProfile {
  id: number;
  email: string;
  full_name: string;
  phone?: string;
  role: string;
  is_active: boolean;
  created_at: string;
}

// Типы для меню
export interface Category {
  id: number;
  name: string;
  description?: string;
  image_url?: string;
  is_active?: boolean;
  position: number;
  created_at?: string;
  updated_at?: string;
  dish_count?: number;
}

export interface Allergen {
  id: number;
  name: string;
  description?: string;
}

export interface Tag {
  id: number;
  name: string;
}

// Интерфейс для данных блюда с бэкенда
export interface ApiDish {
  id: number;
  name: string;
  description: string;
  price: number;
  cost_price?: number;
  image_url?: string;
  calories?: number;
  cooking_time?: number;
  is_vegetarian?: boolean;
  is_vegan?: boolean;
  is_spicy?: boolean;
  is_available?: boolean;
  category_id?: number;
  weight?: number;
  created_at?: string;
  updated_at?: string;
}

// Интерфейс для блюда в приложении
export interface Dish {
  id: number;
  name: string;
  description: string;
  price: number;
  cost_price?: number;
  formatted_price?: string;
  image_url: string;
  is_available: boolean;
  category_id: number;
  is_vegetarian: boolean;
  is_vegan: boolean;
  is_spicy: boolean;
  calories: number;
  cooking_time: number;
  weight: number;
  position?: number;
  is_featured?: boolean;
  ingredients?: string;
  allergens?: string[];
  nutritional_info?: string;
  is_gluten_free?: boolean;
  spiciness_level?: number;
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
}

// Типы для корзины
export interface CartItem {
  id: string;
  dish_id: number;
  name: string;
  price: number;
  quantity: number;
  image_url?: string;
  comment?: string;
}

export interface Cart {
  items: CartItem[];
  total: number;
}

// Типы для заказов
export interface OrderItem {
  dish_id: number;
  quantity: number;
  price: number;
  name?: string;
  dish_name?: string;
  special_instructions?: string;
  id?: number;
  order_id?: number;
  dish_image?: string;
  created_at?: string;
  updated_at?: string | null;
}

export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded';

export interface Payment {
  method?: string;
  status?: PaymentStatus;
  amount?: number;
  transaction_id?: string;
  payment_date?: string;
}

export interface Order {
  id: number;
  user_id?: number;
  waiter_id?: number;
  table_number?: number;
  payment_method?: string;
  customer_name?: string;
  customer_phone?: string;
  reservation_code?: string;
  order_code?: string;
  status: string;
  payment_status?: string;
  total_amount: number;
  comment?: string;
  is_urgent?: boolean;
  is_group_order?: boolean;
  customer_age_group?: string;
  created_at: string;
  updated_at?: string;
  completed_at?: string;
}

// Типы для бронирования
export interface Reservation {
  id: number;
  user_id: number;
  table_id?: number;
  table_number?: number;
  guests_count: number;
  reservation_date: string;
  reservation_time: string;
  status: string;
  guest_name: string;
  guest_phone: string;
  guest_email?: string;
  comments?: string;
  created_at: string;
  updated_at: string;
  reservation_code?: string;
  table?: {
    id: number;
    name: string;
    capacity: number;
  }
}

// Типы для отзывов
export interface Feedback {
  id: number;
  user_id: number;
  dish_id?: number;
  order_id?: number;
  rating: number;
  comment?: string;
  image_url?: string;
  created_at: string;
  user?: UserProfile;
  dish?: Dish;
}

// Типы для настроек ресторана
export interface WorkingHours {
  open: string;
  close: string;
  is_closed: boolean;
}

export interface RestaurantSettings {
  restaurant_name: string;
  email: string;
  phone: string;
  address: string;
  website: string;
  working_hours: {
    monday: WorkingHours;
    tuesday: WorkingHours;
    wednesday: WorkingHours;
    thursday: WorkingHours;
    friday: WorkingHours;
    saturday: WorkingHours;
    sunday: WorkingHours;
  };
  currency: string;
  currency_symbol: string;
  tax_percentage: number;
  min_order_amount: number;
  table_reservation_enabled: boolean;
  privacy_policy: string;
  terms_of_service: string;
  tables: Array<any>;
  payment_methods?: string[];
}

// Добавляем тип для создания нового блюда
export interface CreateDishDTO {
  name: string;
  description: string;
  price: number;
  cost_price?: number;
  image_url: string;
  category_id: number;
  is_available: boolean;
  is_vegetarian: boolean;
  is_vegan: boolean;
  is_spicy: boolean;
  calories: number;
  cooking_time: number;
  weight: number;
  position?: number;
}

// Типы для столов ресторана
export interface RestaurantTable {
  id: number;
  number: number;
  name: string;
  capacity: number;
  status: 'available' | 'occupied' | 'reserved';
  is_active: boolean;
  position_x: number;
  position_y: number;
  position?: {
    x: number;
    y: number;
  };
} 