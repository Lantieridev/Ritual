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
                    <label htmlFor={props.id} className="font-label text-[10px] tracking-[0.1em] uppercase text-ritual-gray-text">
                        {label}
                    </label>
                )}
                <textarea
                    ref={ref}
                    className={twMerge(
                        "w-full bg-ritual-surface border border-ritual-border px-4 py-2 font-body italic text-ritual-bone placeholder:text-ritual-gray-mid focus:outline-none focus:ring-2 focus:ring-ritual-red/40 disabled:opacity-50 transition-colors min-h-[100px]",
                        error && "border-ritual-red focus:ring-ritual-red/30",
                        className
                    )}
                    {...props}
                />
                {error && <p className="font-label text-xs text-ritual-red">{error}</p>}
            </div>
        )
    }
)

Textarea.displayName = 'Textarea'
