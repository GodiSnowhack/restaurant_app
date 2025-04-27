import { useEffect } from 'react'
import { useRouter } from 'next/router'
import Layout from '../../../../components/Layout';

export default function EditRedirect() {
  const router = useRouter()
  const { id } = router.query

  useEffect(() => {
    if (id) {
      // Перенаправляем на правильный URL
      router.replace(`/admin/menu/dishes/${id}`)
    }
  }, [id, router])

  return (
    <Layout title="Перенаправление..." section="admin">
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-primary mb-4"></div>
        <p className="text-lg text-gray-600">Перенаправление...</p>
      </div>
    </Layout>
  )
} 