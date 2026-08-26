# Ritual MCP Server para Auto-Moderación

Este servidor MCP le permite a Claude (o cualquier otra IA) administrar tu base de datos de Ritual, aprobando y fusionando artistas, sedes y eventos directamente desde el chat.

## Setup

1. Entrar a esta carpeta: `cd mcp`
2. Instalar dependencias: `npm install`
3. Copiar `.env.example` a `.env` y poner tus credenciales. 
   - **Nota de seguridad:** Se requiere un `ADMIN_EMAIL` y `ADMIN_PASSWORD` reales de un usuario que tenga el rol `admin` o `moderador` en la base de datos de Ritual. Si usas otra cuenta, el motor de base de datos rechazará las fusiones.
4. Compilar el servidor: `npm run build`

## Conectar a Claude Desktop

Abrí el archivo de configuración de Claude Desktop (en Windows suele estar en `%APPDATA%\Claude\claude_desktop_config.json`, en Mac en `~/Library/Application Support/Claude/claude_desktop_config.json`) y agregá el servidor:

```json
{
  "mcpServers": {
    "ritual-moderator": {
      "command": "node",
      "args": [
        "C:/Users/lantieri/code/personal/Ritual/mcp/dist/index.js"
      ],
      "env": {
        "SUPABASE_URL": "Tu url",
        "SUPABASE_ANON_KEY": "Tu key",
        "ADMIN_EMAIL": "...",
        "ADMIN_PASSWORD": "..."
      }
    }
  }
}
```
*Opcional: podés obviar el bloque `"env"` si ya tenés un archivo `.env` en la ruta absoluta y Node lo levanta, pero inyectar el env acá es más robusto.*

## Reiniciar Claude
Una vez guardado el JSON, reiniciá Claude Desktop y vas a ver el ícono del martillo de herramientas con `ritual-moderator`. Desde ahí vas a poder decirle:
- *"Revisá la cola de moderación"*
- *"Aprobá el artista tal"*
- *"Fusioná el artista 'Las Pastillas' (ID tal) hacia 'Las Pastillas del Abuelo' (ID original)"*
