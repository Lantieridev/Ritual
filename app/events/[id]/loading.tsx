export default function EventDetailLoading() {
  return (
    <main className="min-h-screen bg-neutral-950 text-white p-6 md:p-8 font-sans animate-pulse">
      <div className="h-6 w-48 bg-white/10 rounded mb-8" />
      <div className="h-4 w-32 bg-white/10 rounded mb-2" />
      <div className="h-10 w-3/4 bg-white/10 rounded mb-8" />
      <div className="max-w-2xl rounded-xl border border-white/10 bg-white/5 p-6 space-y-4">
        <div className="h-4 w-24 bg-white/10 rounded" />
        <div className="h-6 w-full bg-white/10 rounded" />
        <div className="h-4 w-32 bg-white/10 rounded pt-4" />
        <div className="h-20 w-full bg-white/10 rounded" />
      </div>
    </main>
  )
}
