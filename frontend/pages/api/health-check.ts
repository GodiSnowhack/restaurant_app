import { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';

// Базовый URL бэкенда
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

/**
 * Эндпоинт для проверки здоровья системы и доступности API
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Информация о состоянии системы
  const systemInfo = {
    status: 'ok',
    frontend: {
      version: process.env.NEXT_PUBLIC_APP_VERSION || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      timestamp: new Date().toISOString()
    },
    backend: {
      status: 'unknown',
      url: API_BASE_URL,
      response_time: null as number | null,
      available: false
    }
  };
  
  // Попытка проверить доступность бэкенда
  try {
    const startTime = Date.now();
    const timeout = 5000; // 5 секунд таймаут
    
    // Пробуем несколько URL для проверки бэкенда
    const pingUrls = [
      `${API_BASE_URL}/health-check`,
      `${API_BASE_URL}/ping`,
      `${API_BASE_URL}/`
    ];
    
    let backendAvailable = false;
    
    // Пробуем все URL последовательно до первого успеха
    for (const url of pingUrls) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);
        
        const response = await fetch(url, {
          method: 'GET',
          headers: { 'Accept': 'application/json' },
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (response.ok) {
          const responseTime = Date.now() - startTime;
          systemInfo.backend.status = 'ok';
          systemInfo.backend.response_time = responseTime;
          systemInfo.backend.available = true;
          backendAvailable = true;
          break;
        }
      } catch (error) {
        // Просто пробуем следующий URL
        continue;
      }
    }
    
    // Если ни один URL не сработал
    if (!backendAvailable) {
      systemInfo.backend.status = 'unavailable';
      systemInfo.status = 'partial';
    }
  } catch (error) {
    console.error('Ошибка при проверке бэкенда:', error);
    systemInfo.backend.status = 'error';
    systemInfo.status = 'partial';
  }
  
  // Отправляем информацию о состоянии системы
  res.status(200).json(systemInfo);
} 