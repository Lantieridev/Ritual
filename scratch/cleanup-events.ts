import { createClient } from '@supabase/supabase-js'

const envUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const envKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(envUrl, envKey)

async function run() {
  const { data: events, error: evErr } = await supabase.from('events').select('id, name').ilike('name', '%Coca Cola%')
  if (evErr) console.error(evErr)
  
  if (events && events.length > 0) {
    for (const ev of events) {
      console.log(`Deleting event: ${ev.name} (${ev.id})`)
      await supabase.from('events').delete().eq('id', ev.id)
    }
  } else {
    console.log('No Coca Cola events found')
  }
}

run()
