export default function FestivalDetailLoading() {
    return (
        <main className="min-h-screen bg-neutral-950 text-white font-sans animate-pulse">
            {/* Hero Skeleton (Gradient style) */}
            <div className="relative bg-neutral-900 border-b border-white/[0.06] h-auto">
                <div className="max-w-3xl mx-auto px-6 md:px-8 py-12">
                    <div className="h-4 w-24 bg-white/10 rounded mb-6" />

                    <div className="flex flex-col sm:flex-row sm:items-start gap-6">
                        <div className="flex-1 space-y-4">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="h-8 w-8 bg-white/10 rounded-full" />
                                <div className="h-6 w-16 bg-white/10 rounded-full" />
                            </div>
                            <div className="h-10 md:h-12 w-3/4 bg-white/10 rounded" />
                            <div className="flex gap-4">
                                <div className="h-4 w-32 bg-white/10 rounded" />
                                <div className="h-4 w-32 bg-white/10 rounded" />
                            </div>
                        </div>
                        <div className="h-10 w-32 bg-white/10 rounded-lg" />
                    </div>
                </div>
            </div>

            {/* Content Skeleton */}
            <div className="max-w-3xl mx-auto px-6 md:px-8 py-10 space-y-10">

                {/* Stats Grid */}
                <div className="grid grid-cols-3 gap-4">
                    <div className="h-24 bg-white/5 rounded-xl" />
                    <div className="h-24 bg-white/5 rounded-xl" />
                    <div className="h-24 bg-white/5 rounded-xl" />
                </div>

                {/* Days / Events */}
                <div className="space-y-5">
                    <div className="h-4 w-40 bg-white/10 rounded" />
                    <div className="space-y-4">
                        {[1, 2].map((i) => (
                            <div key={i} className="h-32 bg-white/5 rounded-xl border border-white/10" />
                        ))}
                    </div>
                </div>

            </div>
        </main>
    )
}
