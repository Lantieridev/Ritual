export default function EventDetailLoading() {
  return (
    <main className="min-h-screen bg-neutral-950 text-white font-sans animate-pulse">
      {/* Hero Image Skeleton */}
      <div className="relative h-72 md:h-96 w-full bg-neutral-900 border-b border-white/5">
        <div className="absolute top-0 left-0 right-0 p-6 flex justify-between">
          <div className="h-8 w-24 bg-white/10 rounded-lg" />
          <div className="h-8 w-24 bg-white/10 rounded-lg" />
        </div>
        <div className="absolute bottom-0 left-0 right-0 p-6 md:p-8 space-y-4">
          <div className="h-4 w-32 bg-white/10 rounded" />
          <div className="h-10 md:h-14 w-3/4 bg-white/10 rounded" />
        </div>
      </div>

      {/* Content Skeleton */}
      <div className="max-w-3xl mx-auto px-6 md:px-8 py-10 space-y-10">

        {/* Attendance */}
        <div className="space-y-3">
          <div className="h-3 w-24 bg-white/10 rounded" />
          <div className="flex gap-2">
            <div className="h-10 flex-1 bg-white/10 rounded-lg" />
            <div className="h-10 flex-1 bg-white/10 rounded-lg" />
            <div className="h-10 flex-1 bg-white/10 rounded-lg" />
          </div>
        </div>

        {/* Info Grid */}
        <div className="grid sm:grid-cols-2 gap-6 border-t border-white/[0.06] pt-8">
          <div className="space-y-2">
            <div className="h-3 w-16 bg-white/10 rounded" />
            <div className="h-6 w-48 bg-white/10 rounded" />
            <div className="h-4 w-32 bg-white/10 rounded" />
          </div>
          <div className="space-y-2">
            <div className="h-3 w-16 bg-white/10 rounded" />
            <div className="h-6 w-48 bg-white/10 rounded" />
          </div>
        </div>

        {/* Lineup */}
        <div className="border-t border-white/[0.06] pt-8 space-y-4">
          <div className="h-3 w-16 bg-white/10 rounded" />
          <div className="flex gap-2 flex-wrap">
            <div className="h-8 w-32 bg-white/10 rounded-lg" />
            <div className="h-8 w-24 bg-white/10 rounded-lg" />
            <div className="h-8 w-40 bg-white/10 rounded-lg" />
          </div>
        </div>

      </div>
    </main>
  )
}
