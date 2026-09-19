import type { NotificationItem } from '../data'

interface NotificationListProps {
    items: readonly NotificationItem[]
}

export function NotificationList({ items }: NotificationListProps) {
    if (items.length === 0) {
        return <p className="text-ritual-gray-text">No tenés avisos todavía.</p>
    }

    return (
        <ul className="divide-y divide-white/10">
            {items.map((item) => (
                <li key={item.id} data-unread={item.readAt === null ? 'true' : 'false'} className="py-4 space-y-1">
                    <h3 className={item.readAt === null ? 'font-semibold text-ritual-bone' : 'text-ritual-gray-text'}>
                        {item.title}
                    </h3>
                    <p className="whitespace-pre-line text-sm text-ritual-gray-text">{item.body}</p>
                    <time dateTime={item.createdAt} className="block text-xs text-ritual-gray-text">
                        {new Date(item.createdAt).toLocaleString('es-AR', { dateStyle: 'medium', timeStyle: 'short' })}
                    </time>
                </li>
            ))}
        </ul>
    )
}
