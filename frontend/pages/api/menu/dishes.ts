import { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Настройка CORS заголовков
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  // Обработка предварительных запросов CORS
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    console.log('API dishes - Sending request to:', `${API_BASE_URL}/menu/dishes`);
    
    const response = await axios.get(`${API_BASE_URL}/menu/dishes`, {
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    });

    console.log('API dishes - Response data:', JSON.stringify(response.data, null, 2));

    // Преобразуем данные в нужный формат
    const dishes = Array.isArray(response.data) ? response.data.map(dish => ({
      id: dish.id,
      name: dish.name,
      description: dish.description || '',
      price: dish.price,
      image_url: dish.image_url,
      is_available: dish.is_available ?? true,
      category_id: dish.category_id,
      is_vegetarian: dish.is_vegetarian ?? false,
      is_vegan: dish.is_vegan ?? false
    })) : [];

    console.log('API dishes - Transformed data:', JSON.stringify(dishes, null, 2));
    res.status(200).json(dishes);
  } catch (error) {
    console.error('Error fetching dishes:', error);
    res.status(500).json({ message: 'Error fetching dishes', error: error instanceof Error ? error.message : String(error) });
  }
} 