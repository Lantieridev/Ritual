export const metadata = { title: 'Sin conexión | RITUAL' }

export default function OfflinePage() {
  return (
    <main className="mx-auto max-w-xl px-6 py-24 text-center text-ritual-bone">
      <h1 className="font-display text-4xl">Sin conexión</h1>
      <p className="font-body text-sm text-ritual-gray-text mt-4">
        Esta pantalla todavía no está disponible sin señal. Los gastos que cargues desde
        &ldquo;Nuevo gasto&rdquo; se guardan en tu dispositivo y se sincronizan cuando vuelva la conexión.
      </p>
    </main>
  )
}
