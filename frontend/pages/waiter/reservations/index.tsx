import { useState, useEffect } from 'react';
import { NextPage } from 'next';
import { useRouter } from 'next/router';
import WaiterLayout from '../../../components/WaiterLayout';
import useAuthStore from '../../../lib/auth-store';
import { 
  CalendarIcon,
  UserIcon,
  ClockIcon,
  UsersIcon,
  CheckCircleIcon,
  XCircleIcon
} from '@heroicons/react/24/outline';

// Временный интерфейс для тестовых данных
interface Reservation {
  id: number;
  customer_name: string;
  customer_phone: string;
  date: string;
  time: string;
  guests: number;
  table_number: number;
  status: 'upcoming' | 'completed' | 'cancelled';
  notes?: string;
}

const testReservations: Reservation[] = [
  {
    id: 1,
    customer_name: 'Иван Петров',
    customer_phone: '+7 (901) 123-45-67',
    date: '2023-12-15',
    time: '19:00',
    guests: 4,
    table_number: 7,
    status: 'upcoming'
  },
  {
    id: 2,
    customer_name: 'Анна Сидорова',
    customer_phone: '+7 (902) 987-65-43',
    date: '2023-12-15',
    time: '20:30',
    guests: 2,
    table_number: 3,
    status: 'upcoming',
    notes: 'Романтический ужин, подготовить свечи'
  },
  {
    id: 3,
    customer_name: 'Сергей Иванов',
    customer_phone: '+7 (903) 456-78-90',
    date: '2023-12-14',
    time: '18:00',
    guests: 6,
    table_number: 10,
    status: 'completed'
  },
  {
    id: 4,
    customer_name: 'Мария Козлова',
    customer_phone: '+7 (904) 321-98-76',
    date: '2023-12-13',
    time: '21:00',
    guests: 3,
    table_number: 5,
    status: 'cancelled',
    notes: 'Клиент отменил из-за болезни'
  }
];

const formatDate = (dateString: string) => {
  const options: Intl.DateTimeFormatOptions = {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  };
  return new Date(dateString).toLocaleDateString('ru-RU', options);
};

const WaiterReservationsPage: NextPage = () => {
  const router = useRouter();
  const { isAuthenticated, user } = useAuthStore();
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [filteredReservations, setFilteredReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'upcoming' | 'completed' | 'cancelled'>('all');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/auth/login?redirect=/waiter/reservations');
    }
  }, [isAuthenticated, router]);

  useEffect(() => {
    const fetchReservations = async () => {
      try {
        setLoading(true);
        // В реальном приложении здесь был бы API-запрос
        // const data = await reservationsApi.getWaiterReservations();
        const data = testReservations;
        setReservations(data);
        setFilteredReservations(data);
        setError(null);
      } catch (err: any) {
        console.error('Ошибка при получении бронирований:', err);
        setError(err.message || 'Не удалось загрузить бронирования');
      } finally {
        setLoading(false);
      }
    };

    if (isAuthenticated) {
      fetchReservations();
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (filter === 'all') {
      setFilteredReservations(reservations);
    } else {
      setFilteredReservations(reservations.filter(res => res.status === filter));
    }
  }, [filter, reservations]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'upcoming':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
            <ClockIcon className="h-3 w-3 mr-1" />
            Предстоит
          </span>
        );
      case 'completed':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
            <CheckCircleIcon className="h-3 w-3 mr-1" />
            Выполнено
          </span>
        );
      case 'cancelled':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
            <XCircleIcon className="h-3 w-3 mr-1" />
            Отменено
          </span>
        );
      default:
        return null;
    }
  };

  if (!isAuthenticated || !user) {
    return (
      <WaiterLayout title="Загрузка...">
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-primary"></div>
        </div>
      </WaiterLayout>
    );
  }

  return (
    <WaiterLayout title="Бронирования" activeTab="reservations">
      <div className="mb-6">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-xl font-bold">Бронирования столиков</h1>
          <div className="inline-flex rounded-md shadow-sm">
            <button
              type="button"
              onClick={() => setFilter('all')}
              className={`px-4 py-2 text-sm font-medium rounded-l-lg ${
                filter === 'all' ? 'bg-primary text-white' : 'bg-white text-gray-700 hover:bg-gray-100'
              }`}
            >
              Все
            </button>
            <button
              type="button"
              onClick={() => setFilter('upcoming')}
              className={`px-4 py-2 text-sm font-medium ${
                filter === 'upcoming' ? 'bg-primary text-white' : 'bg-white text-gray-700 hover:bg-gray-100'
              }`}
            >
              Предстоят
            </button>
            <button
              type="button"
              onClick={() => setFilter('completed')}
              className={`px-4 py-2 text-sm font-medium ${
                filter === 'completed' ? 'bg-primary text-white' : 'bg-white text-gray-700 hover:bg-gray-100'
              }`}
            >
              Выполнены
            </button>
            <button
              type="button"
              onClick={() => setFilter('cancelled')}
              className={`px-4 py-2 text-sm font-medium rounded-r-lg ${
                filter === 'cancelled' ? 'bg-primary text-white' : 'bg-white text-gray-700 hover:bg-gray-100'
              }`}
            >
              Отменены
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border-l-4 border-red-500 text-red-700 p-4 mb-4 rounded">
            <p>{error}</p>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center items-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
          </div>
        ) : filteredReservations.length === 0 ? (
          <div className="bg-white rounded-lg shadow-md p-6 text-center">
            <div className="h-12 w-12 text-gray-400 mx-auto mb-3">
              <CalendarIcon className="h-12 w-12" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-1">Нет бронирований</h3>
            <p className="text-gray-500">
              Бронирования появятся здесь, когда клиенты забронируют столики в ресторане
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredReservations.map((reservation) => (
              <div key={reservation.id} className="bg-white rounded-lg shadow-md p-4">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h3 className="text-lg font-medium">Бронь #{reservation.id}</h3>
                    <div className="flex items-center text-sm text-gray-500">
                      <CalendarIcon className="h-4 w-4 mr-1" />
                      <span>{formatDate(reservation.date)}, {reservation.time}</span>
                    </div>
                  </div>
                  <div>{getStatusBadge(reservation.status)}</div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
                  <div className="bg-gray-50 rounded p-3">
                    <div className="text-sm text-gray-500 mb-1">Клиент:</div>
                    <div className="flex items-center">
                      <UserIcon className="h-4 w-4 text-gray-500 mr-1" />
                      <div className="font-medium">{reservation.customer_name}</div>
                    </div>
                    <div className="text-sm">{reservation.customer_phone}</div>
                  </div>

                  <div className="bg-gray-50 rounded p-3">
                    <div className="text-sm text-gray-500 mb-1">Информация:</div>
                    <div className="flex items-center mb-1">
                      <UsersIcon className="h-4 w-4 text-gray-500 mr-1" />
                      <div>{reservation.guests} гостей</div>
                    </div>
                    <div className="flex items-center">
                      <svg className="h-4 w-4 text-gray-500 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2H5z" />
                      </svg>
                      <div>Стол #{reservation.table_number}</div>
                    </div>
                  </div>
                </div>

                {reservation.notes && (
                  <div className="mb-3 bg-yellow-50 p-3 rounded-md">
                    <div className="text-sm text-gray-500 mb-1">Примечания:</div>
                    <p className="text-sm">{reservation.notes}</p>
                  </div>
                )}

                {reservation.status === 'upcoming' && (
                  <div className="flex justify-end space-x-2 mt-3">
                    <button className="px-4 py-2 bg-green-100 text-green-800 rounded-md text-sm hover:bg-green-200 transition-colors">
                      Отметить как выполненное
                    </button>
                    <button className="px-4 py-2 bg-red-100 text-red-800 rounded-md text-sm hover:bg-red-200 transition-colors">
                      Отменить
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </WaiterLayout>
  );
};

export default WaiterReservationsPage; 