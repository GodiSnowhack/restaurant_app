/**
 * Утилита для обработки API URL
 * Гарантирует использование HTTPS для production URL
 */
export const getSecureApiUrl = (url?: string): string => {
  // Базовый URL по умолчанию
  const defaultUrl = 'https://backend-production-1a78.up.railway.app/api/v1';
  
  // Если URL не предоставлен, используем значение из переменной окружения или по умолчанию
  let baseUrl = url || process.env.NEXT_PUBLIC_API_URL || defaultUrl;
  
  try {
    // Принудительно используем HTTPS для production URL
    if (baseUrl.includes('backend-production-1a78.up.railway.app')) {
      baseUrl = baseUrl.replace('http://', 'https://');
    }
    
    const urlObj = new URL(baseUrl);
    
    // Если это не localhost, принудительно используем HTTPS
    if (!urlObj.hostname.includes('localhost') && urlObj.protocol === 'http:') {
      urlObj.protocol = 'https:';
      return urlObj.toString();
    }
    
    return baseUrl;
  } catch (e) {
    console.error('Неверный формат URL:', e);
    return defaultUrl;
  }
}; 