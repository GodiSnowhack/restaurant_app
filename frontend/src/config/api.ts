// API конфигурация
export const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// Базовые настройки для fetch запросов
export const defaultFetchOptions = {
    headers: {
        'Content-Type': 'application/json',
    },
    credentials: 'include' as const,
};

// Endpoints
export const API_ENDPOINTS = {
    auth: {
        login: `${API_URL}/api/v1/auth/login`,
        register: `${API_URL}/api/v1/auth/register`,
        logout: `${API_URL}/api/v1/auth/logout`,
    },
    menu: {
        dishes: `${API_URL}/api/v1/menu/dishes`,
        categories: `${API_URL}/api/v1/menu/categories`,
        dish: (id: number) => `${API_URL}/api/v1/menu/dishes/${id}`,
    },
    orders: {
        list: `${API_URL}/api/v1/orders`,
        create: `${API_URL}/api/v1/orders`,
        detail: (id: number) => `${API_URL}/api/v1/orders/${id}`,
    },
}; 