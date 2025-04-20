import {useState, useEffect} from 'react';
import {NextPage} from 'next';
import Link from 'next/link';
import Layout from '../../components/Layout';
import useAuthStore from '../../lib/auth-store';
import {TrashIcon, ArrowLeftIcon, ArrowUpTrayIcon as UploadIcon} from '@heroicons/react/24/outline';
import {menuApi} from '../../lib/api';
import ImageUploader from '../../components/ImageUploader';
import {useRouter} from 'next/router';

interface ImageItem {
  url: string;
  filename: string;
}

const AdminImagesPage: NextPage = () => {
  const { user, isAuthenticated } = useAuthStore();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [images, setImages] = useState<ImageItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  useEffect(() => {
    const checkAdmin = async () => {
      if (!isAuthenticated) {
        router.push('/auth/login');
        return;
      }

      if (user?.role !== 'admin') {
        router.push('/');
        return;
      }
      
      fetchImages();
    };

    checkAdmin();
  }, [isAuthenticated, user, router]);

  const fetchImages = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      // Здесь мы эмулируем запрос к API, так как у нас нет реального API для получения списка всех изображений
      // В реальном приложении здесь будет запрос к API
      
      // Сканируем директорию с изображениями блюд через fetch
      const response = await fetch('/api/scan-images');
      
      if (!response.ok) {
        throw new Error('Не удалось загрузить список изображений');
      }
      
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.message || 'Ошибка при загрузке изображений');
      }
      
      setImages(data.images || []);
    } catch (error) {
      console.error('Ошибка при загрузке изображений:', error);
      setError('Не удалось загрузить список изображений. Пожалуйста, попробуйте позже.');
      
      // В случае ошибки показываем тестовые изображения
      setImages([
        { url: '/images/dishes/dish_1.jpg', filename: 'dish_1.jpg' },
        { url: '/images/dishes/dish_2.jpg', filename: 'dish_2.jpg' },
        { url: '/images/dishes/dish_3.jpg', filename: 'dish_3.jpg' }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleImageUpload = (imageUrl: string) => {
    if (imageUrl) {
      // Извлекаем имя файла из URL
      const filename = imageUrl.split('/').pop() || '';
      
      // Добавляем новое изображение в список
      setImages(prev => [{ url: imageUrl, filename }, ...prev]);
    }
  };

  const handleDeleteImage = async (filename: string) => {
    if (!confirm(`Вы уверены, что хотите удалить изображение ${filename}?`)) {
      return;
    }
    
    try {
      setIsDeleting(filename);
      
      await menuApi.deleteDishImage(filename);
      
      // Обновляем список изображений после успешного удаления
      setImages(prev => prev.filter(img => img.filename !== filename));
    } catch (error) {
      console.error('Ошибка при удалении изображения:', error);
      alert('Не удалось удалить изображение. Пожалуйста, попробуйте позже.');
    } finally {
      setIsDeleting(null);
    }
  };

  return (
    <Layout title="Управление изображениями | Админ-панель">
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center mb-6">
          <Link href="/admin" className="text-gray-600 hover:text-primary mr-4">
            <ArrowLeftIcon className="h-5 w-5" />
          </Link>
          <h1 className="text-3xl font-bold">Управление изображениями</h1>
        </div>
        
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}
        
        <div className="bg-white shadow-md rounded-lg p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">Загрузить новое изображение</h2>
          <ImageUploader
            onImageUpload={handleImageUpload}
            deleteFromServer={false}
            className="mb-4"
          />
        </div>
        
        <div className="bg-white shadow-md rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Список изображений</h2>
          
          {isLoading ? (
            <div className="flex justify-center items-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
            </div>
          ) : images.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <UploadIcon className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <p>Нет загруженных изображений</p>
              <p className="text-sm mt-2">Загрузите изображения с помощью формы выше</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {images.map((image, index) => (
                <div key={index} className="relative group">
                  <div className="aspect-w-1 aspect-h-1 bg-gray-100 rounded-md overflow-hidden">
                    <img 
                      src={image.url} 
                      alt={`Изображение ${index + 1}`}
                      className="object-cover w-full h-full" 
                    />
                  </div>
                  <div className="mt-2 flex justify-between items-center">
                    <span className="text-sm text-gray-500 truncate">
                      {image.filename}
                    </span>
                    <button
                      onClick={() => handleDeleteImage(image.filename)}
                      disabled={isDeleting === image.filename}
                      className="text-red-600 hover:text-red-900 disabled:opacity-50"
                      title="Удалить изображение"
                    >
                      {isDeleting === image.filename ? (
                        <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-red-600"></div>
                      ) : (
                        <TrashIcon className="h-5 w-5" />
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default AdminImagesPage; 