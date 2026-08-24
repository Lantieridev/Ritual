import { createClient } from '@supabase/supabase-js'

const envUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const envKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(envUrl, envKey)

async function run() {
  console.log('Cleaning up cosmetic data...')

  // 1. Delete the "Coca Cola 2.25L" event
  const { data: events, error: evErr } = await supabase.from('events').select('id, title').ilike('title', '%Coca Cola%')
  if (evErr) console.error(evErr)
  
  if (events && events.length > 0) {
    for (const ev of events) {
      console.log(`Deleting event: ${ev.title} (${ev.id})`)
      await supabase.from('events').delete().eq('id', ev.id)
    }
  }

  // 2. "asdasdasd" in Movistar Arena address
  const { data: venues, error: venErr } = await supabase.from('venues').select('id, name, address').ilike('name', '%Movistar Arena%')
  if (venErr) console.error(venErr)
  
  if (venues) {
    for (const v of venues) {
      if (v.address === '📍 asdasdasd' || v.address?.includes('asdasdasd')) {
        console.log(`Fixing address for venue: ${v.name} (${v.id})`)
        await supabase.from('venues').update({ address: 'Humboldt 450' }).eq('id', v.id)
      }
    }
  }

  // 3. Deduplicate Los Piojos
  const { data: piojos, error: artErr } = await supabase.from('artists').select('id, name').ilike('name', 'Los Piojos')
  if (artErr) console.error(artErr)

  if (piojos && piojos.length > 1) {
    const { data: linked } = await supabase.from('event_artists').select('artist_id, event_id').in('artist_id', piojos.map(p => p.id))
    
    const counts = piojos.map(p => ({
      ...p,
      links: linked?.filter(l => l.artist_id === p.id).length || 0
    })).sort((a, b) => b.links - a.links)
    
    console.log('Los Piojos found:', counts)
    for (let i = 1; i < counts.length; i++) {
      console.log(`Deleting duplicate Los Piojos: ${counts[i].id}`)
      await supabase.from('artists').delete().eq('id', counts[i].id)
    }
  }

  // 4. Deduplicate Estadio River Plate
  const { data: river, error: rivErr } = await supabase.from('venues').select('id, name').ilike('name', 'Estadio River Plate')
  if (rivErr) console.error(rivErr)

  if (river && river.length > 1) {
    const { data: linked } = await supabase.from('events').select('id, venue_id').in('venue_id', river.map(r => r.id))
    
    const counts = river.map(r => ({
      ...r,
      links: linked?.filter(l => l.venue_id === r.id).length || 0
    })).sort((a, b) => b.links - a.links)
    
    console.log('Estadio River Plate found:', counts)
    for (let i = 1; i < counts.length; i++) {
      console.log(`Deleting duplicate Estadio River Plate: ${counts[i].id}`)
      await supabase.from('venues').delete().eq('id', counts[i].id)
    }
  }
  
  console.log('Cleanup finished.')
}

run()
