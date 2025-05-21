import React, { useState, useRef } from 'react';
import {PhotoIcon as PhotographIcon, XCircleIcon, ArrowUpTrayIcon as UploadIcon} from '@heroicons/react/24/outline';
import {menuApi} from '../lib/api/menu';

interface ImageUploaderProps {
  initialImage?: string;
  onImageUpload: (imageUrl: string) => void;
  className?: string;
  deleteFromServer?: boolean;
}

const ImageUploader: React.FC<ImageUploaderProps> = ({ 
  initialImage, 
  onImageUpload, 
  className = '',
  deleteFromServer = false
}) => {
  const [imageUrl, setImageUrl] = useState<string | null>(initialImage || null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Проверка типа файла
    if (!file.type.startsWith('image/')) {
      setError('Пожалуйста, выберите изображение');
      return;
    }

    // Проверка размера файла (максимум 5 МБ)
    if (file.size > 5 * 1024 * 1024) {
      setError('Размер файла не должен превышать 5 МБ');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Используем API-клиент для загрузки
      const response = await menuApi.uploadDishImage(file);
      
      if (response.success && response.fileUrl) {
        setImageUrl(response.fileUrl);
        onImageUpload(response.fileUrl);
      } else {
        throw new Error('Не удалось загрузить изображение');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Произошла ошибка при загрузке');
      console.error('Ошибка загрузки:', err);
    } finally {
      setIsLoading(false);
      // Сбрасываем значение input, чтобы можно было загрузить тот же файл повторно при необходимости
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemoveImage = async () => {
    try {
      // Если нужно удалить с сервера и есть URL изображения
      if (deleteFromServer && imageUrl) {
        await menuApi.deleteDishImage(imageUrl);
      }
      
      // В любом случае обновляем состояние
      setImageUrl(null);
      onImageUpload('');
    } catch (err) {
      console.error('Ошибка при удалении изображения:', err);
      // Даже если удаление с сервера не удалось, всё равно очищаем локальное состояние
      setImageUrl(null);
      onImageUpload('');
    }
  };

  return (
    <div className={`relative ${className}`}>
      {imageUrl ? (
        <div className="relative">
          <img 
            src={imageUrl} 
            alt="Загруженное изображение" 
            className="w-full h-48 object-cover rounded-md" 
          />
          <button
            type="button"
            onClick={handleRemoveImage}
            className="absolute top-2 right-2 bg-red-500 rounded-full p-1 text-white hover:bg-red-600 transition-colors"
            title="Удалить изображение"
          >
            <XCircleIcon className="w-5 h-5" />
          </button>
        </div>
      ) : (
        <div
          onClick={handleFileSelect}
          className="w-full h-48 border-2 border-dashed border-gray-300 rounded-md flex flex-col items-center justify-center cursor-pointer hover:border-blue-500 transition-colors"
        >
          {isLoading ? (
            <div className="flex flex-col items-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
              <span className="mt-2 text-sm text-gray-500">Загрузка...</span>
            </div>
          ) : (
            <>
              {error ? (
                <div className="text-center p-4">
                  <div className="text-red-500 mb-2">{error}</div>
                  <PhotographIcon className="mx-auto h-12 w-12 text-gray-400" />
                  <p className="mt-1 text-sm text-gray-500">Нажмите, чтобы выбрать другое изображение</p>
                </div>
              ) : (
                <div className="text-center p-4">
                  <UploadIcon className="mx-auto h-12 w-12 text-gray-400" />
                  <p className="mt-1 text-sm text-gray-500">Нажмите, чтобы загрузить изображение</p>
                  <p className="text-xs text-gray-400 mt-1">PNG, JPG, GIF до 5 МБ</p>
                </div>
              )}
            </>
          )}
        </div>
      )}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="image/*"
        className="hidden"
      />
    </div>
  );
};

export default ImageUploader; 