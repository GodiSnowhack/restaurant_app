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
            value: process.env.NODE_ENV === 'production' 
              ? 'https://backend-production-1a78.up.railway.app' 
              : 'http://localhost:8000'
          },
          {
            key: 'Access-Control-Allow-Methods',
            value: 'GET, POST, PUT, DELETE, OPTIONS, PATCH'
          },
          {
            key: 'Access-Control-Allow-Headers',
            value: 'X-Requested-With, Content-Type, Accept, Authorization, X-User-ID, X-User-Role, Access-Control-Allow-Origin, Access-Control-Allow-Credentials, Access-Control-Allow-Methods, Access-Control-Allow-Headers'
          },
          {
            key: 'Access-Control-Allow-Credentials',
            value: 'true'
          },
          {
            key: 'Access-Control-Max-Age',
            value: '3600'
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
    return [
      {
        source: '/api/:path*',
        destination: process.env.NODE_ENV === 'production'
          ? 'https://backend-production-1a78.up.railway.app/api/:path*'
          : 'http://localhost:8000/api/:path*'
      },
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