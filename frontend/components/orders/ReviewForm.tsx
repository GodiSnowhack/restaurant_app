import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { createOrderReview, createServiceReview, createCombinedReview } from '../../lib/api';
import useAuthStore from '../../lib/auth-store';

interface ReviewFormProps {
  orderId: number;
  waiterId?: number | null;
  onReviewSubmitted?: () => void;
}

const StarIcon = ({ filled }: { filled: boolean }) => (
  <svg 
    className={`w-6 h-6 ${filled ? 'text-yellow-500' : 'text-gray-300'} cursor-pointer`} 
    fill="currentColor" 
    viewBox="0 0 20 20"
  >
    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118l-2.8-2.034c-.783-.57-.38-1.81.588-1.81h3.462a1 1 0 00.95-.69l1.07-3.292z" />
  </svg>
);

const RatingInput = ({ value, onChange, name }: { value: number, onChange: (value: number) => void, name: string }) => {
  return (
    <div className="flex space-x-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button 
          key={star} 
          type="button"
          onClick={() => onChange(star)}
          aria-label={`Rate ${star} star`}
          className="focus:outline-none"
        >
          <StarIcon filled={star <= value} />
        </button>
      ))}
    </div>
  );
};

const ReviewForm: React.FC<ReviewFormProps> = ({ orderId, waiterId, onReviewSubmitted }) => {
  const { t } = useTranslation();
  const { user, isAuthenticated } = useAuthStore();
  
  const [orderRating, setOrderRating] = useState<number>(5);
  const [serviceRating, setServiceRating] = useState<number>(5);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  const handleSubmit = async () => {
    if (!isAuthenticated || !user) {
      setError('Для оставления отзыва необходимо авторизоваться');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      setSuccess(null);

      if (!orderId) {
        throw new Error('Отсутствует ID заказа');
      }

      let reviewData = {
        order_id: orderId,
        food_rating: orderRating,
        service_rating: serviceRating
      };
      console.log("Отправка отзыва:", reviewData);
      
      let response = await fetch("/api/reviews/combined", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`
        },
        body: JSON.stringify(reviewData)
      });
      
      let data = await response.json();
      if (!response.ok)
        throw Error(data.detail || data.message || "Не удалось создать отзыв");
      
      setSuccess("Отзыв успешно отправлен");
      if (onReviewSubmitted) {
        onReviewSubmitted();
      }
    } catch (error: any) {
      console.error("Ошибка при отправке отзыва:", error);
      setError(error.message || "Произошла ошибка при отправке отзыва");
    } finally {
      setSubmitting(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="bg-white rounded-lg shadow-md mb-6">
        <div className="p-6">
          <h2 className="text-lg font-medium mb-2">
            Для оставления отзыва необходимо авторизоваться
          </h2>
          <p className="text-sm text-gray-500">
            Пожалуйста, войдите в систему, чтобы оставить отзыв
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md mb-6">
      <div className="p-6">
        <h2 className="text-xl font-medium mb-4">
          Оставить отзыв
        </h2>
        
        {error && (
          <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-md">
            {error}
          </div>
        )}
        
        {success && (
          <div className="mb-4 p-3 bg-green-50 text-green-700 rounded-md">
            {success}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Оценка заказа
            </label>
            <RatingInput 
              value={orderRating} 
              onChange={setOrderRating}
              name="orderRating" 
            />
          </div>
          
          {waiterId && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Оценка обслуживания
              </label>
              <RatingInput 
                value={serviceRating} 
                onChange={setServiceRating}
                name="serviceRating" 
              />
            </div>
          )}
          
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className={`w-full px-4 py-2 text-white rounded-md ${
              submitting
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-primary hover:bg-primary-dark'
            }`}
          >
            {submitting ? (
              <span className="flex items-center justify-center">
                <span className="animate-spin mr-2 h-4 w-4 border-t-2 border-b-2 border-white rounded-full"></span>
                Отправка...
              </span>
            ) : (
              'Отправить отзыв'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ReviewForm; 