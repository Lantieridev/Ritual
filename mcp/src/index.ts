import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

if (!SUPABASE_URL || !SUPABASE_KEY || !ADMIN_EMAIL || !ADMIN_PASSWORD) {
  console.error("Missing SUPABASE_URL, SUPABASE_ANON_KEY, ADMIN_EMAIL, or ADMIN_PASSWORD in .env");
  process.exit(1);
}

// Inicializar cliente (se loguea como el Owner para pasar los chequeos de RLS y get_user_role)
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false }
});

type ModeratedTable = 'artists' | 'venues' | 'events';

interface SearchCatalogArgs { table: ModeratedTable; query: string }
interface ApproveEntityArgs { table: ModeratedTable; id: string }
interface MergeEntityArgs { table: ModeratedTable; sourceId: string; targetId: string }

/**
 * Neutraliza los comodines de LIKE del término de búsqueda. Sin esto un "%"
 * matchea el catálogo entero justo antes de que la IA elija un target de
 * fusión destructiva. Espeja escapeLikeWildcards de
 * src/domains/moderation/service.ts, que resuelve lo mismo del lado web.
 */
function escapeLikeWildcards(term: string): string {
  return term.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
}

const server = new Server(
  {
    name: 'ritual-moderation-mcp',
    version: '1.0.0',
  },
  {
    capabilities: { tools: {} },
  }
);

// Conectar con credenciales del Owner
async function ensureAuth() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    const { error } = await supabase.auth.signInWithPassword({
      email: ADMIN_EMAIL!,
      password: ADMIN_PASSWORD!
    });
    if (error) throw new Error(`Fallo de login MCP: ${error.message}`);
  }
}

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'get_unverified_queue',
        description: 'Obtiene todos los artistas, sedes y eventos que están pendientes de moderación (status = "unverified").',
        inputSchema: { type: 'object', properties: {} }
      },
      {
        name: 'search_catalog',
        description: 'Busca artistas, sedes o eventos verificados en el catálogo para encontrar el ID canónico antes de fusionar.',
        inputSchema: {
          type: 'object',
          properties: {
            table: { type: 'string', enum: ['artists', 'venues', 'events'], description: 'Tabla donde buscar' },
            query: { type: 'string', description: 'Nombre o término a buscar' }
          },
          required: ['table', 'query']
        }
      },
      {
        name: 'approve_entity',
        description: 'Aprueba una entidad pendiente, marcándola como verified.',
        inputSchema: {
          type: 'object',
          properties: {
            table: { type: 'string', enum: ['artists', 'venues', 'events'] },
            id: { type: 'string', description: 'UUID de la entidad' }
          },
          required: ['table', 'id']
        }
      },
      {
        name: 'merge_entity',
        description: 'Fusiona una entidad duplicada/pendiente hacia una entidad canónica verificada. Destruye el origen.',
        inputSchema: {
          type: 'object',
          properties: {
            table: { type: 'string', enum: ['artists', 'venues', 'events'] },
            sourceId: { type: 'string', description: 'UUID de la entidad basura/duplicada a destruir' },
            targetId: { type: 'string', description: 'UUID de la entidad original a mantener' }
          },
          required: ['table', 'sourceId', 'targetId']
        }
      }
    ]
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  await ensureAuth();
  
  if (request.params.name === 'get_unverified_queue') {
    const [artists, venues, events] = await Promise.all([
      supabase.from('artists').select('id, name, genre').eq('status', 'unverified'),
      supabase.from('venues').select('id, name, city, address').eq('status', 'unverified'),
      supabase.from('events').select('id, name, date, venues(name)').eq('status', 'unverified')
    ]);
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          pendingArtists: artists.data,
          pendingVenues: venues.data,
          pendingEvents: events.data
        }, null, 2)
      }]
    };
  }

  if (request.params.name === 'search_catalog') {
    const { table, query } = request.params.arguments as unknown as SearchCatalogArgs;
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .eq('status', 'verified')
      .ilike('name', `%${escapeLikeWildcards(query)}%`)
      .limit(5);
    if (error) return { content: [{ type: 'text', text: `Error: ${error.message}` }], isError: true };
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  }

  if (request.params.name === 'approve_entity') {
    const { table, id } = request.params.arguments as unknown as ApproveEntityArgs;
    // Pasa por el RPC y no por un UPDATE directo. `artists` y `venues` no
    // tienen policy de UPDATE, así que RLS denegaba, PostgREST devolvía 0
    // filas con error null, y este tool respondía "Éxito" sin haber cambiado
    // nada. El RPC valida el rol adentro y falla ruidosamente si no alcanza.
    const { error } = await supabase.rpc('approve_entity', { entity_type: table, entity_id: id });
    if (error) return { content: [{ type: 'text', text: `Error: ${error.message}` }], isError: true };
    return { content: [{ type: 'text', text: `Éxito: ${table} ${id} aprobado.` }] };
  }

  if (request.params.name === 'merge_entity') {
    const { table, sourceId, targetId } = request.params.arguments as unknown as MergeEntityArgs;
    const rpcName = `merge_${table}`;
    const { error } = await supabase.rpc(rpcName, { source_id: sourceId, target_id: targetId });
    if (error) return { content: [{ type: 'text', text: `Error en RPC ${rpcName}: ${error.message}` }], isError: true };
    return { content: [{ type: 'text', text: `Éxito: ${sourceId} fusionado hacia ${targetId}.` }] };
  }

  throw new Error('Tool not found');
});

async function run() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Ritual MCP Moderation Server running on stdio');
}

run().catch(console.error);
