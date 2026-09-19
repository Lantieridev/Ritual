import { describe, it, expect, vi } from 'vitest'
import { createResendSender } from './resend'

const message = { to: 'a@b.com', subject: 'S', text: 'T', html: '<p>T</p>' }

describe('createResendSender', () => {
    it('posts the message to the Resend API with the bearer key', async () => {
        const fetchImpl = vi.fn().mockResolvedValue(new Response('{"id":"x"}', { status: 200 }))

        await createResendSender('re_key', 'Ritual <avisos@ritual.app>', fetchImpl).send(message)

        expect(fetchImpl).toHaveBeenCalledWith('https://api.resend.com/emails', {
            method: 'POST',
            headers: { Authorization: 'Bearer re_key', 'Content-Type': 'application/json' },
            body: JSON.stringify({
                from: 'Ritual <avisos@ritual.app>',
                to: ['a@b.com'],
                subject: 'S',
                text: 'T',
                html: '<p>T</p>',
            }),
        })
    })

    it('throws with the status and a trimmed body on a non-2xx response', async () => {
        const fetchImpl = vi.fn().mockResolvedValue(new Response('x'.repeat(500), { status: 422 }))

        const promise = createResendSender('k', 'f', fetchImpl).send(message)

        await expect(promise).rejects.toThrow(/^Resend 422: x{200}$/)
    })
})
