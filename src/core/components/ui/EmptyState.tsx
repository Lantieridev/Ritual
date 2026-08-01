import Link from 'next/link'
import { cn } from '@/src/core/lib/utils'

interface EmptyStateProps {
    title: string
    description?: string
    action?: {
        label: string
        href: string
    }
    icon?: React.ReactNode
    className?: string
    children?: React.ReactNode
}

export function EmptyState({ title, description, action, icon, className, children }: EmptyStateProps) {
    return (
        <div className={cn(
            "flex flex-col items-center justify-center py-16 px-6 text-center border border-ritual-border-subtle bg-ritual-surface",
            className
        )}>
            {icon ? (
                <div className="mb-6 p-4 rounded-full bg-ritual-surface-high text-ritual-gray-text">
                    {icon}
                </div>
            ) : (
                <div className="mb-6 w-16 h-16 rounded-full bg-ritual-surface-high flex items-center justify-center">
                    <div className="w-8 h-8 bg-ritual-border-2 rotate-45" />
                </div>
            )}

            <h3 className="font-display text-2xl uppercase text-ritual-bone mb-2">{title}</h3>
            {description && <p className="font-body text-ritual-gray-text max-w-md mb-6">{description}</p>}

            {action && (
                <Link
                    href={action.href}
                    className="inline-flex items-center justify-center bg-ritual-red px-4 py-2 font-label text-[10px] tracking-[0.14em] uppercase text-ritual-bone hover:bg-ritual-red-hover transition-colors"
                >
                    {action.label}
                </Link>
            )}
            {children}
        </div>
    )
}
