export default function ExpensesLoading() {
  return (
    <main className="min-h-screen bg-neutral-950 text-white p-6 md:p-8 font-sans animate-pulse">
      <div className="h-6 w-24 bg-white/10 rounded mb-8" />
      <div className="h-8 w-48 bg-white/10 rounded mb-2" />
      <div className="h-4 w-64 bg-white/10 rounded mb-8" />
      <div className="h-16 w-40 bg-white/10 rounded mb-6" />
      <div className="grid gap-4 md:grid-cols-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-24 rounded-xl border border-white/10 bg-white/5" />
        ))}
      </div>
    </main>
  )
}
