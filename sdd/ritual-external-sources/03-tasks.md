# Tasks for External Event Sources

## Wave 1 (Fase 1 - Fundamentos y "Cheap APIs")
- [x] Create `ExternalSourceAdapter` interface and types
- [x] Create `external_events_cache` Supabase table and migration
- [x] Implement Cron/Background refresh mechanism for adapters
- [x] Implement adapter: Alpogo
- [x] Implement adapter: Venti
- [x] Implement adapter: Quehacemos
- [x] Wire `app/buscar` search UI to query cached sources alongside Ticketmaster/Setlist.fm
- [x] Write tests for Alpogo adapter
- [x] Write tests for Venti adapter
- [x] Write tests for Quehacemos adapter
- [x] Write tests for Dedup logic

## Wave 2 (Fase 2 - "Cheap Scrapes" de alto valor)
- [x] Implement adapter: AllAccess
- [x] Implement adapter: Livepass
- [x] Implement adapter: Entradaweb
- [x] Refine dedup logic with real world data
- [ ] Implement adapter: Movistar Arena *(Explicitly deferred: confirmed to be a Blazor Server + SignalR WebSocket app, not scrapeable via plain HTTP fetch. Needs Playwright/headless infrastructure decision.)*

## Wave 3 (Fase 3 - "Cheap Scrapes" de nicho)
- [x] Implement adapter: Enigma
- [x] Implement adapter: Entraste
- [x] Implement adapter: Tuentrada
- [x] Implement adapter: Puntoticket
- [x] Implement adapter: Konex
- [x] Implement adapter: Pulsotickets
- [x] Implement adapter: Norteticket

## Wave 4 (Fase 4 - Las bloqueadas - Evaluación de riesgo)
- [~] Evaluate Passline headless strategy *(Excluded entirely - established in earlier waves)*
- [~] Evaluate Mientrada headless strategy *(Excluded entirely - established in earlier waves)*
- [~] Evaluate Edén Entradas SSL bypass strategy *(Excluded entirely - established in earlier waves)*
