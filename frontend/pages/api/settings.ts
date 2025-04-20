import { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs';
import path from 'path';

const SETTINGS_FILE_PATH = path.join(process.cwd(), 'data', 'settings.json');

// Убедимся, что директория существует
const ensureDirectoryExists = (filePath: string) => {
  const dirname = path.dirname(filePath);
  if (fs.existsSync(dirname)) {
    return true;
  }
  fs.mkdirSync(dirname, { recursive: true });
  return true;
};

// Начальные настройки по умолчанию
const DEFAULT_SETTINGS = {
  restaurant_name: 'Ресторан',
  restaurant_description: 'Описание ресторана',
  restaurant_address: 'Адрес ресторана',
  restaurant_phone: '+7 (777) 777-77-77',
  restaurant_email: 'info@restaurant.com',
  working_hours: {
    monday: { is_open: true, open: '09:00', close: '22:00' },
    tuesday: { is_open: true, open: '09:00', close: '22:00' },
    wednesday: { is_open: true, open: '09:00', close: '22:00' },
    thursday: { is_open: true, open: '09:00', close: '22:00' },
    friday: { is_open: true, open: '09:00', close: '23:00' },
    saturday: { is_open: true, open: '10:00', close: '23:00' },
    sunday: { is_open: true, open: '10:00', close: '22:00' }
  },
  currency: 'KZT',
  currency_symbol: '₸',
  delivery_fee: 0,
  minimum_order: 0,
  tax_rate: 0,
  reservation_enabled: true,
  delivery_enabled: true,
  takeaway_enabled: true,
  online_payment_enabled: true,
  social_media: {
    facebook: '',
    instagram: '',
    telegram: '',
    whatsapp: ''
  },
  tables_layout: [
    { id: 1, name: "Стол 1", capacity: 2, is_active: true, position_x: 100, position_y: 100 },
    { id: 2, name: "Стол 2", capacity: 4, is_active: true, position_x: 250, position_y: 100 },
    { id: 3, name: "Стол 3", capacity: 6, is_active: true, position_x: 400, position_y: 100 },
    { id: 4, name: "Стол 4", capacity: 2, is_active: true, position_x: 100, position_y: 250 },
    { id: 5, name: "Стол 5", capacity: 4, is_active: true, position_x: 250, position_y: 250 },
    { id: 6, name: "Стол 6", capacity: 8, is_active: true, position_x: 400, position_y: 250 },
  ],
  updated_at: new Date().toISOString()
};

// Загрузка настроек из файла
const getSettingsFromFile = () => {
  try {
    ensureDirectoryExists(SETTINGS_FILE_PATH);
    
    if (!fs.existsSync(SETTINGS_FILE_PATH)) {
      // Если файл не существует, создаем его с настройками по умолчанию
      fs.writeFileSync(SETTINGS_FILE_PATH, JSON.stringify(DEFAULT_SETTINGS, null, 2), 'utf8');
      return DEFAULT_SETTINGS;
    }
    
    const fileContent = fs.readFileSync(SETTINGS_FILE_PATH, 'utf8');
    return JSON.parse(fileContent);
  } catch (error) {
    console.error('Ошибка при чтении файла настроек:', error);
    return DEFAULT_SETTINGS;
  }
};

// Сохранение настроек в файл
const saveSettingsToFile = (settings: any) => {
  try {
    ensureDirectoryExists(SETTINGS_FILE_PATH);
    
    // Добавляем timestamp обновления
    const updatedSettings = {
      ...settings,
      updated_at: new Date().toISOString()
    };
    
    fs.writeFileSync(SETTINGS_FILE_PATH, JSON.stringify(updatedSettings, null, 2), 'utf8');
    return updatedSettings;
  } catch (error) {
    console.error('Ошибка при сохранении настроек:', error);
    throw error;
  }
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Добавляем искусственную задержку для демонстрации загрузки
  await new Promise(resolve => setTimeout(resolve, 500));

  try {
    // GET запрос - получение настроек
    if (req.method === 'GET') {
      const settings = getSettingsFromFile();
      return res.status(200).json(settings);
    }
    
    // PUT запрос - обновление настроек
    if (req.method === 'PUT') {
      const newSettings = req.body;
      
      if (!newSettings) {
        return res.status(400).json({ message: 'Отсутствуют данные настроек' });
      }
      
      const updatedSettings = saveSettingsToFile(newSettings);
      return res.status(200).json(updatedSettings);
    }
    
    // Метод не поддерживается
    return res.status(405).json({ message: 'Метод не поддерживается' });
  } catch (error) {
    console.error('Ошибка API настроек:', error);
    return res.status(500).json({ message: 'Внутренняя ошибка сервера' });
  }
} 