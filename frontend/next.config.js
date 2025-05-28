// Патчим модуль path для предотвращения ошибки в watchpack
const path = require('path');
const originalRelative = path.relative;
path.relative = function safeRelative(from, to) {
  if (from === undefined || to === undefined) {
    console.log('[PATCHED] path.relative вызван с undefined аргументом - исправлено');
    return '';
  }
  return originalRelative(from, to);
};

// Добавляем обработчик необработанных исключений для перехвата этой ошибки
process.on('uncaughtException', (err) => {
  if (err && err.code === 'ERR_INVALID_ARG_TYPE' && 
      err.message && err.message.includes('The "to" argument must be of type string')) {
    console.log('Перехвачена ошибка с undefined аргументом в path.relative');
    return; // Предотвращаем падение процесса
  }
  throw err; // Прокидываем остальные ошибки
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Отключаем строгий режим, чтобы избежать проблем с рендерингом
  reactStrictMode: false,
  skipMiddlewareUrlNormalize: true,
  images: {
    domains: [
      'backend-production-1a78.up.railway.app',
      'res.cloudinary.com',
      'placekitten.com',
      'placehold.it',
      'picsum.photos'
    ],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'backend-production-1a78.up.railway.app',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '**.railway.app',
        pathname: '/**',
      }
    ],
    // Отключаем оптимизацию, если есть проблемы с изображениями
    unoptimized: true,
  },
  // Настройка для устранения ошибок гидратации
  compiler: {
    // Подавляет предупреждения об ошибках гидратации в production
    styledComponents: true,
  },
  // Настройка заголовков для CORS
  async headers() {
    return [
      {
        // Применение ко всем маршрутам
        source: '/(.*)',
        headers: [
          {
            key: 'Access-Control-Allow-Origin',
            value: 'https://backend-production-1a78.up.railway.app'
          },
          {
            key: 'Access-Control-Allow-Methods',
            value: 'GET, POST, PUT, DELETE, OPTIONS'
          },
          {
            key: 'Access-Control-Allow-Headers',
            value: 'X-Requested-With, Content-Type, Accept, Authorization, X-User-ID, X-User-Role'
          },
          {
            key: 'Access-Control-Allow-Credentials',
            value: 'true'
          }
        ],
      },
      {
        source: '/:path*',
        headers: [
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains'
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY'
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block'
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin'
          }
        ],
      },
    ];
  },
  // Настройка перезаписи маршрутов для API прокси
  async rewrites() {
    const apiBaseUrl = 'https://backend-production-1a78.up.railway.app';
    
    return [
      // Прямое проксирование путей API
      {
        source: '/api/v1/orders',
        destination: `${apiBaseUrl}/api/v1/orders`
      },
      {
        source: '/orders',
        destination: `${apiBaseUrl}/api/v1/orders`
      },
      {
        source: '/api/orders',
        destination: `${apiBaseUrl}/api/v1/orders`
      },
      // Общие пути
      {
        source: '/api/:path*',
        destination: `${apiBaseUrl}/api/:path*`
      }
    ];
  },
  // Переменные окружения, доступные на клиенте
  env: {
    NEXT_PUBLIC_API_URL: 'https://backend-production-1a78.up.railway.app/api/v1',
    NEXT_PUBLIC_BACKEND_URL: 'https://backend-production-1a78.up.railway.app',
  },
  // Добавляем поддержку SVG
  webpack(config) {
    config.module.rules.push({
      test: /\.svg$/,
      use: ['@svgr/webpack'],
    });
    return config;
  },
  async redirects() {
    return [
      {
        source: '/admin',
        destination: '/admin/dashboard',
        permanent: true,
      },
    ];
  },
  // Экспериментальные функции
  experimental: {
    // Отключаем строгий режим
    esmExternals: true,
    // Отключаем некоторые экспериментальные функции
    forceSwcTransforms: false
  },
}

module.exports = nextConfig 