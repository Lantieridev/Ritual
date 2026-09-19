# 0005 — Carga de gastos offline: Serwist + outbox propio en IndexedDB

## Estado
Aceptada

## Contexto
Los gastos se cargan en el momento, parado en el venue, donde muchas veces la señal es mala o no existe (issue #10). Cargar un gasto tiene que funcionar sin señal y sincronizarse cuando vuelva, tanto en Android como en iPhone.

## Decisión
- **PWA con service worker de Serwist** (`@serwist/turbopack`): cachea la app y el formulario de gasto para que la app instalada abra sin señal.
- **Outbox en IndexedDB**: crear un gasto escribe primero en el outbox y después intenta la mutation `createExpense` que ya existe. Un flusher del lado del cliente (al montar, en `online` y en `visibilitychange`) lo vacía de más viejo a más nuevo.
- **Cada entrada del outbox tiene dueño** (`ownerId`, el usuario verificado en el servidor). El outbox vive en el dispositivo, no en la cuenta: sin dueño, otro usuario que inicie sesión en el mismo celular terminaría subiendo a su cuenta los gastos del anterior. Sólo se listan y se envían las entradas del usuario actual, y sin usuario conocido no se encola nada.
- **Idempotencia en el servidor**: `expenses.client_id` con índice único `(user_id, client_id)`. Un reintento (respuesta perdida, dos pestañas) devuelve la fila existente en vez de duplicarla.
- **Alcance: sólo crear.** La cola es append-only, así que no hay conflictos entre dispositivos (los gastos son por usuario).

Alternativas descartadas:
- **RxDB / PouchDB (local-first con replicación):** desproporcionado para inserts append-only; pide un endpoint de replicación y suma peso al bundle.
- **Background Sync API:** no existe en iOS Safari, así que el flush del cliente hace falta igual; sólo sería un extra en Android.
- **Service worker a mano:** precachear a mano los chunks con hash de Next.js es frágil entre deploys.

## Consecuencias
- Editar/borrar offline, asistencia y notas quedan como seguimiento; el outbox se puede generalizar a otras mutations.
- Las entradas que el servidor rechaza quedan `failed` y necesitan una decisión del usuario (reintentar o descartar).
- Las entradas de otro usuario quedan latentes en el dispositivo hasta que ese usuario vuelva a iniciar sesión; limpiarlas al cerrar sesión es un seguimiento posible.
- Las páginas autenticadas cacheadas viven en el dispositivo hasta que el navegador las desaloje.
- `SerwistProvider` se usa con `reloadOnOnline={false}`: su default recarga la página al volver la señal y borraría un formulario a medio completar.
