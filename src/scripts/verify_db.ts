
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'

// Load env vars manually
const envPath = path.resolve(process.cwd(), '.env.local')
const envContent = fs.readFileSync(envPath, 'utf-8')
const envVars = envContent.split('\n').reduce((acc, line) => {
    let [key, ...valueParts] = line.split('=')
    if (key && valueParts.length > 0) {
        let value = valueParts.join('=').trim()
        // Strip quotes if they exist
        value = value.replace(/^["']|["']$/g, '')
        acc[key.trim()] = value
    }
    return acc
}, {} as Record<string, string>)

const supabaseUrl = envVars.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = envVars.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing Supabase credentials in .env.local')
    process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function checkTable(tableName: string, isPublic: boolean) {
    console.log(`Checking table: ${tableName}...`)
    const { data, error } = await supabase.from(tableName).select('id').limit(1)

    if (error) {
        if (error.code === '42P01') {
            console.error(`❌ Table '${tableName}' DOES NOT EXIST.`)
            return false
        } else {
            console.log(`✅ Table '${tableName}' exists (Status: ${error.code} - ${error.message}).`)
            return true
        }
    }

    console.log(`✅ Table '${tableName}' exists and is accessible.`)
    return true
}

async function checkRPC() {
    console.log('Checking RPC: migrate_legacy_data...')

    const { error } = await supabase.rpc('migrate_legacy_data', { target_user_id: '00000000-0000-0000-0000-000000000000' })

    if (error) {
        if (error.code === '42883') {
            console.error('❌ RPC \'migrate_legacy_data\' DOES NOT EXIST.')
            return false
        }
        console.log(`✅ RPC exists (Response: ${error.code} - ${error.message}).`)
        return true
    }

    console.log('✅ RPC called successfully.')
    return true
}

async function main() {
    console.log('🔎 Starting DB Verification...')
    console.log(`URL: ${supabaseUrl}`)

    const tables = [
        { name: 'events', public: true },
        { name: 'venues', public: true },
        { name: 'artists', public: true },
        { name: 'expenses', public: false },
        { name: 'attendance', public: false },
        { name: 'wishlist', public: false },
        { name: 'memories', public: false },
        { name: 'festival_attendance', public: false },
        { name: 'event_photos', public: true }
    ]

    let allGood = true

    for (const t of tables) {
        const ok = await checkTable(t.name, t.public)
        if (!ok) allGood = false
    }

    const rpcOk = await checkRPC()
    if (!rpcOk) allGood = false

    if (allGood) {
        console.log('\n✨ VERIFICATION PASSED: All tables and RPC functions appear to exist.')
    } else {
        console.error('\n❌ VERIFICATION FAILED: Missing tables or functions.')
        process.exit(1)
    }
}

main()
