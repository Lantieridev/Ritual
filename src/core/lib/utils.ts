import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

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
    let dateObj: Date

    if (typeof date === 'string') {
        // Un "YYYY-MM-DD" pelado se parsea como medianoche UTC, y al
        // formatearlo en horario de Argentina (UTC-3) retrocede al día
        // anterior: `expenses.date` es una columna `date`, así que un gasto
        // del 26 se mostraba como "25 may". Se construye la fecha en horario
        // local para que el día calendario sobreviva al formateo.
        //
        // Es el mismo trap que ya evitan eventYear/eventMonth/isPastEvent en
        // core/lib/dates.ts; acá faltaba.
        const dateOnly = date.match(DATE_ONLY)
        dateObj = dateOnly
            ? new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]))
            : new Date(date)
    } else {
        dateObj = date
    }

    return dateObj.toLocaleDateString('es-AR', options)
}
