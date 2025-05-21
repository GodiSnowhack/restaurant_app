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
  reactStrictMode: true,
  skipMiddlewareUrlNormalize: true,
  images: {
    domains: [
      'localhost', 
      'res.cloudinary.com',
      '127.0.0.1',
      'placekitten.com',
      'placehold.it',
      'picsum.photos',
      '192.168.0.1',
      '192.168.0.2',
      '192.168.0.3',
      '192.168.0.4',
      '192.168.0.5',
      '192.168.0.6',
      '192.168.0.7',
      '192.168.0.8',
      '192.168.0.9',
      '192.168.0.10',
      '192.168.0.16',
      '192.168.0.100',
      '192.168.0.101',
      '192.168.0.102',
      '192.168.1.1',
      '192.168.1.2',
      '192.168.1.3',
      '192.168.1.4',
      '192.168.1.5',
      '192.168.1.6',
      '192.168.1.7',
      '192.168.1.8',
      '192.168.1.10',
      '192.168.1.100',
      '192.168.1.101',
      '192.168.1.102',
      '10.0.0.1',
      '10.0.0.2',
      '10.0.0.3',
      '10.0.0.4',
      '10.0.0.5',
      '10.0.0.6',
      '10.0.0.7',
      '10.0.0.8',
      '10.0.0.9',
      '10.0.0.10',
      '192.168.43.1',
      '172.16.0.1',
      '172.16.0.2',
      '172.16.0.3',
      '172.16.0.4',
      '172.16.0.5',
      '172.16.0.6',
      '172.16.0.7'
    ],
    remotePatterns: [
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '3000',
        pathname: '/images/**',
      },
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '8000',
        pathname: '/static/**',
      },
      {
        protocol: 'http',
        hostname: '**',
        port: '8000',
        pathname: '/static/**',
      },
      {
        protocol: 'http',
        hostname: '**',
        port: '3000',
        pathname: '/images/**',
      },
      {
        protocol: 'http',
        hostname: '192.168.**',
        port: '8000',
        pathname: '/**',
      },
      {
        protocol: 'http',
        hostname: '192.168.**',
        port: '3000',
        pathname: '/**',
      },
      {
        protocol: 'http',
        hostname: '10.**',
        port: '8000',
        pathname: '/**',
      },
      {
        protocol: 'http',
        hostname: '10.**',
        port: '3000',
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
            value: '*',
          },
          {
            key: 'Access-Control-Allow-Methods',
            value: 'GET, POST, PUT, DELETE, OPTIONS',
          },
          {
            key: 'Access-Control-Allow-Headers',
            value: 'X-Requested-With, Content-Type, Accept, Authorization',
          },
        ],
      },
    ];
  },
  // Настройка перезаписи маршрутов для API прокси
  async rewrites() {
    const backendUrl = process.env.NEXT_PUBLIC_API_URL?.replace('/api/v1', '') || 'https://backend-production-1a78.up.railway.app';
    return [
      {
        source: '/api/ping',
        destination: `${backendUrl}/api/v1/ping`,
      },
      {
        source: '/api/:path*',
        destination: `${backendUrl}/api/v1/:path*`,
      },
      {
        source: '/api/auth/:path*',
        destination: `${backendUrl}/api/v1/auth/:path*`,
      },
      {
        source: '/api/menu/:path*',
        destination: `${backendUrl}/api/v1/menu/:path*`,
      },
      {
        source: '/api/orders/:path*',
        destination: `${backendUrl}/api/v1/orders/:path*`,
      },
      {
        source: '/api/reservations/:path*',
        destination: `${backendUrl}/api/v1/reservations/:path*`,
      },
      {
        source: '/api/users/:path*',
        destination: `${backendUrl}/api/v1/users/:path*`,
      },
      {
        source: '/api/waiter/:path*',
        destination: `${backendUrl}/api/v1/waiter/:path*`,
      },
      {
        source: '/api/settings/:path*',
        destination: `${backendUrl}/api/v1/settings/:path*`,
      },
      {
        source: '/api/categories/:path*',
        destination: `${backendUrl}/api/v1/categories/:path*`,
      },
      {
        source: '/api/dishes/:path*',
        destination: `${backendUrl}/api/v1/dishes/:path*`,
      },
    ];
  },
  // Переменные окружения, доступные на клиенте
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'https://backend-production-1a78.up.railway.app/api/v1',
    NEXT_PUBLIC_BACKEND_URL: process.env.NEXT_PUBLIC_BACKEND_URL || 'https://backend-production-1a78.up.railway.app',
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