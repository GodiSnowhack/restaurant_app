import { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs';
import path from 'path';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'DELETE') {
    return res.status(405).json({ message: 'Метод не поддерживается' });
  }

  try {
    const { filename } = req.query;
    
    if (!filename || Array.isArray(filename)) {
      return res.status(400).json({ message: 'Неверный параметр filename' });
    }
    
    // Проверяем, что имя файла соответствует ожидаемому формату
    // Это важная проверка безопасности, чтобы предотвратить удаление нежелательных файлов
    if (!filename.startsWith('dish_') || !filename.match(/^dish_\d+\.(jpg|jpeg|png|gif|webp)$/i)) {
      return res.status(400).json({ 
        message: 'Неверный формат имени файла. Ожидается формат dish_{timestamp}.{ext}' 
      });
    }
    
    const filePath = path.join(process.cwd(), 'public', 'images', 'dishes', filename);
    
    // Проверяем существует ли файл
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ message: 'Файл не найден' });
    }
    
    // Удаляем файл
    fs.unlinkSync(filePath);
    
    return res.status(200).json({ 
      success: true, 
      message: 'Файл успешно удален' 
    });
  } catch (error) {
    console.error('Ошибка при удалении файла:', error);
    res.status(500).json({ message: 'Внутренняя ошибка сервера' });
  }
} 