import 'server-only'
import { after } from 'next/server'
import { createServiceClient } from '@/src/core/lib/supabase/service'
import { getNotificationsFromEmail, getResendApiKey } from '@/src/core/lib/env'
import type { ActionResult } from '@/src/core/types'
import { createResendSender } from './email/resend'
import { deliverNotifications } from './jobs/deliverNotifications'
import { notify } from './notify'

/**
 * Admin → user direct message. The caller (GraphQL resolver) has already
 * checked the admin role. The row is created synchronously; the email attempt
 * runs after the response via `after()`. If it fails, the row stays `pending`
 * and the daily deliver-notifications cron retries it.
 */
export async function sendAdminMessage(input: { userId: string; title: string; body: string }): Promise<ActionResult> {
    const title = input.title.trim()
    const body = input.body.trim()
    if (!title) return { error: 'El título es obligatorio.' }
    if (!body) return { error: 'El mensaje es obligatorio.' }

    const supabase = createServiceClient()
    if (!supabase) return { error: 'El servicio de avisos no está configurado.' }

    const { outcome, id } = await notify(supabase, { userId: input.userId, type: 'admin_message', title, body })
    if (outcome === 'suppressed') return { error: 'La persona desactivó este tipo de aviso.' }
    if (outcome !== 'created' || !id) return { error: 'No pudimos enviar el mensaje.' }

    const apiKey = getResendApiKey()
    const from = getNotificationsFromEmail()
    if (apiKey && from) {
        after(async () => {
            await deliverNotifications(supabase, createResendSender(apiKey, from), { onlyIds: [id] })
        })
    }
    return {}
}
