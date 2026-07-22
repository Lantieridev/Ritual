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

export function formatDate(
    date: string | Date,
    options: Intl.DateTimeFormatOptions = DEFAULT_DATE_OPTIONS
): string {
    const dateObj = typeof date === 'string' ? new Date(date) : date
    return dateObj.toLocaleDateString('es-AR', options)
}
