import React, { useState, useEffect } from 'react';
import { 
  Box, 
  Button, 
  Card, 
  CardContent, 
  Rating, 
  TextField, 
  Typography, 
  Stack, 
  Divider, 
  Alert,
  CircularProgress
} from '@mui/material';
import { Star } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { 
  getOrderReviewStatus, 
  createOrderReview, 
  createServiceReview, 
  createCombinedReview 
} from '@/lib/api';
import { useAuth } from '@/context/AuthContext';

interface ReviewFormProps {
  orderId: number;
  waiterId?: number | null;
  onReviewSubmitted?: () => void;
}

const ReviewForm: React.FC<ReviewFormProps> = ({ 
  orderId, 
  waiterId,
  onReviewSubmitted 
}) => {
  const { t } = useTranslation();
  const { user } = useAuth() as { user: any };
  
  const [orderRating, setOrderRating] = useState<number | null>(5);
  const [serviceRating, setServiceRating] = useState<number | null>(5);
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [canReview, setCanReview] = useState(false);
  const [reviewStatus, setReviewStatus] = useState<any>(null);
  const [showServiceRating, setShowServiceRating] = useState(false);

  useEffect(() => {
    // Проверяем, можно ли оставить отзыв о заказе
    const checkReviewStatus = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const status = await getOrderReviewStatus(orderId);
        
        setReviewStatus(status);
        setCanReview(status.can_review);
        
        // Если есть waiter_id для заказа, позволяем оценить обслуживание
        setShowServiceRating(!!waiterId);
        
        setLoading(false);
      } catch (err: any) {
        setError(err.message || t('common.errors.unknown'));
        setLoading(false);
      }
    };
    
    checkReviewStatus();
  }, [orderId, waiterId, t]);

  const handleSubmit = async () => {
    try {
      setSubmitting(true);
      setError(null);
      setSuccess(null);
      
      // Проверяем наличие рейтингов
      if (!orderRating && !serviceRating) {
        setError(t('reviews.errors.ratingRequired'));
        setSubmitting(false);
        return;
      }
      
      let result;
      
      // Решаем, какой тип отзыва отправлять в зависимости от заполненных полей
      if (orderRating && serviceRating && waiterId) {
        // Комбинированный отзыв (о заказе и обслуживании)
        result = await createCombinedReview({
          order_id: orderId,
          waiter_id: waiterId,
          food_rating: orderRating,
          service_rating: serviceRating,
          comment
        });
      } else if (orderRating) {
        // Только отзыв о заказе
        result = await createOrderReview({
          order_id: orderId,
          food_rating: orderRating,
          comment
        });
      } else if (serviceRating && waiterId) {
        // Только отзыв об обслуживании
        result = await createServiceReview({
          order_id: orderId,
          waiter_id: waiterId,
          service_rating: serviceRating,
          comment
        });
      }
      
      setSuccess(t('reviews.successMessage'));
      setSubmitting(false);
      
      // Сбрасываем форму
      setOrderRating(5);
      setServiceRating(5);
      setComment('');
      
      // Обновляем состояние (теперь отзыв оставлен)
      setCanReview(false);
      
      // Вызываем callback, если он предоставлен
      if (onReviewSubmitted) {
        onReviewSubmitted();
      }
    } catch (err: any) {
      setError(err.message || t('common.errors.unknown'));
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  // Если оставить отзыв нельзя, показываем информацию, почему
  if (!canReview) {
    let reason = '';
    
    if (reviewStatus?.already_reviewed) {
      reason = t('reviews.alreadyReviewed');
    } else if (!reviewStatus?.order_completed) {
      reason = t('reviews.orderNotCompleted');
    } else if (!reviewStatus?.payment_completed) {
      reason = t('reviews.paymentNotCompleted');
    }
    
    return (
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" component="h2" gutterBottom>
            {t('reviews.cannotReview')}
          </Typography>
          
          <Typography variant="body2" color="text.secondary">
            {reason}
          </Typography>
          
          {reviewStatus?.already_reviewed && reviewStatus?.review && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="subtitle2">
                {t('reviews.yourReview')}:
              </Typography>
              
              <Box sx={{ display: 'flex', alignItems: 'center', mt: 1 }}>
                <Typography variant="body2" sx={{ mr: 1 }}>
                  {t('reviews.orderRating')}:
                </Typography>
                <Rating 
                  value={reviewStatus.review.food_rating || 0} 
                  readOnly 
                  precision={0.5}
                  size="small"
                />
              </Box>
              
              {reviewStatus.review.service_rating && (
                <Box sx={{ display: 'flex', alignItems: 'center', mt: 1 }}>
                  <Typography variant="body2" sx={{ mr: 1 }}>
                    {t('reviews.serviceRating')}:
                  </Typography>
                  <Rating 
                    value={reviewStatus.review.service_rating} 
                    readOnly 
                    precision={0.5}
                    size="small"
                  />
                </Box>
              )}
              
              {reviewStatus.review.comment && (
                <Typography variant="body2" sx={{ mt: 1 }}>
                  {reviewStatus.review.comment}
                </Typography>
              )}
            </Box>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card sx={{ mb: 3 }}>
      <CardContent>
        <Typography variant="h6" component="h2" gutterBottom>
          {t('reviews.leaveReview')}
        </Typography>
        
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        
        {success && (
          <Alert severity="success" sx={{ mb: 2 }}>
            {success}
          </Alert>
        )}
        
        <Stack spacing={3}>
          <Box>
            <Typography component="legend" gutterBottom>
              {t('reviews.orderRating')}
            </Typography>
            <Rating
              name="order-rating"
              value={orderRating}
              onChange={(event: React.SyntheticEvent, newValue: number | null) => {
                setOrderRating(newValue);
              }}
              precision={1}
              size="large"
              icon={<Star fontSize="inherit" />}
              emptyIcon={<Star fontSize="inherit" />}
            />
          </Box>
          
          {showServiceRating && (
            <Box>
              <Typography component="legend" gutterBottom>
                {t('reviews.serviceRating')}
              </Typography>
              <Rating
                name="service-rating"
                value={serviceRating}
                onChange={(event: React.SyntheticEvent, newValue: number | null) => {
                  setServiceRating(newValue);
                }}
                precision={1}
                size="large"
                icon={<Star fontSize="inherit" />}
                emptyIcon={<Star fontSize="inherit" />}
              />
            </Box>
          )}
          
          <TextField
            label={t('reviews.comment')}
            multiline
            rows={4}
            value={comment}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setComment(e.target.value)}
            fullWidth
            variant="outlined"
          />
          
          <Button
            variant="contained"
            color="primary"
            onClick={handleSubmit}
            disabled={submitting || (!orderRating && !serviceRating)}
            startIcon={submitting ? <CircularProgress size={20} /> : null}
          >
            {submitting ? t('common.submitting') : t('reviews.submitReview')}
          </Button>
        </Stack>
      </CardContent>
    </Card>
  );
};

export default ReviewForm; 