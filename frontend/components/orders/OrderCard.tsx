import { useState } from 'react';
import { Card, CardContent, Typography, Chip, Button, Box, Grid, Divider, List, ListItem, ListItemText } from '@mui/material';
import { formatCurrency } from '../../lib/utils/format';

// Определение типов
interface OrderItem {
  dish_id: number;
  quantity: number;
  price: number;
  name: string;
  special_instructions?: string;
  total_price?: number;
}

interface Order {
  id: number;
  user_id?: number;
  waiter_id?: number;
  table_number?: number | null;
  status: string;
  payment_status?: string;
  payment_method?: string;
  order_type?: string;
  total_amount: number | string;
  total_price?: number | string;
  created_at: string;
  updated_at?: string;
  completed_at?: string | null;
  customer_name?: string;
  customer_phone?: string;
  customer_email?: string;
  delivery_address?: string | null;
  order_code?: string;
  reservation_code?: string;
  is_urgent?: boolean;
  is_group_order?: boolean;
  comment?: string;
  items: OrderItem[];
}

interface OrderCardProps {
  order: Order;
  onStatusChange?: (orderId: number, newStatus: string) => void;
}

export default function OrderCard({ order, onStatusChange }: OrderCardProps) {
  // Функция для безопасного получения даты
  const safeDate = (dateString?: string) => {
    if (!dateString) return 'Не указано';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return 'Некорректная дата';
      return new Intl.DateTimeFormat('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }).format(date);
    } catch (e) {
      console.error('Ошибка при форматировании даты:', e);
      return 'Некорректная дата';
    }
  };

  // Получаем статус заказа с обработкой неопределенных значений
  const orderStatus = order.status || 'pending';
  
  // Получаем данные товаров с проверкой
  const items = Array.isArray(order.items) ? order.items : [];
  
  // Общая сумма с проверкой
  const totalAmount = typeof order.total_amount === 'number' 
    ? order.total_amount 
    : (typeof order.total_amount === 'string' 
      ? parseFloat(order.total_amount) 
      : 0);
  
  // Безопасно получаем имя клиента
  const customerName = order.customer_name || 'Клиент';
  
  // Тип заказа с проверкой
  const orderType = order.order_type || 'dine-in';
  
  // Статусы заказа с русскими названиями
  const statusLabels: Record<string, string> = {
    'pending': 'Ожидает',
    'confirmed': 'Подтвержден',
    'preparing': 'Готовится',
    'ready': 'Готов',
    'completed': 'Завершен',
    'cancelled': 'Отменен'
  };
  
  // Цвета для статусов
  const statusColors: Record<string, 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning'> = {
    'pending': 'warning',
    'confirmed': 'info',
    'preparing': 'primary',
    'ready': 'success',
    'completed': 'success',
    'cancelled': 'error'
  };
  
  // Русские названия для типов заказа
  const orderTypeLabels: Record<string, string> = {
    'dine-in': 'В ресторане',
    'takeaway': 'С собой',
    'delivery': 'Доставка',
    'pickup': 'Самовывоз'
  };
  
  return (
    <Card sx={{ mb: 2, boxShadow: 2 }}>
      <CardContent>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={8}>
            <Typography variant="h6" gutterBottom>
              Заказ #{order.id} {order.is_urgent && <Chip size="small" color="error" label="Срочно" />}
            </Typography>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              {customerName} • {safeDate(order.created_at)}
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <Chip 
                label={statusLabels[orderStatus] || orderStatus}
                color={statusColors[orderStatus] || 'default'}
                size="small"
              />
              <Chip 
                label={orderTypeLabels[orderType] || orderType}
                variant="outlined"
                size="small"
              />
              {order.table_number && (
                <Chip 
                  label={`Стол ${order.table_number}`}
                  variant="outlined"
                  size="small"
                />
              )}
            </Box>
            
            <Divider sx={{ my: 1 }} />
            
            <List dense disablePadding>
              {items.map((item, index) => (
                <ListItem key={index} disablePadding sx={{ py: 0.5 }}>
                  <ListItemText
                    primary={`${item.name} x ${item.quantity}`}
                    secondary={formatCurrency(item.price)}
                  />
                </ListItem>
              ))}
            </List>
            
            {order.comment && (
              <Box sx={{ mt: 1, p: 1, bgcolor: 'background.paper', borderRadius: 1 }}>
                <Typography variant="body2" color="text.secondary">
                  <strong>Комментарий:</strong> {order.comment}
                </Typography>
              </Box>
            )}
          </Grid>
          
          <Grid item xs={12} sm={4}>
            <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
              <Typography variant="h6" align="right">
                {formatCurrency(totalAmount)}
              </Typography>
              
              <Box sx={{ mt: 'auto', display: 'flex', flexDirection: 'column', gap: 1 }}>
                {onStatusChange && orderStatus !== 'completed' && orderStatus !== 'cancelled' && (
                  <Button 
                    variant="contained" 
                    color="primary" 
                    fullWidth
                    onClick={() => {
                      const nextStatus = {
                        'pending': 'confirmed',
                        'confirmed': 'preparing',
                        'preparing': 'ready',
                        'ready': 'completed'
                      }[orderStatus];
                      
                      if (nextStatus && onStatusChange) {
                        onStatusChange(order.id, nextStatus);
                      }
                    }}
                  >
                    {orderStatus === 'pending' && 'Подтвердить'}
                    {orderStatus === 'confirmed' && 'Готовить'}
                    {orderStatus === 'preparing' && 'Готово'}
                    {orderStatus === 'ready' && 'Завершить'}
                  </Button>
                )}
                
                {onStatusChange && orderStatus !== 'cancelled' && orderStatus !== 'completed' && (
                  <Button 
                    variant="outlined" 
                    color="error" 
                    fullWidth
                    onClick={() => onStatusChange(order.id, 'cancelled')}
                  >
                    Отменить
                  </Button>
                )}
              </Box>
            </Box>
          </Grid>
        </Grid>
      </CardContent>
    </Card>
  );
} 