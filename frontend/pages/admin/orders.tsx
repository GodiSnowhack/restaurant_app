import React, { useState, useEffect } from 'react';
import { 
  Box, Typography, Paper, Table, TableBody, TableCell, 
  TableHead, TableRow, Button, Card, CardContent, TableContainer,
  TextField, IconButton, Chip, Grid, CircularProgress, Alert,
  Dialog, DialogTitle, DialogContent, DialogActions,
  FormControl, InputLabel, Select, MenuItem
} from '@mui/material';
import { Edit, Delete, Refresh, Search, Print, AttachMoney } from '@mui/icons-material';
import Layout from '../../components/Layout';
import { ordersApi } from '../../lib/api/orders';
import { format, addDays, subDays, parseISO } from 'date-fns';
import { Order } from '../../lib/api/types';

const OrdersPage = () => {
  // Состояние для хранения заказов и фильтров
  const [orders, setOrders] = useState<Order[]>([]);
  const [filteredOrders, setFilteredOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [startDate, setStartDate] = useState<string>(format(subDays(new Date(), 7), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [refreshKey, setRefreshKey] = useState(0);
  const [demoMode, setDemoMode] = useState(false);
  
  // Эффект для загрузки заказов при монтировании компонента или изменении дат
  useEffect(() => {
    // Проверяем, нужно ли включить демо-режим (для локальной разработки)
    const isDemo = localStorage.getItem('demo_mode') === 'true';
    setDemoMode(isDemo);
    console.log('Режим демо-данных', isDemo ? 'включен' : 'отключен');
    
    // Функция для загрузки заказов
    const fetchOrders = async () => {
      setLoading(true);
      setError(null);
      
      try {
        // Используем строковые даты напрямую
        const formattedStartDate = startDate;
        const formattedEndDate = endDate;
        
        console.log('Даты для запроса:', { startDate: formattedStartDate, endDate: formattedEndDate });
        
        // Получаем заказы с сервера
        const fetchedOrders = await ordersApi.getOrders(formattedStartDate, formattedEndDate);
        
        console.log('Полученные заказы:', fetchedOrders);
        
        if (Array.isArray(fetchedOrders)) {
          // Нормализуем данные заказов
          const normalizedOrders = fetchedOrders.map(order => ({
            ...order,
            id: order.id || 0,
            status: order.status || 'pending',
            created_at: order.created_at || new Date().toISOString(),
            total_amount: order.total_amount || order.total_price || 0,
            items: Array.isArray(order.items) ? order.items : []
          }));
          
          console.log('Нормализованные заказы:', normalizedOrders);
          setOrders(normalizedOrders);
          applyFilters(normalizedOrders, searchTerm, statusFilter);
        } else {
          console.error('Ошибка: полученные данные не являются массивом');
          setError('Данные получены в неверном формате');
          setOrders([]);
          setFilteredOrders([]);
        }
      } catch (err) {
        console.error('Ошибка при загрузке заказов:', err);
        setError('Не удалось загрузить заказы. Проверьте соединение с сервером.');
        setOrders([]);
        setFilteredOrders([]);
      } finally {
        setLoading(false);
      }
    };
    
    fetchOrders();
  }, [startDate, endDate, refreshKey]);
  
  // Функция для применения фильтров к заказам
  const applyFilters = (ordersList: Order[], search: string, status: string) => {
    let result = [...ordersList];
    
    // Фильтрация по поисковому запросу
    if (search.trim() !== '') {
      const searchLower = search.toLowerCase();
      result = result.filter(order => 
        (order.customer_name && order.customer_name.toLowerCase().includes(searchLower)) ||
        (order.customer_phone && order.customer_phone.toLowerCase().includes(searchLower)) ||
        (order.id && order.id.toString().includes(searchLower)) ||
        (order.order_code && order.order_code.toLowerCase().includes(searchLower))
      );
    }
    
    // Фильтрация по статусу
    if (status !== 'all') {
      result = result.filter(order => order.status === status);
    }
    
    setFilteredOrders(result);
  };
  
  // Обработчик изменения поискового запроса
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchTerm(value);
    applyFilters(orders, value, statusFilter);
  };
  
  // Обработчик изменения фильтра статуса
  const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    setStatusFilter(value);
    applyFilters(orders, searchTerm, value);
  };
  
  // Обработчик обновления данных
  const handleRefresh = () => {
    setRefreshKey(prevKey => prevKey + 1);
  };
  
  // Обработчики изменения дат
  const handleStartDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setStartDate(e.target.value);
  };
  
  const handleEndDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEndDate(e.target.value);
  };
  
  // Функция для форматирования даты
  const formatDateTime = (dateStr: string | undefined) => {
    if (!dateStr) return 'Н/Д';
    try {
      const date = parseISO(dateStr);
      return format(date, 'dd.MM.yyyy HH:mm');
    } catch (e) {
      return 'Неверная дата';
    }
  };
  
  // Функция для получения цветового кода статуса
  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'pending': return 'warning';
      case 'confirmed': return 'info';
      case 'preparing': return 'primary';
      case 'ready': return 'success';
      case 'completed': return 'success';
      case 'cancelled': return 'error';
      default: return 'default';
    }
  };
  
  // Функция для получения русского названия статуса
  const getStatusLabel = (status: string) => {
    switch (status.toLowerCase()) {
      case 'pending': return 'Ожидание';
      case 'confirmed': return 'Подтвержден';
      case 'preparing': return 'Готовится';
      case 'ready': return 'Готов';
      case 'completed': return 'Завершен';
      case 'cancelled': return 'Отменен';
      default: return status;
    }
  };

  return (
    <Layout title="Управление заказами | Админ-панель">
      <Box sx={{ p: 3 }}>
        <Card sx={{ mb: 4 }}>
          <CardContent>
            <Typography variant="h5" component="h2" sx={{ mb: 3 }}>
              Фильтры и управление
            </Typography>
            
            <Grid container spacing={2} alignItems="center">
              <Grid item xs={12} md={3}>
                <TextField
                  label="Начальная дата"
                  type="date"
                  value={startDate}
                  onChange={handleStartDateChange}
                  fullWidth
                  InputLabelProps={{
                    shrink: true,
                  }}
                />
              </Grid>
              
              <Grid item xs={12} md={3}>
                <TextField
                  label="Конечная дата"
                  type="date"
                  value={endDate}
                  onChange={handleEndDateChange}
                  fullWidth
                  InputLabelProps={{
                    shrink: true,
                  }}
                />
              </Grid>
              
              <Grid item xs={12} md={3}>
                <FormControl fullWidth>
                  <InputLabel id="status-filter-label">Статус</InputLabel>
                  <Select
                    labelId="status-filter-label"
                    value={statusFilter}
                    label="Статус"
                    onChange={handleStatusChange}
                  >
                    <MenuItem value="all">Все статусы</MenuItem>
                    <MenuItem value="pending">Ожидание</MenuItem>
                    <MenuItem value="confirmed">Подтвержден</MenuItem>
                    <MenuItem value="preparing">Готовится</MenuItem>
                    <MenuItem value="ready">Готов</MenuItem>
                    <MenuItem value="completed">Завершен</MenuItem>
                    <MenuItem value="cancelled">Отменен</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              
              <Grid item xs={12} md={3}>
                <TextField
                  fullWidth
                  label="Поиск"
                  variant="outlined"
                  value={searchTerm}
                  onChange={handleSearchChange}
                  InputProps={{
                    startAdornment: <Search sx={{ mr: 1, color: 'action.active' }} />
                  }}
                />
              </Grid>
              
              <Grid item xs={12} md={3}>
                <Button
                  variant="contained"
                  color="primary"
                  startIcon={<Refresh />}
                  onClick={handleRefresh}
                  sx={{ height: '56px' }}
                  fullWidth
                >
                  Обновить
                </Button>
              </Grid>
            </Grid>
          </CardContent>
        </Card>

        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}
        
        {demoMode && (
          <Alert severity="info" sx={{ mb: 3 }}>
            Демо-режим активен. Показаны тестовые данные.
          </Alert>
        )}
        
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', my: 5 }}>
            <CircularProgress />
          </Box>
        ) : filteredOrders.length > 0 ? (
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>№</TableCell>
                  <TableCell>Дата и время</TableCell>
                  <TableCell>Клиент</TableCell>
                  <TableCell>Статус</TableCell>
                  <TableCell>Сумма</TableCell>
                  <TableCell>Столик</TableCell>
                  <TableCell>Позиций</TableCell>
                  <TableCell>Действия</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredOrders.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell>{order.id}</TableCell>
                    <TableCell>{formatDateTime(order.created_at)}</TableCell>
                    <TableCell>
                      {order.customer_name || 'Н/Д'}
                      {order.customer_phone && <div>{order.customer_phone}</div>}
                    </TableCell>
                    <TableCell>
                      <Chip 
                        label={getStatusLabel(order.status)} 
                        color={getStatusColor(order.status) as any}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>{order.total_amount?.toLocaleString()} ₸</TableCell>
                    <TableCell>{order.table_number || 'Н/Д'}</TableCell>
                    <TableCell>{order.items?.length || 0}</TableCell>
                    <TableCell>
                      <IconButton size="small" color="primary" title="Редактировать">
                        <Edit />
                      </IconButton>
                      <IconButton size="small" color="secondary" title="Оплата">
                        <AttachMoney />
                      </IconButton>
                      <IconButton size="small" color="default" title="Печать">
                        <Print />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        ) : (
          <Paper sx={{ p: 4, textAlign: 'center' }}>
            <Typography variant="h6">Заказы не найдены</Typography>
            <Typography variant="body2" color="textSecondary">
              Попробуйте изменить параметры фильтрации или выбрать другой диапазон дат
            </Typography>
          </Paper>
        )}
      </Box>
    </Layout>
  );
};

export default OrdersPage; 