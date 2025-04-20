import { NextApiRequest, NextApiResponse } from 'next';
import formidable from 'formidable';
import fs from 'fs';
import path from 'path';

// Отключаем встроенный парсер bodyParser для обработки formData
export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Метод не поддерживается' });
  }

  try {
    // Создаем директорию для загрузки изображений, если она не существует
    const uploadDir = path.join(process.cwd(), 'public', 'images', 'dishes');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const form = formidable({
      uploadDir,
      keepExtensions: true,
      maxFiles: 1,
      maxFileSize: 10 * 1024 * 1024, // 10 МБ
      filename: (name, ext, part) => {
        // Генерируем уникальное имя файла с использованием временной метки
        const timestamp = Date.now();
        const originalName = part.originalFilename || 'unknown';
        // Извлекаем оригинальное расширение
        const originalExt = path.extname(originalName);
        // Создаем безопасное имя файла с оригинальным расширением
        return `dish_${timestamp}${originalExt}`;
      }
    });

    return await new Promise((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) {
          console.error('Ошибка загрузки файла:', err);
          res.status(500).json({ message: 'Ошибка загрузки файла' });
          return resolve(true);
        }

        const file = files.file?.[0];
        
        if (!file) {
          res.status(400).json({ message: 'Файл не найден' });
          return resolve(true);
        }

        // Получаем только название файла (без пути)
        const filename = path.basename(file.filepath);
        
        // Формируем URL для доступа к файлу
        const fileUrl = `/images/dishes/${filename}`;
        
        res.status(200).json({ 
          success: true, 
          fileUrl,
          filename,
          originalFilename: file.originalFilename 
        });
        
        return resolve(true);
      });
    });
  } catch (error) {
    console.error('Ошибка загрузки файла:', error);
    res.status(500).json({ message: 'Внутренняя ошибка сервера' });
  }
} 