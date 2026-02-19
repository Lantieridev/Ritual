# Cómo contribuir a RITUAL

¡Gracias por interesarte en colaborar con RITUAL! Este es un proyecto open source impulsado por la comunidad.

## 📋 Pasos para contribuir

1.  **Encontrá un Issue**: Mirá en la pestaña de Issues de GitHub o en el [ROADMAP.md](./docs/ROADMAP.md).
    *   Si es tu primera vez, buscá etiquetas como `good first issue` o `help wanted`.
2.  **Hacé un Fork**: Creá tu propia copia del repositorio.
3.  **Creá una Rama (Branch)**:
    *   Usá un nombre descriptivo: `feature/nueva-funcionalidad` o `fix/bug-login`.
4.  **Codificá**:
    *   Seguí el estilo de código existente (TypeScript estricto, Tailwind CSS).
    *   Usá Server Components por defecto, `use client` solo cuando sea necesario (interactividad).
    *   Mantené el código limpio y comentado donde haga falta.
5.  **Probá**: Asegurate de que `npm run build` pase sin errores.
6.  **Pull Request**:
    *   Describí qué cambios hiciste y por qué.
    *   Adjuntá capturas de pantalla si cambiaste algo visual.

## 🏗 Estructura y Convenciones

### Estructura de Directorios
Adoptamos una estructura basada en **Dominios** dentro de `src/domains`. Cada dominio (ej: `artists`, `events`) debe contener:
- `components/`: Componentes UI específicos.
- `actions.ts`: Server Actions.
- `data.ts`: Fetching de datos.
- `types.ts`: Tipos específicos (si no están en `core/types`).

### Stack
- **Next.js 15**: Usamos App Router.
- **Supabase**: Base de datos y Auth. Respetamos RLS (Row Level Security).
- **Tailwind**: Para estilos. Evitamos CSS modules salvo excepciones.

## 💬 Comunidad

Si tenés dudas, abrí un Discussion en GitHub o contactanos.

---
¡Gracias por ser parte del Ritual! 🕯️
