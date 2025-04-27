import { NextApiRequest, NextApiResponse } from 'next';
import * as fs from 'fs';
import * as path from 'path';

// Функция для рекурсивного обхода директорий
function getRoutes(dir: string, basePath = ''): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  
  return entries.flatMap(entry => {
    const fullPath = path.join(dir, entry.name);
    const relativePath = path.join(basePath, entry.name.replace(/\.(js|ts)x?$/, '').replace(/\[([^\]]+)\]/g, ':$1'));
    
    if (entry.isDirectory()) {
      return getRoutes(fullPath, relativePath);
    }
    
    // Пропускаем файлы API и _app, _document и т.д.
    if (entry.name.startsWith('_') || 
        relativePath.includes('/api/') || 
        !entry.name.match(/\.(js|ts)x?$/)) {
      return [];
    }
    
    // Заменяем "index" на корневой маршрут
    return [relativePath.replace(/\/index$/, '') || '/'];
  });
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // Получаем путь к директории pages
    const pagesDir = path.join(process.cwd(), 'pages');
    
    const routes = getRoutes(pagesDir);
    
    res.status(200).json({
      success: true,
      routes: routes.sort(),
      count: routes.length,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('Ошибка при получении маршрутов:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
} 