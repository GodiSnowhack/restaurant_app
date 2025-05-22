import axios from 'axios';
import { getApiBaseUrl } from '../api';

// Создаем экземпляр axios с базовыми настройками
export const api = axios.create({
  baseURL: getApiBaseUrl(),
  headers: {
    'Content-Type': 'application/json'
  },
  withCredentials: true // Включаем отправку куки для поддержки авторизации
}); 