function escapeHtml(value: string): string {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
}

export function renderNotificationEmail(input: { title: string; body: string; appUrl: string }) {
    const inboxUrl = `${input.appUrl.replace(/\/$/, '')}/notificaciones`
    const htmlBody = escapeHtml(input.body).replace(/\n/g, '<br>')

    return {
        subject: input.title,
        text: `${input.body}\n\nVer en Ritual: ${inboxUrl}`,
        html: [
            `<h2>${escapeHtml(input.title)}</h2>`,
            `<p>${htmlBody}</p>`,
            `<p><a href="${inboxUrl}">Ver en Ritual</a></p>`,
        ].join(''),
    }
}
