# 0004 — No se usa browser headless para las fuentes externas de eventos

## Estado
Aceptada

## Contexto
El cron `sync-external-sources` lee eventos de sitios de ticketeras con `fetch()` + cheerio (`type: 'api' | 'scrape'`). Una verificación en vivo (issue #72) encontró cuatro fuentes que ese enfoque no puede leer:

- **Passline**: API JSON pública, pero detrás de Cloudflare. Un `fetch()` de servidor recibe 403 con el challenge "Just a moment...".
- **Edén Entradas**: bloqueo anti-bot activo en las páginas de evento y venue.
- **Paseshow**: reCAPTCHA en la home, catálogo aparentemente detrás de login.
- **venti.live**: SPA client-side sin datos server-renderizados.

En una prueba puntual (un intento de 45 s), Chromium headless de Playwright sin ninguna evasión, corriendo desde una máquina de desarrollo local, no pasó el challenge de Cloudflare de Passline: quedó en "Just a moment..." hasta el timeout. Desde una función de Vercel, con IP de datacenter, es esperable el mismo resultado o uno peor (inferencia, no se probó).

## Decisión
No se agrega un browser headless (Puppeteer/Playwright) al cron. Passline, Edén y Paseshow quedan fuera del alcance; venti sigue registrado y devuelve el error explicado.

Razones:
- **No funciona sin evasión.** Pasar un challenge de Cloudflare exige stealth, proxies residenciales o servicios de resolución, es decir, esquivar una medida de seguridad que el sitio puso a propósito. No es algo que este proyecto quiera hacer, y arrastra riesgo de ToS y de baneo de IPs.
- **Costo desproporcionado.** Sumaría una dependencia pesada (Chromium en serverless) y consumiría el presupuesto de `maxDuration` del cron para tres o cuatro fuentes.
- **La cobertura actual alcanza.** 11 de las 13 fuentes registradas funcionan.

## Consecuencias
- El valor `'headless'` de `ExternalSourceAdapter.type` queda sin implementación; no hay que tratarlo como pendiente.
- Nadie debería intentar "arreglar" venti/Passline con un fix rápido de `fetch()`: no va a funcionar.
- Si aparece una vía legítima (API oficial, acuerdo con la ticketera o feed de partner), se reabre esta decisión con un adapter `type: 'api'` normal, sin headless.
