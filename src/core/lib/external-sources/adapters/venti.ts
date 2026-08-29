import { ExternalSearchResponse, ExternalSourceAdapter } from '../types'

export const ventiAdapter: ExternalSourceAdapter = {
  id: 'venti',
  name: 'Venti',
  type: 'api',
  isConfigured: () => true,
  /**
   * Roto de verdad, confirmado en vivo (no un típico "el sitio está caído
   * momentáneamente"): venti.com.ar migró a venti.live y el JSON endpoint
   * `/api/event/` que este adapter llamaba ya no existe (404 permanente,
   * no transitorio). El sitio nuevo es un SPA renderizado 100% client-side
   * -un fetch de servidor a `venti.live/eventos` devuelve un shell de
   * ~3.8KB sin ningún dato de evento adentro, así que tampoco hay HTML para
   * scrapear con cheerio como hacen los demás adapters `type: 'scrape'`.
   *
   * La única forma real de sacar datos de ahí sería un browser headless
   * ejecutando el JS del sitio -infraestructura que no existe en este
   * repo hoy (el enum `type: 'headless'` en `../types` está anticipado
   * pero nada lo implementa todavía). Hacerle andar de nuevo es una
   * decisión de arquitectura aparte, no un fix de una línea, así que en
   * vez de seguir pegándole a una URL muerta todos los días en el cron,
   * esto devuelve el error explicado sin gastar el fetch.
   */
  search: async (): Promise<ExternalSearchResponse> => {
    return {
      events: [],
      total: 0,
      error: 'Venti migró a venti.live (SPA client-side); el API endpoint viejo ya no existe y el sitio nuevo necesita un browser headless para leer sus eventos -no implementado.',
    }
  },
}
