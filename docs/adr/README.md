# Architecture Decision Records

Registro de decisiones de arquitectura de RITUAL. Cada ADR documenta una decisión ya tomada, el contexto que la motivó y sus consecuencias — para que el equipo (y vos mismo en seis meses) no tenga que reconstruir el razonamiento desde cero.

| # | Título | Estado |
|---|---|---|
| [0001](./0001-domain-based-folder-structure.md) | Estructura de carpetas por dominio (`core/` vs `domains/`) | Aceptada |
| [0002](./0002-supabase-client-split-by-execution-context.md) | Cliente Supabase separado por contexto de ejecución (browser/server/middleware) | Aceptada |
| [0003](./0003-optional-external-api-keys-graceful-degradation.md) | Las API keys externas opcionales degradan sin romper el build | Aceptada |

## Cuándo agregar un ADR nuevo

Cuando se tome una decisión de arquitectura que no sea obvia leyendo el código: por qué se eligió una librería sobre otra, por qué una feature vive en `core/` y no en `domains/`, por qué se sacrificó algo a cambio de otra cosa. No hace falta un ADR para cada PR — solo para decisiones que alguien podría cuestionar o revertir sin este contexto.
