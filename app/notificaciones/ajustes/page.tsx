import { redirect } from 'next/navigation'
import { createClient } from '@/src/core/lib/supabase/server'
import { PageShell } from '@/src/core/components/layout'
import { routes } from '@/src/core/lib/routes'
import { getMyNotificationPreferences } from '@/src/domains/notifications/service'
import { NotificationPreferencesForm } from '@/src/domains/notifications/components'

export const metadata = {
    title: 'Ajustes de avisos | RITUAL',
}

export default async function NotificationSettingsPage() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) redirect(routes.login)

    const preferences = await getMyNotificationPreferences()

    return (
        <PageShell
            backHref={routes.notifications}
            backLabel="← Volver a avisos"
            title="Ajustes de avisos"
            description="Elegí qué avisos querés recibir y por dónde."
        >
            <div className="max-w-2xl mx-auto">
                <NotificationPreferencesForm preferences={preferences} />
            </div>
        </PageShell>
    )
}
