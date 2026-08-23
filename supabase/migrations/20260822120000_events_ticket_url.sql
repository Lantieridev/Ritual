-- issue #19: AllAccess y Passline no exponen una API de búsqueda pública ni
-- un patrón de URL documentado para armar un deep link (a diferencia de
-- Ticketmaster, que sí tiene la Discovery API — ver src/core/lib/ticketmaster.ts).
-- Se verificó manualmente contra ambos sitios: el buscador de cada uno es
-- client-side y no navega a una URL con query string reconstruible. Por eso
-- esto es un link manual por evento, no una integración — mismo patrón ya
-- usado para festivals.website (20260218230000_festivals.sql).
alter table public.events add column if not exists ticket_url text;
