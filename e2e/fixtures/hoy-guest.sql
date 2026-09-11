-- E2E Fixture for hoy-guest test (api-real QA)
-- Target: test guest path on Home hero with an upcoming event

-- SETUP BLOCK
INSERT INTO public.venues (id, name, city, country)
VALUES ('11111111-1111-4111-a111-111111111111', 'Estadio QA Test', 'Buenos Aires', 'Argentina')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.artists (id, name, genre)
VALUES ('22222222-2222-4222-a222-222222222222', 'Artista QA Test Guest', 'Rock')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.events (id, name, date, venue_id)
VALUES ('33333333-3333-4333-a333-333333333333', 'Concierto QA Test Guest', now() + interval '5 days', '11111111-1111-4111-a111-111111111111')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.lineups (event_id, artist_id, is_headliner)
VALUES ('33333333-3333-4333-a333-333333333333', '22222222-2222-4222-a222-222222222222', true)
ON CONFLICT (event_id, artist_id) DO NOTHING;

-- CLEANUP BLOCK (run separately or uncomment to delete)
/*
DELETE FROM public.lineups WHERE event_id = '33333333-3333-4333-a333-333333333333';
DELETE FROM public.events WHERE id = '33333333-3333-4333-a333-333333333333';
DELETE FROM public.artists WHERE id = '22222222-2222-4222-a222-222222222222';
DELETE FROM public.venues WHERE id = '11111111-1111-4111-a111-111111111111';
*/
