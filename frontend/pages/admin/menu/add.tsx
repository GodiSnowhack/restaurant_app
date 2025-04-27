import { useEffect } from 'react';
import { useRouter } from 'next/router';
import Layout from '../../../components/Layout';
import useAuthStore from '../../../lib/auth-store';

const AddDishPage = () => {
  const router = useRouter();
  const { isAuthenticated, user } = useAuthStore();

  useEffect(() => {
    // Проверка авторизации пользователя
    if (!isAuthenticated) {
      router.push('/auth/login');
      return;
    }

    // Проверка роли администратора
    if (user?.role !== 'admin') {
      router.push('/');
      return;
    }

    // Перенаправление на страницу админ-меню с открытой формой добавления блюда
    router.push({
      pathname: '/admin/menu',
      query: { showDishForm: 'true' }
    });
  }, [isAuthenticated, user, router]);

  return (
    <Layout title="Добавление блюда | Админ-панель">
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
        </div>
      </div>
    </Layout>
  );
};

export default AddDishPage; 