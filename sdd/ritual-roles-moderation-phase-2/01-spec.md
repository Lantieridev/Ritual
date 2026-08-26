# Especificación: Fase 2 - Cola de Moderación & MCP Automático

## Objetivo
Permitir que la base de datos de Ritual (catálogo colaborativo) escale sin perder calidad, mediante un sistema de "post-moderación" y fusión (merge) de duplicados, operable tanto por humanos (vía web) como por IA (vía MCP).

## Decisiones Arquitectónicas (Grill-me)

1. **Límites de Roles**: 
   - **Admin (Owner)**: Acceso total, métricas, roles, y uso exclusivo del servidor MCP para moderación automática por IA.
   - **Moderador**: Operador de catálogo humano, usa una UI web para aprobar o limpiar datos.
2. **Modelo Post-Moderación (Soft-Publish)**:
   - Para no matar la retención, lo que crea el usuario se publica al instante, pero nace con un estado `unverified`.
   - La cola de moderación es simplemente un listado de todas las entidades `unverified`.
3. **El superpoder es el Merge**:
   - En lugar de simplemente borrar duplicados y dejar a usuarios huérfanos de su historial, la herramienta core es el **Merge (Fusión)**. Mueve asociaciones (attendance, lineups) al registro canónico y elimina el duplicado.
4. **Scope de Entidades**:
   - Aplica a: `events`, `artists`, `venues`.
   - **Festivales excluidos**: Por su complejidad (multi-día, multi-escenario), quedan restringidos a creación exclusiva por Admins (top-down).
5. **Doble Cliente**:
   - **Next.js UI**: Pantallas en `/admin/moderation` para los moderadores humanos.
   - **MCP Server**: Un servidor Node/TypeScript independiente en el repo para que la IA asista al Owner, con herramientas como `get_unverified_queue`, `approve_entity`, `merge_entities`.

## Casos de Uso
- Un usuario agrega un show under. Un moderador humano entra al `/admin/moderation`, verifica que está bien escrito, y le da "Aprobar" (pasa a `verified`).
- Un usuario agrega "Radiohead" pero ya existía "Radiohead UK". El Owner usa Claude (vía MCP) para pedirle: "Revisá los artistas pendientes". La IA detecta el duplicado, llama a la herramienta MCP `merge_artists` y unifica ambos sin romper el historial del usuario.
