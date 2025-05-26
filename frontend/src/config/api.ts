import { getSecureApiUrl } from '../../lib/utils/api';

// Базовый URL API
export const API_URL = getSecureApiUrl();

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
        login: `${API_URL}/auth/login`,
        register: `${API_URL}/auth/register`,
        logout: `${API_URL}/auth/logout`,
    },
    menu: {
        dishes: `${API_URL}/menu/dishes`,
        categories: `${API_URL}/menu/categories`,
        dish: (id: number) => `${API_URL}/menu/dishes/${id}`,
    },
    orders: {
        list: `${API_URL}/orders`,
        create: `${API_URL}/orders`,
        detail: (id: number) => `${API_URL}/orders/${id}`,
    },
    reservations: {
        list: `${API_URL}/reservations`,
        create: `${API_URL}/reservations`,
        detail: (id: number) => `${API_URL}/reservations/${id}`,
        verify: `${API_URL}/reservations/verify-code`,
    },
}; 