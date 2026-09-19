import type { EmailSender } from './types'

const RESEND_URL = 'https://api.resend.com/emails'
const ERROR_BODY_LIMIT = 200

export function createResendSender(apiKey: string, from: string, fetchImpl: typeof fetch = fetch): EmailSender {
    return {
        async send(message) {
            const response = await fetchImpl(RESEND_URL, {
                method: 'POST',
                headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    from,
                    to: [message.to],
                    subject: message.subject,
                    text: message.text,
                    html: message.html,
                }),
            })
            if (!response.ok) {
                const body = (await response.text()).slice(0, ERROR_BODY_LIMIT)
                throw new Error(`Resend ${response.status}: ${body}`)
            }
        },
    }
}
