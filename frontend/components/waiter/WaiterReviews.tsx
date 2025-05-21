import React, { useState, useEffect } from 'react';
import { 
  Box, 
  Typography, 
  Rating, 
  Card, 
  CardContent, 
  Divider, 
  List, 
  ListItem, 
  Avatar, 
  CircularProgress,
  Paper,
  Skeleton
} from '@mui/material';
import { Star } from '@mui/icons-material';
import { getWaiterReviews, getWaiterRating } from '@/lib/api/waiter-api';
import { formatDate } from '@/utils/dateFormatter';

interface WaiterReviewsProps {
  waiterId: number;
}

const WaiterReviews: React.FC<WaiterReviewsProps> = ({ waiterId }) => {
  const [reviews, setReviews] = useState<any[]>([]);
  const [rating, setRating] = useState<{rating: number, count: number}>({ rating: 0, count: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Получаем рейтинг официанта и его отзывы параллельно
        const [ratingData, reviewsData] = await Promise.all([
          getWaiterRating(waiterId),
          getWaiterReviews(waiterId)
        ]);

        setRating(ratingData);
        setReviews(reviewsData || []);
        setLoading(false);
      } catch (err: any) {
        console.error('Ошибка при загрузке отзывов официанта:', err);
        setError(err.message || 'Не удалось загрузить отзывы');
        setLoading(false);
      }
    };

    if (waiterId) {
      fetchData();
    }
  }, [waiterId]);

  if (loading) {
    return (
      <Box sx={{ p: 3 }}>
        <Skeleton variant="rectangular" height={60} sx={{ mb: 2 }} />
        <Skeleton variant="rectangular" height={100} sx={{ mb: 2 }} />
        <Skeleton variant="rectangular" height={100} sx={{ mb: 2 }} />
        <Skeleton variant="rectangular" height={100} />
      </Box>
    );
  }

  if (error) {
    return (
      <Paper 
        elevation={0} 
        sx={{ 
          p: 3, 
          backgroundColor: 'error.lighter', 
          color: 'error.main',
          borderRadius: 2
        }}
      >
        <Typography variant="body1">{error}</Typography>
      </Paper>
    );
  }

  return (
    <Box>
      {/* Компонент с рейтингом */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            <Box 
              sx={{ 
                width: 60, 
                height: 60, 
                borderRadius: '50%', 
                backgroundColor: 'primary.main', 
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                mr: 2,
                fontSize: '1.5rem',
                fontWeight: 'bold'
              }}
            >
              {rating.rating.toFixed(1)}
            </Box>
            <Box>
              <Typography variant="h6" component="div">
                Средний рейтинг
              </Typography>
              <Rating 
                value={rating.rating} 
                readOnly 
                precision={0.1}
                size="small"
              />
              <Typography variant="body2" color="text.secondary">
                На основе {rating.count} отзывов
              </Typography>
            </Box>
          </Box>
        </CardContent>
      </Card>

      {/* Список отзывов */}
      {reviews.length > 0 ? (
        <Card>
          <CardContent>
            <Typography variant="h6" component="div" gutterBottom>
              Отзывы клиентов
            </Typography>
            <List sx={{ p: 0 }}>
              {reviews.map((review, index) => (
                <React.Fragment key={review.id || index}>
                  {index > 0 && <Divider sx={{ my: 2 }} />}
                  <ListItem sx={{ px: 0, display: 'block' }}>
                    <Box sx={{ display: 'flex', mb: 1 }}>
                      <Avatar 
                        sx={{ mr: 2, bgcolor: 'primary.main' }}
                      >
                        {review.user_name ? review.user_name.charAt(0).toUpperCase() : 'К'}
                      </Avatar>
                      <Box>
                        <Typography variant="subtitle1">
                          {review.user_name || 'Клиент'}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {formatDate(review.created_at)}
                        </Typography>
                      </Box>
                    </Box>
                    
                    <Box sx={{ display: 'flex', alignItems: 'center', my: 1 }}>
                      <Typography variant="body2" sx={{ mr: 1 }}>
                        Оценка обслуживания:
                      </Typography>
                      <Rating 
                        value={review.service_rating || 0} 
                        readOnly 
                        precision={0.5}
                        size="small"
                      />
                    </Box>
                    
                    {review.comment && (
                      <Typography variant="body2" sx={{ mt: 1 }}>
                        "{review.comment}"
                      </Typography>
                    )}
                  </ListItem>
                </React.Fragment>
              ))}
            </List>
          </CardContent>
        </Card>
      ) : (
        <Paper 
          elevation={0}
          sx={{ 
            p: 3, 
            backgroundColor: 'info.lighter',
            borderRadius: 2,
            textAlign: 'center'
          }}
        >
          <Typography variant="body1" color="text.secondary">
            У вас еще нет отзывов от клиентов
          </Typography>
        </Paper>
      )}
    </Box>
  );
};

export default WaiterReviews; 