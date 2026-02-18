export default function ArtistDetailLoading() {
    return (
        <main className="min-h-screen bg-neutral-950 text-white font-sans animate-pulse">
            {/* Hero Image Skeleton */}
            <div className="relative h-72 md:h-96 w-full bg-neutral-900 border-b border-white/5">
                <div className="absolute top-0 left-0 right-0 p-6">
                    <div className="h-8 w-24 bg-white/10 rounded-lg" />
                </div>
                <div className="absolute bottom-0 left-0 right-0 p-6 md:p-10 space-y-3">
                    <div className="h-10 md:h-16 w-1/2 bg-white/10 rounded" />
                    <div className="flex gap-3">
                        <div className="h-5 w-20 bg-white/10 rounded-full" />
                        <div className="h-5 w-20 bg-white/10 rounded-full" />
                        <div className="h-5 w-20 bg-white/10 rounded-full" />
                    </div>
                </div>
            </div>

            {/* Content Skeleton */}
            <div className="max-w-3xl mx-auto px-6 md:px-8 py-10 space-y-12">

                {/* Actions & Stats */}
                <div className="flex flex-wrap items-start gap-6">
                    <div className="h-10 w-32 bg-white/10 rounded-lg" />
                    <div className="flex gap-5">
                        <div className="space-y-1">
                            <div className="h-6 w-16 bg-white/10 rounded" />
                            <div className="h-3 w-24 bg-white/10 rounded" />
                        </div>
                        <div className="space-y-1">
                            <div className="h-6 w-16 bg-white/10 rounded" />
                            <div className="h-3 w-24 bg-white/10 rounded" />
                        </div>
                    </div>
                </div>

                {/* Bio */}
                <div className="space-y-2">
                    <div className="h-4 w-full bg-white/10 rounded" />
                    <div className="h-4 w-full bg-white/10 rounded" />
                    <div className="h-4 w-2/3 bg-white/10 rounded" />
                </div>

                {/* Upcoming Shows */}
                <div className="space-y-4">
                    <div className="h-4 w-40 bg-white/10 rounded" />
                    <div className="space-y-2">
                        {[1, 2, 3].map((i) => (
                            <div key={i} className="h-20 w-full bg-white/5 rounded-lg" />
                        ))}
                    </div>
                </div>

            </div>
        </main>
    )
}
