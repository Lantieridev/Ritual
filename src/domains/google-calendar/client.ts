export interface GoogleCalendarEventPayload {
    summary: string
    description: string
    start: { dateTime: string }
    end: { dateTime: string }
}

export interface GoogleCalendarClient {
    exchangeCodeForTokens(code: string, redirectUri: string): Promise<{ refresh_token?: string, access_token: string }>
    revokeToken(token: string): Promise<void>
    refreshAccessToken(refreshToken: string): Promise<string>
    insertEvent(accessToken: string, payload: GoogleCalendarEventPayload): Promise<string>
    updateEvent(accessToken: string, eventId: string, payload: GoogleCalendarEventPayload): Promise<void>
}

class RealGoogleCalendarClient implements GoogleCalendarClient {
    async exchangeCodeForTokens(code: string, redirectUri: string) {
        const res = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                code,
                client_id: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID!,
                client_secret: process.env.GOOGLE_CLIENT_SECRET!,
                redirect_uri: redirectUri,
                grant_type: 'authorization_code',
            })
        })
        if (!res.ok) {
            throw new Error(`Google OAuth exchange failed: ${await res.text()}`)
        }
        return res.json()
    }

    async revokeToken(token: string) {
        const res = await fetch('https://oauth2.googleapis.com/revoke', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({ token })
        })
        if (!res.ok) {
            throw new Error(`Google OAuth revoke failed: ${await res.text()}`)
        }
    }

    async refreshAccessToken(refreshToken: string) {
        const res = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                client_id: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID!,
                client_secret: process.env.GOOGLE_CLIENT_SECRET!,
                refresh_token: refreshToken,
                grant_type: 'refresh_token',
            })
        })
        if (!res.ok) {
            throw new Error(`Google OAuth refresh failed: ${await res.text()}`)
        }
        const data = await res.json()
        return data.access_token
    }

    async insertEvent(accessToken: string, payload: GoogleCalendarEventPayload) {
        const res = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload)
        })
        if (!res.ok) {
            throw new Error(`Google Calendar insert failed: ${await res.text()}`)
        }
        const data = await res.json()
        return data.id
    }

    async updateEvent(accessToken: string, eventId: string, payload: GoogleCalendarEventPayload) {
        const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload)
        })
        if (!res.ok) {
            throw new Error(`Google Calendar update failed: ${await res.text()}`)
        }
    }
}

export const googleCalendarClient: GoogleCalendarClient = new RealGoogleCalendarClient()
