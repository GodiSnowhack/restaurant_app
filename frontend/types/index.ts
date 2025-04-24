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
  description: string;
}

export interface Allergen {
  id: number;
  name: string;
  description: string;
}

export interface Tag {
  id: number;
  name: string;
}

export interface Dish {
  id: number;
  name: string;
  description: string;
  price: number;
  cost_price?: number;
  image_url?: string;
  category_id: number;
  is_vegetarian: boolean;
  is_vegan: boolean;
  cooking_time: number;
  calories: number;
  allergens: Allergen[];
  tags: Tag[];
  category?: Category;
}

// Типы для корзины
export interface CartItem {
  id: string;
  dish_id: number;
  dish: Dish;
  quantity: number;
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
  name: string;
  special_instructions?: string;
}

export interface Order {
  id: number;
  created_at: string;
  updated_at?: string;
  status: string; // 'pending' | 'confirmed' | 'preparing' | 'ready' | 'delivered' | 'completed' | 'cancelled'
  total_amount: number;
  items?: OrderItem[];
  user_id?: number;
  user?: {
    id: number;
    full_name: string;
    email: string;
    phone?: string;
  };
  table_number?: number;
  payment_status?: string; // 'pending' | 'paid' | 'failed' | 'refunded'
  payment_method?: string; // 'cash' | 'card' | 'online'
  comment?: string;
  customer_name?: string;
  customer_phone?: string;
  is_urgent?: boolean;
  reservation_code?: string;
  order_code?: string;
  delivery_address?: string;
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
  tables: Array<any>; // Можно определить более конкретный тип для столов
  payment_methods?: string[]; // 'cash' | 'card' | 'online'
} 