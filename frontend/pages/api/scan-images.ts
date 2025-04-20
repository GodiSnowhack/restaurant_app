import { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs';
import path from 'path';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Метод не поддерживается' });
  }

  try {
    const imagesDir = path.join(process.cwd(), 'public', 'images', 'dishes');
    
    // Проверяем существование директории
    if (!fs.existsSync(imagesDir)) {
      fs.mkdirSync(imagesDir, { recursive: true });
      return res.status(200).json({ 
        success: true, 
        images: [] 
      });
    }
    
    // Получаем список файлов в директории
    const files = fs.readdirSync(imagesDir);
    
    // Фильтруем только файлы изображений и формируем массив объектов
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
    const images = files
      .filter(file => {
        const ext = path.extname(file).toLowerCase();
        return imageExtensions.includes(ext);
      })
      .map(file => ({
        filename: file,
        url: `/images/dishes/${file}`
      }));
    
    return res.status(200).json({
      success: true,
      images
    });
  } catch (error) {
    console.error('Ошибка при сканировании изображений:', error);
    res.status(500).json({ 
      success: false,
      message: 'Внутренняя ошибка сервера при сканировании изображений' 
    });
  }
} 