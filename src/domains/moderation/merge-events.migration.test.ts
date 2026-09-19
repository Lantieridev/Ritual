import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

// merge_events() lives in SQL, and the suite has no Postgres to run it against.
// So this pins the contract on the latest definition itself: every table whose
// event_id FK is SET NULL / CASCADE must be moved to the target before the
// source event is deleted, otherwise the merge drops that data silently (#71).
const MIGRATIONS_DIR = path.join(__dirname, '../../../supabase/migrations')

function latestMergeEventsBody(): string {
  const files = fs.readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql')).sort()
  const definitions = files.flatMap((file) => {
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf-8')
    const match = sql.match(
      /CREATE OR REPLACE FUNCTION (?:public\.)?merge_events\([\s\S]*?\$\$([\s\S]*?)\$\$;/i,
    )
    return match ? [match[1]] : []
  })
  const latest = definitions.at(-1)
  if (!latest) throw new Error('merge_events definition not found in migrations')
  return latest
}

describe('merge_events migration', () => {
  const body = latestMergeEventsBody()
  const deleteAt = body.search(/DELETE FROM events\s+WHERE id = source_id/i)

  it('deletes the source event', () => {
    expect(deleteAt).toBeGreaterThan(-1)
  })

  it.each(['expenses', 'festival_events', 'event_checklist_items', 'event_checklist_checks'])(
    'moves %s to the target before deleting the source event',
    (table) => {
      const updateAt = body.search(new RegExp(`UPDATE (?:public\\.)?${table}\\b`, 'i'))
      expect(updateAt).toBeGreaterThan(-1)
      expect(updateAt).toBeLessThan(deleteAt)
    },
  )
})
