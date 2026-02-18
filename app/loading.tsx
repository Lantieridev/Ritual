import { Skeleton } from "@/src/core/components/ui/Skeleton"

export default function Loading() {
  return (
    <div className="max-w-7xl mx-auto px-6 md:px-8 pt-24 pb-16 space-y-8 animate-in fade-in duration-500">
      <div className="space-y-4">
        <Skeleton className="h-12 w-48 bg-white/10" />
        <Skeleton className="h-4 w-96 bg-white/5" />
      </div>

      {/* Grid layout similar to events/festivals */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 9 }).map((_, i) => (
          <div key={i} className="space-y-3 rounded-xl border border-white/5 p-4 bg-white/[0.02]">
            <Skeleton className="h-48 w-full rounded-lg bg-white/5" />
            <div className="space-y-2 pt-2">
              <Skeleton className="h-5 w-3/4 bg-white/10" />
              <Skeleton className="h-4 w-1/2 bg-white/5" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
