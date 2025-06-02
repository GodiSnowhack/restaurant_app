import { useEffect } from 'react'
import { useRouter } from 'next/router'
import Layout from '../../components/Layout'
import LoadingSpinner from '../../components/LoadingSpinner'
import useAuthStore from '../../lib/auth-store'

/**
 * Страница-перенаправление с /admin/dashboard на основную страницу админ-панели /admin
 */
export default function AdminDashboardRedirect() {
  const router = useRouter()
  const { user, isAuthenticated } = useAuthStore()

  useEffect(() => {
    // Проверка авторизации
    if (!isAuthenticated) {
      router.push('/auth/login')
      return
    }

    // Проверка роли пользователя
    if (user?.role !== 'admin') {
      router.push('/')
      return
    }

    // Перенаправление на основную страницу админ-панели
    router.push('/admin')
  }, [isAuthenticated, router, user])

  return (
    <Layout>
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner size="large" />
      </div>
    </Layout>
  )
} 