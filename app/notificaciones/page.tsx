import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/src/core/lib/supabase/server'
import { PageShell } from '@/src/core/components/layout'
import { routes } from '@/src/core/lib/routes'
import { listMyNotifications } from '@/src/domains/notifications/service'
import { NotificationList, MarkAllReadButton } from '@/src/domains/notifications/components'

export const metadata = {
    title: 'Avisos | RITUAL',
}

export default async function NotificationsPage() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) redirect(routes.login)

    const items = await listMyNotifications()

    return (
        <PageShell title="Avisos" description="Lo que Ritual quiere que sepas.">
            <div className="max-w-2xl mx-auto space-y-6">
                <div className="flex items-center justify-between gap-4">
                    <Link href={routes.notificationSettings} className="text-sm text-ritual-gray-text hover:text-white">
                        Ajustes de avisos
                    </Link>
                    {items.some((item) => item.readAt === null) && <MarkAllReadButton />}
                </div>
                <NotificationList items={items} />
            </div>
        </PageShell>
    )
}
