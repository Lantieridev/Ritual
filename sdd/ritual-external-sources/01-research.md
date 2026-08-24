# Investigación de Fuentes Externas (Ticketing platforms)

Se evaluaron 17 plataformas regionales solicitadas para integrarlas al buscador de Ritual. El objetivo fue identificar qué plataformas exponen APIs públicas o privadas (utilizadas por sus propios frontends SPA), cuáles requieren técnicas de web scraping (HTML parsing), y cuáles presentan barreras de seguridad (WAF, Cloudflare) que hacen inviable su extracción sin riesgos legales o técnicos significativos.

## Metodología
Se inspeccionaron las peticiones de red, la estructura del código fuente (Next.js/React hydration data), los archivos `robots.txt` y los códigos de respuesta HTTP automatizados.

---

## 🟢 Nivel 1: APIs Descubiertas (Cheap-API)
Estas plataformas exponen endpoints JSON de manera directa o para uso de su propia aplicación. Son las más seguras y fáciles de integrar.

### ALPOGO (alpogo.com)
* **Evidencia:** Se encontró directamente un endpoint JSON utilizado por su frontend: `https://alpogo.com/api/events/getEvents2`.
* **Veredicto:** `cheap-API`. Extracción muy sencilla y estructurada.

### VENTI (venti.com.ar)
* **Evidencia:** Su archivo `robots.txt` explícitamente permite a los crawlers acceder a rutas de la API: `Allow: /api/event/*` y `Allow: /api/`.
* **Veredicto:** `cheap-API`. Uso de JSON documentado implícitamente por el propio sitio.

### QUEHACEMOS (quehacemos.com.ar)
* **Evidencia:** El frontend realiza consultas a un subdominio dedicado a la API: `https://api.quehacemos.com.ar/api/v1/`.
* **Veredicto:** `cheap-API`.

---

## 🟡 Nivel 2: Scraping de HTML (Cheap-Scrape)
Estas plataformas no parecen exponer un endpoint JSON limpio o hidratación de estado fácilmente interceptable, por lo que requerirán parsear el HTML resultante (ej. usando `cheerio`). No mostraron bloqueos agresivos a peticiones automatizadas básicas.

* **ALLACCESS** (allaccess.com.ar) - Server-rendered HTML. Su `robots.txt` no bloquea explícitamente rutas de eventos, aunque prohíben indexación general en algunas partes.
* **LIVEPASS** (livepass.com.ar) - Server-rendered HTML.
* **ENIGMA** (enigmatickets.com) - Server-rendered HTML.
* **ENTRASTE** (entraste.com) - Server-rendered HTML.
* **TUENTRADA** (tuentrada.com) - Server-rendered HTML.
* **PUNTOTICKET** (puntoticket.com) - Server-rendered HTML.
* **KONEX** (entradas.cckonex.org) - Server-rendered HTML.
* **MOVISTAR ARENA** (movistararena.com.ar) - Server-rendered HTML.
* **PULSOTICKETS** (pulsotickets.com) - Server-rendered HTML.
* **NORTETICKET** (norteticket.com) - Server-rendered HTML.
* **ENTRADAWEB** (entradaweb.com.ar) - Server-rendered HTML.

**Veredicto para todas:** `cheap-scrape`. La fragilidad es real (cualquier rediseño del sitio romperá el parser), pero técnicamente es factible con herramientas ligeras (fetch + cheerio).

---

## 🔴 Nivel 3: Bloqueadas o Problemáticas (Expensive-Scrape / Inviable)
Estas plataformas implementan defensas activas contra automatización o fallos de infraestructura. Intentar extraer datos de aquí conlleva altos costos técnicos o riesgos directos contra los Términos de Servicio (ToS).

### PASSLINE (passline.com)
* **Evidencia:** Respuesta HTTP 403 Forbidden ante peticiones automatizadas estándar.
* **Veredicto:** `expensive-scrape` o `not-feasible`. Probablemente utilicen Cloudflare Bot Management u otro WAF. Extraer datos requerirá proxies residenciales y navegadores headless (ej. Puppeteer/Playwright), elevando enormemente los costos operativos. Riesgo alto de violación de ToS.

### MIENTRADA (mientrada.com.ar)
* **Evidencia:** Respuesta HTTP 403 Forbidden.
* **Veredicto:** Igual que Passline. Bloqueo activo. `expensive-scrape` o `not-feasible`.

### EDÉN ENTRADAS (edenentradas.com.ar)
* **Evidencia:** `SSLV3_ALERT_HANDSHAKE_FAILURE`.
* **Veredicto:** Utilizan una configuración de seguridad TLS anticuada o rota que rechaza clientes modernos. Aunque puede ser evadido relajando políticas de seguridad en el cliente HTTP, indica una infraestructura inestable. `cheap-scrape` (con bypass SSL).

---

## Resumen Numérico
* **APIs viables (`cheap-API`):** 3 fuentes
* **Scraping HTML estándar (`cheap-scrape`):** 11 fuentes
* **Bloqueadas/Defendidas (`expensive-scrape`):** 3 fuentes (Passline, Mientrada, Edén)

## Preguntas Abiertas (Riesgos a decidir)
1. **Riesgo Legal / Bloqueos:** Passline y Mientrada bloquean proactivamente las conexiones automatizadas. Si intentamos evadir este bloqueo, estamos violando activamente sus medidas de seguridad. ¿Autorizás proceder con scraping pesado (headless) para estas dos, asumiendo el costo de infraestructura (proxies) y el posible baneo de IPs?
2. **Volumen de Mantenimiento:** Los 11 sitios de Nivel 2 van a requerir mantener 11 selectores CSS/HTML distintos. ¿Avanzamos con los 11 de una vez, o priorizamos los de mayor volumen de shows primero?
