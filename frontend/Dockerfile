FROM node:18-alpine

WORKDIR /app

# Установка зависимостей
COPY package*.json ./
RUN npm install

# Копирование исходного кода
COPY . .

# Сборка приложения
RUN npm run build

# Устанавливаем порт для Next.js
ENV PORT=3000
ENV NEXT_PUBLIC_API_URL=https://backend-production-xxxx.up.railway.app

# Запуск приложения
CMD ["npm", "start"] 