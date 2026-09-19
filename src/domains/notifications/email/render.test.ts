import { describe, it, expect } from 'vitest'
import { renderNotificationEmail } from './render'

describe('renderNotificationEmail', () => {
    it('uses the title as subject and links to the inbox', () => {
        const email = renderNotificationEmail({ title: 'Te faltan datos', body: 'Puntuar el show', appUrl: 'https://ritual.app' })

        expect(email.subject).toBe('Te faltan datos')
        expect(email.text).toContain('Puntuar el show')
        expect(email.text).toContain('https://ritual.app/notificaciones')
        expect(email.html).toContain('href="https://ritual.app/notificaciones"')
    })

    it('escapes HTML in title and body', () => {
        const email = renderNotificationEmail({ title: '<b>x</b>', body: 'a & <script>', appUrl: 'https://ritual.app' })

        expect(email.html).not.toContain('<script>')
        expect(email.html).toContain('a &amp; &lt;script&gt;')
        expect(email.html).toContain('&lt;b&gt;x&lt;/b&gt;')
    })

    it('keeps line breaks of the body in the HTML version', () => {
        const email = renderNotificationEmail({ title: 't', body: 'uno\ndos', appUrl: 'https://ritual.app' })

        expect(email.html).toContain('uno<br>dos')
    })
})
