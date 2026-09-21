import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const cors = {
  'Access-Control-Allow-Origin': Deno.env.get('APP_ORIGIN') ?? 'http://localhost:5173',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (request.method !== 'POST') return Response.json({ error: 'Método não permitido.' }, { status: 405, headers: cors });

  const url = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  if (!url || !anonKey) return Response.json({ error: 'Função não configurada.' }, { status: 500, headers: cors });

  const client = createClient(url, anonKey, {
    global: { headers: { Authorization: request.headers.get('Authorization') ?? '' } },
  });
  const { data: { user } } = await client.auth.getUser();
  if (!user) return Response.json({ error: 'Autenticação obrigatória.' }, { status: 401, headers: cors });

  const body = await request.json().catch(() => null) as { operation?: string; payload?: Record<string, unknown> } | null;
  if (!body?.operation || !body.payload) return Response.json({ error: 'Requisição inválida.' }, { status: 400, headers: cors });

  // A lista é deliberadamente pequena: apenas operações já fundamentadas pelas RPCs.
  if (body.operation === 'create_ppp_draft') {
    const { data, error } = await client.rpc('create_ppp_draft', body.payload);
    return Response.json(error ? { ok: false, error: error.message } : { ok: true, data }, { status: error ? 400 : 200, headers: cors });
  }
  if (body.operation === 'save_ppp_draft') {
    const { data, error } = await client.rpc('save_ppp_draft', body.payload);
    return Response.json(error ? { ok: false, error: error.message } : { ok: true, data }, { status: error ? 409 : 200, headers: cors });
  }
  return Response.json({ error: 'Operação ainda não implementada.' }, { status: 404, headers: cors });
});
