import axios from 'axios';
import type { NextApiRequest } from 'next';
import { getSecureApiUrl } from './utils/api';

// Базовый URL для бэкенда
const API_BASE_URL = getSecureApiUrl();

// Создаем базовый клиент с настройками
export const createClient = () => {
  return axios.create({
    baseURL: API_BASE_URL,
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    timeout: 15000, // 15 секунд таймаут
  });
};

// Клиент с токеном авторизации из запроса API Next.js
export const getClientWithAuth = (req: NextApiRequest) => {
  const client = createClient();
  
  // Получаем токен из заголовка Authorization
  const authHeader = req.headers.authorization;
  
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7); // Удаляем префикс 'Bearer '
    client.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  }
  
  return client;
};

// Клиент с явно указанным токеном
export const getClientWithToken = (token: string) => {
  const client = createClient();
  client.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  return client;
};

export default {
  createClient,
  getClientWithAuth,
  getClientWithToken
}; 