import { PrismaClient } from '@prisma/client';

// Создаем экземпляр PrismaClient
const prismaClientSingleton = () => {
  return new PrismaClient();
};

// Используем глобальную переменную для сохранения соединения в режиме разработки
declare global {
  var prisma: undefined | ReturnType<typeof prismaClientSingleton>;
}

// Экспортируем клиент как singleton
export const prisma = globalThis.prisma ?? prismaClientSingleton();

// В режиме разработки сохраняем экземпляр клиента
if (process.env.NODE_ENV !== 'production') {
  globalThis.prisma = prisma;
} 