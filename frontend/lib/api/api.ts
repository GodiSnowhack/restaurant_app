import axios from 'axios';
import { getApiBaseUrl } from '../api';

// Создаем экземпляр axios с базовыми настройками
export const api = axios.create({
  baseURL: getApiBaseUrl(),
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  },
  withCredentials: true, // Включаем отправку куки для поддержки авторизации
  timeout: 10000, // 10 секунд таймаут
  validateStatus: function (status) {
    // Считаем успешными статусы 2xx и 304 (не изменилось)
    return (status >= 200 && status < 300) || status === 304;
  },
  maxRedirects: 0 // Отключаем автоматические редиректы для предотвращения циклических редиректов
});

// Добавляем перехватчик для обработки ошибок
api.interceptors.response.use(
  response => response,
  async error => {
    if (error.response?.status === 404) {
      console.error('API endpoint не найден:', error.config.url);
      // Можно добавить специальную обработку 404 ошибок
    }
    return Promise.reject(error);
  }
); 