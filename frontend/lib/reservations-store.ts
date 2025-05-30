import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { Reservation } from '../types';
import { reservationsApi } from './api/reservations-api';

// Интерфейс для результата проверки кода бронирования
interface VerifyReservationCodeResult {
  valid: boolean;
  message?: string;
  reservation?: Reservation;
  tableNumber?: number;
}

interface ReservationsState {
  reservations: Reservation[];
  isLoading: boolean;
  error: string | null;
  lastUpdated: number | null;
  
  // Методы
  getReservations: () => Promise<Reservation[]>;
  createReservation: (data: any) => Promise<any>;
  clearStore: () => void;
  getReservationById: (id: number) => Reservation | undefined;
  verifyReservationCode: (code: string) => Promise<VerifyReservationCodeResult>;
}

const useReservationsStore = create<ReservationsState>()(
  devtools(
    persist(
      (set, get) => ({
        reservations: [],
        isLoading: false,
        error: null,
        lastUpdated: null,
        
        getReservations: async () => {
          set({ isLoading: true, error: null });
          
          try {
            // Проверяем роль пользователя и его ID
            const userRole = localStorage.getItem('user_role') || '';
            const isAdminOrWaiter = userRole === 'admin' || userRole === 'waiter';
            const currentUserId = parseInt(localStorage.getItem('user_id') || '0');
            
            // Принудительно запрашиваем свежие данные
            console.log('Запрос списка бронирований из хранилища');
            
            // Если пользователь не админ/официант, добавляем параметр userId для фильтрации
            let reservations;
            if (!isAdminOrWaiter && currentUserId > 0) {
              console.log(`Запрос бронирований для пользователя ID=${currentUserId}`);
              reservations = await reservationsApi.getReservations({ userId: currentUserId });
            } else {
              reservations = await reservationsApi.getReservations(true);
            }
            
            if (!reservations || !Array.isArray(reservations)) {
              console.error('Получен некорректный ответ при запросе бронирований:', reservations);
              throw new Error('Некорректный ответ от сервера');
            }
            
            console.log(`Получено ${reservations.length} бронирований из API`);
            
            // Добавляем дополнительную проверку и фильтрацию списка бронирований
            const validReservations = reservations.filter(reservation => 
              reservation && 
              typeof reservation === 'object' && 
              (reservation.id || reservation.reservation_code)
            );
            
            if (validReservations.length !== reservations.length) {
              console.warn(`Отфильтровано ${reservations.length - validReservations.length} некорректных записей бронирований`);
            }
            
            // Сортируем бронирования: сначала ожидающие подтверждения, затем подтвержденные, потом остальные
            const sortedReservations = [...validReservations].sort((a, b) => {
              // Сначала сортируем по статусу
              const statusOrder = { pending: 0, confirmed: 1, completed: 2, cancelled: 3 };
              const statusA = statusOrder[a.status as keyof typeof statusOrder] ?? 999;
              const statusB = statusOrder[b.status as keyof typeof statusOrder] ?? 999;
              
              if (statusA !== statusB) {
                return statusA - statusB;
              }
              
              // Если статусы одинаковые, сортируем по дате создания (новые сверху)
              const dateA = new Date(a.created_at || 0).getTime();
              const dateB = new Date(b.created_at || 0).getTime();
              return dateB - dateA;
            });
            
            console.log('Бронирования отсортированы и готовы к отображению');
            
            set({ 
              reservations: sortedReservations, 
              isLoading: false, 
              lastUpdated: Date.now() 
            });
            
            return sortedReservations;
          } catch (error: any) {
            console.error('Ошибка при получении бронирований:', error);
            
            // В случае ошибки пробуем использовать существующие данные
            const existingReservations = get().reservations;
            if (existingReservations && existingReservations.length > 0) {
              console.log('Используем существующие данные из хранилища');
              set({ isLoading: false, error: error.message });
              return existingReservations;
            }
            
            set({ 
              isLoading: false, 
              error: error.message || 'Не удалось загрузить бронирования'
            });
            
            return [];
          }
        },
        
        createReservation: async (data: any) => {
          set({ isLoading: true, error: null });
          
          try {
            // Создаем бронирование
            const newReservation = await reservationsApi.createReservation(data);
            
            // Проверяем, что в результате мы получили объект
            if (!newReservation || (Array.isArray(newReservation) && newReservation.length === 0)) {
              console.error('Ошибка при создании бронирования: некорректный ответ сервера', newReservation);
              
              // Создаем локальную заглушку для отображения
              const mockReservation = {
                id: Date.now(),
                ...data,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                status: 'pending',
                reservation_code: `RES-${Math.floor(1000 + Math.random() * 9000)}`
              };
              
              // Добавляем к существующим бронированиям
              set(state => ({ 
                reservations: [...state.reservations, mockReservation],
                isLoading: false,
                lastUpdated: Date.now()
              }));
              
              // Принудительно обновляем список после небольшой задержки
              setTimeout(() => {
                const { getReservations } = get();
                console.log('Принудительное обновление списка бронирований после создания фиктивного объекта');
                getReservations();
              }, 2000);
              
              return mockReservation;
            }
            
            // Если все нормально, добавляем новое бронирование в список
            if (newReservation && typeof newReservation === 'object') {
              // Принудительное обновление списка бронирований
              set(state => {
                // Проверяем, нет ли уже такого бронирования в списке
                const exists = state.reservations.some(r => 
                  r.id === newReservation.id || 
                  (r.reservation_code && r.reservation_code === newReservation.reservation_code)
                );
                
                // Если такого бронирования нет, добавляем его
                const updatedReservations = exists 
                  ? state.reservations 
                  : [...state.reservations, newReservation];
                
                console.log('Бронирование успешно создано и добавлено в список:', newReservation);
                
                return { 
                  reservations: updatedReservations,
                  isLoading: false,
                  lastUpdated: Date.now()
                };
              });
              
              // Записываем код бронирования в localStorage для будущего использования
              try {
                if (newReservation.reservation_code) {
                  const reservationData = {
                    code: newReservation.reservation_code,
                    id: newReservation.id,
                    created: new Date().toISOString(),
                    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 дней
                  };
                  localStorage.setItem(`reservation_code_${newReservation.id}`, JSON.stringify(reservationData));
                  console.log('Код бронирования сохранен в localStorage:', newReservation.reservation_code);
                }
              } catch (storageError) {
                console.error('Ошибка при сохранении кода бронирования в localStorage:', storageError);
              }
              
              // После создания нового бронирования обновляем список всех бронирований
              setTimeout(() => {
                const { getReservations } = get();
                console.log('Принудительное обновление списка бронирований после создания');
                getReservations();
              }, 2000);
            }
            
            return newReservation;
          } catch (error: any) {
            console.error('Ошибка при создании бронирования:', error);
            set({ 
              isLoading: false, 
              error: error.message || 'Не удалось создать бронирование'
            });
            throw error;
          }
        },
        
        clearStore: () => {
          set({ 
            reservations: [],
            isLoading: false,
            error: null,
            lastUpdated: null
          });
        },
        
        getReservationById: (id: number) => {
          return get().reservations.find(reservation => reservation.id === id);
        },
        
        verifyReservationCode: async (code: string) => {
          set({ isLoading: true, error: null });
          
          try {
            const result = await reservationsApi.verifyReservationCode(code);
            set({ isLoading: false });
            
            // Возвращаем полный объект ответа с полем valid и другими свойствами
            return result as VerifyReservationCodeResult;
          } catch (error: any) {
            console.error('Ошибка при проверке кода бронирования:', error);
            set({ 
              isLoading: false, 
              error: error.message || 'Не удалось проверить код бронирования'
            });
            
            // Возвращаем объект с полем valid: false в случае ошибки
            return { 
              valid: false,
              message: error.message || 'Не удалось проверить код бронирования' 
            };
          }
        }
      }),
      {
        name: 'reservations-storage',
        partialize: (state) => ({ 
          reservations: state.reservations,
          lastUpdated: state.lastUpdated
        })
      }
    )
  )
);

export default useReservationsStore;