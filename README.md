# 🕯️ RITUAL

**Plataforma de gestión de itinerarios, giras y memoria para recitales. Open Source.**

> *"La procesión va por dentro... y en la app."*

Ritual es un proyecto de código abierto nacido para centralizar la experiencia de la música en vivo. No es solo una agenda, es la bitácora colectiva de nuestra vida musical.

**¿Por qué Open Source?**
Porque la música es cultura compartida. Queremos que RITUAL sea construido por la comunidad que lo usa: manijas, archivistas, desarrolladores y diseñadores que aman los recitales.

## ✨ Características (Features)

### 🗺️ La Procesión (Itinerario)
- **Buscador de Eventos**: Base de datos de recitales y festivales.
- **Agenda Personal**: Marcá los shows a los que vas a ir ("Voy").
- **Wishlist**: Seguí a tus artistas favoritos.

### 💰 La Ofrenda (Gastos)
- **Gestión de Gastos**: Registrá entradas, transporte y consumiciones.
- **División de Gastos**: (Próximamente) Repartí costos con amigos.

### 🏛️ El Santuario (Memoria)
- **Historial de Shows**: Registro automático de eventos pasados.
- **Portales**: Páginas ricas de Artistas, Festivales y Venues.

## 🤝 Cómo Contribuir

¡Toda ayuda es bienvenida! Ya sea reportando bugs, proponiendo ideas o tirando código.

1.  Revisá el [ROADMAP.md](./docs/ROADMAP.md) para ver qué falta hacer. Los issues marcados como "Good First Issue" o "Help Wanted" son ideales para empezar.
2.  Leé nuestra [Guía de Contribución](./CONTRIBUTING.md) (WIP) para conocer los estándares de código.
3.  Hacé un Fork y mandá tu Pull Request.

## 🛠 Stack Tecnológico

- **Frontend**: [Next.js 15](https://nextjs.org/) (App Router) + TypeScript.
- **Estilos**: [Tailwind CSS 4](https://tailwindcss.com/) + CSS Variables.
- **Backend**: [Supabase](https://supabase.com/) (PostgreSQL, Auth, Storage).
- **APIs Externas**: Last.fm, Spotify, Setlist.fm.

## 🚀 Instalación Local

Queremos que sea fácil levantar el proyecto.

1.  **Clonar el repositorio:**
    ```bash
    git clone https://github.com/Lantieridev/ritual.git
    cd ritual
    ```

2.  **Instalar dependencias:**
    ```bash
    npm install
    # o
    bun install
    ```

3.  **Configurar variables de entorno:**
    Copiá `.env.example` a `.env.local` y completá las credenciales (pedilas en Discord o usá tu propio proyecto Supabase gratuito).
    ```bash
    cp .env.example .env.local
    ```

4.  **Correr el entorno de desarrollo:**
    ```bash
    npm run dev
    ```
    Abrir [http://localhost:3000](http://localhost:3000).

## 📂 Estructura del Proyecto

- `app/`: Rutas y páginas (Next.js App Router).
- `src/core/`: Componentes base (UI), librerías (Supabase, API clients) y tipos globales.
- `src/domains/`: Lógica de negocio dividida por dominio (Artists, Events, Auth, Venues).
- `supabase/`: Migraciones y configuración de base de datos.
- `docs/`: Documentación del proyecto.

## 📜 Licencia

Distribuido bajo la licencia MIT. Ver `LICENSE` para más información.

---
*Construido con ❤️ por [Lantieridev](https://github.com/Lantieridev) y la comunidad.*