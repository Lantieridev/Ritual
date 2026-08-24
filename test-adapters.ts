import { externalAdapters } from './src/core/lib/external-sources/adapters/index'

async function run() {
  const results = await Promise.allSettled(
    externalAdapters.map(adapter => adapter.search({}))
  )
  for (let i = 0; i < externalAdapters.length; i++) {
    const res = results[i]
    if (res.status === 'fulfilled') {
      console.log(`Adapter ${externalAdapters[i].id}: ${res.value.events?.length || 0} events. Error? ${res.value.error}`)
    } else {
      console.log(`Adapter ${externalAdapters[i].id}: REJECTED`, res.reason)
    }
  }
}

run()
