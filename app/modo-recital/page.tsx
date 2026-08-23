import { redirect } from 'next/navigation'
import { getCurrentUserId } from '@/src/core/auth/session'
import { routes } from '@/src/core/lib/routes'
import { PageShell } from '@/src/core/components/layout'
import { getShowModeSettings } from '@/src/domains/showmode/service'
import {
    saveShowModePreferences,
    addChecklistTemplateItem,
    removeChecklistTemplateItem,
} from '@/src/domains/showmode/actions'
import { ShowModeSettingsForm } from '@/src/domains/showmode/components'

export const metadata = {
    title: 'Modo recital | RITUAL',
}

/**
 * Ajustes del modo recital activo (issue #9). Las dos cosas que el issue
 * pide configurar una sola vez, juntas: el largo de la ventana y la
 * plantilla base del checklist pre-show.
 */
export default async function ShowModeSettingsPage() {
    const userId = await getCurrentUserId()
    if (!userId) redirect(routes.login)

    const { preferences, templateItems } = await getShowModeSettings(userId)

    return (
        <PageShell
            backHref={routes.profile}
            backLabel="← Volver al perfil"
            title="Modo recital"
            description="Cómo querés que la app te acompañe alrededor de un show."
        >
            <ShowModeSettingsForm
                initialPreferences={preferences}
                initialTemplateItems={templateItems}
                savePreferences={saveShowModePreferences}
                addTemplateItem={addChecklistTemplateItem}
                removeTemplateItem={removeChecklistTemplateItem}
            />
        </PageShell>
    )
}
