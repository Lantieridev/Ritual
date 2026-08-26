import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { APP_TIMEZONE } from '@/src/core/lib/dates'

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs))
}

const DEFAULT_DATE_OPTIONS: Intl.DateTimeFormatOptions = {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
}

/** "YYYY-MM-DD" sin hora — el formato de las columnas `date` de Postgres. */
const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/

export function formatDate(
    date: string | Date,
    options: Intl.DateTimeFormatOptions = DEFAULT_DATE_OPTIONS
): string {
    // Un "YYYY-MM-DD" pelado no representa un instante sino un día calendario:
    // así llegan las columnas `date` de Postgres, como `expenses.date`. Se lo
    // ancla en UTC y se lo formatea en UTC para que salga el día tal cual está
    // guardado. Sin esto se parseaba como medianoche UTC y se formateaba en la
    // zona del runtime, así que un gasto del 26 aparecía como "25 may".
    const dateOnly = typeof date === 'string' ? date.match(DATE_ONLY) : null
    if (dateOnly) {
        const utc = new Date(
            Date.UTC(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]))
        )
        return utc.toLocaleDateString('es-AR', { ...options, timeZone: 'UTC' })
    }

    // Un timestamp sí es un instante, y se muestra en la zona de la app. Fijarla
    // es necesario: `toLocaleDateString` usa la zona del runtime si no se le
    // indica una, así que en Vercel (UTC) un show de las 21:00 en Argentina se
    // renderizaba con la fecha del día siguiente. Mismo criterio que
    // eventYear/eventMonth/isPastEvent en core/lib/dates.ts.
    const dateObj = typeof date === 'string' ? new Date(date) : date
    return dateObj.toLocaleDateString('es-AR', { timeZone: APP_TIMEZONE, ...options })
}
