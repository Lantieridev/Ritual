import Link from 'next/link'
import { routes } from '@/src/core/lib/routes'

interface NotificationBellProps {
    unreadCount: number
}

export function NotificationBell({ unreadCount }: NotificationBellProps) {
    const label = unreadCount > 0 ? `Avisos, ${unreadCount} sin leer` : 'Avisos'
    return (
        <Link
            href={routes.notifications}
            aria-label={label}
            className="relative font-label text-[10px] tracking-[0.16em] uppercase text-ritual-gray-text hover:text-white transition-colors"
        >
            Avisos
            {unreadCount > 0 && (
                <span
                    data-testid="notification-badge"
                    aria-hidden="true"
                    className="absolute -top-2 -right-3 min-w-4 h-4 px-1 rounded-full bg-ritual-red text-ritual-bone text-[9px] leading-4 text-center"
                >
                    {unreadCount > 9 ? '9+' : unreadCount}
                </span>
            )}
        </Link>
    )
}
