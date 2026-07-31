import { cn } from "@/src/core/lib/utils"

function Skeleton({
    className,
    ...props
}: React.HTMLAttributes<HTMLDivElement>) {
    return (
        <div
            className={cn("animate-pulse bg-ritual-surface", className)}
            {...props}
        />
    )
}

export { Skeleton }
