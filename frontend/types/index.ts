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
  order?: number;
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
  is_available?: boolean;
  category_id?: number;
  created_at?: string;
  updated_at?: string;
}

// Интерфейс для блюда в приложении
export interface Dish {
  id: number;
  name: string;
  description?: string;
  price: number;
  formatted_price?: string;
  image_url: string | null;
  is_available: boolean;
  category_id: number;
  is_vegetarian: boolean;
  is_vegan: boolean;
  calories: number | null;
  cooking_time: number | null;
  is_featured?: boolean;
  ingredients?: string;
  allergens?: string;
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
  name: string;
  dish_name?: string;
  special_instructions?: string;
}

export interface Order {
  id: number;
  created_at: string;
  updated_at?: string;
  status: string;
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
  payment_status?: string;
  payment_method?: string;
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
  tables: Array<any>;
  payment_methods?: string[];
} 