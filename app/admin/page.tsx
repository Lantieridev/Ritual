import { redirect } from 'next/navigation'
import { routes } from '@/src/core/lib/routes'

export default function AdminIndex() {
  redirect(routes.admin.moderation.artists)
}
