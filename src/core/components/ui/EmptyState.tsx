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
            "flex flex-col items-center justify-center py-16 px-6 text-center rounded-xl border border-white/5 bg-white/[0.02]",
            className
        )}>
            {icon ? (
                <div className="mb-6 p-4 rounded-full bg-white/5 text-zinc-400">
                    {icon}
                </div>
            ) : (
                <div className="mb-6 w-16 h-16 rounded-full bg-white/5 flex items-center justify-center">
                    <div className="w-8 h-8 rounded-sm bg-white/10 rotate-45" />
                </div>
            )}

            <h3 className="text-xl font-bold text-white mb-2">{title}</h3>
            {description && <p className="text-zinc-400 max-w-md mb-6">{description}</p>}

            {action && (
                <Link
                    href={action.href}
                    className="inline-flex items-center justify-center rounded-md bg-white px-4 py-2 text-sm font-semibold text-neutral-950 hover:bg-zinc-200 transition-colors"
                >
                    {action.label}
                </Link>
            )}
            {children}
        </div>
    )
}
