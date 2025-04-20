/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  images: {
    domains: ['res.cloudinary.com', 'localhost', '127.0.0.1', '192.168.0.10'],
  },
  // Настройка для устранения ошибок гидратации
  compiler: {
    // Подавляет предупреждения об ошибках гидратации в production
    styledComponents: true,
  },
  // Добавление настройки CORS для API бэкэнда
  async rewrites() {
    return [
      // Перенаправление API запросов на бэкенд
      {
        source: '/api/:path*',
        destination: 'http://localhost:8000/api/v1/:path*',
      },
      // Обработка статических файлов для предотвращения 404
      {
        source: '/logo.svg',
        destination: 'http://localhost:8000/static/images/logo.svg',
      },
      {
        source: '/images/hero-bg.jpg',
        destination: 'http://localhost:8000/static/images/hero-bg.jpg',
      },
      {
        source: '/images/dish-1.jpg',
        destination: 'http://localhost:8000/static/images/dish-1.jpg',
      },
      {
        source: '/images/dish-2.jpg',
        destination: 'http://localhost:8000/static/images/dish-2.jpg',
      },
      {
        source: '/images/dish-3.jpg',
        destination: 'http://localhost:8000/static/images/dish-3.jpg',
      },
    ];
  },
  // Переменные окружения, доступные на клиенте
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1',
  },
  // Добавляем поддержку SVG
  webpack(config) {
    config.module.rules.push({
      test: /\.svg$/,
      use: ['@svgr/webpack'],
    });
    return config;
  },
}

module.exports = nextConfig 