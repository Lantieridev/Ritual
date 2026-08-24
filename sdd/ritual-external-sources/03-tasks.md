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
- [ ] Implement adapter: AllAccess
- [ ] Implement adapter: Livepass
- [ ] Implement adapter: Movistar Arena
- [ ] Implement adapter: Entradaweb
- [ ] Refine dedup logic with real world data

## Wave 3 (Fase 3 - "Cheap Scrapes" de nicho)
- [ ] Implement adapter: Enigma
- [ ] Implement adapter: Entraste
- [ ] Implement adapter: Tuentrada
- [ ] Implement adapter: Puntoticket
- [ ] Implement adapter: Konex
- [ ] Implement adapter: Pulsotickets
- [ ] Implement adapter: Norteticket

## Wave 4 (Fase 4 - Las bloqueadas - Evaluación de riesgo)
- [ ] Evaluate Passline headless strategy
- [ ] Evaluate Mientrada headless strategy
- [ ] Evaluate Edén Entradas SSL bypass strategy
