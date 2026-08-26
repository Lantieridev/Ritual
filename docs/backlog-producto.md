# Backlog de producto — ideas futuras

Ideas anotadas para revisar mucho después. No son compromisos ni tienen fecha.

## Mapa de recitales

Anotado 2026-08-25. Dos variantes posibles, sin decidir todavía cuál (o si las
dos):

- **Mapa personal**: los lugares a los que fuiste, marcados sobre un mapa.
  Tendría data ya disponible — `attendance` con `status = 'went'` más
  `venues.address`/`city`/`country` — pero ninguna venue tiene lat/lng
  guardada hoy (columnas `lat`/`lng` existen en `venues` pero no se llenan en
  ningún flujo de alta).
- **Mapa de próximos shows**: recitales agendados o disponibles, geolocalizados.
  Se apoyaría en las mismas coordenadas de venue, más los eventos futuros del
  catálogo.

No evaluado todavía: costo de un proveedor de mapas, si conviene geocodificar
las direcciones existentes o pedir lat/lng en el alta de venue de acá en más,
ni si esto es una pantalla nueva o un modo de vista dentro de `/coleccion`.

## Reliquias — entradas fijadas en el perfil

Ya estaba evaluada y pospuesta a propósito por el propio commit que reconstruyó
el perfil (`7568d676`, 2026-07-31): *"reliquias (pinned shows — needs a new
pinned column on attendance that doesn't exist)"*. Depende de la capa social
(issue #5), pausada con `attendance` privada por defecto hasta que esa capa se
diseñe. No se perdió código: nunca se construyó. Se deja anotada acá para que
no se re-litigue el motivo cada vez que se retome.

## Estado vacío de la Home para visitantes sin sesión

Anotado 2026-08-26. Un visitante anónimo ve el hero sin foto de fondo, porque
la imagen se deriva del próximo show o del último del archivo, y sin sesión no
hay ninguno de los dos. Darle una imagen requeriría consultar el catálogo
compartido, que es exactamente la lectura que se quitó para que la Home
anónima no le pegue a la base en cada visita.

Es un problema de diseño, no de datos: probablemente la respuesta sea una
portada estática o algo generado, no una query. Va junto con la pasada de
diseño inventariada en `docs/design-backlog.md`.

## Observabilidad del cron — ideas evaluadas y pospuestas

Anotado 2026-08-26, tras agregar `cron_runs` (historial persistido de cada
corrida de `sync-external-sources`, con `ok`, `adapters_failed` y
`failed_adapter_ids`). Tres ideas salieron de un debate con gpt-oss-120b y se
descartan por ahora, no por malas sino porque son integraciones nuevas con
costo de mantenimiento que nadie pidió todavía:

- **Notificación a Discord/Slack** cuando el cron falla del todo. Requiere un
  webhook y su secreto en variables de entorno; recién vale la pena si mirar
  `cron_runs` a mano deja de alcanzar.
- **Endpoint de salud (`/api/cron/status`)** para un monitor externo gratuito
  tipo UptimeRobot. Redundante hoy con leer `cron_runs` directo desde el
  dashboard de Supabase; sumaría una superficie de auth más floja que la del
  cron mismo.
- **TTL dinámico** en `external_events_cache` (extender más allá de 7 días si
  la corrida previa falló). Complejidad real por un margen que el TTL actual
  ya cubre para un cron que corre una vez por día en plan Hobby.

También se investigó si valía la pena sumar una fuente de respaldo para
Setlist.fm, Ticketmaster o Last.fm (señalado por un análisis previo de
Gemini). Se descartó: no hay alternativa gratuita conocida con calidad
comparable a Setlist.fm o Last.fm, y el scraping cron ya es respaldo práctico
(no total) de Ticketmaster. Ver el mensaje del commit `95a7c10` para el
detalle del debate.
