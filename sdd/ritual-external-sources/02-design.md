# Arquitectura para Fuentes Externas de Eventos

Este documento diseña la solución unificada para integrar las 17 nuevas tiqueteras regionales, manteniendo compatibilidad con Ticketmaster y Setlist.fm, mientras protege la experiencia del usuario de tiempos de espera largos y protege legalmente/técnicamente al proyecto de abusos de scraping.

## 1. El Patrón Adapter (Interfaz Compartida)

Para evitar que la UI o los servicios de dominio conozcan los detalles de cada tiquetera (API vs HTML vs Ticketmaster), se define una interfaz estricta que todas las fuentes deben respetar. Todos los resultados se normalizan hacia el tipo `FutureEvent` existente.

```typescript
export interface ExternalSearchRequest {
  keyword?: string; // Nombre del artista o evento
  city?: string;    // Filtro por ciudad (opcional)
}

export interface ExternalSearchResponse {
  events: FutureEvent[];
  total: number;
  error?: string; // Solo seteado si esta fuente falló, para no romper el total
}

export interface ExternalSourceAdapter {
  id: string;      // ej: 'alpogo', 'allaccess', 'ticketmaster'
  name: string;    // ej: 'Alpogo', 'All Access'
  type: 'api' | 'scrape' | 'headless';
  
  /** Devuelve false si faltan API keys u otras variables de entorno críticas */
  isConfigured: () => boolean;
  
  /** 
   * Método principal de búsqueda. Debe asegurar no lanzar excepciones no controladas 
   * y retornar resultados normalizados.
   */
  search: (query: ExternalSearchRequest) => Promise<ExternalSearchResponse>;
}
```

## 2. Aislamiento de Errores (Error Isolation)

Al buscar en tiempo real, si una tiquetera cae o tarda mucho, no podemos colgar la página `/buscar` completa. 

* **Timeout estricto:** El orquestador que llama a múltiples adaptadores envolverá cada `adapter.search()` en una promesa con límite de tiempo (ej. `5000ms`).
* **Degradación gracefully:** Se utilizará `Promise.allSettled()` (o similar) para esperar a todos los adaptadores. Si 3 fuentes fallan por timeout o cambian su HTML, la búsqueda devuelve los resultados de las otras 14 sin interrumpir al usuario. Se puede loguear el error silenciosamente (ej. Sentry o log interno).

## 3. Caché y Rate-Limiting (Protegiendo Tiqueteras y Usuarios)

Hacer web scraping a 15 sitios de forma sincrónica cada vez que un usuario escribe en el buscador es abusivo, lento (fácil 5 a 10 segundos de demora) y garantiza que Ritual sea baneado rápidamente (IP Block) por exceso de tráfico.

**Estrategia Propuesta: Scraping asincrónico (Cron Jobs)**

1. **Nueva tabla en Supabase `external_events_cache`**:
   ```sql
   CREATE TABLE external_events_cache (
     id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
     source_id text NOT NULL, -- ej: 'allaccess'
     dedup_key text NOT NULL, -- ej: 'duki-2024-12-15-caba'
     event_data jsonb NOT NULL, -- El objeto FutureEvent completo
     expires_at timestamptz NOT NULL,
     UNIQUE (source_id, dedup_key)
   );
   -- Índices GIN en event_data->>'title' para búsquedas rápidas.
   ```
2. **Workers / Cron Jobs:** En lugar de buscar on-demand, un proceso en background (Vercel Cron Job) corre 1 o 2 veces al día. Este proceso recorre los adaptadores y extrae la cartelera futura de los próximos 2 meses, respetando un rate limit prudente, e inserta todo en la tabla de caché.
3. **El buscador en la app:** La función global `searchExternalEvents()` ya no hace peticiones HTTP al mundo exterior. Solo hace una consulta SQL rápida a la tabla `external_events_cache` filtrando por el query del usuario. El resultado es instantáneo (milisegundos).

## 4. Dedup y Normalización

Como distintas tiqueteras (o la misma agenda) pueden listar el mismo show (ej. Ticketmaster y AllAccess vendiendo distintos sectores, o sitios de agenda duplicando info), se necesita una estrategia de deduplicación.

* **Dedup Key (Clave determinística):** Se generará una clave basada en: `slugify(artista_principal) + '-' + fecha(YYYY-MM-DD)`.
* **Fusión (Merge):** Al consultar la base (o durante el cron), si dos eventos tienen el mismo `Dedup Key`, se agrupan en la UI. En lugar de mostrar 2 tarjetas separadas, mostramos la tarjeta más completa y un badge indicando `"+1 fuente"`, o concatenamos las URLs de compra en un array `ticket_urls`.

## 5. Respetando Reglas (Scraping Responsable)

Para las fuentes de scraping, el diseño incorporará como principio básico:
1. **User-Agent Transparente:** Las peticiones desde el Cron usarán un header claro, ej. `RitualBot/1.0 (+https://ritual.app/bot)`.
2. **Crawl Delay:** Los scripts del Cron insertarán pausas de 1-2 segundos entre paginaciones del mismo sitio, evitando saturar sus servidores (que es la principal razón legal/técnica de baneo).
3. **No peticiones Live:** Como se diseñó en el punto 3, Ritual nunca delegará tráfico de usuarios reales (Live traffic) a las tiqueteras a través del servidor.

## 6. Plan de Rollout Incremental (Fases)

Para evitar un PR gigantesco e imposible de revisar, la implementación se divide según los niveles de factibilidad hallados en la investigación:

* **Fase 1 (Fundamentos y "Cheap APIs"):**
  * Crear la interfaz `ExternalSourceAdapter`.
  * Crear la tabla `external_events_cache` y el sistema de Cron.
  * Implementar las 3 fuentes más seguras: Alpogo, Venti y Quehacemos.
  * Refactorizar Ticketmaster para encajar en el nuevo modelo (si aplica).
* **Fase 2 ("Cheap Scrapes" de alto valor):**
  * Implementar adaptadores HTML (`cheerio`) para las 3-5 tiqueteras más grandes (ej. AllAccess, Livepass, Movistar Arena, Entradaweb).
  * Afinar la lógica de deduplicación con datos del mundo real.
* **Fase 3 ("Cheap Scrapes" de nicho):**
  * Sumar el resto de las tiqueteras de Nivel 2 (Konex, Pulsotickets, etc.).
* **Fase 4 (Las bloqueadas - Evaluación de riesgo):**
  * Definir con el dueño si vale la pena pagar infraestructura headless para Passline y Mientrada, asumiendo el riesgo técnico y de ToS, o descartarlas del roadmap.
