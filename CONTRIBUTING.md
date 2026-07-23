# Cómo contribuir a RITUAL

¡Gracias por interesarte en colaborar con RITUAL! Este es un proyecto open source impulsado por la comunidad.

## 📋 Pasos para contribuir

1.  **Encontrá un Issue**: Mirá la [pestaña de Issues de GitHub](https://github.com/Lantieridev/Ritual/issues) — ahí vive todo el roadmap real del proyecto.
    *   Si es tu primera vez, buscá etiquetas como `good first issue` o `help wanted`.
2.  **Hacé un Fork**: Creá tu propia copia del repositorio.
3.  **Creá una Rama (Branch)**:
    *   Usá un nombre descriptivo: `feature/nueva-funcionalidad` o `fix/bug-login`.
4.  **Codificá**:
    *   Seguí el estilo de código existente (TypeScript estricto, Tailwind CSS).
    *   Usá Server Components por defecto, `use client` solo cuando sea necesario (interactividad).
    *   Los comentarios tienen que valerse por sí solos — explicá el POR QUÉ cuando no sea obvio, nunca dejes referencias a discusiones o sesiones internas que alguien de afuera no puede ver.
5.  **Probá antes de abrir el PR**:
    *   `npx tsc --noEmit` (tipos)
    *   `npx vitest run` (tests)
    *   `npx eslint app src --ext .ts,.tsx` (lint)
6.  **Pull Request**:
    *   Describí qué cambios hiciste y por qué.
    *   Adjuntá capturas de pantalla si cambiaste algo visual.

## 🏗 Estructura y Convenciones

### Estructura de Directorios
Adoptamos una estructura basada en **Dominios** dentro de `src/domains`. Cada dominio (ej: `artists`, `events`) debe contener:
- `components/`: Componentes UI específicos.
- `actions.ts`: Server Actions (ver nota de migración abajo).
- `data.ts`: Fetching de datos.
- `types.ts`: Tipos específicos (si no están en `core/types`).

### ⚠️ Migración en curso: Server Actions → GraphQL
El backend está migrando de Server Actions a una API GraphQL real (ver [issue de la migración](https://github.com/Lantieridev/Ritual/issues/23)) — es normal encontrar ambos patrones conviviendo en el código por ahora. **Si tu contribución necesita un endpoint de backend nuevo, agregalo en `src/graphql/`, no como una Server Action nueva** — evita sumar más deuda a lo que después hay que migrar.

### Stack
- **Next.js 16**: Usamos App Router.
- **Supabase**: Base de datos y Auth. Respetamos RLS (Row Level Security).
- **GraphQL** (GraphQL Yoga + Pothos): API real, reemplazando Server Actions de a poco.
- **Tailwind**: Para estilos. Evitamos CSS modules salvo excepciones.

## 💬 Comunidad

Si tenés dudas, abrí un Discussion en GitHub o contactanos.

---
¡Gracias por ser parte del Ritual! 🕯️
