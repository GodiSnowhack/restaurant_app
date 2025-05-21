import axios from 'axios';

// Создаем экземпляр axios с базовыми настройками
export const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json'
  }
}); 