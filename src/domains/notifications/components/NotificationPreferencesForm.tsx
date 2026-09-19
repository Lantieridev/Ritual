'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useMutation, gql } from 'urql'
import { unwrapMutation } from '@/src/graphql/mutation-result'
import type { NotificationPreferenceView } from '../service'
import type { NotificationType } from '../types'

const UpdatePreferenceMutation = gql`
  mutation UpdateNotificationPreference($type: NotificationType!, $inApp: Boolean!, $email: Boolean!) {
    updateNotificationPreference(type: $type, inApp: $inApp, email: $email) { error }
  }
`

interface NotificationPreferencesFormProps {
    preferences: readonly NotificationPreferenceView[]
}

type Channel = 'inApp' | 'email'

/** One switch per type and channel; each change saves immediately and reverts if the save fails. */
export function NotificationPreferencesForm({ preferences }: NotificationPreferencesFormProps) {
    const router = useRouter()
    const [, updatePreference] = useMutation(UpdatePreferenceMutation)
    const [state, setState] = useState(() =>
        Object.fromEntries(preferences.map((p) => [p.type, { inApp: p.inApp, email: p.email }]))
    )
    const [error, setError] = useState<string | null>(null)

    async function toggle(type: NotificationType, channel: Channel) {
        const previous = state[type]
        const next = { ...previous, [channel]: !previous[channel] }
        setError(null)
        setState((current) => ({ ...current, [type]: next }))

        const result = unwrapMutation(
            await updatePreference({ type, inApp: next.inApp, email: next.email }),
            'updateNotificationPreference',
            'No pudimos guardar tus preferencias.'
        )
        if (result.error) {
            setState((current) => ({ ...current, [type]: previous }))
            setError(result.error)
            return
        }
        router.refresh()
    }

    return (
        <div className="space-y-6">
            {preferences.map((preference) => (
                <fieldset key={preference.type} className="space-y-2">
                    <legend className="font-display text-lg uppercase text-ritual-bone">{preference.label}</legend>
                    <p className="text-sm text-ritual-gray-text">{preference.description}</p>
                    <label className="flex items-center gap-2 text-ritual-bone">
                        <input
                            type="checkbox"
                            aria-label={`${preference.label} — en la app`}
                            checked={state[preference.type].inApp}
                            onChange={() => toggle(preference.type, 'inApp')}
                        />
                        En la app
                    </label>
                    <label className="flex items-center gap-2 text-ritual-bone">
                        <input
                            type="checkbox"
                            aria-label={`${preference.label} — email`}
                            checked={state[preference.type].email}
                            onChange={() => toggle(preference.type, 'email')}
                        />
                        Email
                    </label>
                </fieldset>
            ))}
            {error && <p role="alert" className="text-sm text-ritual-red-hover">{error}</p>}
        </div>
    )
}
