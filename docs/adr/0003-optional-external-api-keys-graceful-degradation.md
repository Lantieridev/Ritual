# 0003 — Las API keys externas opcionales degradan sin romper el build

## Estado
Aceptada

## Contexto
RITUAL integra cuatro APIs externas (Last.fm, Setlist.fm, Spotify, Ticketmaster) para enriquecer datos de artistas y eventos. Ninguna es indispensable para el core del producto (marcar asistencia, gastos, memoria de shows). Pedirle a cada colaborador que consiga las cuatro keys antes de poder levantar el proyecto en local es una barrera de entrada innecesaria para un repo open source.

## Decisión
`src/core/lib/env.ts` distingue explícitamente entre variables requeridas (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`) y opcionales (las cuatro API keys externas):

- `validateEnv()` tira error y corta el build/start solo si falta una requerida.
- Si falta una opcional, solo loguea un `console.warn` (y ni eso en `NODE_ENV=test`).
- Cada `getXApiKey()` devuelve `string | undefined` en vez de tirar — el código que consume la API tiene que manejar el `undefined` y degradar la feature, no asumir que la key existe.

## Consecuencias
- Un colaborador nuevo puede levantar RITUAL con solo las dos keys de Supabase; las features de Last.fm/Spotify/Setlist.fm/Ticketmaster simplemente no muestran datos hasta que configure esas keys.
- El costo se traslada al código consumidor: cada integración externa tiene que chequear el `undefined` explícitamente. Si en el futuro una integración externa se vuelve indispensable para una feature core, hay que moverla a la lista de requeridas en `validateEnv()` — si no, el warning se ignora y el bug aparece como "la feature no anda" sin pista clara del motivo.
