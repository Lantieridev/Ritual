import { TextareaHTMLAttributes, forwardRef } from 'react'
import { twMerge } from 'tailwind-merge'

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
    label?: string
    error?: string
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
    ({ className, label, error, ...props }, ref) => {
        return (
            <div className="space-y-2">
                {label && (
                    <label htmlFor={props.id} className="text-sm font-medium text-zinc-400">
                        {label}
                    </label>
                )}
                <textarea
                    ref={ref}
                    className={twMerge(
                        "w-full rounded-lg bg-white/5 border border-white/10 px-4 py-2 text-white placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-white/20 disabled:opacity-50 transition-colors min-h-[100px]",
                        error && "border-red-500 focus:ring-red-500/20",
                        className
                    )}
                    {...props}
                />
                {error && <p className="text-xs text-red-500">{error}</p>}
            </div>
        )
    }
)

Textarea.displayName = 'Textarea'
