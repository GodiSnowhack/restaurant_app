// Типы для API запросов
export interface LoginCredentials {
  username: string;
  password: string;
}

export interface RegisterCredentials {
  email: string;
  password: string;
  full_name: string;
  phone?: string;
  role?: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
}

export interface UserProfile {
  id: number;
  email: string;
  full_name: string;
  phone?: string;
  role: string;
  is_active: boolean;
  birthday?: string; // в формате YYYY-MM-DD
  age_group?: string; // 'child', 'teenager', 'young', 'adult', 'middle', 'senior'
  created_at: string;
  updated_at: string;
}

export interface FileUploadResponse {
  success: boolean;
  fileUrl: string;
  filename: string;
  originalFilename: string;
  message?: string;
}

export interface DashboardStats {
  ordersToday: number;
  ordersTotal: number;
  revenue: number;
  reservationsToday: number;
  users: number;
  dishes: number;
}

export interface WorkingHoursItem {
  open: string;
  close: string;
  is_closed: boolean;
}

export interface WorkingHours {
  monday: WorkingHoursItem;
  tuesday: WorkingHoursItem;
  wednesday: WorkingHoursItem;
  thursday: WorkingHoursItem;
  friday: WorkingHoursItem;
  saturday: WorkingHoursItem;
  sunday: WorkingHoursItem;
}

export interface RestaurantTable {
  id?: number;
  number: number;
  capacity: number;
  status?: string;
}

export interface RestaurantSettings {
  restaurant_name: string;
  email: string;
  phone: string;
  address: string;
  website: string;
  working_hours: WorkingHours;
  currency: string;
  currency_symbol: string;
  tax_percentage: number;
  min_order_amount: number;
  delivery_fee: number;
  free_delivery_threshold: number;
  table_reservation_enabled: boolean;
  delivery_enabled: boolean;
  pickup_enabled: boolean;
  privacy_policy: string;
  terms_of_service: string;
  tables: RestaurantTable[];
}

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

export interface Order {
  id: number;
  user_id?: number;
  waiter_id?: number;
  table_number?: number;
  status: string;
  payment_status: string;
  payment_method: string;
  order_type: string;
  items: OrderItem[];
  total_amount: number;
  total_price?: number;
  special_instructions?: string;
  created_at: string;
  updated_at?: string;
  completed_at?: string;
  customer_name?: string;
  customer_phone?: string;
  customer_email?: string;
  delivery_address?: string;
  order_code?: string;
  reservation_code?: string;
  is_urgent?: boolean;
  is_group_order?: boolean;
  comment?: string;
  customer_age_group?: string | null;
  payments?: any[];
  user?: {
    id: number;
    full_name: string;
    email: string;
    phone?: string;
  };
} 